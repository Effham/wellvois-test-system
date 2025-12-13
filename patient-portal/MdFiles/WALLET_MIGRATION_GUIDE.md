# Wallet & Transaction System Migration Guide

This guide explains how to migrate your EMR application to the new wallet and transaction architecture.

---

## 📋 Overview

The new system introduces:
- **Clinic Wallet**: A singleton wallet for the entire clinic (type='clinic', singleton_key=1)
- **User Wallets**: Individual wallets for practitioners and staff (type='user')
- **Invoice-Based Transactions**: All transactions are linked to invoices
- **Comprehensive Tracking**: Full audit trail with payment methods, sources, and statuses

---

## 🆕 For New Tenants

When you create a new tenant, the clinic wallet is **automatically created** during tenant registration.

### Steps:
1. Run tenant migrations:
   ```bash
   php artisan tenants:migrate
   ```

2. The clinic wallet will be created automatically when:
   - A new tenant is registered through the registration flow
   - The `TenantController` creates a new tenant

**That's it!** No additional setup needed for new tenants.

---

## 🔄 For Existing Tenants

Existing tenants need to:
1. Run the new migrations
2. Create clinic wallets for all existing tenants

### Step 1: Run Migrations

Run the alter migrations on all existing tenants:

```bash
php artisan tenants:migrate
```

This will:
- Update the `wallets` table structure
- Restructure the `transactions` table
- Add payment fields to the `invoices` table

### Step 2: Create Clinic Wallets

We've created a **safe, idempotent command** that creates clinic wallets for all tenants that don't have one.

#### Run the Command:

```bash
php artisan wallets:create-clinic
```

#### What This Command Does:

✅ **Safe to run multiple times** - It only creates wallets that don't exist  
✅ **Progress tracking** - Shows a progress bar and summary  
✅ **Error handling** - Continues processing even if one tenant fails  
✅ **Detailed output** - Shows how many wallets were created vs already existed

#### Example Output:

```
Starting clinic wallet creation for all tenants...

Found 5 tenant(s). Processing...

█████████████████████████████████████████████ 5/5 [100%]

=== Summary ===
Total tenants processed: 5
Clinic wallets created: 3
Already had clinic wallet: 2

✓ Command completed successfully!
```

---

## 🔍 Verification

After running the migrations and command, verify everything is working:

### Check Clinic Wallets

```bash
php artisan tinker
```

```php
// Check all clinic wallets
DB::table('tenants')->get()->each(function($tenant) {
    tenancy()->initialize($tenant);
    $clinicWallet = \App\Models\Tenant\Wallet::where('type', 'clinic')
        ->where('singleton_key', 1)
        ->first();
    
    echo "Tenant {$tenant->id}: " . ($clinicWallet ? "✓ Has clinic wallet (ID: {$clinicWallet->id})" : "✗ Missing clinic wallet") . "\n";
    tenancy()->end();
});
```

### Check User Wallets

```php
// In tinker, for a specific tenant:
tenancy()->initialize(\App\Models\Tenant::first());

// Check user wallets
\App\Models\Tenant\Wallet::where('type', 'user')->count();

// Check if users have wallets
\App\Models\User::all()->each(function($user) {
    echo "{$user->name}: " . ($user->wallet ? "✓ Has wallet" : "✗ No wallet") . "\n";
});

tenancy()->end();
```

---

## 🏗️ Architecture Changes Summary

### Database Changes

#### `wallets` table:
- Added `type` enum (clinic/user)
- Added `singleton_key` for clinic wallet uniqueness
- Made `user_id` nullable (clinic wallet has no user)
- Updated `balance` to decimal(64, 2)

#### `transactions` table (complete restructure):
- Removed: `wallet_id`, `price`, `transaction_type`, `accountable_type`, `accountable_id`
- Added:
  - `from_wallet_id` - Source wallet
  - `to_wallet_id` - Destination wallet
  - `invoice_id` - Related invoice
  - `amount` - Transaction amount
  - `type` - invoice_payment, payout, refund, adjustment
  - `direction_source` - internal_wallet, external_gateway, external_pos, external_cash
  - `payment_method` - gateway, pos, cash, manual, internal
  - `provider_ref` - Stripe ID, staff ID, etc.
  - `payment_proof_url` - Receipt/proof URL
  - `status` - pending, completed, failed

#### `invoices` table:
- Added `payment_method` - Payment method used
- Added `paid_at` - Timestamp when paid
- Added `meta` - JSON metadata
- Added `status` - pending, paid, paid_manual, failed, refunded

### Code Changes

#### New Service: `WalletService`
Located at: `app/Services/WalletService.php`

Methods:
- `markPaidByGateway()` - Mark invoice paid via Stripe/gateway
- `markPaidManually()` - Mark invoice paid via POS/cash/manual
- `payoutToPractitioner()` - Transfer funds from clinic to practitioner
- `createClinicWallet()` - Create the singleton clinic wallet
- `getOrCreateUserWallet()` - Get or create user wallet

#### Updated Models:

**`Wallet` Model:**
- Added `clinic()` scope
- Added `user()` scope
- Added relationships for incoming/outgoing transactions
- Deprecated `addCredit()` and `addDebit()` methods

**`Transaction` Model:**
- Added `fromWallet()`, `toWallet()`, `invoice()` relationships
- Added scopes: `invoicePayments()`, `payouts()`, `completed()`, `pending()`

**`Invoices` Model:**
- Added `transactions()` relationship

#### Updated Controllers:

**`InvoicesController`:**
- Added `transactions()` - View invoice transactions
- Added `createTransaction()` - Create transaction for invoice
- Updated `index()` to include payment status

**`WalletController`:**
- Updated to work with new transaction structure
- Now shows both incoming and outgoing transactions

---

## 💡 Usage Examples

### Create a Transaction for an Invoice

#### Via Frontend:
1. Go to Invoices page
2. Click the "Create Transaction" button (Receipt icon) on an unpaid invoice
3. Select payment method (POS, Cash, Gateway, Manual)
4. Click "Create Transaction"

#### Via Code:

```php
use App\Services\WalletService;
use App\Models\Tenant\Invoices;

$walletService = app(WalletService::class);
$invoice = Invoices::find(1);

// Mark as paid by gateway (Stripe)
$walletService->markPaidByGateway($invoice, 'stripe_payment_intent_123');

// Mark as paid manually (POS)
$walletService->markPaidManually($invoice, null, 'pos');

// Mark as paid manually (Cash with receipt)
$walletService->markPaidManually($invoice, 'https://example.com/receipt.jpg', 'cash');
```

### Payout to Practitioner

```php
use App\Services\WalletService;

$walletService = app(WalletService::class);

// Payout $500 to practitioner (user_id: 5)
$walletService->payoutToPractitioner(
    practitionerUserId: 5,
    amount: 500.00,
    invoiceId: 123 // optional
);
```

### View Wallet Balance

```php
use App\Models\Tenant\Wallet;

// Clinic wallet
$clinicWallet = Wallet::clinic()->first();
echo "Clinic balance: $" . $clinicWallet->balance;

// User wallet
$userWallet = Wallet::user()->where('user_id', 5)->first();
echo "User balance: $" . $userWallet->balance;
```

---

## ⚠️ Important Notes

### Deprecated Methods

The following methods are **deprecated** and will throw exceptions:

```php
// ❌ DON'T USE
$wallet->addCredit($amount, $model);
$wallet->addDebit($amount, $model);

// ✅ USE INSTEAD
use App\Services\WalletService;
$walletService = app(WalletService::class);
$walletService->markPaidByGateway($invoice, $stripeId);
```

### WalletTransactionService

The old `WalletTransactionService` has been updated but the `processAppointmentCompletion()` method needs further work. It currently logs warnings instead of creating transactions. This will need to be updated to work with the new invoice-based system.

### User Wallet Creation

User wallets are **automatically created** when:
- A new user is created in a tenant context
- The `User` model's boot method runs

### Frontend Features

The invoice management page now includes:
- **View Transactions** button (Eye icon) - For invoices with existing transactions
- **Create Transaction** button (Receipt icon) - For invoices without transactions
- Transaction details modal showing all transaction history
- Payment method selection when creating transactions

---

## 🐛 Troubleshooting

### Problem: Clinic wallet not created for tenant

**Solution:**
```bash
php artisan wallets:create-clinic
```

### Problem: User wallet not created automatically

**Solution:**
```php
use App\Services\WalletService;

$walletService = app(WalletService::class);
$wallet = $walletService->getOrCreateUserWallet($userId);
```

### Problem: Old transactions not showing

**Explanation:** The transaction structure has completely changed. Old transactions used the polymorphic `accountable` relationship. New transactions use invoice relationships. You may need to migrate old transaction data if you want to preserve it.

### Problem: Balance is incorrect

**Solution:**
```php
$wallet->recalculateBalance();
```

---

## 📞 Support

If you encounter any issues during migration:

1. Check the Laravel logs: `storage/logs/laravel.log`
2. Review the migration files in `database/migrations/tenant/`
3. Verify database structure matches the new schema
4. Run the clinic wallet creation command: `php artisan wallets:create-clinic`

---

## ✅ Migration Checklist

- [ ] Backup your database
- [ ] Run `php artisan tenants:migrate`
- [ ] Run `php artisan wallets:create-clinic`
- [ ] Verify clinic wallets exist for all tenants
- [ ] Test creating transactions via frontend
- [ ] Test practitioner payouts
- [ ] Update any custom code using old wallet methods
- [ ] Test wallet display pages

---

**Last Updated:** October 20, 2025  
**Version:** 1.0.0

