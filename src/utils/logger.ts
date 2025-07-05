import winston from 'winston';

// 日誌配置
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'model-sync' },
  transports: [
    // 輸出到控制台 (Kubernetes 日誌收集)
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ],
});

// 在生產環境中添加文件日誌
if (process.env.NODE_ENV === 'production') {
  logger.add(new winston.transports.File({ 
    filename: '/var/log/model-sync-error.log', 
    level: 'error' 
  }));
  logger.add(new winston.transports.File({ 
    filename: '/var/log/model-sync-combined.log' 
  }));
}

export default logger;