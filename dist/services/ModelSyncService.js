"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ModelSyncService = void 0;
const client_sqs_1 = require("@aws-sdk/client-sqs");
const S3Service_1 = require("./S3Service");
const HealthCheckService_1 = require("./HealthCheckService");
const fileValidator_1 = require("../utils/fileValidator");
const logger_1 = __importDefault(require("../utils/logger"));
class ModelSyncService {
    constructor() {
        this.isRunning = false;
        this.sqsClient = new client_sqs_1.SQSClient({
            region: process.env.AWS_REGION || 'us-west-2',
            credentials: {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
            }
        });
        this.s3Service = new S3Service_1.S3Service();
        this.healthService = new HealthCheckService_1.HealthCheckService();
        this.updateQueueUrl = process.env.SQS_UPDATE_QUEUE_URL || '';
        this.notificationQueueUrl = process.env.SQS_NOTIFICATION_QUEUE_URL || '';
        this.modelsBasePath = process.env.MODELS_BASE_PATH || '/models';
        if (!this.updateQueueUrl || !this.notificationQueueUrl) {
            throw new Error('SQS queue URLs are required');
        }
    }
    /**
     * 啟動模型同步服務
     */
    async start() {
        logger_1.default.info('🚀 Model Sync Service starting...');
        this.isRunning = true;
        // 啟動健康檢查服務
        this.healthService.start();
        // 主要處理循環
        while (this.isRunning) {
            try {
                await this.processMessages();
                await this.sleep(5000); // 5秒間隔
            }
            catch (error) {
                logger_1.default.error(`Error in main processing loop: ${error.message}`, { error });
                await this.sleep(10000); // 錯誤時等待更久
            }
        }
    }
    /**
     * 停止服務
     */
    async stop() {
        logger_1.default.info('🛑 Model Sync Service stopping...');
        this.isRunning = false;
    }
    /**
     * 處理 SQS 訊息
     */
    async processMessages() {
        const command = new client_sqs_1.ReceiveMessageCommand({
            QueueUrl: this.updateQueueUrl,
            MaxNumberOfMessages: 10,
            WaitTimeSeconds: 20, // 長輪詢
            VisibilityTimeout: 300 // 5分鐘處理時間
        });
        try {
            const result = await this.sqsClient.send(command);
            if (result.Messages && result.Messages.length > 0) {
                logger_1.default.info(`Received ${result.Messages.length} messages from SQS`);
                for (const message of result.Messages) {
                    try {
                        await this.handleMessage(message);
                        // 成功處理後刪除訊息
                        await this.deleteMessage(message);
                        // 更新健康檢查時間
                        this.healthService.updateLastProcessed();
                    }
                    catch (error) {
                        logger_1.default.error(`Error processing message: ${error.message}`, {
                            messageId: message.MessageId,
                            error
                        });
                        // 訊息會在 visibility timeout 後重新出現，實現自動重試
                    }
                }
            }
        }
        catch (error) {
            logger_1.default.error(`Error receiving messages from SQS: ${error.message}`, { error });
        }
    }
    /**
     * 處理單個 SQS 訊息
     */
    async handleMessage(message) {
        try {
            // 解析 S3 事件
            const s3Event = JSON.parse(message.Body);
            if (!s3Event.Records || !Array.isArray(s3Event.Records)) {
                logger_1.default.warn('Invalid S3 event format, skipping', { messageId: message.MessageId });
                return;
            }
            for (const record of s3Event.Records) {
                await this.handleS3Event(record);
            }
        }
        catch (error) {
            logger_1.default.error(`Error parsing SQS message: ${error.message}`, {
                messageId: message.MessageId,
                error
            });
            throw error;
        }
    }
    /**
     * 處理 S3 事件記錄
     */
    async handleS3Event(record) {
        // const bucketName = record.s3.bucket.name;
        const key = record.s3.object.key;
        const eventName = record.eventName;
        logger_1.default.info(`Processing S3 event: ${eventName} for ${key}`);
        // 過濾模型檔案
        if (!fileValidator_1.FileValidator.isModelFile(key)) {
            logger_1.default.debug(`Skipping non-model file: ${key}`);
            return;
        }
        // 解析模型事件
        const modelEvent = this.parseModelEvent(record);
        if (!modelEvent) {
            logger_1.default.warn(`Failed to parse model event for: ${key}`);
            return;
        }
        // 處理不同的事件類型
        if (eventName.startsWith('s3:ObjectCreated') || eventName.startsWith('s3:ObjectModified')) {
            await this.handleModelUpdate(modelEvent);
        }
        else if (eventName.startsWith('s3:ObjectRemoved')) {
            await this.handleModelDeletion(modelEvent);
        }
        else {
            logger_1.default.debug(`Unsupported event type: ${eventName}`);
        }
    }
    /**
     * 處理模型更新
     */
    async handleModelUpdate(event) {
        try {
            logger_1.default.info(`🔄 Processing model update: ${event.key}`);
            // 生成本地檔案路徑
            const localPath = this.getLocalModelPath(event.key);
            // 檢查是否需要更新
            const shouldUpdate = await this.s3Service.shouldUpdateFile(event.key, localPath);
            if (!shouldUpdate) {
                logger_1.default.info(`Model is already up to date: ${event.key}`);
                return;
            }
            // 下載模型檔案
            const downloadResult = await this.s3Service.downloadFile(event.key, localPath);
            if (downloadResult.success) {
                logger_1.default.info(`✅ Model updated successfully: ${event.key}`);
                // 發送通知給應用 Pods
                await this.notifyApplications({
                    type: 'model_updated',
                    path: event.key,
                    localPath,
                    size: downloadResult.size,
                    timestamp: new Date().toISOString(),
                    downloadDuration: downloadResult.duration
                });
            }
            else {
                throw new Error('Model download failed');
            }
        }
        catch (error) {
            logger_1.default.error(`Failed to update model: ${error.message}`, {
                key: event.key,
                error
            });
            throw error;
        }
    }
    /**
     * 處理模型刪除
     */
    async handleModelDeletion(event) {
        try {
            logger_1.default.info(`🗑️ Processing model deletion: ${event.key}`);
            const localPath = this.getLocalModelPath(event.key);
            // 刪除本地檔案 (如果存在)
            await fileValidator_1.FileValidator.cleanupTempFile(localPath);
            logger_1.default.info(`✅ Model deleted successfully: ${event.key}`);
        }
        catch (error) {
            logger_1.default.error(`Failed to delete model: ${error.message}`, {
                key: event.key,
                error
            });
            throw error;
        }
    }
    /**
     * 解析模型事件
     */
    parseModelEvent(record) {
        try {
            const key = record.s3.object.key;
            const pathParts = key.split('/');
            if (pathParts.length < 2) {
                return null;
            }
            const category = pathParts[0];
            const modelType = pathParts[1];
            return {
                type: record.eventName.startsWith('s3:ObjectRemoved') ? 'model_deleted' : 'model_updated',
                bucket: record.s3.bucket.name,
                key: key,
                size: record.s3.object.size,
                timestamp: record.eventTime,
                category,
                modelType
            };
        }
        catch (error) {
            logger_1.default.error('Error parsing model event', { record, error });
            return null;
        }
    }
    /**
     * 生成本地模型檔案路徑
     */
    getLocalModelPath(s3Key) {
        return `${this.modelsBasePath}/${s3Key}`;
    }
    /**
     * 通知應用 Pods
     */
    async notifyApplications(notification) {
        try {
            const command = new client_sqs_1.SendMessageCommand({
                QueueUrl: this.notificationQueueUrl,
                MessageBody: JSON.stringify(notification),
                MessageAttributes: {
                    'ModelType': {
                        DataType: 'String',
                        StringValue: notification.path.split('/')[1] || 'unknown'
                    },
                    'Category': {
                        DataType: 'String',
                        StringValue: notification.path.split('/')[0] || 'unknown'
                    }
                }
            });
            await this.sqsClient.send(command);
            logger_1.default.info(`📢 Notification sent to applications`, {
                path: notification.path,
                type: notification.type
            });
        }
        catch (error) {
            logger_1.default.error(`Failed to notify applications: ${error.message}`, {
                notification,
                error
            });
            throw error;
        }
    }
    /**
     * 刪除 SQS 訊息
     */
    async deleteMessage(message) {
        try {
            const command = new client_sqs_1.DeleteMessageCommand({
                QueueUrl: this.updateQueueUrl,
                ReceiptHandle: message.ReceiptHandle
            });
            await this.sqsClient.send(command);
        }
        catch (error) {
            logger_1.default.error(`Failed to delete SQS message: ${error.message}`, {
                messageId: message.MessageId,
                error
            });
        }
    }
    /**
     * 延遲執行
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
exports.ModelSyncService = ModelSyncService;
//# sourceMappingURL=ModelSyncService.js.map