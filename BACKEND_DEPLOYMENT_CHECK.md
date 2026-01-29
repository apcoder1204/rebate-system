# Backend Deployment Check - Reports API 404 Error

## Issue
Reports endpoints returning 404:
- `/api/admin/reports/revenue`
- `/api/admin/reports/order-trends`
- `/api/admin/reports/summary`

## Verification
✅ Routes are correctly defined in `backend/src/routes/adminRoutes.ts`
✅ Controllers are properly exported in `backend/src/controllers/reportController.ts`
✅ Routes are mounted in `backend/src/routes/index.ts` at `/admin`
✅ Compiled JavaScript in `backend/dist/` shows routes are present

## Solution Steps

### 1. Rebuild Backend
```bash
cd backend
npm run build
```

### 2. Verify Build Output
Check that `backend/dist/routes/adminRoutes.js` contains:
- `router.get('/reports/revenue', ...)`
- `router.get('/reports/order-trends', ...)`
- `router.get('/reports/summary', ...)`

### 3. Restart Backend Server
If using PM2:
```bash
pm2 restart rebate-api
```

If using systemd:
```bash
sudo systemctl restart rebate-api
```

If using Render/other platform:
- Trigger a new deployment
- Or restart the service

### 4. Test Endpoints
```bash
curl https://rebate-api.cctvpoint.org/api/admin/reports/summary \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 5. Check Server Logs
Look for route registration messages or errors during startup.

## Common Causes
1. **Old deployment**: Backend server running old code without report routes
2. **Build not run**: TypeScript not compiled to JavaScript
3. **Cache issue**: Server using cached old routes
4. **Deployment config**: Build step missing in deployment pipeline
