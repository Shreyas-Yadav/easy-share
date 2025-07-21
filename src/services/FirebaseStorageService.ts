import { 
  getStorage, 
  ref, 
  uploadBytes, 
  getDownloadURL, 
  deleteObject,
  FirebaseStorage 
} from 'firebase/storage';
import { app } from '../utils/firebase';
import type { 
  IStorageService, 
  UploadResult, 
  UploadOptions 
} from '../types/storage';
import { 
  StorageError, 
  FileSizeError, 
  FileTypeError, 
  UploadFailedError 
} from '../types/storage';

export class FirebaseStorageService implements IStorageService {
  private storage: FirebaseStorage;
  private readonly DEFAULT_MAX_SIZE = 10 * 1024 * 1024; // 10MB
  private readonly DEFAULT_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  private readonly DEFAULT_FILE_TYPES = [
    ...this.DEFAULT_IMAGE_TYPES,
    'application/pdf',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];

  constructor() {
    this.storage = getStorage(app);
  }

  async uploadImage(file: File, folder: string = 'images'): Promise<UploadResult> {
    const options: UploadOptions = {
      maxSizeBytes: this.DEFAULT_MAX_SIZE,
      allowedTypes: this.DEFAULT_IMAGE_TYPES,
      generateUniqueName: true,
      folder
    };

    return this.uploadFile(file, folder, options);
  }

  // Overloaded method for server-side buffer uploads
  async uploadImageFromBuffer(
    buffer: ArrayBuffer | Buffer, 
    fileName: string, 
    contentType: string, 
    folder: string = 'images'
  ): Promise<UploadResult> {
    const options: UploadOptions = {
      maxSizeBytes: this.DEFAULT_MAX_SIZE,
      allowedTypes: this.DEFAULT_IMAGE_TYPES,
      generateUniqueName: true,
      folder
    };

    return this.uploadFromBuffer(buffer, fileName, contentType, folder, options);
  }

  async uploadFile(file: File, folder: string = 'files', options?: UploadOptions): Promise<UploadResult> {
    try {
      
      // Apply default options
      const uploadOptions: UploadOptions = {
        maxSizeBytes: this.DEFAULT_MAX_SIZE,
        allowedTypes: this.DEFAULT_FILE_TYPES,
        generateUniqueName: true,
        ...options
      };

      // Validate file
      this.validateFile(file, uploadOptions);

      // Generate file path
      const fileName = uploadOptions.generateUniqueName ? 
        this.generateUniqueFileName(file.name) : 
        file.name;
      
      const path = `${folder}/${fileName}`;
      const storageRef = ref(this.storage, path);

      // Upload file
      const snapshot = await uploadBytes(storageRef, file);
      
      // Get download URL
      const url = await getDownloadURL(snapshot.ref);

      return {
        url,
        path,
        size: file.size,
        contentType: file.type,
        fileName
      };
    } catch (error) {
      if (error instanceof StorageError) {
        throw error;
      }
      
      console.error('Firebase upload error:', error);
      throw new UploadFailedError((error as Error).message);
    }
  }

  // New method for uploading from buffer (server-side)
  async uploadFromBuffer(
    buffer: ArrayBuffer | Buffer, 
    fileName: string, 
    contentType: string, 
    folder: string = 'files', 
    options?: UploadOptions
  ): Promise<UploadResult> {
    try {
      
      // Apply default options
      const uploadOptions: UploadOptions = {
        maxSizeBytes: this.DEFAULT_MAX_SIZE,
        allowedTypes: this.DEFAULT_FILE_TYPES,
        generateUniqueName: true,
        ...options
      };

      // Convert Buffer to Uint8Array if needed
      const uint8Array = buffer instanceof Buffer ? 
        new Uint8Array(buffer) : 
        new Uint8Array(buffer);

      // Validate buffer data
      this.validateBufferData(uint8Array, contentType, uploadOptions);

      // Generate file path
      const finalFileName = uploadOptions.generateUniqueName ? 
        this.generateUniqueFileName(fileName) : 
        fileName;
      
      const path = `${folder}/${finalFileName}`;
      const storageRef = ref(this.storage, path);

      // Upload buffer as Uint8Array
      const snapshot = await uploadBytes(storageRef, uint8Array, {
        contentType: contentType
      });
      
      // Get download URL
      const url = await getDownloadURL(snapshot.ref);

      return {
        url,
        path,
        size: uint8Array.length,
        contentType: contentType,
        fileName: finalFileName
      };
    } catch (error) {
      if (error instanceof StorageError) {
        throw error;
      }
      
      console.error('Firebase buffer upload error:', error);
      throw new UploadFailedError((error as Error).message);
    }
  }

  async deleteFile(url: string): Promise<void> {
    try {
      // Extract path from Firebase URL
      const path = this.extractPathFromUrl(url);
      const storageRef = ref(this.storage, path);
      await deleteObject(storageRef);
    } catch (error) {
      console.error('Firebase delete error:', error);
      throw new StorageError(`Failed to delete file: ${(error as Error).message}`, 'DELETE_FAILED');
    }
  }

  async getDownloadUrl(path: string): Promise<string> {
    try {
      const storageRef = ref(this.storage, path);
      return await getDownloadURL(storageRef);
    } catch (error) {
      console.error('Firebase getDownloadUrl error:', error);
      throw new StorageError(`Failed to get download URL: ${(error as Error).message}`, 'URL_FETCH_FAILED');
    }
  }

  private validateFile(file: File, options: UploadOptions): void {
    // Check file size
    if (options.maxSizeBytes && file.size > options.maxSizeBytes) {
      throw new FileSizeError(options.maxSizeBytes, file.size);
    }

    // Check file type
    if (options.allowedTypes && !options.allowedTypes.includes(file.type)) {
      throw new FileTypeError(options.allowedTypes, file.type);
    }

    // Check if file is not empty
    if (file.size === 0) {
      throw new StorageError('File is empty', 'EMPTY_FILE');
    }
  }

  private validateBufferData(buffer: Uint8Array, contentType: string, options: UploadOptions): void {
    // Check buffer size
    if (options.maxSizeBytes && buffer.length > options.maxSizeBytes) {
      throw new FileSizeError(options.maxSizeBytes, buffer.length);
    }

    // Check content type
    if (options.allowedTypes && !options.allowedTypes.includes(contentType)) {
      throw new FileTypeError(options.allowedTypes, contentType);
    }

    // Check if buffer is not empty
    if (buffer.length === 0) {
      throw new StorageError('Buffer is empty', 'EMPTY_BUFFER');
    }
  }

  private generateUniqueFileName(originalName: string): string {
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 9);
    const extension = originalName.split('.').pop();
    const nameWithoutExtension = originalName.replace(/\.[^/.]+$/, '');
    
    // Sanitize filename
    const sanitizedName = nameWithoutExtension
      .replace(/[^a-zA-Z0-9-_]/g, '_')
      .substring(0, 50);
    
    return `${sanitizedName}_${timestamp}_${randomString}${extension ? '.' + extension : ''}`;
  }

  private extractPathFromUrl(url: string): string {
    try {
      // Firebase Storage URLs have format: 
      // https://firebasestorage.googleapis.com/v0/b/{bucket}/o/{path}?alt=media&token={token}
      // where {path} is URL-encoded
      const urlObj = new URL(url);
      
      // Extract the encoded path from the pathname
      // Example: /v0/b/bucket/o/rooms%2FroomId%2Fimages%2Ffile.jpg
      const pathParts = urlObj.pathname.split('/o/');
      if (pathParts.length < 2) {
        throw new Error('Invalid Firebase Storage URL format - missing /o/ segment');
      }
      
      // Get the encoded path and decode it
      const encodedPath = pathParts[1].split('?')[0]; // Remove query params if any
      const decodedPath = decodeURIComponent(encodedPath);
      
      if (!decodedPath) {
        throw new Error('Could not extract path from Firebase Storage URL');
      }
      
      return decodedPath;
    } catch (error) {
      console.error('Error extracting path from Firebase URL:', error);
      throw new StorageError(`Invalid storage URL: ${url}. Error: ${(error as Error).message}`, 'INVALID_URL');
    }
  }

  // Utility methods for checking file types
  isImage(contentType: string): boolean {
    return this.DEFAULT_IMAGE_TYPES.includes(contentType);
  }

  isSupportedFileType(contentType: string): boolean {
    return this.DEFAULT_FILE_TYPES.includes(contentType);
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
} 