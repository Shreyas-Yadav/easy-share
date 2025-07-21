import { NextRequest, NextResponse } from 'next/server';
import { redisdb } from '../../../utils/redisdb';
import { RepositoryFactory } from '../../../factories/RepositoryFactory';
import { ServiceFactory } from '../../../factories/ServiceFactory';

// Initialize factories and services
const repositoryFactory = RepositoryFactory.getInstance(redisdb);
const serviceFactory = ServiceFactory.getInstance(repositoryFactory);
const billService = serviceFactory.createBillService();

export async function POST(req: NextRequest) {
  try {
    const { imageUrl, imageName, userId, userName, userImage, roomId } = await req.json();

    if (!imageUrl) {
      return NextResponse.json({
        success: false,
        error: 'Image URL is required'
      }, { status: 400 });
    }

    if (!userId || !userName || !roomId) {
      return NextResponse.json({
        success: false,
        error: 'User ID, user name, and room ID are required'
      }, { status: 400 });
    }

    console.log('=== BILL EXTRACTION REQUEST ===');
    console.log('Processing image:', { imageUrl, imageName, userId, userName, roomId });

    // Extract bill data and save to database using BillService
    const billExtraction = await billService.extractAndSaveBill({
      roomId,
      userId,
      userName,
      userImage: userImage || '',
      imageUrl,
      imageName: imageName || 'Unknown'
    });

    console.log('Bill extraction completed and saved to database');
    console.log('Bill ID:', billExtraction.id);
    console.log('Items found:', billExtraction.billData.items.length);
    console.log('Total amount:', billExtraction.billData.total_amount);

    return NextResponse.json({
      success: true,
      data: billExtraction,
      message: 'Bill extracted and saved successfully'
    });

  } catch (error) {
    console.error('=== BILL EXTRACTION ERROR ===');
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Bill extraction failed'
    }, { status: 500 });
  }
} 