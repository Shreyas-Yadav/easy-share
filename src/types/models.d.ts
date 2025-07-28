interface User {
    id: string,
    firstName: string,
    lastName: string,
    email: string,
    imageUrl: string
}

// Bill-related types for persistence
export interface BillItem {
  name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  category?: string;
}

export interface BillData {
  items: BillItem[];
  subtotal?: number;
  tax_amount?: number;
  tip_amount?: number;
  total_amount: number;
  restaurant_name?: string;
  date?: string;
}

export interface BillExtraction {
  id: string;
  roomId: string;
  userId: string;
  userName: string;
  userImage: string;
  imageUrl: string;
  imageName: string;
  billData: BillData;
  itemAssignments: Record<number, string[]>; // itemIndex -> userId[]
  billParticipants: BillParticipant[]; // Users included in bill splitting
  extractedAt: Date;
  updatedAt: Date;
}

// Simplified participant data for bill splitting (persists even if user leaves room)
export interface BillParticipant {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  imageUrl: string;
}

// Bill splitting types
export interface BillSplit {
  billId: string;
  userId: string;
  userName: string;
  itemIndexes: number[]; // which items this user is assigned to
  totalAmount: number;
  createdAt: Date;
}