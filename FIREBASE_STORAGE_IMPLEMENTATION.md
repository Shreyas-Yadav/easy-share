# Firebase Storage Implementation

## Overview

This implementation adds Firebase Storage integration for image and file uploads while maintaining SOLID principles. The system replaces the previous base64 image storage with proper cloud storage using Firebase.

## Architecture

### SOLID Principles Implementation

#### 1. Single Responsibility Principle (SRP)
- **`FirebaseStorageService`**: Handles all Firebase Storage operations (upload, delete, URL generation)
- **`MessageService`**: Enhanced with image/file upload methods while maintaining message management focus
- **Storage interfaces**: Clear separation between storage concerns and other system components

#### 2. Open/Closed Principle (OCP)
- **`IStorageService` interface**: Allows for different storage providers (AWS S3, Google Cloud, etc.) without changing existing code
- **Extensible file type support**: New file types can be added through configuration

#### 3. Liskov Substitution Principle (LSP)
- Any implementation of `IStorageService` can be substituted seamlessly
- Storage service is injected via dependency injection

#### 4. Interface Segregation Principle (ISP)
- **`IStorageService`**: Focused interface containing only storage-related methods
- Separate error types for different storage failure scenarios

#### 5. Dependency Inversion Principle (DIP)
- **Factory Pattern**: Storage service is created through `RepositoryFactory`
- **Service Injection**: `MessageService` depends on `IStorageService` abstraction, not concrete implementation

## Key Components

### 1. Storage Interface (`src/types/storage.ts`)

```typescript
interface IStorageService {
  uploadImage(file: File, path: string): Promise<UploadResult>;
  uploadFile(file: File, path: string): Promise<UploadResult>;
  deleteFile(url: string): Promise<void>;
  getDownloadUrl(path: string): Promise<string>;
}
```

**Features:**
- Type-safe upload results
- Comprehensive error handling with custom error classes
- File validation (size, type, emptiness)
- Upload progress tracking support

### 2. Firebase Storage Service (`src/services/FirebaseStorageService.ts`)

**Key Features:**
- **File Validation**: Size limits (10MB default), type restrictions, empty file detection
- **Unique Filename Generation**: Prevents conflicts with timestamp + random string
- **Organized Storage Structure**: Files organized by room and type (`rooms/{roomId}/images/`, `rooms/{roomId}/files/`)
- **Error Handling**: Custom error types for different failure scenarios
- **File Type Support**: Images (JPEG, PNG, GIF, WebP) and documents (PDF, DOC, TXT)

**Security Features:**
- Filename sanitization to prevent path traversal
- File type validation based on MIME types
- Size restrictions to prevent abuse

### 3. Enhanced Message Service (`src/services/MessageService.ts`)

**New Methods:**
- `uploadAndSendImage()`: Uploads image to Firebase and creates message with storage URL
- `uploadAndSendFile()`: Uploads file to Firebase and creates message with download URL
- Enhanced `deleteMessage()`: Also removes files from Firebase Storage when deleting messages
- Enhanced `deleteRoomMessages()`: Bulk deletion with storage cleanup

### 4. Updated Factories

**RepositoryFactory:**
- Added `createStorageService()` method
- Maintains singleton pattern for storage service

**ServiceFactory:**
- Injects storage service into MessageService
- Proper dependency management

## Data Flow

### Image Upload Process

1. **Client Side** (`SocketProvider.tsx`):
   ```typescript
   // User selects image
   const file = /* File object */;
   
   // Convert to ArrayBuffer for socket transmission
   const arrayBuffer = await file.arrayBuffer();
   socket.emit('image:upload', {
     roomId,
     imageBuffer: arrayBuffer,
     imageName: file.name,
     imageType: file.type,
     imageSize: file.size
   });
   ```

2. **Server Side** (`socket/route.ts`):
   ```typescript
   // Reconstruct File object from buffer
   const buffer = Buffer.from(data.imageBuffer);
   const file = new File([buffer], data.imageName, { type: data.imageType });
   
   // Upload to Firebase and create message
   const imageMessage = await messageService.uploadAndSendImage({
     roomId: data.roomId,
     userId: userData.userId,
     userName: userData.userName,
     userImage: userData.userImage,
     file: file,
   });
   ```

3. **Storage Service**:
   ```typescript
   // Upload to Firebase Storage
   const folder = `rooms/${roomId}/images`;
   const uploadResult = await storageService.uploadImage(file, folder);
   
   // Returns: { url, path, size, contentType, fileName }
   ```

4. **Message Creation**:
   ```typescript
   // Store message with Firebase URL in Redis
   const message: ImageMessage = {
     id: generateId(),
     roomId,
     userId,
     content: `Shared an image: ${uploadResult.fileName}`,
     type: 'image',
     imageUrl: uploadResult.url,  // Firebase Storage URL
     imageName: uploadResult.fileName,
     imageSize: uploadResult.size,
     timestamp: new Date(),
   };
   ```

## Storage Structure

### Firebase Storage Organization
```
your-project.appspot.com/
├── rooms/
│   ├── {roomId1}/
│   │   ├── images/
│   │   │   ├── sanitized_name_timestamp_random.jpg
│   │   │   └── another_image_timestamp_random.png
│   │   └── files/
│   │       ├── document_timestamp_random.pdf
│   │       └── spreadsheet_timestamp_random.xlsx
│   └── {roomId2}/
│       ├── images/
│       └── files/
```

### Redis Data Structure
```
Messages still stored in Redis with Firebase URLs:
- message:{id} → { ..., imageUrl: "https://firebasestorage.googleapis.com/...", ... }
- room_messages:{roomId} → [messageId1, messageId2, ...]
```

## Configuration

### Required Environment Variables

```env
# Firebase Configuration
FIREBASE_API_KEY=your_firebase_api_key
FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
FIREBASE_APP_ID=your_firebase_app_id
FIREBASE_MEASUREMENT_ID=your_measurement_id
```

### Firebase Console Setup

1. **Enable Storage**: Go to Firebase Console → Storage → Get Started
2. **Set Security Rules**: Configure appropriate security rules for your use case
3. **Configure CORS**: If needed for web uploads

**Example Security Rules:**
```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /rooms/{roomId}/{allPaths=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

## Error Handling

### Custom Error Types

1. **`StorageError`**: Base error for storage operations
2. **`FileSizeError`**: File exceeds size limits
3. **`FileTypeError`**: Unsupported file type
4. **`UploadFailedError`**: Upload operation failed

### Error Scenarios Handled

- **Network failures**: Retry logic and graceful degradation
- **File validation**: Clear error messages for user feedback
- **Storage quota**: Proper error handling for quota exceeded
- **Invalid URLs**: Safe URL parsing and validation
- **Partial failures**: Continue message deletion even if storage cleanup fails

## Performance Considerations

### Optimizations Implemented

1. **File Size Limits**: 10MB default to prevent large uploads
2. **Unique Filenames**: Prevents storage conflicts and enables caching
3. **Organized Structure**: Enables efficient cleanup and management
4. **Lazy Loading**: Storage service created only when needed
5. **Cleanup on Delete**: Prevents storage bloat by removing unused files

### Monitoring

- **Upload Success Rate**: Track via Firebase Console
- **Storage Usage**: Monitor through Firebase Console
- **Error Rates**: Application logs with structured error information

## Migration from Base64

### What Changed

1. **Data Format**: Images now stored as Firebase URLs instead of base64 strings
2. **Socket Events**: `image:upload` now expects ArrayBuffer instead of base64 string
3. **Message Structure**: `ImageMessage.imageUrl` now contains Firebase Storage URLs
4. **Cleanup**: Added automatic file deletion when messages are removed

### Backward Compatibility

- **Existing Messages**: Old base64 messages continue to work
- **API**: Socket events maintain same structure, only data format changed
- **UI**: No changes required in message display components

## Benefits Achieved

### Technical Benefits

1. **Reduced Memory Usage**: No more large base64 strings in Redis
2. **Improved Performance**: Faster message loading and transmission
3. **Scalability**: Firebase Storage handles file distribution and CDN
4. **Reliability**: Firebase's 99.95% uptime SLA
5. **Cost Efficiency**: Pay only for storage used, not for bandwidth

### Development Benefits

1. **Clean Architecture**: Clear separation of storage concerns
2. **Testability**: Interface-based design enables easy mocking
3. **Maintainability**: Well-structured code following SOLID principles
4. **Extensibility**: Easy to add new storage providers or file types

### User Benefits

1. **Faster Loading**: Images load directly from Firebase CDN
2. **Better Quality**: No base64 compression artifacts
3. **Reliable Uploads**: Robust error handling and retry logic
4. **Progress Feedback**: Clear error messages for failed uploads

## Future Extensions

### Planned Enhancements

1. **Image Optimization**: Automatic resizing and format conversion
2. **Upload Progress**: Real-time upload progress indicators
3. **File Preview**: Thumbnail generation for documents
4. **Batch Uploads**: Multiple file upload support
5. **Storage Analytics**: Upload metrics and usage tracking

### Additional Storage Providers

The architecture supports easy addition of:
- **AWS S3**: Alternative cloud storage
- **Google Cloud Storage**: Direct Google Cloud integration
- **Azure Blob Storage**: Microsoft cloud storage
- **Custom Storage**: On-premises or custom solutions

## Security Considerations

### Implemented Security

1. **File Type Validation**: Only allowed MIME types accepted
2. **Size Restrictions**: Prevents abuse through large file uploads
3. **Filename Sanitization**: Prevents path traversal attacks
4. **User Authentication**: Only authenticated users can upload
5. **Room Membership**: Users can only upload to rooms they're in

### Recommended Additional Security

1. **Virus Scanning**: Implement file scanning before storage
2. **Content Moderation**: Automatic content screening
3. **Rate Limiting**: Prevent upload spam
4. **Access Control**: Fine-grained permission system
5. **Audit Logging**: Track all upload/download activities

This implementation provides a robust, scalable, and maintainable solution for file uploads while maintaining clean architecture principles and ensuring excellent user experience. 