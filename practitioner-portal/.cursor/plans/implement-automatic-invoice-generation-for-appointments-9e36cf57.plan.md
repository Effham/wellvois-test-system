<!-- 9e36cf57-6ce6-47da-a574-05b6cd0fd8d3 e95b7370-8f2d-4221-a041-813d5442de28 -->
# Practitioner Invoice Generation System

## Task 1: Practitioner Invoice Generation on Wallet Page

### Overview

Add functionality to the practitioner wallet page to:

1. Display all completed appointments assigned to the practitioner
2. Show sum of total prices for those appointments
3. Add "Generate Invoice" button to create invoice with practitioner as customer

### Implementation Steps

#### 1. Create Migration for Reference Columns (TASK2 - Do First)

**File**: `database/migrations/tenant/YYYY_MM_DD_HHMMSS_add_reference_columns_to_invoices.php`

- Add `reference_type` (string, nullable) - stores appointment model path
- Add `reference_id` (bigint, nullable) - stores appointment ID
- Run migration to update invoices table

#### 2. Update WalletController

**File**: `app/Http/Controllers/WalletController.php`

**Add method**: `getPractitionerCompletedAppointments()`

- Query appointments where practitioner is assigned (`appointment_practitioner`)
- Filter by `status = 'completed'`
- Join with existing invoices to get prices
- Calculate sum of total prices
- Return: list of appointments with their invoice data

**Modify**: `index()` method

- Check if user is practitioner (`hasRole('Practitioner')`)
- If practitioner, add completed appointments data to Inertia props
- Format: `completed_appointments` array with appointment details and invoice info

#### 3. Add Invoice Generation Endpoint

**File**: `app/Http/Controllers/WalletController.php`

**Add method**: `generatePractitionerInvoice()`

- Accept POST request
- Get authenticated practitioner
- Query completed appointments for this practitioner
- Check if invoice already exists for this practitioner (prevent duplicates)
- Sum up total prices from appointment invoices (already includes tax)
- Create new invoice:
  - `invoiceable_type` = 'practitioner'
  - `invoiceable_id` = practitioner ID
  - `customer_wallet_id` = practitioner's wallet ID
  - `subtotal` = sum of appointment invoice prices (already includes tax)
  - `tax_total` = 0 (appointments already taxed)
  - `price` = sum
  - `meta` = array of appointment references with line items
- Return success response

#### 4. Update Wallet Page UI

**File**: `resources/js/pages/Wallet/Index.tsx`

**Add section**: "Completed Appointments" (above transactions)

- Display cards for each completed appointment with:
  - Patient name
  - Service name
  - Date
  - Invoice amount (from appointment invoice)
  - Status badge
- Show total sum at bottom
- Add "Generate Invoice" button
- Button triggers POST to `/wallet/generate-invoice`
- Show loading state during generation
- Display success message with invoice details
- Prevent duplicate invoice generation (disable if invoice exists)

**Data Structure**:

```typescript
interface CompletedAppointment {
  id: number;
  patient_name: string;
  service_name: string;
  appointment_date: string;
  invoice_price: number;
  invoice_id?: number;
  invoice_number?: string;
}
```

### Invoice Structure

```php
Invoices::create([
    'invoiceable_type' => 'practitioner',
    'invoiceable_id' => $practitionerId,
    'customer_wallet_id' => $practitionerWallet->id,
    'subtotal' => $totalSum,
    'tax_total' => 0.00,  // No additional tax
    'price' => $totalSum,
    'status' => 'pending',
    'meta' => [
        'appointments' => [$appointmentIds],
        'lines' => [
            [
                'desc' => "Professional Services - Appointment with {$patientName}",
                'qty' => 1,
                'unit_price' => $appointmentInvoice->price,
                'tax_rate' => 0,
                'tax_amount' => 0,
                'line_subtotal' => $appointmentInvoice->price,
                'original_invoice_id' => $appointmentInvoice->id,
                'appointment_id' => $appointment->id,
            ]
        ]
    ]
]);
```

#### 5. Add Route

**File**: `routes/web.php`

Add route:

```php
Route::post('/wallet/generate-invoice', [WalletController::class, 'generatePractitionerInvoice'])
    ->name('wallet.generate-invoice');
```

### Task 2: Add Reference Columns to Invoices Table

**File**: Create new migration `database/migrations/tenant/YYYY_MM_DD_HHMMSS_add_reference_columns_to_invoices.php`

**Migration Content**:

```php
Schema::table('invoices', function (Blueprint $table) {
    $table->string('reference_type')->nullable()->after('invoiceable_id');
    $table->unsignedBigInteger('reference_id')->nullable()->after('reference_type');
    
    // Add index for performance
    $table->index(['reference_type', 'reference_id']);
});
```

**Purpose**: Store appointment reference separately from invoiceable relationship

- `reference_type` = 'App\Models\Tenant\Appointment'
- `reference_id` = appointment ID
- Allows storing appointment link even when `invoiceable_type` = 'system'

**Update InvoiceGenerationService**:

- When creating appointment invoices, also set:
  - `reference_type` = 'App\Models\Tenant\Appointment'
  - `reference_id` = $appointment->id

## Files to Create/Modify

1. `database/migrations/tenant/YYYY_MM_DD_HHMMSS_add_reference_columns_to_invoices.php` (NEW)
2. `app/Http/Controllers/WalletController.php` (MODIFY)
3. `routes/web.php` (MODIFY)
4. `app/Services/InvoiceGenerationService.php` (MODIFY - add reference fields)
5. `resources/js/pages/Wallet/Index.tsx` (MODIFY)
6. `app/Models/Tenant/Invoices.php` (MODIFY - add to fillable array)

## Key Points

1. **No Additional Tax**: Practitioner invoices sum appointment invoice prices that already include tax
2. **Practitioner as Customer**: `customer_wallet_id` = practitioner's user wallet
3. **Reference Tracking**: Use new `reference_type` and `reference_id` columns to link invoices to appointments
4. **Duplicate Prevention**: Check if practitioner invoice already exists before creating
5. **UX**: Show appointment details clearly with total sum before invoice generation

### To-dos

- [x] Analyze current invoice structure vs requirements - verify if invoiceable_type should be string vs polymorphic
- [x] Create InvoiceGenerationService.php with tax calculation, practitioner price retrieval, and patient wallet logic
- [x] Update appointment creation flow to generate invoice for virtual mode immediately after creation
- [x] Update appointment confirmation flow to generate invoice for in-person mode when status becomes confirmed
- [x] Integrate accounting settings (tax enabled, tax rate, tax name) from OrganizationSetting into invoice generation
- [ ] Test virtual appointment invoice generation on creation
- [ ] Test in-person appointment invoice generation on confirmation
- [ ] Test tax calculations with and without tax enabled in settings