# Rebate System

A full-stack rebate management system for tracking customer contracts, orders, and rebates.

## Project Structure

```
rebate system/
├── backend/          # Node.js + Express + PostgreSQL API (deployed with Docker)
├── Components/       # React UI components
├── Context/          # React context providers (toasts, theme, session)
├── Pages/            # React page components
├── entities/         # Frontend data models
├── main.tsx          # Frontend entry point and routes
└── src/              # Frontend utilities and API client
```

> If you add a new top-level folder containing React components, add it to `content` in `tailwind.config.js`. Otherwise Tailwind won't generate its classes. (This is why toast messages were once invisible.)

## Quick Start

### Backend Setup

1. Navigate to backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Set up PostgreSQL database:
```sql
CREATE DATABASE rebate_system;
```

4. Configure environment: create `backend/.env` with your local database credentials and `DEV_LOCAL_ONLY=true`, so development never touches production data. See `backend/README.md` for the variables.

5. Run migrations:
```bash
npm run migrate
```

6. Start backend server:
```bash
npm run dev
```

Backend runs on `http://localhost:3000`

### Frontend Setup

1. Install dependencies:
```bash
npm install
```

2. Configure API URL (optional):
Create `.env` file in root:
```env
VITE_API_URL=http://localhost:3000/api
```

3. Start development server:
```bash
npm run dev
```

Frontend runs on `http://localhost:5173`

## Default Admin Account

On first migration of an empty database, `backend/src/db/migrate.ts` creates a default admin account. **Change its password immediately.** Create additional users through registration or the admin pages.

## Deployment

Production runs the frontend on Vercel and the backend in Docker on our own Ubuntu server, with local PostgreSQL as primary and Neon as backup. See **[DEPLOYMENT.md](DEPLOYMENT.md)**.

## Features

- User authentication and authorization
- Contract management
- Order tracking
- Rebate calculation (1% default)
- File upload for signed contracts
- Role-based access control (admin, manager, staff, user)

## Technology Stack

### Frontend
- React 18
- TypeScript
- Vite
- Tailwind CSS
- React Router

### Backend
- Node.js
- Express.js
- PostgreSQL
- TypeScript
- JWT Authentication
- Multer (file uploads)

## Development

Both frontend and backend support hot-reload during development.

For production builds:
- Frontend: `npm run build`
- Backend: `npm run build && npm start`

## API Documentation

See `backend/README.md` for detailed API endpoint documentation.

## License

Private project

# rebate-system
