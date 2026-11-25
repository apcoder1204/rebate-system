# Rebate System Backend

Node.js + Express + PostgreSQL backend API for the Rebate System.

## Prerequisites

- Node.js 20 (the production Docker image uses `node:20-alpine`)
- PostgreSQL (v12 or higher)
- npm or yarn

## Setup Instructions

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Configure Database

Create a PostgreSQL database:

```sql
CREATE DATABASE rebate_system;
```

### 3. Configure Environment Variables

Create `backend/.env` (it is git-ignored, so never commit it) with at least:

```env
PORT=3000
NODE_ENV=development
DEV_LOCAL_ONLY=true        # dev: use only the local database, never Neon

DB_HOST=localhost
DB_PORT=5432
DB_NAME=rebate_system
DB_USER=postgres
DB_PASSWORD=your_password

JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=7d

UPLOAD_DIR=./uploads/contracts
MAX_FILE_SIZE=10485760
```

For production variables (`NEON_DATABASE_URL`, `LOCAL_IS_PRIMARY`, `BIND_HOST`, `REDIS_URL`, Resend, VAPID, etc.), see [DEPLOYMENT.md](../DEPLOYMENT.md#3-backend-environment-variables) and [DATABASE_SETUP.md](DATABASE_SETUP.md).

### 4. Run Database Migrations

```bash
npm run migrate
```

This will:
- Create all database tables
- Set up indexes and triggers
- Create a default admin user if it doesn't exist yet (**change its password immediately**)

### 5. Start the Server

Development mode (with auto-reload):
```bash
npm run dev
```

Production mode:
```bash
npm run build
npm start
```

The server will start on `http://localhost:3000`.

Production runs this backend in Docker (`backend/Dockerfile`) on our own server. See [DEPLOYMENT.md](../DEPLOYMENT.md).

## API Endpoints

### Authentication
- `POST /api/users/login` - Login user
- `POST /api/users/register` - Register new user
- `GET /api/users/me` - Get current user (requires auth)
- `GET /api/users/list` - List all users (admin/manager only)

### Contracts
- `GET /api/contracts` - List contracts
- `GET /api/contracts/filter` - Filter contracts
- `GET /api/contracts/:id` - Get contract by ID
- `POST /api/contracts` - Create contract
- `PUT /api/contracts/:id` - Update contract

### Orders
- `GET /api/orders` - List orders
- `GET /api/orders/filter` - Filter orders
- `GET /api/orders/:id` - Get order by ID
- `POST /api/orders` - Create order
- `PUT /api/orders/:id` - Update order
- `DELETE /api/orders/:id` - Delete order (admin/manager only)

### File Upload
- `POST /api/upload/contract` - Upload contract PDF (requires auth)
- `GET /api/upload/contracts/:filename` - Download contract file

## Default Users

On an empty database, migrations create one default **admin** account (see `src/db/migrate.ts`). Change its password right after the first login.

You can create additional users through the registration endpoint or directly in the database.

## Database Schema

- **users** - User accounts with roles (admin, manager, staff, user)
- **contracts** - Rebate contracts between company and customers
- **orders** - Customer orders
- **order_items** - Items within each order

## Security

- JWT-based authentication
- Password hashing with bcrypt
- Role-based access control
- File upload validation (PDF only)
- SQL injection protection via parameterized queries
- Rate limiting (Redis-backed): login/register 50 failed attempts per 15 min per IP + email; API 500 requests per 150 min per user, or per IP when not logged in. Real client IPs come from `app.set('trust proxy', 'loopback')` behind Nginx/Cloudflare.

## Development

The backend uses TypeScript and includes:
- Express.js for routing
- PostgreSQL with pg library
- JWT for authentication
- Multer for file uploads
- CORS enabled for frontend integration

## Troubleshooting

### Database Connection Issues
- Ensure PostgreSQL is running
- Check database credentials in `.env`
- Verify database exists: `psql -U postgres -l`

### Port Already in Use
- Change `PORT` in `.env` file
- Or kill the process using port 3000: `lsof -ti:3000 | xargs kill`

### Migration Errors
- Ensure database exists
- Check user has CREATE TABLE permissions
- Review error messages in console

