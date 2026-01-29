# Vercel Deployment Fix for Vite Error

## Issue
Error: `Cannot find module '/vercel/path0/node_modules/vite/dist/node/chunks/dep-BK3b2jBa.js'`

## Solution Steps

### 1. Clear Vercel Build Cache
In Vercel Dashboard:
- Go to your project → Settings → General
- Scroll to "Build & Development Settings"
- Click "Clear Build Cache" or redeploy with "Clear cache and deploy"

### 2. Update package.json (if needed)
The package.json has been updated to use `npm ci` for clean installs.

### 3. Alternative: Use package-lock.json
Ensure `package-lock.json` is committed to git. Vercel will use it for consistent installs.

### 4. If issue persists, try:
- Delete `.vercel` folder locally (if exists)
- Redeploy from Vercel dashboard with "Clear cache" enabled
- Or update Vite to latest stable: `npm install vite@latest --save-dev`
