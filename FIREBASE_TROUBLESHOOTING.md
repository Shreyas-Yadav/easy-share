# Firebase Storage Upload Troubleshooting Guide

## Issue: Images Not Uploading to Firebase Storage

This guide helps you troubleshoot Firebase Storage upload issues in the EasyShare chat application.

## 🔍 Recent Fixes Applied

### Problem Identified
The original implementation tried to create `File` objects in a Node.js server environment, which doesn't work correctly. Browser `File` objects don't exist on the server side.

### Solution Implemented
1. **Added Buffer Upload Support**: New `uploadImageFromBuffer()` method for server-side processing
2. **Updated Socket Handler**: Now properly converts `ArrayBuffer` to `Buffer` for Node.js
3. **Enhanced Error Handling**: Comprehensive logging and error reporting
4. **Added Test Endpoint**: `/api/test-firebase` for connectivity testing

## 🔧 Step-by-Step Troubleshooting

### Step 1: Verify Environment Variables

Ensure your `.env.local` file contains all required Firebase configuration:

```env
# Firebase Configuration (All Required)
FIREBASE_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
FIREBASE_MESSAGING_SENDER_ID=123456789012
FIREBASE_APP_ID=1:123456789012:web:abcdefghijklmnop
FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX
```

**Important Notes:**
- File must be named exactly `.env.local` (not `.env` or `.env.local.txt`)
- Must be in project root directory (same level as `package.json`)
- Restart dev server after adding/modifying environment variables

### Step 2: Verify Firebase Console Setup

#### Enable Firebase Storage:
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Navigate to **Build** → **Storage**
4. If not enabled, click **Get started**
5. Choose your location (can't be changed later)
6. Set initial security rules (choose "Start in test mode" for development)

#### Check Storage Rules:
```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // DEVELOPMENT ONLY - Allow all access for testing
    match /{allPaths=**} {
      allow read, write: if true;
    }
  }
}
```

**⚠️ Security Warning:** The above rules allow unrestricted access. For production, implement proper authentication-based rules.

#### Production-Ready Rules Example:
```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /rooms/{roomId}/{allPaths=**} {
      // Only authenticated users can upload to rooms
      allow read, write: if request.auth != null;
    }
  }
}
```

### Step 3: Test Firebase Connectivity

#### Manual Browser Test:
Navigate to: `http://localhost:3000/api/test-firebase`

**Expected Success Response:**
```json
{
  "success": true,
  "message": "Firebase Storage connectivity test passed",
  "result": {
    "url": "https://firebasestorage.googleapis.com/...",
    "path": "test/test-image_timestamp_random.png",
    "size": 67,
    "contentType": "image/png",
    "fileName": "test-image_timestamp_random.png"
  }
}
```

**Error Response Example:**
```json
{
  "success": false,
  "error": "Missing required Firebase environment variables: FIREBASE_API_KEY",
  "details": "..."
}
```

### Step 4: Monitor Console Logs

#### Server-Side Logs (Terminal):
Look for these messages when uploading:
```
✅ Firebase config initialized with project: your-project-id
✅ Storage bucket: your-project-id.appspot.com
✅ Received image upload request: { roomId: '...', imageName: '...', ... }
✅ Buffer created from ArrayBuffer, size: 123456
✅ Starting buffer upload: image.jpg Type: image/jpeg
✅ Uploading buffer to Firebase Storage path: rooms/room123/images/image_123456_abc123.jpg
✅ Buffer upload successful, snapshot: image_123456_abc123.jpg
✅ Download URL generated: https://firebasestorage.googleapis.com/...
✅ Message created and stored: msg_123456_abc123
```

#### Browser Console Logs:
Check Developer Tools (F12) → Console for client-side errors:
```
✅ Starting file upload: image.jpg Size: 123456 Type: image/jpeg
❌ Error: Failed to upload image - [specific error message]
```

### Step 5: Verify File Upload Process

#### Image Selection and Upload Flow:
1. **User selects image** in chat room
2. **Client converts to ArrayBuffer** and sends via socket
3. **Server receives buffer** and converts to Node.js Buffer
4. **Firebase upload** happens with proper metadata
5. **Message created** with Firebase Storage URL
6. **Broadcast to room** with image message

#### Debug Each Step:
1. **Image Selection**: Check file picker works
2. **Socket Transmission**: Verify data reaches server
3. **Buffer Conversion**: Confirm buffer size matches original
4. **Firebase Upload**: Check Firebase Console for new files
5. **Message Storage**: Verify message appears in chat

## 🚨 Common Issues & Solutions

### Issue 1: "Missing Firebase environment variables"

**Symptoms:**
```
Missing required Firebase environment variables: FIREBASE_API_KEY, FIREBASE_PROJECT_ID
```

**Solutions:**
1. Check `.env.local` file exists in project root
2. Verify all variable names match exactly (case-sensitive)
3. Restart development server: `npm run dev`
4. Ensure no spaces around `=` in environment file

### Issue 2: "Firebase Storage bucket not found"

**Symptoms:**
```
Error: Firebase Storage bucket 'undefined' not found
```

**Solutions:**
1. Verify `FIREBASE_STORAGE_BUCKET` is correctly set
2. Check Firebase Console → Project Settings → General for correct bucket name
3. Ensure Storage is enabled in Firebase Console

### Issue 3: "Permission denied" errors

**Symptoms:**
```
FirebaseError: Firebase Storage: User does not have permission to access 'rooms/...'
```

**Solutions:**
1. Update Storage Rules to allow uploads (see Step 2)
2. For testing, use permissive rules: `allow read, write: if true;`
3. Check Firebase Console → Storage → Rules tab

### Issue 4: Images appear to upload but don't show in chat

**Symptoms:**
- No errors in console
- Files appear in Firebase Storage
- Images don't display in chat messages

**Solutions:**
1. Check message creation logs
2. Verify Redis message storage
3. Check WebSocket message broadcasting
4. Inspect network tab for failed image loads

### Issue 5: "File constructor is not defined"

**Symptoms:**
```
ReferenceError: File is not defined
```

**Solutions:**
- This should be fixed with recent updates
- Ensure you're using the latest code with `uploadImageFromBuffer`
- Verify socket handler uses buffer conversion, not File objects

## 🧪 Testing Checklist

### Basic Functionality Test:
- [ ] Environment variables loaded correctly
- [ ] Firebase config shows project ID and bucket
- [ ] Test endpoint (`/api/test-firebase`) returns success
- [ ] Can create/join chat rooms
- [ ] Image picker opens when clicking camera button
- [ ] Selected images show preview in chat input
- [ ] Upload progress or success indicators appear
- [ ] Images display in chat messages
- [ ] Other users see uploaded images
- [ ] Images load from Firebase URLs

### Advanced Testing:
- [ ] Large image upload (near 10MB limit)
- [ ] Multiple image uploads in sequence
- [ ] Upload during poor network conditions
- [ ] Different image formats (PNG, JPG, GIF, WebP)
- [ ] Error handling for invalid file types
- [ ] Error handling for oversized files
- [ ] Message deletion removes files from Firebase
- [ ] Room deletion cleans up all associated files

## 📊 Monitoring & Analytics

### Firebase Console Monitoring:
1. **Storage Usage**: Monitor file uploads and storage consumption
2. **Request Metrics**: Track upload/download request counts
3. **Error Rates**: Monitor failed uploads
4. **Security Rules**: Review rule evaluation logs

### Application Logging:
- Enable detailed logging in development
- Monitor upload success/failure rates
- Track file sizes and upload times
- Log user feedback on upload issues

## 🔧 Advanced Configuration

### Firebase Storage CORS (if needed):
```json
[
  {
    "origin": ["https://your-domain.com", "http://localhost:3000"],
    "method": ["GET", "POST", "PUT"],
    "maxAgeSeconds": 3600
  }
]
```

### Environment-Specific Configuration:
```javascript
// firebase.ts - Environment-aware configuration
const config = {
  development: {
    storageBucket: "your-project-dev.appspot.com",
    // ... dev config
  },
  production: {
    storageBucket: "your-project-prod.appspot.com",
    // ... prod config
  }
};
```

## 📞 Getting Help

If issues persist after following this guide:

1. **Share Console Logs**: Include both browser and server-side logs
2. **Firebase Console Screenshots**: Show Storage settings and rules
3. **Environment Variables**: Share variable names (not values)
4. **Network Analysis**: Include Network tab information from DevTools
5. **Firebase Project Settings**: Screenshots of project configuration

### Useful Commands for Debugging:

```bash
# Check environment variables (development)
npm run dev > dev.log 2>&1

# Test Firebase connectivity
curl http://localhost:3000/api/test-firebase

# Monitor real-time logs
tail -f dev.log | grep -i firebase
```

This troubleshooting guide should resolve most Firebase Storage upload issues. The recent code changes specifically address server-side File object creation problems that are common in Next.js applications. 