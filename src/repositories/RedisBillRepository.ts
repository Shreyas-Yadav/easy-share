import { Redis } from '@upstash/redis';
import type { BillExtraction } from '../types/models';
import type { IBillRepository } from '../types/repositories';
import { NotFoundError, RepositoryError } from '../types/repositories';

export class RedisBillRepository implements IBillRepository {
  private readonly BILL_PREFIX = 'bill:';
  private readonly ROOM_BILLS_PREFIX = 'room_bills:';
  private readonly BILL_TTL = 30 * 24 * 60 * 60; // 30 days in seconds
  
  constructor(private readonly redis: Redis) {}

  async create(billExtraction: BillExtraction): Promise<void> {
    try {
      const billKey = this.getBillKey(billExtraction.id);
      const roomBillsKey = this.getRoomBillsKey(billExtraction.roomId);
      
      // Store bill data
      await this.redis.set(billKey, this.serializeBill(billExtraction));
      
      // Add bill to room's bill list (using timestamp as score for chronological order)
      const score = billExtraction.extractedAt.getTime();
      await this.redis.zadd(roomBillsKey, { score, member: billExtraction.id });
      
      // Set expiration for bills (30 days)
      await this.redis.expire(billKey, this.BILL_TTL);
    } catch (error) {
      throw new RepositoryError(`Failed to create bill extraction: ${error}`);
    }
  }

  async findById(id: string): Promise<BillExtraction | null> {
    try {
      const billKey = this.getBillKey(id);
      const data = await this.redis.get(billKey);
      
      if (!data) {
        return null;
      }
      
      return this.deserializeBill(data);
    } catch (error) {
      throw new RepositoryError(`Failed to find bill extraction: ${error}`);
    }
  }

  async findByRoomId(roomId: string): Promise<BillExtraction[]> {
    try {
      const roomBillsKey = this.getRoomBillsKey(roomId);
      
      // Get all bill IDs for the room, ordered by timestamp (newest first)
      const billIds = await this.redis.zrange(roomBillsKey, 0, -1, { rev: true });
      
      if (!billIds || billIds.length === 0) {
        return [];
      }
      
      // Fetch all bills
      const bills: BillExtraction[] = [];
      for (const billId of billIds as string[]) {
        const bill = await this.findById(billId);
        if (bill) {
          bills.push(bill);
        }
      }
      
      return bills;
    } catch (error) {
      throw new RepositoryError(`Failed to find bills for room: ${error}`);
    }
  }

  async update(billExtraction: BillExtraction): Promise<void> {
    try {
      const billKey = this.getBillKey(billExtraction.id);
      
      // Check if bill exists
      const exists = await this.redis.exists(billKey);
      if (!exists) {
        throw new NotFoundError('Bill extraction', billExtraction.id);
      }
      
      // Update bill data with new updatedAt timestamp
      billExtraction.updatedAt = new Date();
      await this.redis.set(billKey, this.serializeBill(billExtraction));
      
      // Refresh expiration
      await this.redis.expire(billKey, this.BILL_TTL);
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      throw new RepositoryError(`Failed to update bill extraction: ${error}`);
    }
  }

  async delete(id: string): Promise<void> {
    try {
      const bill = await this.findById(id);
      if (!bill) {
        throw new NotFoundError('Bill extraction', id);
      }
      
      const billKey = this.getBillKey(id);
      const roomBillsKey = this.getRoomBillsKey(bill.roomId);
      
      // Delete bill data
      await this.redis.del(billKey);
      
      // Remove from room's bill list
      await this.redis.zrem(roomBillsKey, id);
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      throw new RepositoryError(`Failed to delete bill extraction: ${error}`);
    }
  }

  async deleteRoomBills(roomId: string): Promise<void> {
    try {
      // Get all bill IDs for the room
      const bills = await this.findByRoomId(roomId);
      
      // Delete each bill individually
      for (const bill of bills) {
        await this.delete(bill.id);
      }
      
      // Clean up the room bills list key
      const roomBillsKey = this.getRoomBillsKey(roomId);
      await this.redis.del(roomBillsKey);
    } catch (error) {
      console.error('Error deleting room bills:', error);
      throw error;
    }
  }

  private getBillKey(id: string): string {
    return `${this.BILL_PREFIX}${id}`;
  }

  private getRoomBillsKey(roomId: string): string {
    return `${this.ROOM_BILLS_PREFIX}${roomId}`;
  }

  private serializeBill(bill: BillExtraction): string {
    return JSON.stringify({
      ...bill,
      extractedAt: bill.extractedAt.toISOString(),
      updatedAt: bill.updatedAt.toISOString(),
    });
  }

  private deserializeBill(data: unknown): BillExtraction {
    const parsed = typeof data === 'string' ? JSON.parse(data) : data;
    return {
      ...parsed,
      extractedAt: new Date(parsed.extractedAt),
      updatedAt: new Date(parsed.updatedAt),
    } as BillExtraction;
  }
} 