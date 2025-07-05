"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HealthCheckService = void 0;
const express_1 = __importDefault(require("express"));
const logger_1 = __importDefault(require("../utils/logger"));
class HealthCheckService {
    constructor() {
        this.app = (0, express_1.default)();
        this.lastProcessedTime = null;
        this.isHealthy = true;
        this.startTime = new Date();
        this.setupRoutes();
    }
    /**
     * 設定健康檢查路由
     */
    setupRoutes() {
        // 基本健康檢查
        this.app.get('/health', (req, res) => {
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
            const statusCode = this.isHealthy ? 200 : 503;
            res.status(statusCode).json(healthData);
        });
        // 準備就緒檢查 (Kubernetes readiness probe)
        this.app.get('/ready', (req, res) => {
            // 檢查環境變數
            const requiredEnvVars = [
                'AWS_ACCESS_KEY_ID',
                'AWS_SECRET_ACCESS_KEY',
                'AWS_REGION',
                'S3_BUCKET_NAME',
                'SQS_UPDATE_QUEUE_URL'
            ];
            const missingEnvVars = requiredEnvVars.filter(env => !process.env[env]);
            if (missingEnvVars.length > 0) {
                return res.status(503).json({
                    status: 'not_ready',
                    message: 'Missing required environment variables',
                    missingEnvVars
                });
            }
            res.json({
                status: 'ready',
                timestamp: new Date().toISOString(),
                startTime: this.startTime.toISOString()
            });
        });
        // 存活檢查 (Kubernetes liveness probe)
        this.app.get('/live', (req, res) => {
            res.json({
                status: 'alive',
                timestamp: new Date().toISOString(),
                uptime: Math.floor(process.uptime())
            });
        });
        // 詳細指標 (用於監控)
        this.app.get('/metrics', (req, res) => {
            const metrics = {
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
            res.json(metrics);
        });
        // 健康狀態切換 (僅用於測試)
        if (process.env.NODE_ENV !== 'production') {
            this.app.post('/health/toggle', (req, res) => {
                this.isHealthy = !this.isHealthy;
                logger_1.default.info(`Health status toggled to: ${this.isHealthy ? 'healthy' : 'unhealthy'}`);
                res.json({ status: this.isHealthy ? 'healthy' : 'unhealthy' });
            });
        }
    }
    /**
     * 啟動健康檢查服務
     */
    start(port = 8080) {
        this.app.listen(port, '0.0.0.0', () => {
            logger_1.default.info(`🏥 Health check service running on port ${port}`);
        });
    }
    /**
     * 更新最後處理時間
     */
    updateLastProcessed() {
        this.lastProcessedTime = new Date();
        this.isHealthy = true; // 成功處理訊息時恢復健康狀態
    }
    /**
     * 設定健康狀態
     */
    setHealthy(healthy) {
        this.isHealthy = healthy;
    }
    /**
     * 獲取處理計數 (簡單實作)
     */
    getProcessCount() {
        // 這裡可以實作更複雜的計數邏輯
        return this.lastProcessedTime ? 1 : 0;
    }
}
exports.HealthCheckService = HealthCheckService;
//# sourceMappingURL=HealthCheckService.js.map