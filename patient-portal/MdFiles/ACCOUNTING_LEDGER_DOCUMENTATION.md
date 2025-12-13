# Accounting Ledger - Double-Entry Bookkeeping System

## Overview

The **Accounting Ledger** is a comprehensive double-entry bookkeeping view that provides complete transparency and verification of all financial transactions in the system. This page allows clinic administrators to:

- ✅ Verify all money is properly accounted for
- ✅ Track clinic commission (10% retention)
- ✅ See both sides of every transaction (from/to wallets)
- ✅ Identify external payments (null from_wallet_id)
- ✅ Reconcile clinic wallet balance with ledger
- ✅ Filter and search transactions by multiple criteria

---

## Access

**URL**: `/ledger`  
**Route Name**: `ledger.index`  
**Menu**: Can be added to sidebar under "Financial" or "Accounting" section

---

## Features

### 1. **Summary Dashboard** (5 Key Metrics)

At the top of the page, 5 cards display critical financial metrics:

| Metric | Description | Calculation |
|--------|-------------|-------------|
| **Clinic Balance** | Current balance in clinic wallet | Direct from `wallets` table |
| **Total Incoming** | All money received by clinic | Sum of transactions where `to_wallet_id` = clinic |
| **Total Outgoing** | All money paid out by clinic | Sum of transactions where `from_wallet_id` = clinic |
| **Total Commission** | Clinic's 10% commission earned | Sum of (invoice price - payout amount) |
| **Net Position** | Current net cash position | Total Incoming - Total Outgoing |

**Financial Health Check**:
```
Net Position = Total Incoming - Total Outgoing
Should Equal: Current Clinic Balance (when all transactions are completed)
```

---

### 2. **Advanced Filtering**

Filter transactions by:

- **Transaction Type**: Invoice Payment, Payout, Refund, Adjustment
- **Status**: Pending, Completed, Failed
- **Wallet**: Filter by specific wallet (Clinic, or any user wallet)
- **Date Range**: From/To dates
- **Per Page**: 25, 50, 100, 200 results

All filters are preserved in URL query parameters for bookmarking and sharing.

---

### 3. **Double-Entry Ledger Table**

A comprehensive table showing all transactions with double-entry accounting principles:

| Column | Description | Example |
|--------|-------------|---------|
| **ID** | Transaction identifier | #45 |
| **Date** | Transaction creation date | 2024-01-15 |
| **Type** | Transaction type badge | 🟢 Invoice Payment |
| **Invoice** | Linked invoice ID (if any) | #123 |
| **From (Credit)** | Source wallet | 💳 External Payment<br/>🏥 Clinic<br/>👤 User Name |
| **To (Debit)** | Destination wallet | 🏥 Clinic<br/>👤 Practitioner Name |
| **Amount** | Transaction amount | $100.00 |
| **Method** | Payment method | GATEWAY, POS, CASH |
| **Status** | Transaction status | ✓ Completed |
| **Balanced** | Double-entry check | ✓ (has from & to) |

---

## Double-Entry Examples

### Example 1: Customer Payment (Invoice Payment)

```
Transaction ID: #45
Type: Invoice Payment
From: 💳 External Payment (from_wallet_id = null)
To: 🏥 Clinic Wallet
Amount: $100.00
Status: Completed
Balanced: ✓
```

**Accounting Entry**:
- Debit: Clinic Wallet (+$100)
- Credit: External (Customer paid)

---

### Example 2: Practitioner Payout

```
Transaction ID: #46
Type: Payout
From: 🏥 Clinic Wallet
To: 👤 Dr. Smith (Practitioner)
Amount: $90.00
Status: Completed
Balanced: ✓
```

**Accounting Entry**:
- Debit: Practitioner Wallet (+$90)
- Credit: Clinic Wallet (-$90)

**Commission Calculation**:
- Original Invoice: $100.00
- Payout to Practitioner: $90.00
- **Clinic Commission: $10.00 (10%)**

---

### Example 3: Complete Flow

**Invoice #123: $100 Appointment**

1. **Customer Pays** (Transaction #45):
   ```
   Type: invoice_payment
   From: External (null)
   To: Clinic Wallet
   Amount: $100.00
   
   Clinic Balance: $0 → $100
   ```

2. **Practitioner Payout** (Transaction #46):
   ```
   Type: payout
   From: Clinic Wallet
   To: Practitioner Wallet
   Amount: $90.00
   
   Clinic Balance: $100 → $10
   Practitioner Balance: $0 → $90
   ```

3. **Final Balances**:
   - Clinic Wallet: $10 (commission)
   - Practitioner Wallet: $90 (payout)
   - Total Money In System: $100 ✓
   - Commission Earned: $10 (10%) ✓

---

## Understanding External Payments

### What is "External Payment"?

When **From** shows **"💳 External Payment"**, this means:
- The `from_wallet_id` is `NULL` in the database
- Money is coming **from outside the system** (customer payment)
- This is the **entry point** for money into the clinic

### Why NULL from_wallet_id?

- Customers don't have wallets in the system
- Payment comes from external sources:
  - Credit card (via Stripe)
  - POS terminal
  - Cash payment
  - Manual payment

### Double-Entry for External Payments

Even though `from_wallet_id` is NULL, the transaction is still balanced:
- **Credit Side**: External party (customer)
- **Debit Side**: Clinic Wallet (to_wallet_id)

This follows standard accounting principles where external entities don't need internal accounts.

---

## Balance Reconciliation

### How to Verify Balances

The ledger allows you to verify that all money is properly accounted for:

1. **Check Net Position**:
   ```
   Net Position = Total Incoming - Total Outgoing
   ```

2. **Verify Clinic Balance**:
   ```
   Current Clinic Balance should equal:
   - All completed incoming transactions
   - MINUS all completed outgoing transactions
   ```

3. **Verify Commission**:
   ```
   Total Commission = Sum of all (Invoice Amount - Payout Amount)
   ```

4. **Check Individual Transactions**:
   - Each transaction should have ✓ in the "Balanced" column
   - ✗ indicates missing from or to wallet (investigation needed)

---

## Commission Tracking

The system automatically calculates the 10% clinic commission:

### How Commission is Calculated

For each payout transaction:
```php
if ($transaction->type === 'payout' && $transaction->invoice_id) {
    $invoice = $transaction->invoice;
    $commission = $invoice->price - $transaction->amount;
}
```

**Example**:
- Invoice Amount: $100
- Payout Amount: $90
- **Commission: $10 (10%)**

### Viewing Total Commission

The **Total Commission** card at the top shows:
```
Total Commission = Sum of all (Invoice - Payout) amounts
```

This represents the total money retained by the clinic across all payouts.

---

## Use Cases

### 1. **End-of-Day Reconciliation**

**Goal**: Verify all today's transactions balance correctly

**Steps**:
1. Filter by today's date
2. Check "Net Position" matches expected cash flow
3. Verify "Balanced" column shows ✓ for all transactions
4. Compare "Clinic Balance" with actual bank balance

---

### 2. **Monthly Commission Report**

**Goal**: Calculate total commission earned this month

**Steps**:
1. Set date range to current month
2. Filter by Type = "Payout"
3. Check "Total Commission" card
4. Review individual payouts to see commission per transaction

---

### 3. **Practitioner Earnings Verification**

**Goal**: Verify a specific practitioner's payouts

**Steps**:
1. Filter by Wallet = "Practitioner Name"
2. Filter by Type = "Payout"
3. Review all payout transactions to that practitioner
4. Sum amounts to verify total earnings

---

### 4. **Audit Trail**

**Goal**: Track a specific invoice's complete financial flow

**Steps**:
1. Filter by Invoice ID (e.g., #123)
2. View both transactions:
   - Invoice Payment (customer → clinic)
   - Payout (clinic → practitioner)
3. Verify commission = invoice - payout
4. Check both transactions are completed

---

## Backend Implementation

### Controller: `LedgerController`

**File**: `app/Http/Controllers/Tenant/LedgerController.php`

**Key Methods**:
```php
public function index(Request $request)
{
    // Get all transactions with relationships
    $transactions = Transaction::with(['fromWallet', 'toWallet', 'invoice'])
        ->latest()
        ->paginate();
    
    // Calculate summary statistics
    $summary = [
        'clinic_balance' => $clinicWallet->balance,
        'total_incoming' => ...,
        'total_outgoing' => ...,
        'total_commission' => ...,
        'net_position' => ...,
    ];
    
    return Inertia::render('Ledger/Index', [
        'transactions' => $transactions,
        'summary' => $summary,
    ]);
}
```

---

## Frontend Implementation

### Component: `Ledger/Index.tsx`

**File**: `resources/js/pages/Ledger/Index.tsx`

**Key Features**:
- Summary cards with financial metrics
- Advanced filter bar
- Responsive transaction table
- Pagination
- Accounting notes section

---

## Database Queries

### Get All Transactions with Balance Impact

```sql
SELECT 
    t.id,
    t.amount,
    t.type,
    t.from_wallet_id,
    t.to_wallet_id,
    t.invoice_id,
    w_from.type as from_wallet_type,
    w_to.type as to_wallet_type,
    t.created_at
FROM transactions t
LEFT JOIN wallets w_from ON t.from_wallet_id = w_from.id
LEFT JOIN wallets w_to ON t.to_wallet_id = w_to.id
ORDER BY t.created_at DESC;
```

### Calculate Total Commission

```sql
SELECT 
    SUM(i.price - t.amount) as total_commission
FROM transactions t
JOIN invoices i ON t.invoice_id = i.id
WHERE t.type = 'payout'
AND t.status = 'completed';
```

### Verify Clinic Balance

```sql
-- Should equal current clinic wallet balance
SELECT 
    (
        -- Total incoming
        SELECT COALESCE(SUM(amount), 0)
        FROM transactions
        WHERE to_wallet_id = :clinic_wallet_id
        AND status = 'completed'
    ) - (
        -- Total outgoing
        SELECT COALESCE(SUM(amount), 0)
        FROM transactions
        WHERE from_wallet_id = :clinic_wallet_id
        AND status = 'completed'
    ) as calculated_balance;
```

---

## Accounting Notes

### Key Principles

1. **Double-Entry Bookkeeping**
   - Every transaction affects two accounts
   - One debit, one credit
   - Total debits = Total credits

2. **External Payments**
   - `from_wallet_id = NULL` for customer payments
   - Represents money entering the system
   - Still follows double-entry (External → Clinic)

3. **Commission Tracking**
   - 10% automatically calculated on payouts
   - Retained in clinic wallet
   - Tracked in summary statistics

4. **Balance Verification**
   - Net Position should match Clinic Balance
   - All transactions should be "Balanced" (✓)
   - Discrepancies indicate missing or failed transactions

---

## Troubleshooting

### Balance Doesn't Match

**Symptoms**: Clinic Balance ≠ Net Position

**Possible Causes**:
1. Pending transactions (not yet completed)
2. Failed transactions still counted
3. Manual adjustments not recorded

**Solution**:
1. Filter by Status = "Completed"
2. Check for ✗ in "Balanced" column
3. Review failed transactions

---

### Missing Transactions

**Symptoms**: Expected transaction not in ledger

**Possible Causes**:
1. Transaction still pending
2. Filtered out by current filters
3. Database issue

**Solution**:
1. Reset all filters
2. Search by Invoice ID
3. Check transaction status

---

### Commission Calculation Incorrect

**Symptoms**: Total Commission doesn't match expected

**Possible Causes**:
1. Invoices without payouts
2. Manual adjustments
3. Non-appointment invoices (no practitioner)

**Solution**:
1. Filter Type = "Payout"
2. Review each payout's linked invoice
3. Verify 10% calculation manually

---

## Future Enhancements

Potential improvements for the ledger:

1. **Export to CSV/Excel**
   - Download ledger for external analysis
   - Date range exports

2. **Graphical Reports**
   - Charts showing commission over time
   - Wallet balance trends
   - Transaction volume graphs

3. **Automated Reconciliation**
   - Daily balance checks
   - Alert for discrepancies
   - Automatic correction suggestions

4. **Audit Log**
   - Track who viewed ledger
   - Record filter parameters used
   - Export history

5. **Multi-Currency Support**
   - Handle different currencies
   - Exchange rate tracking
   - Currency conversion in ledger

---

## Related Documentation

- `INVOICE_PAYOUT_SYSTEM_IMPLEMENTATION.md` - Invoice and payout system
- `WALLET_MIGRATION_GUIDE.md` - Wallet architecture
- `WALLET_CONVERSION_SUMMARY.md` - Wallet system changes

---

## Summary

The **Accounting Ledger** provides:

✅ **Transparency**: See every transaction's complete flow  
✅ **Verification**: Double-entry ensures nothing is missing  
✅ **Commission Tracking**: Automatic 10% calculation  
✅ **External Payments**: Properly handles customer payments  
✅ **Balance Reconciliation**: Verify wallet balances match ledger  
✅ **Audit Trail**: Complete financial history  

This system ensures **every dollar is accounted for**, providing peace of mind and financial accuracy for clinic management.

