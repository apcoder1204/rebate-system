# Contract Approval Workflow

## Overview
This document describes the contract approval workflow where customers sign contracts and managers/admin approve them before contracts become active.

## Workflow Steps

### 1. Customer Signs Contract
- Customer uploads a signed PDF or uses digital signature pad
- Contract is created with status: `pending_approval`
- Customer cannot track orders/rebates until contract is approved

### 2. Manager/Admin Approval
- Managers and Admins can see contracts with status `pending_approval` in the Manage Contracts page
- Manager clicks "Approve" button on a pending contract
- Manager fills in:
  - **Name**: Manager's full name (for CCTV POINT section)
  - **Position**: Manager's position (e.g., Director, Manager)
  - **Signature**: Digital signature using signature pad
- Manager can preview the contract with their signature before approving
- Manager can either:
  - **Approve**: Contract status changes to `active` - customer can now track orders and rebates
  - **Reject**: Contract status changes to `rejected` - requires a reason

### 3. Contract Status Flow
```
pending → pending_approval → approved/active → (expired/cancelled)
                ↓
            rejected
```

- **pending**: Initial state when contract is created without signature
- **pending_approval**: Customer has signed, waiting for manager approval
- **approved/active**: Manager has approved, contract is active
- **rejected**: Manager rejected the contract
- **expired**: Contract end date has passed
- **cancelled**: Contract was cancelled

## Database Schema Changes

### New Fields in `contracts` table:
- `manager_signature_data_url` (TEXT): Base64 encoded signature image
- `manager_name` (VARCHAR): Manager's name who approved
- `manager_position` (VARCHAR): Manager's position
- `approved_by` (UUID): Reference to users table (manager who approved)
- `approved_date` (TIMESTAMP): When contract was approved

### Status Values:
Updated status constraint to include:
- `pending`
- `pending_approval`
- `approved`
- `active`
- `expired`
- `cancelled`
- `rejected`

## Components

### ManagerApprovalDialog
- Location: `./Components/contracts/ManagerApprovalDialog.tsx`
- Purpose: Allows managers to sign and approve contracts
- Features:
  - Form fields for manager name and position
  - Digital signature pad
  - Preview contract with manager signature
  - Approve/Reject actions

### ContractsList
- Location: `./Components/staff/ContractsList.tsx`
- Updates:
  - Shows "Pending Approval" badge for contracts awaiting approval
  - Shows "Approve" button for managers/admins on pending_approval contracts
  - Displays approval status badges

### ContractPreviewDialog
- Location: `./Components/contracts/ContractPreviewDialog.tsx`
- Updates:
  - Displays manager signature when available
  - Shows manager name and position in CCTV POINT section
  - Shows customer signature in FUNDI/MTAALAMU/ENGINEER section

## Backend Changes

### Contract Controller
- `updateContract` function updated to:
  - Allow managers to approve contracts (not just admins)
  - Handle manager approval fields
  - Set `approved_date` automatically when `approved_by` is set
  - Validate that only `pending_approval` contracts can be approved

### Database Migration
- File: `./backend/src/db/migrations/add_manager_approval_fields.sql`
- Run this migration to add new fields to contracts table

## Permissions

- **Users**: Can create and sign contracts (status: pending_approval)
- **Managers**: Can approve/reject contracts (status: pending_approval → active/rejected)
- **Admins**: Can do everything managers can do, plus modify any contract field

## Usage

1. **Customer signs contract**:
   - Go to "My Contracts" page
   - Click "Upload Contract"
   - Fill dates, sign (upload PDF or digital signature)
   - Submit → Contract status: `pending_approval`

2. **Manager approves contract**:
   - Go to "Manage Contracts" page (admin/manager only)
   - Find contract with "Pending Approval" badge
   - Click "Approve" button
   - Fill in name, position, and sign
   - Click "Approve Contract" → Contract status: `active`
   - Customer can now track orders and rebates

## Notes

- Only one contract per customer at a time
- Contracts must be approved before customers can track orders/rebates
- Manager signature is embedded in the contract PDF
- Contract preview shows both customer and manager signatures when available
