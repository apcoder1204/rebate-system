# Rebate System

A full-stack rebate management system for tracking customer contracts, orders, and rebates.

## Project Structure

```
rebate system/
├── backend/          # Node.js + Express + PostgreSQL API
├── Components/       # React UI components
├── Pages/           # React page components
├── entities/        # Frontend data models
└── src/             # Frontend utilities and API client
```

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

4. Configure environment:
```bash
cp .env.example .env
# Edit .env with your database credentials
```

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

## Default Login Credentials

- **Admin**: `apcoder3@gmail.com` / `1234`
- Create additional users through registration or database

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
