# Worker Model Sync TTS Makefile
# Provides convenient commands for development and operations

.PHONY: help build start dev test lint clean install health sync-full sync-status logs docker-build docker-run deploy

# Default target
help: ## Show this help message
	@echo "Worker Model Sync TTS - Available Commands:"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

# Development Commands
install: ## Install dependencies
	npm install

build: ## Build TypeScript code
	npm run build

start: ## Start production server
	npm start

dev: ## Start development server with hot reload
	npm run dev

test: ## Run tests
	npm test

lint: ## Run ESLint code checking
	npm run lint

clean: ## Clean build artifacts
	rm -rf dist node_modules

# Health Check Commands
health: ## Check service health status
	@echo "🏥 Checking service health..."
	@curl -s http://localhost:8080/health | jq '.' || echo "Service not running or jq not installed"

ready: ## Check if service is ready
	@echo "✅ Checking service readiness..."
	@curl -s http://localhost:8080/ready | jq '.' || echo "Service not running or jq not installed"

metrics: ## Show service metrics
	@echo "📊 Fetching service metrics..."
	@curl -s http://localhost:8080/metrics | jq '.' || echo "Service not running or jq not installed"

# Model Sync Commands
sync-full: ## Trigger full model synchronization
	@echo "🔄 Triggering full model sync..."
	@curl -X POST -s http://localhost:8080/sync/full | jq '.' || echo "Service not running or jq not installed"

sync-status: ## Check current sync status
	@echo "📋 Checking sync status..."
	@curl -s http://localhost:8080/sync/status | jq '.' || echo "Service not running or jq not installed"

# Docker Commands
docker-build: ## Build Docker image with commit SHA tag
	$(eval COMMIT_SHA := $(shell git rev-parse --short HEAD))
	docker build -t worker-model-sync-tts:latest -t worker-model-sync-tts:$(COMMIT_SHA) .
	@echo "🐳 Built Docker images:"
	@echo "  - worker-model-sync-tts:latest"
	@echo "  - worker-model-sync-tts:$(COMMIT_SHA)"

docker-run: ## Run Docker container locally
	docker run -p 8080:8080 \
		-e AWS_ACCESS_KEY_ID="$(AWS_ACCESS_KEY_ID)" \
		-e AWS_SECRET_ACCESS_KEY="$(AWS_SECRET_ACCESS_KEY)" \
		-e AWS_REGION="$(AWS_REGION)" \
		-e S3_BUCKET_NAME="$(S3_BUCKET_NAME)" \
		-e SQS_UPDATE_QUEUE_URL="$(SQS_UPDATE_QUEUE_URL)" \
		-e LOG_LEVEL=debug \
		worker-model-sync-tts:latest

docker-run-sha: ## Run Docker container with specific commit SHA
	$(eval COMMIT_SHA := $(shell git rev-parse --short HEAD))
	docker run -p 8080:8080 \
		-e AWS_ACCESS_KEY_ID="$(AWS_ACCESS_KEY_ID)" \
		-e AWS_SECRET_ACCESS_KEY="$(AWS_SECRET_ACCESS_KEY)" \
		-e AWS_REGION="$(AWS_REGION)" \
		-e S3_BUCKET_NAME="$(S3_BUCKET_NAME)" \
		-e SQS_UPDATE_QUEUE_URL="$(SQS_UPDATE_QUEUE_URL)" \
		-e LOG_LEVEL=debug \
		worker-model-sync-tts:$(COMMIT_SHA)

# Kubernetes Commands
deploy-dev: ## Deploy to development environment
	./deploy.sh -e dev -b

deploy-prod: ## Deploy to production environment
	./deploy.sh -e prod -b -p

deploy-dry-run: ## Show deployment configuration without applying
	./deploy.sh -e dev -d

# Kubernetes Logs and Debugging
logs: ## Show Kubernetes pod logs
	kubectl logs -f deployment/worker-model-sync-tts -n voice-tts

logs-tail: ## Show last 100 lines of logs
	kubectl logs deployment/worker-model-sync-tts -n voice-tts --tail=100

debug: ## Set debug log level in Kubernetes
	kubectl set env deployment/worker-model-sync-tts LOG_LEVEL=debug -n voice-tts

# Kubernetes Health Checks
k8s-health: ## Check Kubernetes deployment health
	@echo "🔍 Checking Kubernetes deployment status..."
	kubectl get pods -n voice-tts -l app.kubernetes.io/name=worker-model-sync-tts
	@echo ""
	@echo "🏥 Checking pod health endpoint..."
	kubectl exec -n voice-tts deployment/worker-model-sync-tts -- curl -s http://localhost:8080/health || echo "Health check failed"

k8s-sync: ## Trigger sync via Kubernetes pod
	@echo "🔄 Triggering sync via Kubernetes pod..."
	kubectl exec -n voice-tts deployment/worker-model-sync-tts -- curl -X POST -s http://localhost:8080/sync/full || echo "Sync trigger failed"

# Utility Commands
port-forward: ## Port forward Kubernetes service to localhost
	@echo "🔗 Port forwarding service to localhost:8080..."
	kubectl port-forward -n voice-tts service/worker-model-sync-tts 8080:8080

check-pvc: ## Check PVC status and usage
	@echo "💾 Checking PVC status..."
	kubectl get pvc -n voice-tts worker-model-sync-tts-models-pvc
	@echo ""
	@echo "📁 Checking PVC contents..."
	kubectl exec -n voice-tts deployment/worker-model-sync-tts -- ls -la /models || echo "Cannot access /models directory"

restart: ## Restart Kubernetes deployment
	kubectl rollout restart deployment/worker-model-sync-tts -n voice-tts

# Environment Setup
env-check: ## Check required environment variables
	@echo "🔍 Checking required environment variables..."
	@echo "AWS_ACCESS_KEY_ID: $${AWS_ACCESS_KEY_ID:+✅ Set}$${AWS_ACCESS_KEY_ID:-❌ Not set}"
	@echo "AWS_SECRET_ACCESS_KEY: $${AWS_SECRET_ACCESS_KEY:+✅ Set}$${AWS_SECRET_ACCESS_KEY:-❌ Not set}"
	@echo "AWS_REGION: $${AWS_REGION:+✅ Set ($$AWS_REGION)}$${AWS_REGION:-❌ Not set}"
	@echo "S3_BUCKET_NAME: $${S3_BUCKET_NAME:+✅ Set ($$S3_BUCKET_NAME)}$${S3_BUCKET_NAME:-❌ Not set}"
	@echo "SQS_UPDATE_QUEUE_URL: $${SQS_UPDATE_QUEUE_URL:+✅ Set}$${SQS_UPDATE_QUEUE_URL:-❌ Not set}"

# Quick Development Workflow
quick-start: install build start ## Install, build, and start in one command

# Testing Commands
test-api: ## Test all API endpoints
	@echo "🧪 Testing API endpoints..."
	@echo "Health check:"
	@make health
	@echo ""
	@echo "Readiness check:"
	@make ready
	@echo ""
	@echo "Sync status:"
	@make sync-status

# All-in-one commands
full-deploy: build docker-build deploy-dev ## Build, create Docker image, and deploy to dev

all: clean install build test lint ## Run full CI pipeline locally