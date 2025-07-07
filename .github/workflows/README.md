# GitHub Actions Workflows

這個目錄包含 Worker Model Sync TTS 的自動化 CI/CD 工作流程。

## 工作流程說明

### docker-build.yml
建置和推送 Docker 映像到 AWS ECR。

**觸發條件：**
- Push 到 `main` 分支
- 創建版本標籤 (v*)
- Pull Request
- 手動觸發 (workflow_dispatch)

**功能：**
- 建置多架構 Docker 映像 (amd64, arm64)
- 執行 Trivy 安全掃描
- 推送到 AWS ECR

## 必要的設定

### 1. GitHub OIDC Provider
此工作流程使用 AWS OIDC 進行身份驗證，不需要存儲 AWS 密鑰。

需要在 AWS IAM 中設定：
- OIDC Provider: `token.actions.githubusercontent.com`
- IAM Role: `github-oidc-provider-aws`
- Trust Policy 已包含 `repo:morphusai-com/worker-model-sync-tts:*`

### 2. ECR Repository
確保 ECR repository 已創建：
```bash
aws ecr create-repository --repository-name worker-model-sync-tts --region us-west-2
```

## 標籤策略

### 映像標籤
- `latest` - main 分支的最新版本
- `{commit-sha}` - 特定 commit 版本
- `{timestamp}` - 時間戳版本
- `{version}` - 版本標籤（如 v1.0.0）
- `{branch}` - 分支版本
- `{branch}-{commit-sha}` - 分支+commit 版本

## 使用範例

### 手動觸發建置
```bash
# 使用 GitHub CLI
gh workflow run docker-build.yml --ref main -f push_to_registry=true
```

### 拉取映像
```bash
# 配置 AWS 認證
aws ecr get-login-password --region us-west-2 | docker login --username AWS --password-stdin 084375548982.dkr.ecr.us-west-2.amazonaws.com

# 拉取最新映像
docker pull 084375548982.dkr.ecr.us-west-2.amazonaws.com/worker-model-sync-tts:latest
```

### 運行容器
```bash
# 運行服務
docker run -p 8080:8080 \
  -e AWS_REGION=us-west-2 \
  -e S3_BUCKET_NAME=your-bucket \
  -e SQS_UPDATE_QUEUE_URL=your-queue-url \
  084375548982.dkr.ecr.us-west-2.amazonaws.com/worker-model-sync-tts:latest
```

## 注意事項

1. **映像大小**：Node.js 映像相對較小（約 200-400MB）
2. **多架構支援**：支援 amd64 和 arm64 架構
3. **建置時間**：約 5-10 分鐘
4. **成本考量**：ECR 儲存和傳輸會產生 AWS 費用
5. **安全掃描**：所有映像都會經過 Trivy 掃描，CRITICAL 和 HIGH 級別的漏洞會被報告

## 故障排除

### 建置失敗
- 檢查 GitHub Actions 日誌
- 確認 AWS 認證正確
- 檢查 ECR repository 是否存在

### 推送失敗
- 確認 AWS IAM 權限包含 ECR 推送權限
- 檢查 ECR repository 政策

### 測試失敗
- 確認 Dockerfile 正確設定 ENTRYPOINT 或 CMD
- 檢查 Node.js 環境是否正確安裝