# Resend Email Setup Guide

This guide explains how to configure Resend for email-based password reset and user verification.

## Prerequisites

1. A Resend account (sign up at https://resend.com)
2. Your domain verified in Resend

## Setup Steps

### 1. Get Your Resend API Key

1. Log in to your [Resend Dashboard](https://resend.com/dashboard)
2. Go to **API Keys** section
3. Click **Create API Key**
4. Name it something like "RebateFlow Production"
5. Copy the API key (it starts with `re_`)

### 2. Verify Your Domain (Required for Production)

1. In Resend Dashboard, go to **Domains**
2. Click **Add Domain**
3. Enter your domain (e.g., `yourdomain.com`)
4. Add the DNS records shown to your domain provider
5. Wait for verification (usually takes a few minutes)

### 3. Configure Environment Variables

Add the following to your `.env` file in the `backend` directory:

```env
# Resend Configuration
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx
RESEND_FROM_EMAIL=noreply@yourdomain.com
APP_NAME=RebateFlow
```

**Important:** 
- Use your verified domain for `RESEND_FROM_EMAIL`
- The `APP_NAME` is optional and defaults to "RebateFlow"

### 4. Test the Setup

1. Restart your backend server
2. Go to the Forgot Password page
3. Enter a valid email address
4. Check your inbox (and spam folder) for the verification code

## Email Templates

The system sends beautifully formatted HTML emails:

### Registration Email
- Subject: "RebateFlow - Verify Your Email Address"
- Contains: Welcome message + 6-digit verification code
- Code expires in: 10 minutes

### Password Reset Email
- Subject: "RebateFlow - Password Reset Code"
- Contains: Password reset instructions + 6-digit code
- Code expires in: 10 minutes

## API Endpoints

### Send Email Verification Code
```
POST /api/users/send-email-code
Body: { email: string, purpose: 'registration' | 'password_reset' }
```

### Verify Email Code
```
POST /api/users/verify-email-code
Body: { email: string, code: string, purpose: 'registration' | 'password_reset' }
```

### Reset Password by Email
```
POST /api/users/reset-password-email
Body: { email: string, verification_code: string, new_password: string }
```

## Troubleshooting

### Email not received?
1. Check your spam folder
2. Verify your domain is properly configured in Resend
3. Check the backend logs for error messages
4. Ensure `RESEND_API_KEY` is correctly set

### "Email service is not configured" error?
- The `RESEND_API_KEY` environment variable is not set
- Make sure you've added it to your `.env` file and restarted the server

### Rate limiting issues?
- Password reset endpoints are rate-limited to 3 attempts per hour
- Wait or use a different IP address for testing

## Security Notes

1. Verification codes expire after 10 minutes
2. Each code can only be used once
3. Password reset requires the exact email used to register
4. Rate limiting prevents brute force attacks

## Free Tier Limits (Resend)

- 3,000 emails per month (free tier)
- 100 emails per day
- This is more than enough for most applications

## Migration

If you need to add email support to your existing database, run:

```bash
npm run migrate:email
```

This adds the necessary columns to support email verification.

