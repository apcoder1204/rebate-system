# Render Deployment Steps - Fix Reports API 404

## Current Status
✅ Code is committed and pushed to GitHub  
✅ Local build includes report routes  
❌ Production server (rebate-api.cctvpoint.org) is running old code without report routes

## Solution: Trigger Render Deployment

### Option 1: Manual Deploy (Recommended)
1. Go to [Render Dashboard](https://dashboard.render.com)
2. Find your `rebate-api` service
3. Click on the service
4. Go to **Manual Deploy** section
5. Click **Deploy latest commit**
6. Wait for build to complete (usually 2-5 minutes)

### Option 2: Auto-Deploy (If enabled)
- Render should auto-deploy when you push to `main` branch
- If it didn't auto-deploy, use Option 1

### Option 3: Push an Empty Commit (Trigger)
If you want to force a deployment:
```bash
git commit --allow-empty -m "Trigger Render deployment for report routes"
git push origin main
```

## Verify Deployment

After deployment completes, test the endpoint:

```bash
curl https://rebate-api.cctvpoint.org/api/admin/reports/summary?start_date=2025-12-29&end_date=2026-01-29 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

You should get JSON data instead of the HTML 404 error.

## Check Build Logs

In Render Dashboard:
1. Go to your service → **Logs** tab
2. Look for:
   - ✅ `npm run build` completing successfully
   - ✅ `npm start` starting the server
   - ✅ No TypeScript compilation errors
   - ✅ Routes being registered

## Expected Build Output

You should see in the logs:
```
> rebate-system-backend@1.0.0 build
> tsc
(No errors - build successful)

> rebate-system-backend@1.0.0 start
> npm run migrate && node dist/server.js
🚀 Server running on http://localhost:3000
```

## Troubleshooting

If deployment fails:
1. Check **Logs** tab in Render for errors
2. Verify `package.json` has correct build/start scripts
3. Ensure all dependencies are in `package.json` (not just devDependencies)
4. Check that `dist/` folder is being created (it should be, since it's in .gitignore but built on Render)
