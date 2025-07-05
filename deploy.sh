#!/bin/bash

# Gamania Voice Model Sync Service 部署腳本
set -e

# 顏色設定
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# 預設值
ENVIRONMENT="dev"
BUILD_IMAGE=false
PUSH_IMAGE=false
DRY_RUN=false
REGISTRY="gamania-voice"

# 使用說明
usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -e, --env ENVIRONMENT     Environment to deploy (dev|prod) [default: dev]"
    echo "  -b, --build              Build Docker image"
    echo "  -p, --push               Push Docker image to registry"
    echo "  -r, --registry REGISTRY  Docker registry [default: gamania-voice]"
    echo "  -d, --dry-run            Show what would be deployed without applying"
    echo "  -h, --help               Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 -e dev -b                    # Build and deploy to dev"
    echo "  $0 -e prod -b -p               # Build, push and deploy to prod"
    echo "  $0 -e dev -d                   # Dry run for dev environment"
}

# 解析命令列參數
while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--env)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -b|--build)
            BUILD_IMAGE=true
            shift
            ;;
        -p|--push)
            PUSH_IMAGE=true
            shift
            ;;
        -r|--registry)
            REGISTRY="$2"
            shift 2
            ;;
        -d|--dry-run)
            DRY_RUN=true
            shift
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            echo "Unknown option $1"
            usage
            exit 1
            ;;
    esac
done

# 驗證環境參數
if [[ "$ENVIRONMENT" != "dev" && "$ENVIRONMENT" != "prod" ]]; then
    echo -e "${RED}❌ Error: Environment must be 'dev' or 'prod'${NC}"
    exit 1
fi

echo -e "${BLUE}🚀 Deploying Model Sync Service to $ENVIRONMENT environment${NC}"

# 檢查必要工具
check_tools() {
    local tools=("docker" "kubectl" "kustomize")
    for tool in "${tools[@]}"; do
        if ! command -v $tool &> /dev/null; then
            echo -e "${RED}❌ Error: $tool is not installed${NC}"
            exit 1
        fi
    done
    echo -e "${GREEN}✅ All required tools are available${NC}"
}

# 建置 Docker 映像
build_image() {
    echo -e "${YELLOW}🔨 Building Docker image...${NC}"
    local tag="$REGISTRY/model-sync:$ENVIRONMENT-latest"
    
    docker build -t "$tag" .
    
    if [[ "$ENVIRONMENT" == "prod" ]]; then
        # 生產環境使用版本標籤
        local version=$(grep '"version"' package.json | cut -d'"' -f4)
        docker tag "$tag" "$REGISTRY/model-sync:$version"
        echo -e "${GREEN}✅ Built image: $REGISTRY/model-sync:$version${NC}"
    fi
    
    echo -e "${GREEN}✅ Built image: $tag${NC}"
}

# 推送映像
push_image() {
    echo -e "${YELLOW}📤 Pushing Docker image...${NC}"
    local tag="$REGISTRY/model-sync:$ENVIRONMENT-latest"
    
    docker push "$tag"
    
    if [[ "$ENVIRONMENT" == "prod" ]]; then
        local version=$(grep '"version"' package.json | cut -d'"' -f4)
        docker push "$REGISTRY/model-sync:$version"
        echo -e "${GREEN}✅ Pushed image: $REGISTRY/model-sync:$version${NC}"
    fi
    
    echo -e "${GREEN}✅ Pushed image: $tag${NC}"
}

# 部署到 Kubernetes
deploy_k8s() {
    echo -e "${YELLOW}☸️ Deploying to Kubernetes ($ENVIRONMENT)...${NC}"
    
    local overlay_path="k8s/overlays/$ENVIRONMENT"
    
    if [[ ! -d "$overlay_path" ]]; then
        echo -e "${RED}❌ Error: Overlay directory not found: $overlay_path${NC}"
        exit 1
    fi
    
    if [[ "$DRY_RUN" == "true" ]]; then
        echo -e "${BLUE}📋 Dry run - showing what would be deployed:${NC}"
        kustomize build "$overlay_path"
        return 0
    fi
    
    # 應用配置
    kustomize build "$overlay_path" | kubectl apply -f -
    
    echo -e "${GREEN}✅ Deployed to Kubernetes${NC}"
    
    # 等待部署完成
    echo -e "${YELLOW}⏳ Waiting for deployment to be ready...${NC}"
    kubectl rollout status deployment/${ENVIRONMENT}-model-sync-service -n voice-tts --timeout=300s
    
    # 顯示部署狀態
    echo -e "${BLUE}📊 Deployment status:${NC}"
    kubectl get pods -n voice-tts -l app.kubernetes.io/name=model-sync-service
    
    # 顯示服務端點
    echo -e "${BLUE}🌐 Service endpoints:${NC}"
    kubectl get svc -n voice-tts -l app.kubernetes.io/name=model-sync-service
}

# 顯示日誌
show_logs() {
    echo -e "${BLUE}📝 Recent logs:${NC}"
    kubectl logs -n voice-tts -l app.kubernetes.io/name=model-sync-service --tail=20
}

# 主函數
main() {
    echo -e "${BLUE}Configuration:${NC}"
    echo "  Environment: $ENVIRONMENT"
    echo "  Build image: $BUILD_IMAGE"
    echo "  Push image: $PUSH_IMAGE"
    echo "  Registry: $REGISTRY"
    echo "  Dry run: $DRY_RUN"
    echo ""
    
    check_tools
    
    if [[ "$BUILD_IMAGE" == "true" ]]; then
        build_image
    fi
    
    if [[ "$PUSH_IMAGE" == "true" ]]; then
        push_image
    fi
    
    deploy_k8s
    
    if [[ "$DRY_RUN" == "false" ]]; then
        show_logs
    fi
    
    echo -e "${GREEN}🎉 Deployment completed successfully!${NC}"
}

# 執行主函數
main