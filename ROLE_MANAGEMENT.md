# Role Management System

## Overview

The system uses an **Approval-Based Role Assignment** system where:
- All users register with the same registration page
- Users can optionally request a higher role during registration
- Admins/Managers approve or reject role requests
- Admins can directly change user roles (with safety checks)

## Roles

1. **User** (default) - Regular customers
2. **Staff** - Can view and manage orders
3. **Manager** - Can manage contracts, orders, and approve role requests
4. **Admin** - Full access, can manage all users and roles

## How It Works

### Registration Flow

1. User fills out registration form
2. User can optionally select a role to request (Staff, Manager, or Admin)
3. If no role is selected, user gets "user" role by default
4. If a role is requested:
   - User account is created with "user" role
   - A role request is created with status "pending"
   - User receives notification that request is pending approval

### Role Request Approval

1. Admin or Manager logs in
2. Views pending role requests (via API endpoint)
3. Can approve or reject requests
4. If approved, user's role is automatically updated
5. User is notified of the decision

### Direct Role Management (Admin Only)

Admins can directly change any user's role via API:
- `PUT /api/users/:id/role` with body `{ "role": "manager" }`
- **Safety Check**: System prevents removing the last admin
- If trying to demote the last admin, system returns error

## API Endpoints

### Role Requests

- `GET /api/users/role-requests?status=pending` - Get role requests (Admin/Manager only)
- `POST /api/users/role-requests/:id/review` - Approve/reject request
  ```json
  {
    "action": "approve",  // or "reject"
    "comment": "Optional comment"
  }
  ```
- `GET /api/users/my-role-request` - Get user's own pending request

### Direct Role Management

- `PUT /api/users/:id/role` - Change user role directly (Admin only)
  ```json
  {
    "role": "manager"  // admin, manager, staff, or user
  }
  ```

## Safety Features

1. **Last Admin Protection**: Cannot demote the last admin in the system
2. **Role Validation**: Only valid roles can be assigned
3. **Permission Checks**: Only admins/managers can approve requests
4. **Audit Trail**: All role changes are tracked in role_requests table

## Changing Admin Role

### Scenario 1: Promote Another User to Admin First

1. Admin promotes another user to admin role
2. Now there are 2+ admins
3. Original admin can now be demoted if needed

### Scenario 2: Direct Role Change

```bash
# Promote user to admin
PUT /api/users/{user_id}/role
Body: { "role": "admin" }

# Now you can demote the original admin (if needed)
PUT /api/users/{original_admin_id}/role
Body: { "role": "manager" }
```

### Scenario 3: Via Database (Emergency)

If needed, you can directly update in PostgreSQL:

```sql
-- Check current admins
SELECT id, email, full_name FROM users WHERE role = 'admin';

-- Promote a user to admin
UPDATE users SET role = 'admin' WHERE email = 'newadmin@example.com';

-- Now you can demote the original admin
UPDATE users SET role = 'manager' WHERE email = 'oldadmin@example.com';
```

## Frontend Integration

The registration form now includes:
- Optional "Request Role" dropdown
- Shows message if role is requested
- Users can check their request status via their profile

## Future Enhancements

- Admin panel UI for managing role requests
- Email notifications for role request status
- Role request history
- Bulk role management


