# Redis Setup Guide

## Issue Description
You're seeing this error because the Redis client cannot connect to your Upstash Redis instance:
```
[Upstash Redis] Redis client was initialized without url or token. Failed to execute command.
```

## Quick Fix Steps

### 1. Set Up Your Upstash Redis Database

1. Go to [Upstash Console](https://console.upstash.com/)
2. Sign up or log in to your account
3. Click "Create Database"
4. Choose your preferred region
5. Give your database a name (e.g., "easy-share-chat")
6. Click "Create"

### 2. Get Your Redis Credentials

After creating your database:
1. Click on your newly created database
2. Copy the **REST URL** (this will be your `UPSTASH_REDIS_URL`)
3. Copy the **REST Token** (this will be your `UPSTASH_REDIS_TOKEN`)

### 3. Configure Environment Variables

Create a `.env.local` file in your project root (if it doesn't exist) and add:

```env
# Redis Configuration
UPSTASH_REDIS_URL=https://your-database-id.upstash.io
UPSTASH_REDIS_TOKEN=your_actual_rest_token_here

# Other variables you might need
SOCKET_PORT=3001
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**Important:** Replace the placeholder values with your actual credentials from step 2.

### 4. Verify Your Setup

The updated Redis configuration will now validate your environment variables and show clear error messages if they're missing.

### 5. Restart Your Development Server

After setting up the environment variables:
```bash
npm run dev
```

## Example Configuration

Your `.env.local` should look like this (with your actual values):

```env
UPSTASH_REDIS_URL=https://apt-polliwog-12345.upstash.io
UPSTASH_REDIS_TOKEN=AZjJASQgYjEtNGY4Yi04YWQ0LWE5ZjYtOWEyYjJkNmE2MmE3cGVhcmNlNjdkMTQ0ZWE5NzQ5NTJhYTViZmUzOWE5ZGQ=
```

## Troubleshooting

### If you still see connection errors:

1. **Double-check your credentials** - Make sure you copied the REST URL and REST Token (not the Redis URL/Password)
2. **Check environment file location** - The `.env.local` file should be in your project root, not in the `src` folder
3. **Restart your server** - Environment variables are only loaded on server startup
4. **Check for typos** - Variable names must be exactly `UPSTASH_REDIS_URL` and `UPSTASH_REDIS_TOKEN`

### If you see "Failed to parse URL" errors:

This has been fixed by updating the Redis operations to avoid problematic pipeline usage.

## Security Notes

- Never commit your `.env.local` file to version control
- The `.env.local` file is already in `.gitignore` for security
- Use the `.env.example` file as a template for team members

## What Happens Next

Once configured correctly:
1. ✅ Chat rooms will persist across server restarts
2. ✅ Message history will be saved
3. ✅ User sessions will be maintained
4. ✅ Real-time features will work with persistence

Your chat application will now have full Redis-based persistence! 