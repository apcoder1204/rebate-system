# Database Setup Guide

## Step 1: Install PostgreSQL (if not already installed)

### Ubuntu/Debian:
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
```

### Check if PostgreSQL is installed:
```bash
psql --version
```

### Start PostgreSQL service:
```bash
sudo systemctl start postgresql
sudo systemctl enable postgresql  # Enable auto-start on boot
```

## Step 2: Create the Database

You have two options:

### Option A: Using psql command line

1. Switch to the postgres user:
```bash
sudo -u postgres psql
```

2. Create the database:
```sql
CREATE DATABASE rebate_system;
```

3. (Optional) Create a dedicated user (recommended for production):
```sql
CREATE USER rebate_user WITH PASSWORD 'your_password_here';
GRANT ALL PRIVILEGES ON DATABASE rebate_system TO rebate_user;
```

4. Exit psql:
```sql
\q
```

### Option B: Using createdb command

```bash
sudo -u postgres createdb rebate_system
```

## Step 3: Verify Database Creation

```bash
sudo -u postgres psql -l
```

You should see `rebate_system` in the list.

## Step 4: Configure Backend Connection

Edit `backend/.env` file:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=rebate_system
DB_USER=postgres          # or 'rebate_user' if you created one
DB_PASSWORD=postgres      # or your password
```

**Note:** Default PostgreSQL installation usually has:
- User: `postgres`
- Password: Usually empty or set during installation

If you don't know the postgres password, you can reset it:

```bash
sudo -u postgres psql
ALTER USER postgres PASSWORD 'new_password';
\q
```

Then update `backend/.env` with the new password.

## Step 5: Run Migrations

After creating the database and configuring `.env`, run:

```bash
cd backend
npm run migrate
```

This will:
- Create all tables (users, contracts, orders, order_items)
- Create indexes for performance
- Set up triggers
- Create default admin user

## Troubleshooting

### "database does not exist" error
- Make sure you created the database: `CREATE DATABASE rebate_system;`
- Verify it exists: `psql -U postgres -l`

### "password authentication failed" error
- Check your password in `.env` matches PostgreSQL password
- Reset password: `ALTER USER postgres PASSWORD 'newpassword';`

### "connection refused" error
- Check PostgreSQL is running: `sudo systemctl status postgresql`
- Start it: `sudo systemctl start postgresql`

### "permission denied" error
- Make sure the user in `.env` has permissions
- Grant permissions: `GRANT ALL PRIVILEGES ON DATABASE rebate_system TO postgres;`

## Quick Test

Test your database connection:

```bash
cd backend
node -e "
const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Connection failed:', err.message);
    process.exit(1);
  } else {
    console.log('✅ Database connection successful!');
    console.log('Current time:', res.rows[0].now);
    process.exit(0);
  }
});
"
```

If this works, your database is ready for migrations!

