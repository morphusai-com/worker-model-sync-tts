import crypto from 'crypto';
import fs from 'fs-extra';
import logger from './logger';

export class FileValidator {
  /**
   * 檢查檔案是否為模型檔案
   */
  static isModelFile(key: string): boolean {
    const modelExtensions = [
      '.pth', '.bin', '.onnx', '.safetensors', '.pkl',
      '.json', '.txt'  // 新增配置檔案支援
    ];
    const lowerKey = key.toLowerCase();
    return modelExtensions.some(ext => lowerKey.endsWith(ext));
  }

  /**
   * 計算檔案的 SHA256 雜湊值
   */
  static async calculateSHA256(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath);
      
      stream.on('error', reject);
      stream.on('data', chunk => hash.update(chunk));
      stream.on('end', () => resolve(hash.digest('hex')));
    });
  }

  /**
   * 驗證下載檔案的完整性
   */
  static async verifyFileIntegrity(
    filePath: string, 
    expectedSize?: number, 
    expectedHash?: string
  ): Promise<boolean> {
    try {
      const stats = await fs.stat(filePath);
      
      // 檢查檔案大小
      if (expectedSize && stats.size !== expectedSize) {
        logger.warn(`File size mismatch: expected ${expectedSize}, got ${stats.size}`, {
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
          logger.warn(`File hash mismatch: expected ${expectedHash}, got ${actualHash}`, {
            filePath,
            expectedHash,
            actualHash
          });
          return false;
        }
      }

      logger.info(`File integrity verified successfully`, { filePath });
      return true;
    } catch (error) {
      logger.error(`Error verifying file integrity: ${error}`, { filePath, error });
      return false;
    }
  }

  /**
   * 檢查磁碟空間是否足夠
   */
  static async checkDiskSpace(targetPath: string): Promise<boolean> {
    try {
      // 使用 fs.stat 來檢查檔案系統，簡化實作
      await fs.access(targetPath);
      // 暫時返回 true，實際應用中可以使用 statvfs 或其他方法
      return true;
    } catch (error) {
      logger.error(`Error checking disk space: ${error}`, { targetPath, error });
      return false;
    }
  }

  /**
   * 清理暫存檔案
   */
  static async cleanupTempFile(filePath: string): Promise<void> {
    try {
      if (await fs.pathExists(filePath)) {
        await fs.remove(filePath);
        logger.debug(`Cleaned up temp file: ${filePath}`);
      }
    } catch (error) {
      logger.warn(`Failed to cleanup temp file: ${error}`, { filePath, error });
    }
  }
}