import { NextRequest, NextResponse } from 'next/server';
import { redisdb } from '../../../utils/redisdb';
import { RepositoryFactory } from '../../../factories/RepositoryFactory';
import { ServiceFactory } from '../../../factories/ServiceFactory';

// Initialize factories and services
const repositoryFactory = RepositoryFactory.getInstance(redisdb);
const serviceFactory = ServiceFactory.getInstance(repositoryFactory);
const messageService = serviceFactory.createMessageService();

export async function POST(req: NextRequest) {
  try {
    console.log('=== IMAGE UPLOAD HTTP ENDPOINT ===');
    
    // Parse form data
    const formData = await req.formData();
    const file = formData.get('image') as File;
    const roomId = formData.get('roomId') as string;
    const userId = formData.get('userId') as string;
    const userName = formData.get('userName') as string;
    const userImage = formData.get('userImage') as string;

    console.log('1. Received upload request:', {
      fileName: file?.name,
      fileSize: file?.size,
      fileType: file?.type,
      roomId,
      userId,
      userName
    });

    // Validate inputs
    if (!file || !roomId || !userId || !userName) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields'
      }, { status: 400 });
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({
        success: false,
        error: 'File must be an image'
      }, { status: 400 });
    }

    // Validate file size (3MB limit)
    const maxSize = 3 * 1024 * 1024; // 3MB
    if (file.size > maxSize) {
      return NextResponse.json({
        success: false,
        error: 'Image size must be less than 3MB'
      }, { status: 400 });
    }

    console.log('2. File validation passed, uploading to Firebase...');

    // Convert File to buffer for server-side processing
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    console.log('3. File converted to buffer, size:', buffer.length);

    // Upload image buffer to Firebase and create message
    const imageMessage = await messageService.uploadAndSendImageFromBuffer({
      roomId,
      userId,
      userName,
      userImage,
      buffer: buffer,
      fileName: file.name,
      contentType: file.type
    });

    console.log('4. Image uploaded to Firebase and message created:', {
      messageId: imageMessage.id,
      imageUrl: imageMessage.imageUrl,
      fileName: imageMessage.imageName
    });

    console.log('5. Upload completed successfully');

    return NextResponse.json({
      success: true,
      message: imageMessage,
      imageUrl: imageMessage.imageUrl
    });

  } catch (error) {
    console.error('=== IMAGE UPLOAD ERROR ===');
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Upload failed'
    }, { status: 500 });
  }
} 