# Twilio Setup Guide

This guide explains how to set up Twilio for phone verification and password reset functionality.

## Prerequisites

1. A Twilio account (sign up at https://www.twilio.com/try-twilio)
2. A Twilio phone number (you'll get one with a free trial)

## Setup Steps

### 1. Get Your Twilio Credentials

1. Log in to your [Twilio Console](https://console.twilio.com/)
2. Go to the Dashboard
3. Copy your **Account SID** and **Auth Token**
4. Go to Phone Numbers → Manage → Active numbers
5. Copy your **Twilio Phone Number** (format: +1234567890)

### 2. Configure Environment Variables

Add the following to your `.env` file in the `backend` directory:

```env
# Twilio Configuration
TWILIO_ACCOUNT_SID=your_account_sid_here
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_PHONE_NUMBER=+1234567890
```

### 3. Development Mode

If Twilio is not configured (credentials are missing), the system will run in **development mode**:
- Verification codes will be generated and logged to the console
- Codes will also be returned in the API response (for testing)
- No actual SMS will be sent

This allows you to test the verification flow without setting up Twilio immediately.

### 4. Phone Number Format

The system automatically formats phone numbers:
- If the number starts with `0`, it assumes Tanzania (+255) and converts it
- If no country code is provided, it defaults to +255 (Tanzania)
- Numbers should be in format: `+255123456789` or `0712345678`

### 5. Testing

1. Start the backend server: `npm run dev`
2. Use the registration or forgot password flow
3. In development mode, check the console for the verification code
4. In production mode (with Twilio configured), codes will be sent via SMS

## Features

- **Phone Verification for Registration**: Users must verify their phone number before account creation
- **Password Reset via SMS**: Users can reset their password using phone verification
- **Code Expiration**: Verification codes expire after 10 minutes
- **One-time Use**: Each code can only be used once
- **Automatic Cleanup**: Expired codes are automatically cleaned up

## API Endpoints

- `POST /api/users/send-verification-code` - Send verification code
- `POST /api/users/verify-code` - Verify the code
- `POST /api/users/reset-password` - Reset password with verification code

## Security Notes

- Verification codes are stored in the database with expiration timestamps
- Codes are hashed and verified server-side
- Phone numbers are normalized and validated
- Failed verification attempts are logged

## Troubleshooting

### Codes not being sent
- Check your Twilio credentials in `.env`
- Verify your Twilio account has sufficient credits
- Check the Twilio console for error logs
- In development mode, check the server console for codes

### Invalid phone number errors
- Ensure phone numbers include country code
- Format: `+255123456789` or `0712345678` (will auto-convert to +255)

### Code expired errors
- Codes expire after 10 minutes
- Request a new code if expired

