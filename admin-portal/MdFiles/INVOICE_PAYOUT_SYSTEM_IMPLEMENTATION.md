# Invoice Payout System Implementation

## Overview

This document describes the comprehensive payout system implemented for invoice-based practitioner payments. The system allows creating **multiple transactions per invoice**:

1. **Payment Transaction**: Money coming into the clinic's wallet from the customer
2. **Payout Transaction**: Money going from the clinic's wallet to the practitioner's wallet (90% of invoice amount, with 10% clinic commission)

---

## Key Features

### 1. Multiple Transactions Per Invoice
- Each invoice can have **two types of transactions**:
  - **Invoice Payment** (type: `invoice_payment`): External payment → Clinic Wallet
  - **Payout** (type: `payout`): Clinic Wallet → Practitioner Wallet
  
### 2. Automatic Practitioner Resolution
The system automatically finds the primary practitioner for an invoice using this chain:

```
Invoice (invoiceable_type = Appointment)
  ↓
Appointment
  ↓
appointment_practitioner table (is_primary = true)
  ↓
Practitioner (central DB)
  ↓
User (tenant DB, matched by email)
  ↓
Wallet (user's wallet in tenant)
```

### 3. Commission Calculation
- **Clinic Commission**: 10% (configurable)
- **Practitioner Payout**: 90% of invoice amount
- Example: $100 invoice → $10 clinic commission, $90 practitioner payout

---

## Database Changes

### Invoice Model (`app/Models/Tenant/Invoices.php`)

#### New Methods:

```php
/**
 * Get the primary practitioner's wallet for this invoice
 * Traverses: Invoice → Appointment → AppointmentPractitioner (is_primary) → Practitioner → User → Wallet
 */
public function getPrimaryPractitionerWallet(): ?Wallet

/**
 * Check if invoice has a payment transaction (money into clinic)
 */
public function hasPaymentTransaction(): bool

/**
 * Check if invoice has a payout transaction (money to practitioner)
 */
public function hasPayoutTransaction(): bool

/**
 * Get the payment transaction
 */
public function getPaymentTransaction(): ?Transaction

/**
 * Get the payout transaction
 */
public function getPayoutTransaction(): ?Transaction
```

---

## Service Layer

### WalletService (`app/Services/WalletService.php`)

#### New Method:

```php
/**
 * Create payout for an invoice to its primary practitioner
 * Automatically calculates payout amount after deducting clinic commission (10%)
 *
 * @param Invoices $invoice The invoice to create payout for
 * @param float $commissionPercentage Commission percentage to deduct (default 10%)
 * @throws \RuntimeException If no primary practitioner found or insufficient balance
 */
public function createInvoicePayout(Invoices $invoice, float $commissionPercentage = 10.0): void
{
    // Validates:
    // 1. Invoice must have a payment transaction
    // 2. Payout doesn't already exist
    // 3. Primary practitioner's wallet exists
    // 4. Clinic has sufficient balance
    
    // Calculates:
    // - Commission amount = invoice price × 10%
    // - Payout amount = invoice price - commission
    
    // Creates:
    // - Transaction record with type 'payout'
    // - Updates clinic wallet (decrement)
    // - Updates practitioner wallet (increment)
}
```

---

## Controller Changes

### InvoicesController (`app/Http/Controllers/Tenant/InvoicesController.php`)

#### Updated `index()` Method:
Added new fields to invoice data:
```php
'has_payment_transaction' => $inv->hasPaymentTransaction(),
'has_payout_transaction' => $inv->hasPayoutTransaction(),
'invoiceable_type_short' => class_basename($inv->invoiceable_type),
```

#### New Endpoint: `createPayout()`

**Route**: `POST /invoices/{invoice}/create-payout`

**Validation**:
- Invoice must be paid (has payment transaction)
- Payout doesn't already exist
- Invoice must be appointment-based (only appointments have practitioners)
- Primary practitioner must exist
- Clinic must have sufficient balance

**Success Response**: `"Payout created successfully. Practitioner has been paid 90% of invoice amount (10% clinic commission deducted)."`

**Error Responses**:
- `"Invoice must be paid before creating a payout."`
- `"Payout already exists for this invoice."`
- `"Only appointment-based invoices can have practitioner payouts."`
- `"No primary practitioner found for this invoice."`
- `"Insufficient clinic balance for payout."`

---

## Frontend Changes

### Invoices Index Page (`resources/js/pages/Invoices/Index.tsx`)

#### Updated Invoice Interface:
```typescript
export type Invoice = {
  // ... existing fields
  has_payment_transaction?: boolean;
  has_payout_transaction?: boolean;
  invoiceable_type_short?: string;   // 'Appointment' instead of full class name
};
```

#### New Icons:
- `Receipt`: Create payment transaction
- `Eye`: View all transactions
- `Wallet`: Create payout to practitioner

#### Action Buttons (Smart Display):

1. **View Transactions Button** (Eye icon, blue)
   - Shows if: `has_transactions === true`
   - Opens: Sidebar with all transactions for the invoice

2. **Create Payment Transaction Button** (Receipt icon, green)
   - Shows if: `has_payment_transaction === false`
   - Opens: Payment transaction creation form

3. **Create Payout Button** (Wallet icon, purple)
   - Shows if:
     - `has_payment_transaction === true` AND
     - `has_payout_transaction === false` AND
     - `invoiceable_type_short === 'Appointment'`
   - Action: Confirms and creates payout transaction

#### View Transactions Sidebar

**Features**:
- **Transaction Summary Card** (blue):
  - Total transactions count
  - Invoice amount
  - Payment status badge (green)
  - Payout status badge (purple)

- **Transaction Cards** (for each transaction):
  - Transaction ID
  - Created timestamp
  - Status badge (completed/pending/failed)
  - Amount
  - Type (Invoice Payment / Payout)
  - Payment method
  - Direction source
  - Provider reference (if any)
  - Payment proof URL (clickable link)
  - From wallet (Clinic/User)
  - To wallet (Clinic/User)

#### Create Payout Handler:

```typescript
const handleCreatePayout = async (invoice: Invoice) => {
  // Validates payment transaction exists
  // Validates payout doesn't exist
  // Confirms with user
  // Posts to /invoices/{invoice}/create-payout
};
```

**Confirmation Message**:
> "Create payout to practitioner? This will transfer 90% of the invoice amount (10% clinic commission deducted)."

---

## Routes

### New Route Added (`routes/tenant.php`):

```php
Route::post('invoices/{invoice}/create-payout', [InvoicesController::class, 'createPayout'])
    ->name('invoices.create-payout');
```

---

## Workflow Example

### Scenario: Appointment Invoice Payment & Payout

1. **Appointment Completed**
   - Invoice created with `invoiceable_type = 'App\Models\Tenant\Appointment'`
   - Invoice status: `pending`

2. **Customer Pays (Transaction 1)**
   - User clicks "Create Transaction" button (Receipt icon)
   - Fills payment details (POS/Cash/Gateway)
   - Invoice status: `paid` or `paid_manual`
   - Transaction created:
     - `type`: `invoice_payment`
     - `from_wallet_id`: `null` (external)
     - `to_wallet_id`: Clinic Wallet ID
     - `amount`: Full invoice amount
   - Clinic wallet balance increases by invoice amount

3. **Practitioner Payout (Transaction 2)**
   - User clicks "Create Payout" button (Wallet icon)
   - System confirms: "Create payout to practitioner? (90% after 10% commission)"
   - Transaction created:
     - `type`: `payout`
     - `from_wallet_id`: Clinic Wallet ID
     - `to_wallet_id`: Practitioner Wallet ID
     - `amount`: 90% of invoice amount
     - `meta`: Stores commission details
   - Clinic wallet balance decreases by 90%
   - Practitioner wallet balance increases by 90%
   - Clinic retains 10% commission

4. **View Transactions**
   - User clicks "View Transactions" button (Eye icon)
   - Sidebar shows:
     - Transaction summary (2 transactions total)
     - Payment status: Paid ✓
     - Payout status: Paid ✓
     - Both transaction details

---

## Error Handling

### Payment Transaction Errors:
- **Invalid payment method**: Returns validation error
- **Invoice already paid**: Backend throws exception

### Payout Transaction Errors:
- **Invoice not paid**: `"Invoice must be paid before creating a payout."`
- **Payout already exists**: `"Payout already exists for this invoice."`
- **Not appointment-based**: `"Only appointment-based invoices can have practitioner payouts."`
- **No primary practitioner**: `"No primary practitioner found for this invoice."`
- **Insufficient clinic balance**: `"Insufficient clinic balance for payout."`
- **No practitioner wallet**: Wallet is auto-created if user exists
- **Practitioner not in tenant**: `"No primary practitioner found..."`

---

## Safeguards

1. **Idempotency**: Payout creation checks if payout already exists
2. **Balance Validation**: Checks clinic wallet has sufficient funds
3. **Transaction Wrapping**: All wallet operations use database transactions
4. **Practitioner Resolution**: Comprehensive chain with null checks at each step
5. **Invoice Type Check**: Only appointment invoices can have payouts
6. **Payment Validation**: Payout requires payment transaction first

---

## Testing Checklist

### Manual Testing Steps:

1. **Create Invoice for Appointment**
   - ✓ Verify invoice shows "Create Transaction" button
   - ✓ Verify "Create Payout" button is hidden

2. **Create Payment Transaction**
   - ✓ Fill payment details (method, reference, proof URL)
   - ✓ Submit transaction
   - ✓ Verify clinic wallet balance increases
   - ✓ Verify invoice status changes to `paid`
   - ✓ Verify "Create Transaction" button changes to "View Transactions"
   - ✓ Verify "Create Payout" button appears

3. **View Transactions**
   - ✓ Click "View Transactions"
   - ✓ Verify transaction summary shows 1 transaction
   - ✓ Verify payment status shows "Paid"
   - ✓ Verify payout status shows "Pending"
   - ✓ Verify payment transaction details are correct

4. **Create Payout Transaction**
   - ✓ Click "Create Payout" button
   - ✓ Confirm the dialog
   - ✓ Verify success message
   - ✓ Verify clinic wallet balance decreases by 90%
   - ✓ Verify practitioner wallet balance increases by 90%
   - ✓ Verify "Create Payout" button disappears

5. **View Both Transactions**
   - ✓ Click "View Transactions"
   - ✓ Verify transaction summary shows 2 transactions
   - ✓ Verify payment status shows "Paid"
   - ✓ Verify payout status shows "Paid"
   - ✓ Verify both transaction details are correct
   - ✓ Verify payout shows from "Clinic Wallet" to "User Wallet"

6. **Error Cases**
   - ✓ Try creating payout without payment → Error
   - ✓ Try creating duplicate payout → Error
   - ✓ Try payout with insufficient clinic balance → Error
   - ✓ Try payout for non-appointment invoice → Error

---

## Commission Configuration

The commission percentage is currently hardcoded to **10%** in:

```php
app/Services/WalletService.php:
public function createInvoicePayout(Invoices $invoice, float $commissionPercentage = 10.0): void
```

### Future Enhancement:
To make commission configurable per tenant:
1. Add `commission_percentage` column to `tenants` table
2. Store in tenant settings
3. Pass from controller: `$walletService->createInvoicePayout($invoice, tenant()->commission_percentage)`

---

## Files Modified

### Backend:
- ✓ `app/Models/Tenant/Invoices.php` - Added practitioner wallet resolution and transaction checks
- ✓ `app/Services/WalletService.php` - Added `createInvoicePayout()` method
- ✓ `app/Http/Controllers/Tenant/InvoicesController.php` - Added `createPayout()` endpoint, updated `index()`
- ✓ `routes/tenant.php` - Added payout route

### Frontend:
- ✓ `resources/js/pages/Invoices/Index.tsx` - Added payout button, transaction summary, improved UI

---

## Next Steps (Optional Enhancements)

1. **Bulk Payout**: Create payouts for multiple invoices at once
2. **Payout Schedule**: Automatic payouts at end of day/week/month
3. **Commission Tiers**: Different commission rates per practitioner/service
4. **Payout Reports**: Monthly payout summaries for practitioners
5. **Payout Approval**: Require admin approval before payout
6. **Partial Payouts**: Split payments across multiple practitioners
7. **Payout Notifications**: Email/SMS when practitioner receives payout

---

## Support

For questions or issues with this payout system, refer to:
- `WALLET_MIGRATION_GUIDE.md` - Wallet and transaction architecture
- `WALLET_CONVERSION_SUMMARY.md` - Previous wallet system changes

