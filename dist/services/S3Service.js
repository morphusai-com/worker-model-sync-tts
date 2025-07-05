"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.S3Service = void 0;
const client_s3_1 = require("@aws-sdk/client-s3");
const fs_extra_1 = __importDefault(require("fs-extra"));
const promises_1 = require("stream/promises");
const logger_1 = __importDefault(require("../utils/logger"));
const fileValidator_1 = require("../utils/fileValidator");
class S3Service {
    constructor() {
        this.s3Client = new client_s3_1.S3Client({
            region: process.env.AWS_REGION || 'us-west-2',
            credentials: {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
            }
        });
        this.bucketName = process.env.S3_BUCKET_NAME || 'gamania-voice-models';
    }
    /**
     * 檢查 S3 物件是否存在並獲取資訊
     */
    async getObjectInfo(key) {
        try {
            const command = new client_s3_1.HeadObjectCommand({
                Bucket: this.bucketName,
                Key: key
            });
            const response = await this.s3Client.send(command);
            return {
                size: response.ContentLength || 0,
                lastModified: response.LastModified || new Date(),
                etag: response.ETag ? response.ETag.replace(/"/g, '') : ''
            };
        }
        catch (error) {
            if (error.name === 'NotFound') {
                return null;
            }
            logger_1.default.error(`Error getting S3 object info: ${error.message}`, { key, error });
            throw error;
        }
    }
    /**
     * 從 S3 下載檔案到本地
     */
    async downloadFile(s3Key, localPath) {
        const startTime = Date.now();
        let downloadedSize = 0;
        try {
            logger_1.default.info(`Starting download from S3: ${s3Key} -> ${localPath}`);
            // 檢查 S3 物件資訊
            const objectInfo = await this.getObjectInfo(s3Key);
            if (!objectInfo) {
                throw new Error(`S3 object not found: ${s3Key}`);
            }
            // 檢查本地磁碟空間
            const targetDir = require('path').dirname(localPath);
            await fs_extra_1.default.ensureDir(targetDir);
            const hasSpace = await fileValidator_1.FileValidator.checkDiskSpace(targetDir);
            if (!hasSpace) {
                throw new Error(`Insufficient disk space for download: ${objectInfo.size} bytes required`);
            }
            // 下載檔案
            const command = new client_s3_1.GetObjectCommand({
                Bucket: this.bucketName,
                Key: s3Key
            });
            const response = await this.s3Client.send(command);
            if (!response.Body) {
                throw new Error('Empty response body from S3');
            }
            // 建立暫存檔案路徑
            const tempPath = `${localPath}.tmp`;
            try {
                // 使用 pipeline 進行流式下載
                const writeStream = fs_extra_1.default.createWriteStream(tempPath);
                // 監控下載進度
                const bodyStream = response.Body;
                bodyStream.on('data', (chunk) => {
                    downloadedSize += chunk.length;
                    const progress = (downloadedSize / objectInfo.size * 100).toFixed(1);
                    if (downloadedSize % (10 * 1024 * 1024) === 0) { // 每 10MB 記錄一次
                        logger_1.default.debug(`Download progress: ${progress}% (${downloadedSize}/${objectInfo.size})`, { s3Key });
                    }
                });
                await (0, promises_1.pipeline)(bodyStream, writeStream);
                // 驗證下載檔案
                const isValid = await fileValidator_1.FileValidator.verifyFileIntegrity(tempPath, objectInfo.size);
                if (!isValid) {
                    await fileValidator_1.FileValidator.cleanupTempFile(tempPath);
                    throw new Error('Downloaded file failed integrity check');
                }
                // 原子性移動檔案 (重命名)
                await fs_extra_1.default.move(tempPath, localPath, { overwrite: true });
                const duration = Date.now() - startTime;
                const speedMBps = (downloadedSize / 1024 / 1024) / (duration / 1000);
                logger_1.default.info(`Successfully downloaded file from S3`, {
                    s3Key,
                    localPath,
                    size: downloadedSize,
                    duration,
                    speedMBps: speedMBps.toFixed(2)
                });
                return {
                    success: true,
                    size: downloadedSize,
                    duration
                };
            }
            catch (error) {
                // 清理暫存檔案
                await fileValidator_1.FileValidator.cleanupTempFile(tempPath);
                throw error;
            }
        }
        catch (error) {
            const duration = Date.now() - startTime;
            logger_1.default.error(`Failed to download file from S3: ${error.message}`, {
                s3Key,
                localPath,
                downloadedSize,
                duration,
                error: error.message
            });
            return {
                success: false,
                size: downloadedSize,
                duration
            };
        }
    }
    /**
     * 檢查檔案是否需要更新
     */
    async shouldUpdateFile(s3Key, localPath) {
        try {
            // 檢查本地檔案是否存在
            if (!(await fs_extra_1.default.pathExists(localPath))) {
                logger_1.default.debug(`Local file does not exist, update needed: ${localPath}`);
                return true;
            }
            // 獲取 S3 物件資訊
            const s3Info = await this.getObjectInfo(s3Key);
            if (!s3Info) {
                logger_1.default.warn(`S3 object not found: ${s3Key}`);
                return false;
            }
            // 檢查本地檔案資訊
            const localStats = await fs_extra_1.default.stat(localPath);
            // 比較檔案大小
            if (localStats.size !== s3Info.size) {
                logger_1.default.debug(`File size differs, update needed`, {
                    s3Key,
                    s3Size: s3Info.size,
                    localSize: localStats.size
                });
                return true;
            }
            // 比較修改時間
            if (s3Info.lastModified > localStats.mtime) {
                logger_1.default.debug(`S3 file is newer, update needed`, {
                    s3Key,
                    s3Modified: s3Info.lastModified,
                    localModified: localStats.mtime
                });
                return true;
            }
            logger_1.default.debug(`File is up to date: ${localPath}`);
            return false;
        }
        catch (error) {
            logger_1.default.error(`Error checking if file should update: ${error.message}`, { s3Key, localPath, error });
            return true; // 錯誤時選擇更新
        }
    }
}
exports.S3Service = S3Service;
//# sourceMappingURL=S3Service.js.map