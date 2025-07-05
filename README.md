# Worker Model Sync TTS

[![CI](https://github.com/morphusai-com/worker-model-sync-tts/actions/workflows/ci.yml/badge.svg)](https://github.com/morphusai-com/worker-model-sync-tts/actions/workflows/ci.yml)
[![Build and Push](https://github.com/morphusai-com/worker-model-sync-tts/actions/workflows/build-and-push.yml/badge.svg)](https://github.com/morphusai-com/worker-model-sync-tts/actions/workflows/build-and-push.yml)

A Kubernetes-native worker service for automatically synchronizing AI models from AWS S3 to local storage, designed for TTS (Text-to-Speech) platforms.

## 🎯 功能特色

- **自動化同步**: 監聽 S3 事件，自動下載和更新模型檔案
- **手動觸發同步**: HTTP API 端點支援手動觸發全量同步
- **智能過濾**: 處理模型檔案和配置檔案 (.pth, .bin, .onnx, .json, .txt 等)
- **原子性操作**: 確保檔案更新的一致性和完整性
- **健康監控**: 完整的健康檢查和監控指標
- **Kubernetes 原生**: 使用 Kustomize 進行多環境部署
- **高可靠性**: 自動重試、錯誤處理和故障恢復
- **CI/CD 整合**: GitHub Actions 自動構建和推送到 AWS ECR

## 🏗️ 架構設計

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   AWS S3        │    │   SQS Queue      │    │  Model Sync     │
│                 │────│                  │────│    Service      │
│ Model Storage   │    │  Event Broker    │    │  (Kubernetes)   │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                         │
                                                         ▼
                                                ┌─────────────────┐
                                                │ Shared PVC      │
                                                │ Model Storage   │
                                                └─────────────────┘
                                                         │
                                                         ▼
                                                ┌─────────────────┐
                                                │ TTS Application │
                                                │ Pods            │
                                                └─────────────────┘
```

## 📁 專案結構

```
worker-model-sync-tts/
├── src/                        # TypeScript 源碼
│   ├── services/              # 核心服務
│   │   ├── ModelSyncService.ts
│   │   ├── S3Service.ts
│   │   └── HealthCheckService.ts
│   ├── utils/                 # 工具類
│   └── types/                 # 類型定義
├── k8s/                       # Kubernetes 配置
│   ├── base/                  # 基礎配置
│   └── overlays/              # 環境特定配置
│       ├── dev/
│       └── prod/
├── .github/workflows/         # GitHub Actions
│   ├── ci.yml                # CI 管道
│   └── build-and-push.yml    # Docker 構建和推送
├── Dockerfile                 # 容器映像
├── deploy.sh                  # 部署腳本
└── package.json               # Node.js 配置
```

## 🚀 快速開始

### 前置需求

- Node.js 18+
- Docker
- Kubernetes 集群
- kubectl
- kustomize
- AWS 認證配置

### 本地開發

1. **安裝依賴**
   ```bash
   cd worker-model-sync-tts
   npm install
   ```

2. **設定環境變數**
   ```bash
   export AWS_ACCESS_KEY_ID=your_access_key
   export AWS_SECRET_ACCESS_KEY=your_secret_key
   export AWS_REGION=us-west-2
   export S3_BUCKET_NAME=your-s3-bucket
   export SQS_UPDATE_QUEUE_URL=your-sqs-url
   export MODELS_BASE_PATH=/tmp/models
   ```

3. **開發模式執行**
   ```bash
   npm run dev
   ```

### 部署到 Kubernetes

1. **開發環境部署**
   ```bash
   ./deploy.sh -e dev -b
   ```

2. **生產環境部署**
   ```bash
   ./deploy.sh -e prod -b -p
   ```

3. **僅查看配置 (Dry Run)**
   ```bash
   ./deploy.sh -e dev -d
   ```

## 🔄 CI/CD 流程

### GitHub Actions Workflows

1. **CI Pipeline** (`.github/workflows/ci.yml`):
   - 程式碼檢查 (ESLint)
   - TypeScript 編譯測試
   - Kubernetes 配置驗證

2. **Build and Push** (`.github/workflows/build-and-push.yml`):
   - 自動構建 Docker 映像
   - 推送到 AWS ECR
   - 安全性掃描 (Trivy)
   - 支援多架構 (AMD64/ARM64)

### 設定 GitHub Secrets

在 GitHub repository 設定以下 secrets：

```
AWS_ACCESS_KEY_ID=your_ecr_access_key
AWS_SECRET_ACCESS_KEY=your_ecr_secret_key
```

### ECR Repository 設定

在 AWS ECR 中創建 repository：

```bash
aws ecr create-repository \
  --repository-name worker-model-sync-tts \
  --region us-west-2
```

## ⚙️ 配置選項

### 環境變數

| 變數名稱 | 描述 | 預設值 |
|---------|------|--------|
| `AWS_REGION` | AWS 區域 | `us-west-2` |
| `S3_BUCKET_NAME` | S3 儲存桶名稱 | 必填 |
| `SQS_UPDATE_QUEUE_URL` | SQS 更新佇列 URL | 必填 |
| `SQS_NOTIFICATION_QUEUE_URL` | SQS 通知佇列 URL | 選填 |
| `MODELS_BASE_PATH` | 本地模型儲存路徑 | `/models` |
| `LOG_LEVEL` | 日誌級別 | `info` |
| `NODE_ENV` | 執行環境 | `production` |

### Kustomize 環境

- **開發環境** (`k8s/overlays/dev/`)
  - 較少的資源限制
  - Debug 日誌級別
  - 開發專用的 SQS 佇列
  
- **生產環境** (`k8s/overlays/prod/`)
  - 更高的資源限制
  - 生產級日誌配置
  - 更大的 PVC 儲存空間

## 🔍 監控和健康檢查

### 健康檢查端點

- `/health` - 整體健康狀態
- `/ready` - Kubernetes readiness probe
- `/live` - Kubernetes liveness probe  
- `/metrics` - 詳細監控指標

### 手動同步端點

- `POST /sync/full` - 觸發全量模型同步
- `GET /sync/status` - 查詢同步狀態

### 監控指標

- 處理訊息數量和成功率
- 下載速度和檔案大小統計
- 記憶體和 CPU 使用率
- 佇列延遲和處理時間

### 日誌查看

```bash
# 查看即時日誌
kubectl logs -f deployment/worker-model-sync-tts -n voice-tts

# 查看特定時間範圍的日誌
kubectl logs deployment/worker-model-sync-tts -n voice-tts --since=1h
```

## 🛠️ 故障排除

### 常見問題

1. **AWS 認證失敗**
   ```bash
   # 檢查 Secret 配置
   kubectl get secret aws-secrets -n voice-tts -o yaml
   ```

2. **S3 連接問題**
   ```bash
   # 檢查網路連接
   kubectl exec -it deployment/worker-model-sync-tts -n voice-tts -- curl -I https://s3.amazonaws.com
   ```

3. **PVC 掛載問題**
   ```bash
   # 檢查 PVC 狀態
   kubectl get pvc worker-model-sync-tts-models-pvc -n voice-tts
   ```

### 除錯模式

開發環境自動啟用 debug 日誌，或手動設定：

```bash
kubectl set env deployment/worker-model-sync-tts LOG_LEVEL=debug -n voice-tts
```

## 🔧 開發指南

### 建置和測試

```bash
# 編譯 TypeScript
npm run build

# 執行測試
npm test

# 程式碼檢查
npm run lint
```

### Docker 建置

```bash
# 建置開發映像
docker build -t worker-model-sync-tts:dev .

# 建置生產映像
docker build -t worker-model-sync-tts:1.0.0 .
```

## 📝 API 文檔

### 健康檢查 API

#### GET /health
返回服務整體健康狀態

```json
{
  "status": "healthy",
  "uptime": 3600,
  "timestamp": "2024-01-01T12:00:00Z",
  "memory": {...},
  "lastProcessed": "2024-01-01T11:59:00Z"
}
```

#### GET /metrics
返回詳細監控指標

```json
{
  "timestamp": "2024-01-01T12:00:00Z",
  "uptime": 3600,
  "memory": {...},
  "cpu": {...},
  "processCount": 42,
  "healthStatus": "healthy"
}
```

### 模型同步 API

#### POST /sync/full
觸發全量模型同步，掃描 S3 存儲桶中所有模型檔案

**請求範例:**
```bash
curl -X POST http://localhost:8080/sync/full
```

**回應範例:**
```json
{
  "success": true,
  "message": "Full sync completed successfully",
  "data": {
    "totalModels": 15,
    "syncedModels": 3,
    "errors": [],
    "duration": 45000
  }
}
```

#### GET /sync/status  
查詢當前同步狀態

**回應範例:**
```json
{
  "service": {
    "status": "healthy",
    "uptime": 3600,
    "lastProcessed": "2024-01-01T11:59:00Z"
  },
  "metrics": {...}
}
```

## 🤝 貢獻指南

1. Fork 專案
2. 建立 feature branch
3. 提交變更
4. 建立 Pull Request

## 📄 授權

MIT License - 詳見 LICENSE 檔案