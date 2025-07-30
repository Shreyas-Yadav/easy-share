# EasyShare 🚀

**A real-time file sharing and bill splitting application with AI-powered receipt analysis**

## What is EasyShare?

EasyShare is a modern web application that makes it easy for groups to share files, chat in real-time, and split bills automatically. Think of it as a digital room where friends, colleagues, or family members can gather to share documents and receipts, with the app automatically extracting bill information using AI.

### For Non-Technical Users

**What can you do with EasyShare?**
- 📁 **Share files** with your group instantly
- 💬 **Chat in real-time** with room participants
- 🧾 **Upload receipts** and let AI extract the bill details automatically
- 💰 **Split bills** easily - the app reads restaurant receipts and organizes items by category
- 🔐 **Secure rooms** with unique 6-character codes
- 👥 **Manage participants** - control who can join your room

**Perfect for:**
- Roommates splitting grocery bills
- Friends sharing vacation photos and receipts
- Work teams collaborating on documents
- Family members organizing shared expenses

### For Developers

EasyShare is built with modern web technologies and features:

**Tech Stack:**
- **Frontend:** Next.js 15, React 19, TypeScript, Tailwind CSS
- **Backend:** Next.js API routes, Socket.IO for real-time communication
- **Authentication:** Clerk for secure user management
- **Database:** Redis for caching and session management
- **File Storage:** Firebase Storage for file uploads
- **AI Integration:** OpenAI API for receipt analysis
- **Real-time:** Socket.IO for live messaging and file sharing

**Key Features:**
- Real-time messaging and file sharing
- AI-powered receipt/bill extraction
- Room-based collaboration with participant limits
- Secure file upload and storage
- Responsive design for all devices

## Features

### 🏠 Room Management
- Create rooms with custom names and participant limits
- Join rooms using 6-character codes
- Real-time participant list and status
- Room persistence across sessions

### 📁 File Sharing
- Drag-and-drop file uploads
- Support for images, documents, and other file types
- Real-time file sharing notifications
- Secure file storage with Firebase

### 💬 Real-time Chat
- Instant messaging between room participants
- Message history persistence
- User avatars and online status
- Typing indicators

### 🧾 AI Bill Extraction
- Upload restaurant receipts
- Automatic extraction of:
  - Restaurant name and date
  - Individual items with prices
  - Total bill amount
  - Item categorization (food, drinks, desserts, etc.)
- Organized bill breakdown for easy splitting

### 🔐 Security & Authentication
- Secure user authentication with Clerk
- Room access control
- File upload validation
- Session management

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm, yarn, pnpm, or bun
- Redis database
- Firebase project (for file storage)
- OpenAI API key (for bill extraction)
- Clerk account (for authentication)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd easy-share
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   
   Create a `.env.local` file in the root directory:
   ```env
   # Clerk Authentication
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
   CLERK_SECRET_KEY=your_clerk_secret_key

   NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
   NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/
   NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/
   
   # Redis Database
   UPSTASH_REDIS_REST_URL=your_redis_url
   UPSTASH_REDIS_REST_TOKEN=your_redis_token
   
   # Firebase Storage
   NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_firebase_auth_domain
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_firebase_project_id
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_firebase_storage_bucket
   FIREBASE_PRIVATE_KEY=your_firebase_private_key
   FIREBASE_CLIENT_EMAIL=your_firebase_client_email
   
   # OpenAI API
   OPENROUTER_API_KEY=your_openai_api_key
   ```

4. **Run the development server**
   ```bash
   npm run dev
   ```

5. **Open your browser**
   
   Navigate to [http://localhost:3000](http://localhost:3000) to see the application.

## Usage Guide

### Creating a Room
1. Sign in to your account
2. Click "Create Room" 
3. Enter a room name and set participant limit
4. Share the generated 6-character code with others

### Joining a Room
1. Click "Join Room"
2. Enter the 6-character room code
3. Start sharing files and chatting!

### Sharing Files
1. In a room, drag and drop files or click to upload
2. Files are instantly shared with all room participants
3. View shared files in the room's file list

### Extracting Bills from Receipts
1. Upload a restaurant receipt image
2. The AI will automatically extract:
   - Restaurant name and date
   - Individual items and prices
   - Total amount
   - Item categories
3. View the organized breakdown for easy bill splitting

## Project Structure

```
easy-share/
├── src/
│   ├── app/                   # Next.js app router
│   │   ├── (room)/            # Room-related pages
│   │   ├── api/               # API routes
│   │   └── sign-in/           # Authentication pages
│   ├── components/            # React components
│   │   ├── providers/         # Context providers
│   │   ├── room/              # Room-specific components
│   │   └── ui/                # Reusable UI components
│   ├── factories/             # Service and repository factories
│   ├── repositories/          # Data access layer
│   ├── services/              # Business logic services
│   ├── types/                 # TypeScript type definitions
│   └── utils/                 # Utility functions
├── public/                    # Static assets
└── package.json               # Dependencies and scripts
```

## API Endpoints

- `POST /api/extract-bill` - Extract bill data from receipt images
- `POST /api/upload-image` - Upload images to Firebase Storage
- `GET /api/room-bills` - Get bills for a specific room
- `POST /api/socket` - Socket.IO connection endpoint

## Support

If you encounter any issues or have questions:
- Check the [Issues](https://github.com/your-repo/easy-share/issues) page
- Create a new issue with detailed information
- Contact the development team

---

**Made with ❤️ using Next.js, React, Redis and Cursor**
