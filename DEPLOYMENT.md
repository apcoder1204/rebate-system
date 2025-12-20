# Deployment Guide for Vercel (Frontend) and Render (Backend)

This guide explains how to deploy your rebate system using the `feature/dual-database-session-management` branch.

## Prerequisites

1. **GitHub Repository**: Your code must be pushed to GitHub
2. **Vercel Account**: For frontend deployment
3. **Render Account**: For backend deployment
4. **Neon Database**: Already configured (primary database)
5. **Localhost PostgreSQL**: Optional (backup database)

## Step 1: Push Branch to GitHub

If you haven't already, push your branch to GitHub:

```bash
# Add remote (if not already added)
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git

# Push the branch
git push -u origin feature/dual-database-session-management
```

## Step 2: Deploy Frontend on Vercel

### 2.1 Connect Repository to Vercel

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click **"Add New Project"**
3. Import your GitHub repository
4. Select the repository

### 2.2 Configure Project Settings

**Root Directory**: Leave as root (or set to project root if monorepo)

**Framework Preset**: Vite

**Build Command**: `npm run build`

**Output Directory**: `dist`

**Install Command**: `npm install`

### 2.3 Set Environment Variables

Go to **Settings → Environment Variables** and add:

```env
# API URL (your Render backend URL)
VITE_API_URL=https://your-backend.onrender.com/api

# Example:
VITE_API_URL=https://rebate-system-backend.onrender.com/api
```

### 2.4 Configure Branch Deployment

1. Go to **Settings → Git**
2. Under **Production Branch**, you can:
   - Keep `main`/`master` as production
   - Or set `feature/dual-database-session-management` as production branch
3. Enable **Preview Deployments** to auto-deploy all branches

### 2.5 Deploy

1. Click **Deploy**
2. Vercel will build and deploy your frontend
3. You'll get a URL like: `https://your-app.vercel.app`

## Step 3: Deploy Backend on Render

### 3.1 Create New Web Service

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub repository
4. Select your repository

### 3.2 Configure Service Settings

**Name**: `rebate-system-backend` (or your preferred name)

**Region**: Choose closest to your users

**Branch**: `feature/dual-database-session-management`

**Root Directory**: `backend`

**Runtime**: `Node`

**Build Command**: `npm install && npm run build`

**Start Command**: `npm start`

### 3.3 Set Environment Variables

Go to **Environment** tab and add:

```env
# Primary Database (Neon) - REQUIRED
NEON_DATABASE_URL=postgresql://neondb_owner:YOUR_PASSWORD@ep-dry-cloud-agiicyd1-pooler.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require

# Backup Database (Optional - can leave empty for production)
DB_HOST=
DB_PORT=5432
DB_NAME=rebate_system
DB_USER=
DB_PASSWORD=

# Server Configuration
PORT=10000
FRONTEND_URL=https://your-frontend.vercel.app

# JWT Secret (generate a strong random string)
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# Twilio Configuration (Optional)
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=+1234567890
```

**Important Notes:**
- Replace `YOUR_PASSWORD` with your actual Neon database password
- `FRONTEND_URL` should match your Vercel deployment URL
- Generate a strong `JWT_SECRET` (you can use: `openssl rand -base64 32`)
- For production, you might want to skip the backup database (localhost won't be accessible)

### 3.4 Advanced Settings

**Auto-Deploy**: Enable to auto-deploy on push to the branch

**Health Check Path**: `/api/health` (optional - create this endpoint)

### 3.5 Deploy

1. Click **"Create Web Service"**
2. Render will build and deploy your backend
3. You'll get a URL like: `https://your-backend.onrender.com`

## Step 4: Update Frontend Environment Variable

After backend is deployed, update Vercel environment variable:

1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Update `VITE_API_URL` to your Render backend URL:
   ```
   VITE_API_URL=https://your-backend.onrender.com/api
   ```
3. Redeploy frontend (or it will auto-redeploy)

## Step 5: Run Database Migrations

After backend is deployed, run migrations on Neon database:

### Option 1: Via Render Shell

1. Go to Render Dashboard → Your Service
2. Click **"Shell"** tab
3. Run:
   ```bash
   cd backend
   npm run migrate
   ```

### Option 2: Via Local Machine

1. Clone repository
2. Checkout the branch
3. Set `NEON_DATABASE_URL` in local `.env`
4. Run:
   ```bash
   cd backend
   npm install
   npm run migrate
   ```

## Step 6: Verify Deployment

### Frontend (Vercel)
- Visit your Vercel URL
- Check browser console for errors
- Test login functionality

### Backend (Render)
- Visit: `https://your-backend.onrender.com/api/health` (if you created this endpoint)
- Test API endpoints
- Check Render logs for errors

## Branch Strategy

### Option A: Use Branch as Production
- Set `feature/dual-database-session-management` as production branch
- All deployments come from this branch
- Merge to `main` when ready

### Option B: Merge to Main First
```bash
# Switch to main
git checkout main

# Merge feature branch
git merge feature/dual-database-session-management

# Push to main
git push origin main
```
Then configure Vercel/Render to use `main` branch.

## Environment Variables Summary

### Vercel (Frontend)
- `VITE_API_URL` - Your Render backend URL

### Render (Backend)
- `NEON_DATABASE_URL` - Neon database connection string
- `FRONTEND_URL` - Your Vercel frontend URL
- `JWT_SECRET` - Secret key for JWT tokens
- `TWILIO_*` - Twilio credentials (optional)
- `PORT` - Server port (usually 10000 on Render)

## Troubleshooting

### Backend Won't Start
- Check Render logs for errors
- Verify all environment variables are set
- Check database connection string
- Ensure `package.json` has correct start script

### Frontend Can't Connect to Backend
- Verify `VITE_API_URL` is correct
- Check CORS settings in backend
- Verify backend is running (check Render logs)
- Check browser console for CORS errors

### Database Connection Issues
- Verify `NEON_DATABASE_URL` is correct
- Check Neon database is running
- Verify SSL mode in connection string
- Check Render logs for database errors

### Session Management Issues
- Verify `JWT_SECRET` is set
- Check frontend and backend are using same domain (or CORS configured)
- Verify session timeout settings

## Production Considerations

1. **Backup Database**: For production, you might want to disable localhost backup or use another cloud database
2. **Environment Variables**: Never commit `.env` files
3. **JWT Secret**: Use a strong, random secret in production
4. **CORS**: Configure CORS to only allow your Vercel domain
5. **Database**: Consider using Neon's connection pooling for better performance
6. **Monitoring**: Set up error tracking (Sentry, etc.)
7. **Logging**: Configure proper logging for production

## Quick Deploy Checklist

- [ ] Push branch to GitHub
- [ ] Connect repository to Vercel
- [ ] Set Vercel environment variables
- [ ] Deploy frontend on Vercel
- [ ] Connect repository to Render
- [ ] Set Render environment variables
- [ ] Deploy backend on Render
- [ ] Update Vercel with Render backend URL
- [ ] Run database migrations
- [ ] Test deployment
- [ ] Verify session management works
- [ ] Test dual database writes (check Neon database)

## Support

If you encounter issues:
1. Check Render logs: Dashboard → Your Service → Logs
2. Check Vercel logs: Dashboard → Your Project → Deployments → View Function Logs
3. Check browser console for frontend errors
4. Verify all environment variables are set correctly


