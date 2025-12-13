<?php

namespace App\Http\Controllers\Tenant;

use App\Http\Controllers\Controller;
use App\Models\Patient;
use App\Models\Practitioner;
use App\Models\Tenant\Invoices;
use App\Models\Tenant\Transaction;
use App\Models\Tenant\Wallet;
use App\Services\WalletService;
use Illuminate\Http\Request; // central
use Inertia\Inertia;      // central

class InvoicesController extends Controller
{
    /**
     * List invoices (with invoiceable).
     */
    public function __construct()
    {
        $this->middleware('permission:view-invoices')->only(['index', 'show']);
        $this->middleware('permission:add-invoices')->only(['create', 'store']);
        $this->middleware('permission:update-invoices')->only(['edit', 'update', 'updateStatus']);
        $this->middleware('permission:delete-invoices')->only('destroy');
    }

    public function index(Request $request)
    {
        // Don't eager load 'invoiceable' for system-generated invoices
        $query = \App\Models\Tenant\Invoices::query()->latest();

        // filters
        if ($s = trim($request->input('search', ''))) {
            // Search by invoice id, invoiceable_id, or invoiceable_type
            $query->where(function ($q) use ($s) {
                $q->where('id', $s)
                    ->orWhere('invoiceable_id', $s)
                    ->orWhere('invoiceable_type', 'like', "%{$s}%");
            });
        }
        if ($type = $request->input('invoiceable_type')) {
            $query->where('invoiceable_type', $type);
        }

        // Status filter
        if ($status = $request->input('status')) {
            $query->where('status', $status);
        }

        // Date type filter (created_at or due_date)
        $dateType = $request->input('date_type', 'created_at'); // Default to created_at
        if ($from = $request->input('date_from')) {
            $query->whereDate($dateType, '>=', $from);
        }
        if ($to = $request->input('date_to')) {
            $query->whereDate($dateType, '<=', $to);
        }

        $perPage = (int) $request->input('perPage', 15);

        $invoices = $query->paginate($perPage)->through(function ($inv) {
            // invoiceable_type is now just a string label, not polymorphic
            $name = match ($inv->invoiceable_type) {
                'system' => 'System Generated',
                'appointment' => 'Appointment',
                'order' => 'Order',
                'subscription' => 'Subscription',
                default => ucfirst($inv->invoiceable_type),
            };

            return [
                'id' => $inv->id,
                'invoice_number' => $inv->invoice_number,
                'price' => (string) $inv->price,
                'subtotal' => (string) $inv->subtotal,
                'tax_total' => (string) $inv->tax_total,
                'invoiceable_type' => $inv->invoiceable_type,
                'invoiceable_id' => $inv->invoiceable_id,
                'invoiceable' => ['name' => $name], // Simple label, not polymorphic
                'payment_method' => $inv->payment_method,
                'paid_at' => $inv->paid_at ? $inv->paid_at->toISOString() : null,
                'status' => $inv->status ?? 'pending',
                'has_transactions' => $inv->transactions()->exists(),
                'has_payment_transaction' => $inv->hasPaymentTransaction(),
                'has_payout_transaction' => $inv->hasPayoutTransaction(),
                'invoiceable_type_short' => ucfirst($inv->invoiceable_type),
                'deleted_at' => $inv->deleted_at,
                'created_at' => optional($inv->created_at)->toISOString(),
                'updated_at' => optional($inv->updated_at)->toISOString(),
                'meta' => $inv->meta, // Include meta JSON for line items
            ];
        })->withQueryString();

        // Optional: provide types for dropdown (aliases or FQCNs)
        $invoiceableTypes = [
            ['label' => 'Order', 'value' => 'order'], // or 'App\\Models\\Tenant\\Order'
            ['label' => 'Subscription', 'value' => 'subscription'],
            // ...
        ];

        return \Inertia\Inertia::render('Invoices/Index', [
            'invoices' => $invoices,
            'filters' => [
                'search' => $request->input('search', ''),
                'invoiceable_type' => $type ?: '',
                'status' => $request->input('status', ''),
                'date_type' => $request->input('date_type', 'created_at'),
                'date_from' => $request->input('date_from', ''),
                'date_to' => $request->input('date_to', ''),
                'perPage' => $perPage,
            ],
            'invoiceableTypes' => $invoiceableTypes,
        ]);
    }

    /**
     * Export invoices to PDF
     */
    public function export(Request $request)
    {
        // Apply same filters as index
        $query = \App\Models\Tenant\Invoices::query()->latest();

        if ($s = trim($request->input('search', ''))) {
            $query->where(function ($q) use ($s) {
                $q->where('id', $s)
                    ->orWhere('invoiceable_id', $s)
                    ->orWhere('invoiceable_type', 'like', "%{$s}%");
            });
        }
        if ($type = $request->input('invoiceable_type')) {
            $query->where('invoiceable_type', $type);
        }
        if ($status = $request->input('status')) {
            $query->where('status', $status);
        }

        $dateType = $request->input('date_type', 'created_at');
        if ($from = $request->input('date_from')) {
            $query->whereDate($dateType, '>=', $from);
        }
        if ($to = $request->input('date_to')) {
            $query->whereDate($dateType, '<=', $to);
        }

        // Get all matching invoices (no pagination for export)
        $invoices = $query->get();

        // Get currency from organization settings
        $currency = \App\Models\OrganizationSetting::getValue('accounting_currency', 'CAD');
        $currencySymbols = [
            'CAD' => 'CA$',
            'USD' => '$',
            'EUR' => '€',
            'GBP' => '£',
            'AUD' => 'A$',
            'PKR' => 'Rs',
        ];
        $currencySymbol = $currencySymbols[$currency] ?? $currency;

        // Generate PDF
        $pdf = \PDF::loadView('invoices.export-pdf', [
            'invoices' => $invoices,
            'currency' => $currencySymbol,
        ]);

        $filename = 'invoices_'.now()->format('Y-m-d_His').'.pdf';

        return $pdf->download($filename);
    }

    /**
     * Show create form.
     * (You can pass selectable invoiceable targets if you want)
     */
    public function create()
    {
        return Inertia::render('Invoices/Create', [
            // 'invoiceableOptions' => [...], // optional
        ]);
    }

    /**
     * Store a new invoice.
     */
    // public function store(Request $request)
    // {
    //     $validated = $request->validate([
    //         'invoiceable_type' => 'required|string|max:255', // e.g. App\\Models\\Tenant\\Order (or morph map alias)
    //         'invoiceable_id'   => 'required|integer',
    //         'price'            => 'required|numeric|min:0',
    //     ]);

    //     Invoices::create($validated);

    //     return redirect()->route('invoices.index')
    //         ->with('success', 'Invoice created.');
    // }

    /**
     * Show a single invoice page.
     */
    public function show(Invoices $invoice)
    {
        // Get customer wallet info
        $customerWallet = $invoice->customerWallet;
        $customerInfo = null;

        if ($customerWallet) {
            if ($customerWallet->owner_type === 'patient' && $customerWallet->owner_id) {
                // Use the Patient model for proper CipherSweet decryption
                $patient = \App\Models\Patient::find($customerWallet->owner_id);
                $customerInfo = [
                    'type' => 'patient',
                    'id' => $customerWallet->owner_id,
                    'name' => $patient ? trim(($patient->first_name ?? '').' '.($patient->last_name ?? '')) : 'Unknown Patient',
                    'wallet_id' => $customerWallet->id,
                ];
            } elseif ($customerWallet->owner_type === 'practitioner' && $customerWallet->owner_id) {
                $practitioner = \App\Models\Practitioner::find($customerWallet->owner_id);
                $customerInfo = [
                    'type' => 'practitioner',
                    'id' => $customerWallet->owner_id,
                    'name' => $practitioner ? trim(($practitioner->first_name ?? '').' '.($practitioner->last_name ?? '')) : 'Unknown Practitioner',
                    'wallet_id' => $customerWallet->id,
                ];
            }
        }

        // invoiceable_type is now just a string label, not polymorphic
        $invoiceableName = match ($invoice->invoiceable_type) {
            'system' => 'System Generated',
            'appointment' => 'Appointment',
            'order' => 'Order',
            'subscription' => 'Subscription',
            default => ucfirst($invoice->invoiceable_type),
        };

        // Shape the payload
        $payload = [
            'id' => $invoice->id,
            'invoice_number' => $invoice->invoice_number,
            'price' => (string) $invoice->price,
            'subtotal' => (string) $invoice->subtotal,
            'tax_total' => (string) $invoice->tax_total,
            'due_date' => $invoice->due_date,
            'invoiceable_type' => $invoice->invoiceable_type,
            'invoiceable_id' => $invoice->invoiceable_id,
            'invoiceable' => ['name' => $invoiceableName], // Simple label, not polymorphic
            'invoiceable_type_short' => ucfirst($invoice->invoiceable_type),
            'payment_method' => $invoice->payment_method,
            'paid_at' => $invoice->paid_at ? $invoice->paid_at->toISOString() : null,
            'status' => $invoice->status ?? 'pending',
            'has_transactions' => $invoice->transactions()->exists(),
            'has_payment_transaction' => $invoice->hasPaymentTransaction(),
            'has_payout_transaction' => $invoice->hasPayoutTransaction(),
            'meta' => $invoice->meta,
            'created_at' => $invoice->created_at ? $invoice->created_at->toISOString() : null,
            'updated_at' => $invoice->updated_at ? $invoice->updated_at->toISOString() : null,
            'deleted_at' => $invoice->deleted_at ? $invoice->deleted_at->toISOString() : null,
        ];

        return Inertia::render('Invoices/Show', [
            'invoice' => $payload,
            'customer' => $customerInfo,
        ]);
    }

    /**
     * Show edit invoice form (only if no transactions exist)
     */
    public function edit(Invoices $invoice)
    {
        // Check if invoice has any transactions
        if ($invoice->transactions()->exists()) {
            return redirect()->route('invoices.index')
                ->with('error', 'Cannot edit invoice that has transactions.');
        }

        // Get customer wallet info
        $customerWallet = $invoice->customerWallet;
        $customerInfo = null;

        if ($customerWallet) {
            if ($customerWallet->owner_type === 'patient' && $customerWallet->owner_id) {
                // Use the Patient model for proper CipherSweet decryption
                $patient = \App\Models\Patient::find($customerWallet->owner_id);
                $customerInfo = [
                    'type' => 'patient',
                    'id' => $customerWallet->owner_id,
                    'name' => $patient ? trim(($patient->first_name ?? '').' '.($patient->last_name ?? '')) : 'Unknown Patient',
                    'email' => $patient->email ?? null,
                    'health_number' => $patient->health_number ?? null,
                    'wallet_id' => $customerWallet->id,
                ];
            } elseif ($customerWallet->owner_type === 'practitioner' && $customerWallet->owner_id) {
                // Use the Practitioner model for proper CipherSweet decryption
                $practitioner = \App\Models\Practitioner::find($customerWallet->owner_id);
                $customerInfo = [
                    'type' => 'practitioner',
                    'id' => $customerWallet->owner_id,
                    'name' => $practitioner ? trim(($practitioner->first_name ?? '').' '.($practitioner->last_name ?? '')) : 'Unknown Practitioner',
                    'email' => $practitioner->email ?? null,
                    'license_number' => $practitioner->license_number ?? null,
                    'wallet_id' => $customerWallet->id,
                ];
            }
        }

        return Inertia::render('Invoices/Edit', [
            'invoice' => [
                'id' => $invoice->id,
                'price' => (string) $invoice->price,
                'subtotal' => (string) $invoice->subtotal,
                'tax_total' => (string) $invoice->tax_total,
                'customer_wallet_id' => $invoice->customer_wallet_id,
                'meta' => $invoice->meta,
                'status' => $invoice->status,
            ],
            'customer' => $customerInfo,
        ]);
    }

    /**
     * Update an existing invoice (only if no transactions exist)
     */
    public function update(Request $request, Invoices $invoice)
    {
        // Check if invoice has any transactions
        if ($invoice->transactions()->exists()) {
            return redirect()->route('invoices.index')
                ->with('error', 'Cannot update invoice that has transactions.');
        }

        $validated = $request->validate([
            'customer_wallet_id' => 'required|exists:wallets,id',
            'due_date' => 'nullable|date',
            'line_items' => 'required|array|min:1',
            'line_items.*.desc' => 'required|string',
            'line_items.*.qty' => 'required|numeric|min:1',
            'line_items.*.unit_price' => 'required|numeric|min:0',
            'line_items.*.tax_rate' => 'required|numeric|min:0|max:100',
        ]);

        // Calculate totals from line items
        $subtotal = 0;
        $taxTotal = 0;
        $lines = [];

        foreach ($validated['line_items'] as $item) {
            $qty = (float) $item['qty'];
            $unitPrice = (float) $item['unit_price'];
            $taxRate = (float) $item['tax_rate'];

            $lineSubtotal = $qty * $unitPrice;
            $taxAmount = $lineSubtotal * ($taxRate / 100);

            $subtotal += $lineSubtotal;
            $taxTotal += $taxAmount;

            $lines[] = [
                'desc' => $item['desc'],
                'qty' => $qty,
                'unit_price' => round($unitPrice, 4),
                'tax_rate' => $taxRate,
                'tax_amount' => round($taxAmount, 4),
                'line_subtotal' => round($lineSubtotal, 4),
            ];
        }

        $price = $subtotal + $taxTotal;

        // Update invoice
        $invoice->update([
            'customer_wallet_id' => $validated['customer_wallet_id'],
            'price' => round($price, 4),
            'subtotal' => round($subtotal, 4),
            'tax_total' => round($taxTotal, 4),
            'due_date' => $validated['due_date'] ?? null,
            'meta' => [
                'lines' => $lines,
            ],
        ]);

        return redirect()->route('invoices.index')
            ->with('success', 'Invoice updated successfully.');
    }

    /**
     * Send invoice via email to customer
     */
    public function sendEmail(Invoices $invoice)
    {
        try {
            // Get customer wallet and details
            $customerWallet = $invoice->customerWallet;
            $customerEmail = null;
            $customerName = null;
            $customerType = null;

            if ($customerWallet) {
                if ($customerWallet->owner_type === 'patient' && $customerWallet->owner_id) {
                    $patient = \App\Models\Patient::find($customerWallet->owner_id);
                    if ($patient) {
                        $customerEmail = $patient->email;
                        $customerName = trim(($patient->first_name ?? '').' '.($patient->last_name ?? ''));
                        $customerType = 'patient';
                    }
                } elseif ($customerWallet->owner_type === 'practitioner' && $customerWallet->owner_id) {
                    $practitioner = \App\Models\Practitioner::find($customerWallet->owner_id);
                    if ($practitioner) {
                        $customerEmail = $practitioner->email;
                        $customerName = trim(($practitioner->first_name ?? '').' '.($practitioner->last_name ?? ''));
                        $customerType = 'practitioner';
                    }
                }
            }

            // Validate email exists
            if (! $customerEmail) {
                return back()->with('error', 'Customer email not found. Cannot send invoice.');
            }

            // Get organization details with safe defaults
            $organizationData = [
                'name' => \App\Models\OrganizationSetting::getValue('practice_details_name', 'Practice'),
                'email' => \App\Models\OrganizationSetting::getValue('practice_details_contact_email', ''),
                'phone' => \App\Models\OrganizationSetting::getValue('practice_details_phone_number', ''),
                'currency' => \App\Models\OrganizationSetting::getValue('accounting_currency', 'CAD'),
            ];

            // Prepare invoice data
            $invoiceData = [
                'lines' => $invoice->meta['lines'] ?? [],
            ];

            // Prepare customer data
            $customerData = [
                'name' => $customerName,
                'email' => $customerEmail,
                'type' => $customerType,
            ];

            // Send email
            \Mail::to($customerEmail)->send(
                new \App\Mail\InvoiceEmail($invoice, $invoiceData, $customerData, $organizationData)
            );

            return back()->with('success', "Invoice sent successfully to {$customerEmail}");
        } catch (\Exception $e) {
            \Log::error('Failed to send invoice email', [
                'invoice_id' => $invoice->id,
                'error' => $e->getMessage(),
            ]);

            return back()->with('error', 'Failed to send invoice email: '.$e->getMessage());
        }
    }

    /**
     * Search for customer wallets (system, patients, practitioners)
     */
    public function searchCustomers(Request $request)
    {
        $search = $request->input('search', '');
        $type = $request->input('type', 'patient'); // patient or practitioner
        $results = [];
        $currentTenantId = tenant('id');

        if (! $search) {
            return response()->json($results);
        }

        if ($type === 'patient') {
            // Search patients by exact match on encrypted fields using whereBlind
            $matchingPatientIds = tenancy()->central(function () use ($search) {
                return \App\Models\Patient::where(function ($query) use ($search) {
                    // Search by health card number (exact match)
                    $query->whereBlind('health_number', 'health_number_index', $search)
                        // Search by full name combinations
                        ->orWhereBlind('first_name', 'first_name_index', $search)
                        ->orWhereBlind('last_name', 'last_name_index', $search);

                    // Try to split the search into first and last name
                    $nameParts = explode(' ', $search, 2);
                    if (count($nameParts) === 2) {
                        $firstName = trim($nameParts[0]);
                        $lastName = trim($nameParts[1]);

                        // Search for exact first name AND last name match
                        $query->orWhere(function ($q) use ($firstName, $lastName) {
                            $q->whereBlind('first_name', 'first_name_index', $firstName)
                                ->whereBlind('last_name', 'last_name_index', $lastName);
                        });
                    }
                })
                    ->pluck('id')
                    ->toArray();
            });

            if (! empty($matchingPatientIds)) {
                // Fetch full models to allow CipherSweet to decrypt properly
                $patients = \App\Models\Patient::whereHas('tenants', function ($subQuery) use ($currentTenantId) {
                    $subQuery->where('tenant_id', $currentTenantId);
                })
                    ->whereIn('id', $matchingPatientIds)
                    ->limit(10)
                    ->get(); // Fetch complete models for proper decryption

                foreach ($patients as $patient) {
                    // Get or create wallet for this patient
                    $wallet = Wallet::getOrCreatePatientWallet($patient->id);

                    // Map to only needed fields after decryption
                    $results[] = [
                        'id' => "patient-{$patient->id}",
                        'name' => "{$patient->first_name} {$patient->last_name}".($patient->health_number ? " (HC: {$patient->health_number})" : ''),
                        'type' => 'patient',
                        'type_id' => $patient->id,
                        'wallet_id' => $wallet->id,
                    ];
                }
            }
        } elseif ($type === 'practitioner') {
            // Search practitioners by exact match on encrypted fields using whereBlind
            $matchingPractitionerIds = tenancy()->central(function () use ($search) {
                return Practitioner::where(function ($query) use ($search) {
                    // Search by license number (exact match) - assuming you have this field
                    // $query->whereBlind('license_number', 'license_number_index', $search)
                    // Search by full name combinations
                    $query->whereBlind('first_name', 'first_name_index', $search)
                        ->orWhereBlind('last_name', 'last_name_index', $search);

                    // Try to split the search into first and last name
                    $nameParts = explode(' ', $search, 2);
                    if (count($nameParts) === 2) {
                        $firstName = trim($nameParts[0]);
                        $lastName = trim($nameParts[1]);

                        // Search for exact first name AND last name match
                        $query->orWhere(function ($q) use ($firstName, $lastName) {
                            $q->whereBlind('first_name', 'first_name_index', $firstName)
                                ->whereBlind('last_name', 'last_name_index', $lastName);
                        });
                    }
                })
                    ->pluck('id')
                    ->toArray();
            });

            if (! empty($matchingPractitionerIds)) {
                // Fetch full models from tenant database to allow CipherSweet to decrypt properly
                $practitioners = Practitioner::whereIn('id', $matchingPractitionerIds)
                    ->limit(10)
                    ->get(); // Fetch complete models for proper decryption

                foreach ($practitioners as $practitioner) {
                    // Get or create wallet for this practitioner
                    $wallet = Wallet::getOrCreatePractitionerWallet($practitioner->id);

                    // Map to only needed fields after decryption
                    $results[] = [
                        'id' => "practitioner-{$practitioner->id}",
                        'name' => "{$practitioner->first_name} {$practitioner->last_name}".($practitioner->email ? " ({$practitioner->email})" : ''),
                        'type' => 'practitioner',
                        'type_id' => $practitioner->id,
                        'wallet_id' => $wallet->id,
                    ];
                }
            }
        }

        return response()->json($results);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'customer' => 'required|string',
            'due_date' => 'nullable|date',
            'lines' => 'required|array|min:1',
            'lines.*.description' => 'required|string|max:255',
            'lines.*.quantity' => 'required|numeric|min:0.01',
            'lines.*.unit_price' => 'required|numeric|min:0',
            'lines.*.tax_rate' => 'nullable|numeric|min:0|max:100',
        ]);

        // Resolve customer wallet
        $customerWallet = $this->resolveCustomerWallet($validated['customer']);

        if (! $customerWallet) {
            return back()
                ->withInput()
                ->withErrors(['customer' => 'Invalid customer selected.']);
        }

        // Calculate totals from lines
        $subtotal = 0;
        $taxTotal = 0;
        $lines = [];

        foreach ($validated['lines'] as $line) {
            $qty = $line['quantity'];
            $unitPrice = $line['unit_price'];
            $taxRate = $line['tax_rate'] ?? 0;

            $lineSubtotal = $qty * $unitPrice;
            $lineTax = $lineSubtotal * ($taxRate / 100);

            $subtotal += $lineSubtotal;
            $taxTotal += $lineTax;

            $lines[] = [
                'desc' => $line['description'],
                'qty' => $qty,
                'unit_price' => $unitPrice,
                'tax_rate' => $taxRate,
                'tax_amount' => round($lineTax, 4),
                'line_subtotal' => round($lineSubtotal, 4),
            ];
        }

        $price = $subtotal + $taxTotal;

        // Create invoice - system-generated standalone invoice
        $invoice = Invoices::create([
            'invoiceable_type' => 'system', // System-generated invoice
            'invoiceable_id' => 0, // 0 indicates system-generated (no related model)
            'customer_wallet_id' => $customerWallet->id,
            'price' => round($price, 4),
            'subtotal' => round($subtotal, 4),
            'tax_total' => round($taxTotal, 4),
            'due_date' => $validated['due_date'] ?? null,
            'meta' => [
                'lines' => $lines,
            ],
        ]);

        return redirect()
            ->route('invoices.index')
            ->with('success', 'Invoice created successfully.');
    }

    /**
     * Resolve customer wallet based on selection
     */
    protected function resolveCustomerWallet(string $customer): ?Wallet
    {
        if ($customer === 'system') {
            return Wallet::getSystemWallet();
        }

        if (str_starts_with($customer, 'patient-')) {
            $patientId = (int) str_replace('patient-', '', $customer);

            return Wallet::getOrCreatePatientWallet($patientId);
        }

        if (str_starts_with($customer, 'practitioner-')) {
            $practitionerId = (int) str_replace('practitioner-', '', $customer);

            return Wallet::getOrCreatePractitionerWallet($practitionerId);
        }

        return null;
    }

    /**
     * Soft delete.
     */
    public function destroy(Invoices $invoice)
    {
        $invoice->delete();

        return redirect()->route('invoices.index')
            ->with('success', 'Invoice deleted.');
    }

    /**
     * Archived (trashed) list.
     */
    public function archived(Request $request)
    {
        $query = Invoices::onlyTrashed()
            ->with('invoiceable')
            ->latest();

        // Optional filters here as well
        if ($type = $request->string('invoiceable_type')->toString()) {
            $query->where('invoiceable_type', $type);
        }
        if ($id = $request->integer('invoiceable_id')) {
            $query->where('invoiceable_id', $id);
        }

        $invoices = $query->paginate(15)->withQueryString();

        return Inertia::render('billing/Invoices/Archived', [
            'invoices' => $invoices,
            'filters' => [
                'invoiceable_type' => $type ?? null,
                'invoiceable_id' => $id ?? null,
            ],
        ]);
    }

    /**
     * Restore a soft-deleted invoice.
     */
    public function restore($id)
    {
        $invoice = Invoices::onlyTrashed()->findOrFail($id);
        $invoice->restore();

        return redirect()->route('invoices.archived')
            ->with('success', 'Invoice restored.');
    }

    /**
     * Permanently delete a soft-deleted invoice.
     */
    public function forceDelete($id)
    {
        $invoice = Invoices::onlyTrashed()->findOrFail($id);
        $invoice->forceDelete();

        return redirect()->route('invoices.archived')
            ->with('success', 'Invoice permanently deleted.');
    }

    /**
     * Get transactions for a specific invoice
     */
    public function transactions(Invoices $invoice)
    {
        $transactions = $invoice->transactions()
            ->with(['fromWallet', 'toWallet'])
            ->latest()
            ->get()
            ->map(function ($transaction) {
                // Helper function to get wallet display name
                $getWalletLabel = function ($wallet) {
                    if (! $wallet) {
                        return null;
                    }

                    // Check if it's the clinic wallet (singleton_key = 1)
                    if ($wallet->singleton_key === 1 || $wallet->owner_type === 'system') {
                        return 'Clinic';
                    }

                    // Return owner type for other wallets
                    return match ($wallet->owner_type) {
                        'patient' => 'Patient',
                        'practitioner' => 'Practitioner',
                        'user' => 'User',
                        default => ucfirst($wallet->owner_type),
                    };
                };

                return [
                    'id' => $transaction->id,
                    'amount' => (string) $transaction->amount,
                    'type' => $transaction->type,
                    'direction_source' => $transaction->direction_source,
                    'payment_method' => $transaction->payment_method,
                    'provider_ref' => $transaction->provider_ref,
                    'payment_proof_url' => $transaction->payment_proof_url,
                    'status' => $transaction->status,
                    'from_wallet' => $transaction->fromWallet ? [
                        'id' => $transaction->fromWallet->id,
                        'type' => $getWalletLabel($transaction->fromWallet),
                        'owner_type' => $transaction->fromWallet->owner_type,
                        'balance' => (string) $transaction->fromWallet->balance,
                    ] : null,
                    'to_wallet' => $transaction->toWallet ? [
                        'id' => $transaction->toWallet->id,
                        'type' => $getWalletLabel($transaction->toWallet),
                        'owner_type' => $transaction->toWallet->owner_type,
                        'balance' => (string) $transaction->toWallet->balance,
                    ] : null,
                    'created_at' => $transaction->created_at->toISOString(),
                ];
            });

        return response()->json([
            'transactions' => $transactions,
        ]);
    }

    /**
     * Create a transaction for an invoice (mark as paid)
     */
    public function createTransaction(Request $request, Invoices $invoice)
    {
        $validated = $request->validate([
            'payment_method' => 'required|string|in:gateway,pos,cash,manual',
            'amount' => 'required|numeric|min:0.01',
            'provider_ref' => 'nullable|string',
            'payment_proof_url' => 'nullable|url',
        ]);

        // Validate amount doesn't exceed invoice price
        if ($validated['amount'] > $invoice->price) {
            return back()->withErrors(['error' => 'Payment amount cannot exceed invoice amount.']);
        }

        $walletService = app(WalletService::class);

        try {
            $partialAmount = (float) $validated['amount'];

            if ($validated['payment_method'] === 'gateway') {
                $walletService->markPaidByGateway(
                    $invoice,
                    $validated['provider_ref'] ?? 'manual-gateway-'.time(),
                    $partialAmount
                );
            } else {
                $walletService->markPaidManually(
                    $invoice,
                    $validated['payment_proof_url'] ?? null,
                    $validated['payment_method'],
                    $partialAmount
                );
            }

            // Check if invoice is fully paid or partial
            if ($invoice->fresh()->isFullyPaid()) {
                $message = 'Transaction created successfully and invoice marked as paid.';
            } else {
                $message = 'Partial payment recorded. Invoice status updated to partial.';
            }

            return back()->with('success', $message);
        } catch (\Exception $e) {
            return back()->withErrors(['error' => 'Failed to create transaction: '.$e->getMessage()]);
        }
    }

    /**
     * Create payout transaction for an invoice to its primary practitioner
     * This is the second transaction - transferring money from clinic to practitioner after 10% commission
     */
    public function createPayout(Request $request, Invoices $invoice)
    {
        $walletService = app(WalletService::class);

        try {
            // Validate that invoice is paid first
            if (! $invoice->hasPaymentTransaction()) {
                return back()->withErrors(['error' => 'Invoice must be paid before creating a payout.']);
            }

            // Validate that payout doesn't already exist
            if ($invoice->hasPayoutTransaction()) {
                return back()->withErrors(['error' => 'Payout already exists for this invoice.']);
            }

            // Check if invoice is appointment-based (only appointments have practitioners)
            if ($invoice->invoiceable_type !== 'App\\Models\\Tenant\\Appointment') {
                return back()->withErrors(['error' => 'Only appointment-based invoices can have practitioner payouts.']);
            }

            // Create the payout (automatically calculates 90% of invoice amount)
            $walletService->createInvoicePayout($invoice);

            return back()->with('success', 'Payout created successfully. Practitioner has been paid 90% of invoice amount (10% clinic commission deducted).');
        } catch (\RuntimeException $e) {
            return back()->withErrors(['error' => $e->getMessage()]);
        } catch (\Exception $e) {
            return back()->withErrors(['error' => 'Failed to create payout: '.$e->getMessage()]);
        }
    }
}
