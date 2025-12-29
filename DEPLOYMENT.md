# Deployment Guide for Rebate System

This guide covers the deployment of the Rebate System:
- **Frontend**: Vercel (React/Vite)
- **Backend**: Render (Node.js/Express)
- **Database**: Neon (PostgreSQL)
- **Domain**: Namecheap (`cctvpoint.org`)
- **Email**: Resend

---

## 1. Prerequisites

Ensure you have the following accounts and access:
- **GitHub**: Repository pushed with latest changes
- **Neon**: Database connection string
- **Resend**: API Key
- **Render**: Account for backend hosting
- **Vercel**: Account for frontend hosting
- **Namecheap**: Domain management

---

## 2. Backend Deployment (Render)

### Step 1: Create Web Service
1. Log in to [Render Dashboard](https://dashboard.render.com).
2. Click **New +** -> **Web Service**.
3. Connect your GitHub repository.
4. Configure settings:
   - **Name**: `rebate-api`
   - **Region**: Frankfurt (EU Central) - *To match Neon DB*
   - **Root Directory**: `backend`
   - **Runtime**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start` (Runs migrations automatically)
   - **Plan**: Free

### Step 2: Environment Variables
Add these in the **Environment** tab:

| Key | Value | Description |
|-----|-------|-------------|
| `NODE_ENV` | `production` | Production mode |
| `NEON_DATABASE_URL` | `postgresql://...-pooler...` | **Must use Pooled Connection URL** |
| `FRONTEND_URL` | `https://rebate.cctvpoint.org` | Allow CORS for frontend |
| `JWT_SECRET` | `your-secure-random-string` | Secret for auth tokens |
| `RESEND_API_KEY` | `re_...` | Your Resend API Key |
| `RESEND_FROM_EMAIL` | `onboarding@resend.dev` | Use this for testing until domain verified |

> **Note**: Once you verify `cctvpoint.org` in Resend, change `RESEND_FROM_EMAIL` to `noreply@cctvpoint.org`.

### Step 3: Custom Domain
1. Go to **Settings** -> **Custom Domains**.
2. Add `rebate-api.cctvpoint.org`.
3. Render will provide a value (e.g., `rebate-api-xxxxx.onrender.com`).
4. **Go to Namecheap**:
   - Advanced DNS -> Add New Record
   - **Type**: CNAME Record
   - **Host**: `rebate-api`
   - **Value**: (The Render URL)
   - **TTL**: Automatic

---

## 3. Frontend Deployment (Vercel)

### Step 1: Create Project
1. Log in to [Vercel Dashboard](https://vercel.com).
2. Click **Add New** -> **Project**.
3. Import your repository.
4. Configure settings:
   - **Framework Preset**: Vite
   - **Root Directory**: `.` (Root)
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`

### Step 2: Environment Variables
Add in the **Environment Variables** section:

| Key | Value | Description |
|-----|-------|-------------|
| `VITE_API_URL` | `https://rebate-api.cctvpoint.org/api` | **Must end with /api** |

### Step 3: Custom Domain
1. Go to **Settings** -> **Domains**.
2. Add `rebate.cctvpoint.org`.
3. Vercel will ask you to verify ownership.
4. **Go to Namecheap**:
   - Advanced DNS -> Add New Record
   - **Type**: CNAME Record
   - **Host**: `rebate`
   - **Value**: `cname.vercel-dns.com`
   - **TTL**: Automatic

---

## 4. Verification & Troubleshooting

### Database Migrations
- Migrations run automatically on every Render deployment (`npm start` executes `npm run migrate`).
- If you see "Column not found" errors, check Render logs to ensure migration scripts executed successfully.

### Email Issues (Resend)
- **Testing**: Use `RESEND_FROM_EMAIL=onboarding@resend.dev` and only send to your own email.
- **Production**: Verify domain in Resend (requires adding DNS records in Namecheap) to send to any user.

### Connection Issues (CORS/405)
- Ensure `VITE_API_URL` in Vercel has `/api` at the end.
- Ensure `FRONTEND_URL` in Render matches your Vercel domain exactly (no trailing slash).
- Check `/health` endpoint: `https://rebate-api.cctvpoint.org/health`.

### Neon Database
- Ensure you are using the **Pooler URL** (`-pooler` in hostname) for connection stability.
- The system automatically handles keep-alives and reconnections.

