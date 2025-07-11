# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

Worker Model Sync TTS is a standalone Kubernetes-native service for automatically synchronizing AI models from AWS S3 to local storage. This service is designed to work with TTS (Text-to-Speech) platforms by providing model management capabilities.

## Common Development Commands

### Local Development
```bash
make install        # Install dependencies
make build          # Compile TypeScript  
make start          # Production mode
make dev            # Development with hot reload
make test           # Run tests
make lint           # Run ESLint

# Alternative: use npm directly
npm install && npm run build && npm start
```

### Docker Operations
```bash
make docker-build   # Build Docker image
make docker-run     # Run locally with Docker

# Alternative: use docker directly
docker build -t worker-model-sync-tts:latest .
docker run -p 8080:8080 worker-model-sync-tts:latest
```

### Kubernetes Deployment
```bash
make deploy-dev     # Deploy to development environment
make deploy-prod    # Deploy to production environment
make deploy-dry-run # Dry run (view configuration only)

# Alternative: use deploy script directly
./deploy.sh -e dev -b
./deploy.sh -e prod -b -p
./deploy.sh -e dev -d
```

### Testing
```bash
# Health checks
make health         # Overall health status
make ready          # Readiness probe  
make metrics        # Detailed metrics

# Manual sync operations
make sync-full      # Trigger full model sync
make sync-status    # Check sync status

# Kubernetes operations
make k8s-health     # Check Kubernetes deployment health
make k8s-sync       # Trigger sync via Kubernetes pod
make logs           # View pod logs

# Run tests
make test

# Alternative: use curl directly
curl http://localhost:8080/health
curl -X POST http://localhost:8080/sync/full
```

## High-Level Architecture

### Service Architecture
The worker implements a **single-pod design** for model management, providing:

- **Event-driven sync**: SQS triggers model synchronization from S3
- **Manual sync API**: HTTP endpoints for triggering full model synchronization
- **Shared storage**: Kubernetes PVC for model sharing with TTS applications
- **Health monitoring**: Complete health check and monitoring endpoints
- **Multi-environment support**: Kustomize configurations for dev/prod

### Model Management Flow
```
S3 Model Update → SQS Event → Worker Model Sync → PVC Update → TTS Applications
```

### Storage Strategy
- **S3 Integration**: Automatic download of model files from S3
- **Local Caching**: PVC-based model storage with intelligent cleanup
- **File Validation**: Only processes relevant model files (.pth, .bin, .onnx)
- **Atomic Operations**: Ensures consistency during file updates

## Key Technologies and Patterns

### Technology Stack
- **Runtime**: Node.js 18+ with full TypeScript typing
- **AWS Integration**: S3 SDK v3, SQS for event handling
- **Kubernetes**: Native deployment with Kustomize configurations
- **Monitoring**: Winston logging, Express health checks
- **Security**: Non-root containers, RBAC, Kubernetes secrets

### Configuration Management
Critical environment variables:
- `NODE_ENV`: development/production mode
- `AWS_*`: S3 and SQS credentials and configuration
- `S3_BUCKET_NAME`: Model storage bucket
- `SQS_*_QUEUE_URL`: Event notification queues
- `MODELS_BASE_PATH`: Local model storage path
- `LOG_LEVEL`: Logging verbosity

## Development Guidelines

### TypeScript Patterns
- **Full type safety** - never use `any` type
- **AWS SDK v3** patterns for S3 and SQS operations
- **Async/await** for all I/O operations
- **Graceful shutdown** handling with proper cleanup

### Kubernetes Best Practices
- **Single-pod deployment** for simplicity and resource efficiency
- **Resource limits** defined for memory and CPU
- **Health probes** for startup, liveness, and readiness
- **Security context** with non-root user
- **RBAC** for least-privilege access

### Error Handling
- **Comprehensive logging** with structured Winston format
- **Retry mechanisms** for S3 and SQS operations
- **Graceful degradation** when services are unavailable
- **Health status reporting** for monitoring integration

## Deployment Architecture

### Kubernetes Configuration
- **Namespace**: voice-tts (configurable via overlays)
- **Single replica**: Ensures no conflicts during model sync
- **PVC sharing**: Models accessible to other TTS pods
- **Service account**: RBAC for AWS resource access
- **ConfigMap/Secret**: Environment variables and credentials

### Service Endpoints
- **Health Check**: http://localhost:8080/health
- **Readiness**: http://localhost:8080/ready  
- **Liveness**: http://localhost:8080/live
- **Metrics**: http://localhost:8080/metrics
- **Manual Full Sync**: POST http://localhost:8080/sync/full
- **Sync Status**: http://localhost:8080/sync/status

## Important Notes

### Security
- **Environment variables** for all configuration
- **Kubernetes secrets** for AWS credentials
- **Non-root containers** for security
- **RBAC** for service account permissions

### Resource Requirements
- **CPU**: 250m request, 1000m limit
- **Memory**: 512Mi request, 2Gi limit
- **Storage**: Shared PVC for model files
- **Network**: Access to AWS S3 and SQS services

### Monitoring
- **Prometheus metrics** exposed on /metrics endpoint
- **Structured logging** with Winston
- **Health checks** for Kubernetes probes
- **Performance tracking** for sync operations

## Troubleshooting

### Common Issues
- **AWS credentials**: Check Kubernetes secrets configuration
- **S3 connectivity**: Verify network policies and AWS permissions
- **PVC mounting**: Check storage class and volume claims
- **Resource limits**: Monitor CPU and memory usage

### Debug Commands
```bash
# Check pod status
kubectl get pods -n voice-tts -l app.kubernetes.io/name=worker-model-sync-tts

# View logs
kubectl logs -f deployment/worker-model-sync-tts -n voice-tts

# Debug environment
kubectl set env deployment/worker-model-sync-tts LOG_LEVEL=debug -n voice-tts

# Check PVC status
kubectl get pvc worker-model-sync-tts-models-pvc -n voice-tts
```