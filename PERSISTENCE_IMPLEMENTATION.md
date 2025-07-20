# Chat Room Persistence Implementation

## Overview

This implementation transforms the chat room application from using in-memory storage to a Redis-based persistent storage system following SOLID principles. The architecture provides a clean separation of concerns with proper dependency injection and error handling.

## Architecture

### SOLID Principles Implementation

#### 1. Single Responsibility Principle (SRP)
- **Repository Classes**: Each repository handles data access for a specific entity
  - `RedisRoomRepository`: Manages room data persistence
  - `RedisMessageRepository`: Handles message storage and retrieval
  - `RedisUserSessionRepository`: Manages user session data
  - `RedisCacheRepository`: Handles general caching operations

- **Service Classes**: Each service manages business logic for a specific domain
  - `RoomService`: Room creation, joining, leaving, and management
  - `MessageService`: Message sending, editing, and retrieval
  - `UserSessionService`: User authentication, session management, and activity tracking

#### 2. Open/Closed Principle (OCP)
- **Interface-based Design**: All repositories implement interfaces, allowing for extension without modification
- **Factory Pattern**: New repository implementations can be added without changing existing code
- **Service Layer**: Business logic can be extended through new service methods

#### 3. Liskov Substitution Principle (LSP)
- **Repository Interfaces**: Any implementation of `IRoomRepository`, `IMessageRepository`, etc., can be substituted seamlessly
- **Service Dependencies**: Services depend on abstractions, not concrete implementations

#### 4. Interface Segregation Principle (ISP)
- **Focused Interfaces**: Each repository interface contains only methods relevant to its specific domain
- **Granular Contracts**: Clients depend only on the interfaces they actually use

#### 5. Dependency Inversion Principle (DIP)
- **Factory Pattern**: High-level modules depend on abstractions through factory injection
- **Service Layer**: Services depend on repository interfaces, not concrete implementations
- **Configuration**: Redis connection is injected into repositories

## Key Components

### 1. Repository Layer (`src/repositories/`)

**RedisRoomRepository**
- Stores room data with participant information
- Manages room codes and active room tracking
- Handles participant status updates

**RedisMessageRepository**
- Uses Redis sorted sets for chronological message ordering
- Implements message pagination and counting
- Supports message expiration (30 days default)

**RedisUserSessionRepository**
- Manages user-to-socket mappings
- Tracks active users and room assignments
- Handles session cleanup and expiration

**RedisCacheRepository**
- General-purpose caching with TTL support
- Bulk operations for performance
- Pattern-based deletion capabilities

### 2. Service Layer (`src/services/`)

**RoomService**
- Business logic for room operations
- Validates room access and capacity
- Manages participant lifecycle

**MessageService**
- Handles all message types (text, image, file, system)
- Implements message editing and deletion rules
- Provides search functionality

**UserSessionService**
- User authentication and session management
- Typing indicator management
- Activity tracking and statistics

### 3. Factory Layer (`src/factories/`)

**RepositoryFactory**
- Singleton pattern for repository instantiation
- Manages Redis connection sharing
- Provides clean disposal methods

**ServiceFactory**
- Creates service instances with proper dependency injection
- Ensures single instances for performance
- Manages service lifecycle

### 4. Type System (`src/types/`)

**Repository Interfaces**
- Clear contracts for data access operations
- Consistent error handling patterns
- Generic type support for type safety

**Custom Error Classes**
- `RepositoryError`: Base error for data access issues
- `NotFoundError`: Specific error for missing resources
- `ConflictError`: Business rule violation errors

## Data Storage Strategy

### Redis Key Patterns

```
Rooms:
- room:{id} - Room data with participants
- room_code:{code} - Code to room ID mapping
- active_rooms - Set of active room IDs

Messages:
- message:{id} - Individual message data
- room_messages:{roomId} - Sorted set of message IDs by timestamp
- message_count:{roomId} - Message count for pagination

User Sessions:
- user_socket:{userId} - User to socket ID mapping
- socket_data:{socketId} - Socket session data
- active_users - Set of active user IDs

Cache:
- cache:{key} - General purpose caching
- typing:{roomId}:{userId} - Typing indicators
- activity:{userId} - User activity tracking
```

### Data Persistence Features

1. **Automatic Cleanup**
   - Message expiration (30 days)
   - Session TTL (24 hours)
   - Periodic cleanup of inactive rooms

2. **Performance Optimization**
   - Redis sorted sets for efficient message ordering
   - Bulk operations where possible
   - Minimal data serialization overhead

3. **Reliability Features**
   - Error handling with specific error types
   - Circuit breaker pattern for fault tolerance
   - Retry logic for transient failures
   - Health checking utilities

## Usage Examples

### Creating a Room with Persistence

```typescript
// Old way (in-memory)
const room = { id: '123', name: 'Test Room', /* ... */ };
rooms.set(room.id, room);

// New way (persistent)
const roomService = serviceFactory.createRoomService();
const room = await roomService.createRoom({
  name: 'Test Room',
  createdBy: 'user123',
  maxParticipants: 50
});
```

### Sending a Message with Persistence

```typescript
// Old way (in-memory)
const message = createMessage(/* ... */);
// No persistence

// New way (persistent)
const messageService = serviceFactory.createMessageService();
const message = await messageService.sendMessage({
  roomId: 'room123',
  userId: 'user123',
  userName: 'John Doe',
  userImage: 'avatar.jpg',
  content: 'Hello, world!',
  type: 'text'
});
```

## Error Handling

### Graceful Degradation
- Circuit breaker prevents cascade failures
- Retry logic for transient issues
- Comprehensive error logging
- Health check monitoring

### Error Types
- **NotFoundError**: Resource doesn't exist
- **ConflictError**: Business rule violations
- **RepositoryError**: Data access failures

## Health Monitoring

The implementation includes comprehensive health checking:

```typescript
const healthChecker = new HealthChecker(redis, repositoryFactory, serviceFactory);
const status = await healthChecker.checkHealth();
// Returns detailed health status for all components
```

## Migration Notes

### From In-Memory to Persistent Storage

1. **Data Structure**: All existing data structures are preserved
2. **API Compatibility**: Socket events remain unchanged
3. **Performance**: Redis operations are asynchronous but optimized
4. **Reliability**: Data survives server restarts and failures

### Environment Setup

Ensure Redis environment variables are configured:
```env
UPSTASH_REDIS_URL=your_redis_url
UPSTASH_REDIS_TOKEN=your_redis_token
```

## Benefits Achieved

1. **Data Persistence**: Chat rooms and messages survive server restarts
2. **Scalability**: Redis can handle multiple server instances
3. **Maintainability**: Clean architecture with clear separation of concerns
4. **Testability**: Interface-based design enables easy mocking
5. **Reliability**: Comprehensive error handling and monitoring
6. **Performance**: Optimized Redis operations with proper indexing

## Future Extensions

The architecture supports easy extensions:
- Additional message types
- Message search and indexing
- File upload persistence
- Analytics and reporting
- Multi-tenant support
- Horizontal scaling

This implementation provides a solid foundation for a production-ready chat application with proper data persistence while maintaining clean, maintainable code following SOLID principles. 