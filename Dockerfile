# Multi-stage build for Node.js Model Sync Service
FROM node:18-alpine AS builder

WORKDIR /app

# 安裝依賴
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# 安裝開發依賴用於編譯
COPY package*.json ./
RUN npm install

# 複製源碼並編譯
COPY src/ ./src/
COPY tsconfig.json ./
RUN npm run build

# 生產階段
FROM node:18-alpine

# 建立非 root 使用者
RUN addgroup -g 1001 -S nodejs && \
    adduser -S syncuser -u 1001

WORKDIR /app

# 安裝必要的系統工具
RUN apk add --no-cache \
    curl \
    ca-certificates \
    tzdata

# 複製編譯結果和生產依賴
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./

# 建立模型目錄並設定權限
RUN mkdir -p /models && \
    chown -R syncuser:nodejs /models && \
    chown -R syncuser:nodejs /app

# 切換到非 root 使用者
USER syncuser

# 健康檢查
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1

# 暴露端口
EXPOSE 8080

# 設定環境變數
ENV NODE_ENV=production
ENV MODELS_BASE_PATH=/models

# 啟動應用
CMD ["node", "dist/index.js"]