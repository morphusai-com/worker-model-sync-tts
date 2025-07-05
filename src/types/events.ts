// S3 和 SQS 事件類型定義

export interface S3EventRecord {
  eventVersion: string;
  eventSource: string;
  eventTime: string;
  eventName: string;
  s3: {
    bucket: {
      name: string;
    };
    object: {
      key: string;
      size: number;
      eTag: string;
    };
  };
}

export interface SQSMessage {
  MessageId: string;
  ReceiptHandle: string;
  Body: string;
  Attributes?: Record<string, string>;
  MessageAttributes?: Record<string, any>;
}

export interface ModelUpdateEvent {
  type: 'model_updated' | 'model_deleted';
  bucket: string;
  key: string;
  size: number;
  timestamp: string;
  category: 'essential' | 'optional' | 'archive';
  modelType: 'bert' | 'voice' | 'g2p' | 'emotional' | 'wavlm';
}

export interface NotificationEvent {
  type: 'model_updated';
  path: string;
  localPath: string;
  size: number;
  timestamp: string;
  downloadDuration: number;
}