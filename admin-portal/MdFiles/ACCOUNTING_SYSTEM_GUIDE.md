# Accounting System - Simple Guide

## Quick Setup

### 1. Run Migration
```bash
php artisan tenants:migrate
```

This will:
- Drop old `wallets`, `invoices`, `transactions` tables
- Recreate them with clean polymorphic structure

### 2. Create Wallets
```bash
php artisan wallets:sync
```

This will:
- Create system (clinic) wallet for each tenant
- Create patient wallets for all patients
- Create practitioner wallets for all practitioners

## New Table Structure

### Wallets Table
```
- owner_type: system, patient, practitioner, or user
- owner_id: ID of owner (null for system wallet)
- balance: cached balance
- currency: PKR (default)
```

### Invoices Table
```
- customer_wallet_id: REQUIRED - who is paying
- price: total amount
- subtotal: amount before tax (optional)
- tax_total: tax amount (optional)
- meta: JSON for line items
```

### Transactions Table
```
- from_wallet_id, to_wallet_id: wallet IDs
- invoice_id: linked invoice
- amount: transaction amount
- type: invoice_payment, payout, refund, adjustment
- idempotency_key: prevents duplicates
```

## Code Usage

### Get/Create Wallets
```php
// System wallet
$systemWallet = Wallet::getSystemWallet();

// Patient wallet
$patientWallet = Wallet::getOrCreatePatientWallet($patientId);

// Practitioner wallet
$practitionerWallet = Wallet::getOrCreatePractitionerWallet($practitionerId);
```

### Create Invoice
```php
$patientWallet = Wallet::getOrCreatePatientWallet($appointment->patient_id);

Invoices::create([
    'invoiceable_type' => Appointment::class,
    'invoiceable_id' => $appointment->id,
    'customer_wallet_id' => $patientWallet->id, // REQUIRED
    'price' => 1130.00,
    'subtotal' => 1000.00,
    'tax_total' => 130.00,
    'meta' => [
        'lines' => [
            ['desc' => 'Consultation', 'qty' => 1, 'unit_price' => 1000, 'tax_rate' => 13],
        ],
    ],
]);
```

### Process Payment
```php
use App\Services\WalletService;

$walletService = app(WalletService::class);

// Gateway payment
$walletService->markPaidByGateway($invoice, $stripePaymentIntentId);

// Manual payment (POS/Cash)
$walletService->markPaidManually($invoice, $receiptUrl, 'pos');

// Partial payment
$walletService->markPaidManually($invoice, null, 'pos', 500.00, 'attempt-1');

// Refund
$walletService->processRefund($invoice, 100.00, 'Customer request');
```

## Command Options

```bash
# Sync all tenants (default)
php artisan wallets:sync

# Sync specific tenants only
php artisan wallets:sync --tenants=clinic1,clinic2,clinic3

# Force update existing wallets
php artisan wallets:sync --force

# Combine options
php artisan wallets:sync --tenants=clinic123 --force
```

**Note**: The command automatically processes ALL tenants by default - no need to specify anything!

## Example Output

```
═══════════════════════════════════════════════
  Wallet Synchronization
═══════════════════════════════════════════════

Tenants: 3

▶ Processing tenant: clinic1
  ✓ System wallet verified
  → Found 45 patients
  ✓ Created 45 patient wallets
  → Found 12 practitioners
  ✓ Created 12 practitioner wallets

▶ Processing tenant: clinic2
  ✓ System wallet verified
  → Found 23 patients
  ✓ Created 23 patient wallets
  → Found 8 practitioners
  ✓ Created 8 practitioner wallets

═══════════════════════════════════════════════
🎉 Created 88 new wallets across 2 tenants
   • System: 0
   • Patient: 68
   • Practitioner: 20

💡 Tip: Use --tenants=clinic1,clinic2 to sync specific tenants
═══════════════════════════════════════════════
```

## Automatic Wallet Creation

Wallets are automatically created when:

1. **New Practitioner Linked**: When a practitioner is linked to a clinic
2. **New Practitioner Created**: When creating a new practitioner
3. **New Patient (Intake)**: When a patient registers via intake form
4. **New Patient (Appointment)**: When creating a patient during appointment booking

All these locations now automatically call:
- `Wallet::getOrCreatePractitionerWallet($practitionerId)`
- `Wallet::getOrCreatePatientWallet($patientId)`

## That's It!

Simple and clean. No complex migrations or backfills needed.

