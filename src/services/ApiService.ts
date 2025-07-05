import express from 'express';
import { Server } from 'http';
import { ModelSyncService } from './ModelSyncService';
import { HealthCheckService } from './HealthCheckService';
import logger from '../utils/logger';

export class ApiService {
  private app: express.Application;
  private server: Server | null = null;
  private modelSyncService: ModelSyncService;
  private healthService: HealthCheckService;
  private port: number;

  constructor(modelSyncService: ModelSyncService, healthService: HealthCheckService) {
    this.app = express();
    this.modelSyncService = modelSyncService;
    this.healthService = healthService;
    this.port = parseInt(process.env.PORT || '8080', 10);
    
    this.setupMiddleware();
    this.setupRoutes();
  }

  /**
   * 設定中介軟體
   */
  private setupMiddleware(): void {
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
    
    // 請求日誌
    this.app.use((req, res, next) => {
      logger.info(`${req.method} ${req.path}`, {
        userAgent: req.get('User-Agent'),
        ip: req.ip
      });
      next();
    });
  }

  /**
   * 設定路由
   */
  private setupRoutes(): void {
    // 健康檢查端點
    this.app.get('/health', (req, res) => {
      const health = this.healthService.getHealth();
      res.status(health.status === 'healthy' ? 200 : 503).json(health);
    });

    this.app.get('/ready', (req, res) => {
      const health = this.healthService.getHealth();
      const isReady = health.status === 'healthy';
      res.status(isReady ? 200 : 503).json({ ready: isReady });
    });

    this.app.get('/live', (req, res) => {
      res.status(200).json({ alive: true });
    });

    // 指標端點
    this.app.get('/metrics', (req, res) => {
      const metrics = this.healthService.getMetrics();
      res.status(200).json(metrics);
    });

    // 手動觸發全量同步
    this.app.post('/sync/full', async (req, res) => {
      try {
        logger.info('🔄 Manual full sync triggered via API');
        
        const result = await this.modelSyncService.triggerFullSync();
        
        if (result.success) {
          res.status(200).json({
            success: true,
            message: 'Full sync completed successfully',
            data: result
          });
        } else {
          res.status(207).json({
            success: false,
            message: 'Full sync completed with errors',
            data: result
          });
        }
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error(`API error during full sync: ${errorMessage}`, { error });
        res.status(500).json({
          success: false,
          message: 'Internal server error during full sync',
          error: errorMessage
        });
      }
    });

    // 獲取同步狀態
    this.app.get('/sync/status', (req, res) => {
      const health = this.healthService.getHealth();
      const metrics = this.healthService.getMetrics();
      
      res.status(200).json({
        service: {
          status: health.status,
          uptime: health.uptime,
          lastProcessed: health.lastProcessed
        },
        metrics: metrics
      });
    });

    // 404 處理
    this.app.use('*', (req, res) => {
      res.status(404).json({
        error: 'Not Found',
        message: `Route ${req.method} ${req.originalUrl} not found`
      });
    });

    // 錯誤處理中介軟體
    this.app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
      logger.error('Express error handler', { error: err.message, stack: err.stack });
      
      if (res.headersSent) {
        return next(err);
      }
      
      res.status(500).json({
        error: 'Internal Server Error',
        message: err.message
      });
    });
  }

  /**
   * 啟動 API 伺服器
   */
  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = this.app.listen(this.port, () => {
        logger.info(`🚀 API Server started on port ${this.port}`);
        logger.info(`Health check: http://localhost:${this.port}/health`);
        logger.info(`Manual sync: POST http://localhost:${this.port}/sync/full`);
        resolve();
      });

      this.server.on('error', (error: NodeJS.ErrnoException) => {
        if (error.code === 'EADDRINUSE') {
          logger.error(`Port ${this.port} is already in use`);
        } else {
          logger.error(`Server error: ${error.message}`, { error });
        }
        reject(error);
      });
    });
  }

  /**
   * 停止 API 伺服器
   */
  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          logger.info('🛑 API Server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * 取得 Express 應用程式實例
   */
  getApp(): express.Application {
    return this.app;
  }
}