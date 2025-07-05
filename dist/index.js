"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const ModelSyncService_1 = require("./services/ModelSyncService");
const logger_1 = __importDefault(require("./utils/logger"));
// 處理未捕獲的異常
process.on('uncaughtException', (error) => {
    logger_1.default.error('Uncaught Exception:', error);
    process.exit(1);
});
process.on('unhandledRejection', (reason, promise) => {
    logger_1.default.error('Unhandled Rejection at:', { promise, reason });
    process.exit(1);
});
// 優雅關閉處理
let syncService = null;
process.on('SIGTERM', async () => {
    logger_1.default.info('Received SIGTERM, shutting down gracefully...');
    if (syncService) {
        await syncService.stop();
    }
    process.exit(0);
});
process.on('SIGINT', async () => {
    logger_1.default.info('Received SIGINT, shutting down gracefully...');
    if (syncService) {
        await syncService.stop();
    }
    process.exit(0);
});
// 主函數
async function main() {
    try {
        logger_1.default.info('🚀 Starting Worker Model Sync TTS Service...');
        // 檢查必要的環境變數
        const requiredEnvVars = [
            'AWS_ACCESS_KEY_ID',
            'AWS_SECRET_ACCESS_KEY',
            'AWS_REGION',
            'S3_BUCKET_NAME',
            'SQS_UPDATE_QUEUE_URL'
        ];
        const missingEnvVars = requiredEnvVars.filter(env => !process.env[env]);
        if (missingEnvVars.length > 0) {
            throw new Error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
        }
        // 記錄配置信息
        logger_1.default.info('Configuration:', {
            awsRegion: process.env.AWS_REGION,
            s3Bucket: process.env.S3_BUCKET_NAME,
            modelsPath: process.env.MODELS_BASE_PATH || '/models',
            logLevel: process.env.LOG_LEVEL || 'info',
            nodeEnv: process.env.NODE_ENV || 'development'
        });
        // 建立並啟動同步服務
        syncService = new ModelSyncService_1.ModelSyncService();
        await syncService.start();
    }
    catch (error) {
        logger_1.default.error(`Failed to start Model Sync Service: ${error.message}`, { error });
        process.exit(1);
    }
}
// 啟動應用
main().catch((error) => {
    logger_1.default.error('Fatal error in main function:', error);
    process.exit(1);
});
//# sourceMappingURL=index.js.map