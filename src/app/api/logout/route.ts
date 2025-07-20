import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { redisdb } from '../../../utils/redisdb';
import { RepositoryFactory } from '../../../factories/RepositoryFactory';
import { ServiceFactory } from '../../../factories/ServiceFactory';

// Initialize factories and services
const repositoryFactory = RepositoryFactory.getInstance(redisdb);
const serviceFactory = ServiceFactory.getInstance(repositoryFactory);
const userSessionService = serviceFactory.createUserSessionService();
const roomService = serviceFactory.createRoomService();

export async function POST(req: NextRequest) {
  try {
    console.log('=== LOGOUT CLEANUP REQUEST ===');
    
    // Get the user ID from Clerk auth or request body
    const { userId: clerkUserId } = await auth();
    
    let userId = clerkUserId;
    
    // If no user in auth context, try to get from request body
    if (!userId) {
      const body = await req.json();
      userId = body.userId;
    }
    
    if (!userId) {
      console.log('No user ID provided for logout cleanup');
      return NextResponse.json({
        success: false,
        error: 'User ID required for logout cleanup'
      }, { status: 400 });
    }

    console.log(`Processing logout cleanup for user: ${userId}`);

    // Get user's current room before cleanup
    const userData = await userSessionService.getUserBySocketId(await userSessionService.getSocketByUserId(userId) || '');
    
    // If user is in a room, remove them from the room
    if (userData?.roomId) {
      console.log(`User ${userId} is in room ${userData.roomId}, removing from room...`);
      await roomService.leaveRoom(userData.roomId, userId);
    }

    // Perform comprehensive session cleanup
    await userSessionService.cleanupUserLogout(userId);

    console.log(`SUCCESS: Logout cleanup completed for user ${userId}`);

    return NextResponse.json({
      success: true,
      message: 'Logout cleanup completed successfully'
    });

  } catch (error) {
    console.error('=== LOGOUT CLEANUP ERROR ===');
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Logout cleanup failed'
    }, { status: 500 });
  }
} 