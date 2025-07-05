import logger from '../utils/logger';

export class HealthCheckService {
  private lastProcessedTime: Date | null = null;
  private startTime: Date;
  private isHealthy: boolean = true;

  constructor() {
    this.startTime = new Date();
  }

  /**
   * 獲取健康狀態資訊
   */
  getHealth(): {
    status: string;
    uptime: number;
    timestamp: string;
    memory: NodeJS.MemoryUsage;
    lastProcessed: string | null;
    timeSinceLastProcess: number | null;
  } {
    const healthData = {
      status: this.isHealthy ? 'healthy' : 'unhealthy',
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      memory: process.memoryUsage(),
      lastProcessed: this.lastProcessedTime ? this.lastProcessedTime.toISOString() : null,
      timeSinceLastProcess: this.lastProcessedTime 
        ? Date.now() - this.lastProcessedTime.getTime() 
        : null
    };

    // 如果超過 10 分鐘沒有處理訊息，標記為不健康
    const maxIdleTime = 10 * 60 * 1000; // 10 分鐘
    if (this.lastProcessedTime && Date.now() - this.lastProcessedTime.getTime() > maxIdleTime) {
      this.isHealthy = false;
      healthData.status = 'unhealthy';
    }

    return healthData;
  }

  /**
   * 獲取詳細指標
   */
  getMetrics(): {
    timestamp: string;
    uptime: number;
    memory: NodeJS.MemoryUsage;
    cpu: NodeJS.CpuUsage;
    lastProcessed: string | null;
    processCount: number;
    healthStatus: string;
    version: string;
    nodeVersion: string;
    platform: string;
    arch: string;
  } {
    return {
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      lastProcessed: this.lastProcessedTime ? this.lastProcessedTime.toISOString() : null,
      processCount: this.getProcessCount(),
      healthStatus: this.isHealthy ? 'healthy' : 'unhealthy',
      version: process.env.npm_package_version || '1.0.0',
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch
    };
  }

  /**
   * 檢查是否準備就緒
   */
  isReady(): { ready: boolean; missingEnvVars?: string[] } {
    const requiredEnvVars = [
      'AWS_ACCESS_KEY_ID',
      'AWS_SECRET_ACCESS_KEY',
      'AWS_REGION',
      'S3_BUCKET_NAME',
      'SQS_UPDATE_QUEUE_URL'
    ];

    const missingEnvVars = requiredEnvVars.filter(env => !process.env[env]);

    return {
      ready: missingEnvVars.length === 0,
      missingEnvVars: missingEnvVars.length > 0 ? missingEnvVars : undefined
    };
  }

  /**
   * 啟動健康檢查服務
   */
  start(): void {
    logger.info('🏥 Health check service initialized');
  }

  /**
   * 更新最後處理時間
   */
  updateLastProcessed(): void {
    this.lastProcessedTime = new Date();
    this.isHealthy = true; // 成功處理訊息時恢復健康狀態
  }

  /**
   * 設定健康狀態
   */
  setHealthy(healthy: boolean): void {
    this.isHealthy = healthy;
  }

  /**
   * 獲取處理計數 (簡單實作)
   */
  private getProcessCount(): number {
    // 這裡可以實作更複雜的計數邏輯
    return this.lastProcessedTime ? 1 : 0;
  }
}