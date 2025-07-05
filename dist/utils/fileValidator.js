"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileValidator = void 0;
const crypto_1 = __importDefault(require("crypto"));
const fs_extra_1 = __importDefault(require("fs-extra"));
const logger_1 = __importDefault(require("./logger"));
class FileValidator {
    /**
     * 檢查檔案是否為模型檔案
     */
    static isModelFile(key) {
        const modelExtensions = ['.pth', '.bin', '.onnx', '.safetensors', '.pkl'];
        const lowerKey = key.toLowerCase();
        return modelExtensions.some(ext => lowerKey.endsWith(ext));
    }
    /**
     * 計算檔案的 SHA256 雜湊值
     */
    static async calculateSHA256(filePath) {
        return new Promise((resolve, reject) => {
            const hash = crypto_1.default.createHash('sha256');
            const stream = fs_extra_1.default.createReadStream(filePath);
            stream.on('error', reject);
            stream.on('data', chunk => hash.update(chunk));
            stream.on('end', () => resolve(hash.digest('hex')));
        });
    }
    /**
     * 驗證下載檔案的完整性
     */
    static async verifyFileIntegrity(filePath, expectedSize, expectedHash) {
        try {
            const stats = await fs_extra_1.default.stat(filePath);
            // 檢查檔案大小
            if (expectedSize && stats.size !== expectedSize) {
                logger_1.default.warn(`File size mismatch: expected ${expectedSize}, got ${stats.size}`, {
                    filePath,
                    expectedSize,
                    actualSize: stats.size
                });
                return false;
            }
            // 檢查雜湊值
            if (expectedHash) {
                const actualHash = await this.calculateSHA256(filePath);
                if (actualHash !== expectedHash) {
                    logger_1.default.warn(`File hash mismatch: expected ${expectedHash}, got ${actualHash}`, {
                        filePath,
                        expectedHash,
                        actualHash
                    });
                    return false;
                }
            }
            logger_1.default.info(`File integrity verified successfully`, { filePath });
            return true;
        }
        catch (error) {
            logger_1.default.error(`Error verifying file integrity: ${error}`, { filePath, error });
            return false;
        }
    }
    /**
     * 檢查磁碟空間是否足夠
     */
    static async checkDiskSpace(targetPath) {
        try {
            // 使用 fs.stat 來檢查檔案系統，簡化實作
            await fs_extra_1.default.access(targetPath);
            // 暫時返回 true，實際應用中可以使用 statvfs 或其他方法
            return true;
        }
        catch (error) {
            logger_1.default.error(`Error checking disk space: ${error}`, { targetPath, error });
            return false;
        }
    }
    /**
     * 清理暫存檔案
     */
    static async cleanupTempFile(filePath) {
        try {
            if (await fs_extra_1.default.pathExists(filePath)) {
                await fs_extra_1.default.remove(filePath);
                logger_1.default.debug(`Cleaned up temp file: ${filePath}`);
            }
        }
        catch (error) {
            logger_1.default.warn(`Failed to cleanup temp file: ${error}`, { filePath, error });
        }
    }
}
exports.FileValidator = FileValidator;
//# sourceMappingURL=fileValidator.js.map