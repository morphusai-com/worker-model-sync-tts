"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const winston_1 = __importDefault(require("winston"));
// 日誌配置
const logger = winston_1.default.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.errors({ stack: true }), winston_1.default.format.json()),
    defaultMeta: { service: 'model-sync' },
    transports: [
        // 輸出到控制台 (Kubernetes 日誌收集)
        new winston_1.default.transports.Console({
            format: winston_1.default.format.combine(winston_1.default.format.colorize(), winston_1.default.format.simple())
        })
    ],
});
// 在生產環境中添加文件日誌
if (process.env.NODE_ENV === 'production') {
    logger.add(new winston_1.default.transports.File({
        filename: '/var/log/model-sync-error.log',
        level: 'error'
    }));
    logger.add(new winston_1.default.transports.File({
        filename: '/var/log/model-sync-combined.log'
    }));
}
exports.default = logger;
//# sourceMappingURL=logger.js.map