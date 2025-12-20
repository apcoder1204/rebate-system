#!/bin/bash
# Fix PostgreSQL authentication to allow password login

echo "Setting PostgreSQL password..."
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'apcoder3';"

echo "Creating database..."
sudo -u postgres createdb rebate_system 2>/dev/null || echo "Database might already exist"

echo ""
echo "✅ Setup complete! Now run: npm run migrate"




