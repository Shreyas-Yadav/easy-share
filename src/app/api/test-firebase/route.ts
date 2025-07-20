import { NextRequest, NextResponse } from 'next/server';
import { FirebaseStorageService } from '../../../services/FirebaseStorageService';

export async function GET(req: NextRequest) {
  try {
    console.log('Testing Firebase Storage connectivity...');

    // Create a test storage service instance
    const storageService = new FirebaseStorageService();

    // Create a small test buffer (1x1 transparent PNG)
    const testImageBuffer = Buffer.from([
      0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 
      0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4,
      0x89, 0x00, 0x00, 0x00, 0x0B, 0x49, 0x44, 0x41,
      0x54, 0x78, 0x9C, 0x63, 0x60, 0x00, 0x00, 0x00,
      0x02, 0x00, 0x01, 0xE5, 0x27, 0xDE, 0xFC, 0x00,
      0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE,
      0x42, 0x60, 0x82
    ]);

    console.log('Attempting to upload test image...');

    // Test upload
    const result = await storageService.uploadImageFromBuffer(
      testImageBuffer,
      'test-image.png',
      'image/png',
      'test'
    );

    console.log('Test upload successful:', result);

    // Clean up test file
    try {
      await storageService.deleteFile(result.url);
      console.log('Test file cleaned up successfully');
    } catch (cleanupError) {
      console.warn('Failed to clean up test file:', cleanupError);
    }

    return NextResponse.json({
      success: true,
      message: 'Firebase Storage connectivity test passed',
      result: {
        url: result.url,
        path: result.path,
        size: result.size,
        contentType: result.contentType,
        fileName: result.fileName
      }
    });

  } catch (error) {
    console.error('Firebase Storage test failed:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      details: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({
        success: false,
        error: 'No file provided'
      }, { status: 400 });
    }

    console.log('Testing file upload with real file:', file.name, file.size, file.type);

    const storageService = new FirebaseStorageService();
    const result = await storageService.uploadImage(file, 'test');

    return NextResponse.json({
      success: true,
      message: 'File upload test passed',
      result: {
        url: result.url,
        path: result.path,
        size: result.size,
        contentType: result.contentType,
        fileName: result.fileName
      }
    });

  } catch (error) {
    console.error('File upload test failed:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      details: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
} 