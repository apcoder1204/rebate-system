#!/bin/bash
# PostgreSQL Setup Script
# Run this script to set up PostgreSQL with password "apcoder3"

echo "Setting PostgreSQL password for user 'postgres'..."
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'apcoder3';"

echo "Creating database 'rebate_system'..."
sudo -u postgres createdb rebate_system 2>/dev/null || echo "Database might already exist"

echo "✅ PostgreSQL setup complete!"
echo ""
echo "Now run: cd backend && npm run migrate"




