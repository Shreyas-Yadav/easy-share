import { toast, ToastOptions, Id } from 'react-toastify';

// Interface for toast notification types
export interface IToastService {
  success(message: string, options?: ToastOptions): Id;
  error(message: string, options?: ToastOptions): Id;
  warning(message: string, options?: ToastOptions): Id;
  info(message: string, options?: ToastOptions): Id;
  loading(message: string, options?: ToastOptions): Id;
  dismiss(toastId?: Id): void;
  dismissAll(): void;
  update(toastId: Id, options: { render: string; type?: 'success' | 'error' | 'warning' | 'info' }): void;
}

// Toast notification types
export enum ToastType {
  SUCCESS = 'success',
  ERROR = 'error',
  WARNING = 'warning',
  INFO = 'info',
  LOADING = 'loading'
}

// Default toast configuration
export const DEFAULT_TOAST_CONFIG: ToastOptions = {
  position: 'top-right',
  autoClose: 3000, // 3 seconds as requested
  hideProgressBar: false,
  closeOnClick: true,
  pauseOnHover: true,
  draggable: true,
  progress: undefined,
  theme: 'light',
};

// Toast service implementation following Single Responsibility Principle
export class ToastService implements IToastService {
  private defaultOptions: ToastOptions;

  constructor(defaultOptions: ToastOptions = DEFAULT_TOAST_CONFIG) {
    this.defaultOptions = defaultOptions;
  }

  success(message: string, options?: ToastOptions): Id {
    return toast.success(message, { ...this.defaultOptions, ...options });
  }

  error(message: string, options?: ToastOptions): Id {
    return toast.error(message, { ...this.defaultOptions, ...options });
  }

  warning(message: string, options?: ToastOptions): Id {
    return toast.warning(message, { ...this.defaultOptions, ...options });
  }

  info(message: string, options?: ToastOptions): Id {
    return toast.info(message, { ...this.defaultOptions, ...options });
  }

  loading(message: string, options?: ToastOptions): Id {
    return toast.loading(message, { ...this.defaultOptions, ...options });
  }

  dismiss(toastId?: Id): void {
    toast.dismiss(toastId);
  }

  dismissAll(): void {
    toast.dismiss();
  }

  update(toastId: Id, options: { render: string; type?: 'success' | 'error' | 'warning' | 'info' }): void {
    toast.update(toastId, {
      render: options.render,
      type: options.type || 'info',
      isLoading: false,
      autoClose: this.defaultOptions.autoClose
    });
  }
}

// Specialized notification services following Open/Closed Principle
export class SocketToastService extends ToastService {
  // Connection related notifications
  connectionEstablished(): Id {
    return this.success('Connected to server', { autoClose: 2000 });
  }

  connectionLost(): Id {
    return this.error('Connection lost. Attempting to reconnect...', { autoClose: false });
  }

  connectionReconnected(): Id {
    return this.success('Reconnected successfully!', { autoClose: 2000 });
  }

  connectionFailed(): Id {
    return this.error('Failed to connect to server. Please refresh the page.', { autoClose: false });
  }
}

export class RoomToastService extends ToastService {
  // Room management notifications
  roomCreated(roomName: string, roomCode: string): Id {
    return this.success(`Room "${roomName}" created! Code: ${roomCode}`, { autoClose: 5000 });
  }

  roomJoined(roomName: string): Id {
    return this.success(`Joined room "${roomName}" successfully!`);
  }

  roomLeft(): Id {
    return this.info('Left the room');
  }

  roomDeleted(): Id {
    return this.warning('Room has been deleted');
  }

  roomNotFound(): Id {
    return this.error('Room not found. Please check the room code.');
  }

  roomFull(): Id {
    return this.error('Room is full. Cannot join.');
  }

  invalidRoomCode(): Id {
    return this.error('Invalid room code. Please check and try again.');
  }
}

export class MessageToastService extends ToastService {
  // Message related notifications
  imageUploadStarted(): Id {
    return this.loading('Uploading image...');
  }

  imageUploadSuccess(): Id {
    return this.success('Image uploaded successfully!');
  }

  imageUploadFailed(error?: string): Id {
    return this.error(error || 'Failed to upload image. Please try again.');
  }

  fileTooLarge(maxSize: string): Id {
    return this.error(`File size too large. Maximum size is ${maxSize}.`);
  }

  invalidFileType(): Id {
    return this.error('Invalid file type. Please select an image file.');
  }

  messageDeleted(): Id {
    return this.info('Message deleted');
  }

  messageSendFailed(): Id {
    return this.error('Failed to send message. Please try again.');
  }
}

export class UserToastService extends ToastService {
  // User related notifications
  userJoined(userName: string): Id {
    return this.info(`${userName} joined the room`, { autoClose: 2000 });
  }

  userLeft(userName: string): Id {
    return this.info(`${userName} left the room`, { autoClose: 2000 });
  }

  userKicked(userName: string): Id {
    return this.warning(`${userName} was removed from the room`);
  }

  copyToClipboard(): Id {
    return this.success('Copied to clipboard!', { autoClose: 1500 });
  }

  copyFailed(): Id {
    return this.error('Failed to copy to clipboard');
  }
}

// Factory pattern for creating toast services (Dependency Inversion Principle)
export class ToastServiceFactory {
  private static socketToastService: SocketToastService;
  private static roomToastService: RoomToastService;
  private static messageToastService: MessageToastService;
  private static userToastService: UserToastService;
  private static generalToastService: ToastService;

  static getSocketToastService(): SocketToastService {
    if (!this.socketToastService) {
      this.socketToastService = new SocketToastService();
    }
    return this.socketToastService;
  }

  static getRoomToastService(): RoomToastService {
    if (!this.roomToastService) {
      this.roomToastService = new RoomToastService();
    }
    return this.roomToastService;
  }

  static getMessageToastService(): MessageToastService {
    if (!this.messageToastService) {
      this.messageToastService = new MessageToastService();
    }
    return this.messageToastService;
  }

  static getUserToastService(): UserToastService {
    if (!this.userToastService) {
      this.userToastService = new UserToastService();
    }
    return this.userToastService;
  }

  static getGeneralToastService(): ToastService {
    if (!this.generalToastService) {
      this.generalToastService = new ToastService();
    }
    return this.generalToastService;
  }
}

// Singleton pattern for easy access throughout the app
export const toastService = ToastServiceFactory.getGeneralToastService();
export const socketToast = ToastServiceFactory.getSocketToastService();
export const roomToast = ToastServiceFactory.getRoomToastService();
export const messageToast = ToastServiceFactory.getMessageToastService();
export const userToast = ToastServiceFactory.getUserToastService(); 