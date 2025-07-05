import { ModelSyncService } from './services/ModelSyncService';
import { ApiService } from './services/ApiService';
import { HealthCheckService } from './services/HealthCheckService';
import logger from './utils/logger';

// 處理未捕獲的異常
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', { promise, reason });
  process.exit(1);
});

// 優雅關閉處理
let syncService: ModelSyncService | null = null;
let apiService: ApiService | null = null;

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, shutting down gracefully...');
  if (apiService) {
    await apiService.stop();
  }
  if (syncService) {
    await syncService.stop();
  }
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('Received SIGINT, shutting down gracefully...');
  if (apiService) {
    await apiService.stop();
  }
  if (syncService) {
    await syncService.stop();
  }
  process.exit(0);
});

// 主函數
async function main() {
  try {
    logger.info('🚀 Starting Worker Model Sync TTS Service...');
    
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
    logger.info('Configuration:', {
      awsRegion: process.env.AWS_REGION,
      s3Bucket: process.env.S3_BUCKET_NAME,
      modelsPath: process.env.MODELS_BASE_PATH || '/models',
      logLevel: process.env.LOG_LEVEL || 'info',
      nodeEnv: process.env.NODE_ENV || 'development'
    });

    // 建立並啟動同步服務
    syncService = new ModelSyncService();
    
    // 建立並啟動 API 服務
    const healthService = new HealthCheckService();
    apiService = new ApiService(syncService, healthService);
    
    // 同時啟動兩個服務
    await Promise.all([
      syncService.start(),
      apiService.start()
    ]);

  } catch (error) {
    logger.error(`Failed to start Model Sync Service: ${error.message}`, { error });
    process.exit(1);
  }
}

// 啟動應用
main().catch((error) => {
  logger.error('Fatal error in main function:', error);
  process.exit(1);
});