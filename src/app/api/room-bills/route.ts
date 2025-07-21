import { NextRequest, NextResponse } from 'next/server';
import { redisdb } from '../../../utils/redisdb';
import { RepositoryFactory } from '../../../factories/RepositoryFactory';
import { ServiceFactory } from '../../../factories/ServiceFactory';

// Initialize factories and services
const repositoryFactory = RepositoryFactory.getInstance(redisdb);
const serviceFactory = ServiceFactory.getInstance(repositoryFactory);
const billService = serviceFactory.createBillService();

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const roomId = searchParams.get('roomId');

    if (!roomId) {
      return NextResponse.json({
        success: false,
        error: 'Room ID is required'
      }, { status: 400 });
    }

    console.log('=== GET ROOM BILLS REQUEST ===');
    console.log('Fetching bills for room:', roomId);

    // Get all bills for the room
    const bills = await billService.getRoomBills(roomId);

    console.log('Bills fetched successfully');
    console.log('Number of bills:', bills.length);

    return NextResponse.json({
      success: true,
      data: bills,
      message: `Found ${bills.length} bills for room`
    });

  } catch (error) {
    console.error('=== GET ROOM BILLS ERROR ===');
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch room bills'
    }, { status: 500 });
  }
}

// POST endpoint to update bill assignments
export async function POST(req: NextRequest) {
  try {
    const { billId, itemAssignments, userId } = await req.json();

    if (!billId || !userId) {
      return NextResponse.json({
        success: false,
        error: 'Bill ID and user ID are required'
      }, { status: 400 });
    }

    if (!itemAssignments || typeof itemAssignments !== 'object') {
      return NextResponse.json({
        success: false,
        error: 'Item assignments are required'
      }, { status: 400 });
    }

    console.log('=== UPDATE BILL ASSIGNMENTS REQUEST ===');
    console.log('Updating bill:', billId, 'for user:', userId);

    // Update bill assignments
    const updatedBill = await billService.updateBillAssignments(billId, itemAssignments, userId);

    console.log('Bill assignments updated successfully');

    return NextResponse.json({
      success: true,
      data: updatedBill,
      message: 'Bill assignments updated successfully'
    });

  } catch (error) {
    console.error('=== UPDATE BILL ASSIGNMENTS ERROR ===');
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update bill assignments'
    }, { status: 500 });
  }
} 