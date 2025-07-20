// Storage service interfaces following Interface Segregation Principle
export interface IStorageService {
  uploadImage(file: File, path: string): Promise<UploadResult>;
  uploadImageFromBuffer(buffer: ArrayBuffer | Buffer, fileName: string, contentType: string, folder?: string): Promise<UploadResult>;
  uploadFile(file: File, path: string): Promise<UploadResult>;
  deleteFile(url: string): Promise<void>;
  getDownloadUrl(path: string): Promise<string>;
}

export interface UploadResult {
  url: string;
  path: string;
  size: number;
  contentType: string;
  fileName: string;
}

export interface UploadOptions {
  maxSizeBytes?: number;
  allowedTypes?: string[];
  generateUniqueName?: boolean;
  folder?: string;
}

export interface UploadProgress {
  bytesTransferred: number;
  totalBytes: number;
  percentage: number;
}

// Error types for storage operations
export class StorageError extends Error {
  constructor(message: string, public readonly code?: string) {
    super(message);
    this.name = 'StorageError';
  }
}

export class FileSizeError extends StorageError {
  constructor(maxSize: number, actualSize: number) {
    super(`File size ${actualSize} bytes exceeds maximum allowed size of ${maxSize} bytes`, 'FILE_TOO_LARGE');
    this.name = 'FileSizeError';
  }
}

export class FileTypeError extends StorageError {
  constructor(allowedTypes: string[], actualType: string) {
    super(`File type '${actualType}' is not allowed. Allowed types: ${allowedTypes.join(', ')}`, 'INVALID_FILE_TYPE');
    this.name = 'FileTypeError';
  }
}

export class UploadFailedError extends StorageError {
  constructor(reason: string) {
    super(`Upload failed: ${reason}`, 'UPLOAD_FAILED');
    this.name = 'UploadFailedError';
  }
} 