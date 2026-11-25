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

> The backend now runs in Docker on our own Ubuntu server. See [DEPLOYMENT.md](DEPLOYMENT.md) for the full procedure. (PM2, systemd and Render are no longer used for the backend.)

### 1. Sync the latest code to the server
From the repo root on your dev machine:
```bash
rsync -az --exclude node_modules --exclude .git --exclude dist \
  --exclude .env --exclude uploads \
  backend/ cctvpoint@<server>:/var/www/rebate-backend/
```
(Never add `--delete`: the server's `docker-compose.yml`, `scripts/` and `.env` exist only there.)

### 2. Rebuild and restart the container
The Docker build runs `npm run build` (`tsc`), so a TypeScript error makes the build fail before anything is replaced.
```bash
ssh cctvpoint@<server> "cd /var/www/rebate-backend && docker compose up -d --build"
```

### 3. Verify Build Output
Check inside the running container that the routes are compiled:
```bash
ssh cctvpoint@<server> "docker exec rebate-backend-backend-1 grep -c 'reports/' dist/routes/adminRoutes.js"
```

### 4. Test Endpoints
```bash
curl https://rebate-api.cctvpoint.org/api/admin/reports/summary \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 5. Check Server Logs
```bash
ssh cctvpoint@<server> "docker logs rebate-backend-backend-1 --since 5m"
```
Look for route registration messages or errors during startup.

## Common Causes
1. **Old deployment**: Backend server running old code without report routes
2. **Build not run**: TypeScript not compiled to JavaScript
3. **Cache issue**: Server using cached old routes
4. **Deployment config**: Build step missing in deployment pipeline
