import { RepositoryError, NotFoundError, ConflictError } from '../types/repositories';

export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    timestamp: string;
  };
}

export interface SuccessResponse<T = any> {
  success: true;
  data: T;
  timestamp: string;
}

export type ApiResponse<T = any> = SuccessResponse<T> | ErrorResponse;

export function createErrorResponse(error: Error): ErrorResponse {
  const timestamp = new Date().toISOString();
  
  if (error instanceof NotFoundError) {
    return {
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: error.message,
        timestamp,
      },
    };
  }
  
  if (error instanceof ConflictError) {
    return {
      success: false,
      error: {
        code: 'CONFLICT',
        message: error.message,
        timestamp,
      },
    };
  }
  
  if (error instanceof RepositoryError) {
    return {
      success: false,
      error: {
        code: error.code || 'REPOSITORY_ERROR',
        message: error.message,
        timestamp,
      },
    };
  }
  
  // Generic error
  return {
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
      timestamp,
    },
  };
}

export function createSuccessResponse<T>(data: T): SuccessResponse<T> {
  return {
    success: true,
    data,
    timestamp: new Date().toISOString(),
  };
}

export function handleAsyncError<T extends (...args: any[]) => Promise<any>>(
  fn: T
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await fn(...args);
    } catch (error) {
      console.error('Async operation failed:', error);
      throw error;
    }
  }) as T;
}

export class CircuitBreaker {
  private failures = 0;
  private nextAttempt = Date.now();
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';

  constructor(
    private readonly threshold: number = 5,
    private readonly timeout: number = 60000
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttempt) {
        throw new Error('Circuit breaker is OPEN');
      }
      this.state = 'HALF_OPEN';
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failures = 0;
    this.state = 'CLOSED';
  }

  private onFailure(): void {
    this.failures++;
    if (this.failures >= this.threshold) {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.timeout;
    }
  }

  getState(): string {
    return this.state;
  }
}

export class RetryHandler {
  constructor(
    private readonly maxRetries: number = 3,
    private readonly baseDelay: number = 1000
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt === this.maxRetries) {
          break;
        }
        
        // Exponential backoff
        const delay = this.baseDelay * Math.pow(2, attempt - 1);
        await this.sleep(delay);
      }
    }
    
    throw lastError!;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export function isRetryableError(error: Error): boolean {
  // Define which errors should be retried
  return !(error instanceof NotFoundError || error instanceof ConflictError);
}

export function logError(error: Error, context?: string): void {
  const timestamp = new Date().toISOString();
  const errorInfo = {
    timestamp,
    context: context || 'Unknown',
    message: error.message,
    stack: error.stack,
    name: error.name,
  };
  
  console.error('Application Error:', JSON.stringify(errorInfo, null, 2));
} 