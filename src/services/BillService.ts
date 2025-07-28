import type { BillExtraction, BillParticipant } from '../types/models';
import type { IBillRepository, IRoomRepository } from '../types/repositories';
import { NotFoundError, ConflictError } from '../types/repositories';
import { extractBillFromImage } from '../utils/billExtraction';

export class BillService {
  constructor(
    private readonly billRepository: IBillRepository,
    private readonly roomRepository: IRoomRepository
  ) {}

  async extractAndSaveBill(data: {
    roomId: string;
    userId: string;
    userName: string;
    userImage: string;
    imageUrl: string;
    imageName: string;
  }): Promise<BillExtraction> {
    // Verify room exists
    const room = await this.roomRepository.findById(data.roomId);
    if (!room) {
      throw new NotFoundError('Room', data.roomId);
    }

    // Extract bill data using OpenAI
    const billData = await extractBillFromImage(data.imageUrl);

    // Create bill extraction record
    const billExtraction: BillExtraction = {
      id: this.generateBillId(),
      roomId: data.roomId,
      userId: data.userId,
      userName: data.userName,
      userImage: data.userImage,
      imageUrl: data.imageUrl,
      imageName: data.imageName,
      billData,
      itemAssignments: {}, // Empty initially
      billParticipants: [], // Empty initially - room creator will add participants
      extractedAt: new Date(),
      updatedAt: new Date(),
    };

    // Save to database
    await this.billRepository.create(billExtraction);

    return billExtraction;
  }

  async updateBillAssignments(
    billId: string,
    itemAssignments: Record<number, string[]>,
    userId: string
  ): Promise<BillExtraction> {
    const bill = await this.billRepository.findById(billId);
    if (!bill) {
      throw new NotFoundError('Bill extraction', billId);
    }

    // Verify room exists and user has access
    const room = await this.roomRepository.findById(bill.roomId);
    if (!room) {
      throw new NotFoundError('Room', bill.roomId);
    }

    // Check if user is a participant in the room
    const isParticipant = room.participants.some(p => p.userId === userId);
    if (!isParticipant) {
      throw new ConflictError('You must be a room participant to update bill assignments');
    }

    // Permission checks for bill assignment updates
    const isRoomCreator = room.createdBy === userId;
    
    if (!isRoomCreator) {
      // For regular participants, validate they're only modifying their own assignments
      const currentAssignments = bill.itemAssignments || {};
      
      for (const [itemIndex, assignedUsers] of Object.entries(itemAssignments)) {
        const currentUsers = currentAssignments[parseInt(itemIndex)] || [];
        const newUsers = assignedUsers || [];
        
        // Check if any changes involve other users
        const addedUsers = newUsers.filter(user => !currentUsers.includes(user));
        const removedUsers = currentUsers.filter(user => !newUsers.includes(user));
        
        // Participants can only add/remove themselves
        for (const addedUser of addedUsers) {
          if (addedUser !== userId) {
            throw new ConflictError('You can only assign/unassign yourself to bill items');
          }
        }
        
        for (const removedUser of removedUsers) {
          if (removedUser !== userId) {
            throw new ConflictError('You can only assign/unassign yourself to bill items');
          }
        }
      }
    }
    // Room creators have full permission to edit all assignments

    // Update assignments
    bill.itemAssignments = itemAssignments;
    bill.updatedAt = new Date();
    // Explicitly preserve billParticipants during item assignment updates
    // This ensures checkboxes don't clear the participant columns
    if (!bill.billParticipants) {
      bill.billParticipants = []; // Ensure it's always an array
    }

    await this.billRepository.update(bill);
    return bill;
  }

  async updateBillParticipants(
    billId: string,
    billParticipants: BillParticipant[],
    userId: string
  ): Promise<BillExtraction> {
    const bill = await this.billRepository.findById(billId);
    if (!bill) {
      throw new NotFoundError('Bill extraction', billId);
    }

    // Verify room exists and user has access
    const room = await this.roomRepository.findById(bill.roomId);
    if (!room) {
      throw new NotFoundError('Room', bill.roomId);
    }

    // Only room creator can manage bill participants
    if (room.createdBy !== userId) {
      throw new ConflictError('Only the room creator can manage bill participants');
    }

    // Update bill participants
    bill.billParticipants = billParticipants;
    bill.updatedAt = new Date();

    await this.billRepository.update(bill);
    return bill;
  }

  async getBillById(billId: string): Promise<BillExtraction | null> {
    return this.billRepository.findById(billId);
  }

  async getRoomBills(roomId: string): Promise<BillExtraction[]> {
    // Verify room exists
    const room = await this.roomRepository.findById(roomId);
    if (!room) {
      throw new NotFoundError('Room', roomId);
    }

    return this.billRepository.findByRoomId(roomId);
  }

  async deleteBill(billId: string, userId: string): Promise<void> {
    const bill = await this.billRepository.findById(billId);
    if (!bill) {
      throw new NotFoundError('Bill extraction', billId);
    }

    // Verify room exists
    const room = await this.roomRepository.findById(bill.roomId);
    if (!room) {
      throw new NotFoundError('Room', bill.roomId);
    }

    // Only allow bill creator or room creator to delete
    const canDelete = bill.userId === userId || room.createdBy === userId;
    if (!canDelete) {
      throw new ConflictError('Only the bill creator or room creator can delete this bill');
    }

    await this.billRepository.delete(billId);
  }

  async deleteRoomBills(roomId: string): Promise<void> {
    await this.billRepository.deleteRoomBills(roomId);
  }

  async calculateUserTotals(billId: string): Promise<Record<string, number>> {
    const bill = await this.billRepository.findById(billId);
    if (!bill) {
      throw new NotFoundError('Bill extraction', billId);
    }

    const userTotals: Record<string, number> = {};

    // Calculate split for each item
    bill.billData.items.forEach((item, index) => {
      const assignedUsers = bill.itemAssignments[index] || [];
      if (assignedUsers.length > 0) {
        const splitAmount = item.total_price / assignedUsers.length;
        assignedUsers.forEach(userId => {
          userTotals[userId] = (userTotals[userId] || 0) + splitAmount;
        });
      }
    });

    return userTotals;
  }

  private generateBillId(): string {
    return `bill_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
} 