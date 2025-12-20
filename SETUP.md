# Complete Setup Guide

## Prerequisites

- Node.js (v18 or higher)
- PostgreSQL (v12 or higher)
- npm or yarn

## Step-by-Step Setup

### 1. Database Setup

First, create the PostgreSQL database:

```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE rebate_system;

# Exit psql
\q
```

### 2. Backend Setup

```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Edit .env file with your database credentials
# Update these values:
# - DB_PASSWORD (your PostgreSQL password)
# - JWT_SECRET (use a strong random string)
```

Edit `backend/.env`:
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=rebate_system
DB_USER=postgres
DB_PASSWORD=your_postgres_password_here
JWT_SECRET=your-super-secret-jwt-key-change-this
```

```bash
# Run database migrations (creates tables and default admin user)
npm run migrate

# Start backend server
npm run dev
```

Backend will run on `http://localhost:3000`

### 3. Frontend Setup

Open a new terminal:

```bash
# Navigate to project root
cd /home/apcoder/Documents/rebate\ system

# Install dependencies (if not already done)
npm install

# Optional: Create .env file for custom API URL
echo "VITE_API_URL=http://localhost:3000/api" > .env

# Start frontend development server
npm run dev
```

Frontend will run on `http://localhost:5173`

### 4. Access the Application

1. Open browser: `http://localhost:5173`
2. Login with default admin credentials:
   - Email: `apcoder3@gmail.com`
   - Password: `1234`

## Default Users Created by Migration

After running `npm run migrate` in the backend, you'll have:

- **Admin**: `apcoder3@gmail.com` / `1234`

You can create additional users:
- Through the registration page (creates regular users)
- Directly in the database (for admin/manager/staff roles)

## Creating Additional Users via Database

```sql
-- Connect to database
psql -U postgres -d rebate_system

-- Create a manager user (password: 1234)
-- Note: You'll need to hash the password using bcrypt
-- For now, use the backend API to create users, or use the registration endpoint
```

Or use the registration endpoint:
```bash
curl -X POST http://localhost:3000/api/users/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "manager@example.com",
    "password": "1234",
    "full_name": "Manager Name",
    "phone": "+255123456789"
  }'
```

## Troubleshooting

### Backend won't start
- Check PostgreSQL is running: `sudo systemctl status postgresql`
- Verify database credentials in `.env`
- Check if port 3000 is available: `lsof -i :3000`

### Database connection errors
- Ensure PostgreSQL is installed and running
- Verify database name, user, and password in `.env`
- Test connection: `psql -U postgres -d rebate_system`

### Frontend can't connect to backend
- Verify backend is running on port 3000
- Check CORS settings in backend
- Verify `VITE_API_URL` in frontend `.env` (if set)

### Migration errors
- Ensure database exists
- Check user has CREATE TABLE permissions
- Drop and recreate database if needed:
  ```sql
  DROP DATABASE rebate_system;
  CREATE DATABASE rebate_system;
  ```

## Production Deployment

### Backend
1. Set `NODE_ENV=production` in `.env`
2. Build: `npm run build`
3. Start: `npm start`
4. Use PM2 or similar for process management

### Frontend
1. Build: `npm run build`
2. Serve `dist/` directory with nginx or similar
3. Configure API URL in environment variables

## API Testing

Test the API health endpoint:
```bash
curl http://localhost:3000/health
```

Should return:
```json
{"status":"ok","timestamp":"2025-01-XX..."}
```

## Next Steps

1. ✅ Database created
2. ✅ Backend running
3. ✅ Frontend running
4. ✅ Login with admin credentials
5. Create contracts
6. Create orders
7. Track rebates

Enjoy your rebate system! 🎉

