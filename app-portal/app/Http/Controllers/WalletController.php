<?php

namespace App\Http\Controllers;

use App\Models\Practitioner;
use App\Models\Tenant\Appointment;
use App\Models\Tenant\Invoices;
use App\Models\Tenant\Wallet;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;
use Inertia\Response;

class WalletController extends Controller
{
    /**
     * Display the wallet page for the authenticated user
     */
    public function index(): Response
    {
        $user = Auth::user();

        Log::info('Wallet page accessed', ['user_id' => $user->id]);

        // Get or create wallet for the user
        $wallet = Wallet::getOrCreateUserWallet($user->id);

        // Load transactions where this wallet is involved (incoming or outgoing)
        $transactions = \App\Models\Tenant\Transaction::query()
            ->where(function ($query) use ($wallet) {
                $query->where('from_wallet_id', $wallet->id)
                    ->orWhere('to_wallet_id', $wallet->id);
            })
            ->with(['fromWallet', 'toWallet', 'invoice.invoiceable'])
            ->orderBy('created_at', 'desc')
            ->get()
            ->map(function ($transaction) use ($wallet) {
                // Determine if this is incoming or outgoing for this wallet
                $isIncoming = $transaction->to_wallet_id === $wallet->id;
                $type = $isIncoming ? 'credit' : 'debit';

                // Try to extract related information
                $appointmentId = null;
                $patientName = null;
                $service = 'N/A';
                $description = ucfirst(str_replace('_', ' ', $transaction->type));

                // If there's an invoice, try to get more details
                if ($transaction->invoice && $transaction->invoice->invoiceable) {
                    $invoiceable = $transaction->invoice->invoiceable;

                    // Check if it's an appointment
                    if (get_class($invoiceable) === 'App\Models\Tenant\Appointment') {
                        $appointmentId = $invoiceable->id;
                        $patient = $invoiceable->getPatientData();
                        $patientName = $patient?->full_name ?? 'Unknown Patient';
                        $service = $invoiceable->service->name ?? 'Unknown Service';
                        $description = "{$service} - {$patientName}";
                    }
                }

                return [
                    'id' => (string) $transaction->id,
                    'type' => $type,
                    'amount' => (float) $transaction->amount,
                    'description' => $description,
                    'appointment_id' => $appointmentId ? (string) $appointmentId : null,
                    'patient_name' => $patientName,
                    'service' => $service,
                    'date' => $transaction->created_at->toISOString(),
                    'status' => $transaction->status,
                    'payment_method' => $transaction->payment_method ?? 'N/A',
                    'transaction_type' => $transaction->type,
                    'direction_source' => $transaction->direction_source,
                ];
            });

        // Get wallet statistics using model methods
        $statistics = $wallet->getStatistics();

        $walletData = [
            'balance' => [
                'current' => $wallet->getCurrentBalance(),
                'pending' => $wallet->getPendingBalance(),
                'total_earned' => $wallet->getTotalEarnings(),
            ],
            'transactions' => $transactions,
            'statistics' => $statistics,
        ];

        Log::info('Wallet data prepared', [
            'user_id' => $user->id,
            'balance' => $wallet->getCurrentBalance(),
            'transactions_count' => $transactions->count(),
        ]);

        // Get role-specific data
        $roleSpecificData = [];
        if ($user->hasRole('Practitioner')) {
            $practitioner = Practitioner::where('user_id', $user->id)->first();

            if ($practitioner) {
                $totalBalance = (float) $wallet->balance;
                $pendingInvoices = $this->getPractitionerPendingInvoices($practitioner->id);
                $remainingAmount = array_sum(array_column($pendingInvoices, 'remaining_amount'));
                $generatableAmount = $this->getGeneratableInvoiceAmount($practitioner->id);

                $roleSpecificData = [
                    'total_balance' => $totalBalance,
                    'remaining_amount' => round($remainingAmount, 2),
                    // 'remaining_amount' => round($remainingAmount + $generatableAmount, 2),
                    'generatable_amount' => $generatableAmount,
                    'pending_invoices' => $pendingInvoices,
                ];
            }
        } else {
            // Admin/Tenant view - show clinic financial metrics
            $systemWallet = Wallet::getSystemWallet();
            $totalBalance = (float) $systemWallet->balance;

            // Calculate "To Pay" - sum of unpaid practitioner invoices
            $toPayAmount = Invoices::where('invoiceable_type', 'practitioner')
                ->whereIn('status', ['pending', 'partial'])
                ->get()
                ->sum(function ($invoice) {
                    return $invoice->getRemainingBalance();
                });

            // Calculate "Yet to Receive" - sum of unpaid system invoices
            $yetToReceive = Invoices::where('invoiceable_type', 'system')
                ->where('invoiceable_id', 0)
                ->whereIn('status', ['pending', 'partial'])
                ->get()
                ->sum(function ($invoice) {
                    return $invoice->getRemainingBalance();
                });

            $roleSpecificData = [
                'admin_view' => true,
                'clinic_total_balance' => round($totalBalance, 2),
                'clinic_to_pay' => round($toPayAmount, 2),
                'clinic_yet_to_receive' => round($yetToReceive, 2),
            ];

            Log::info('Admin wallet metrics calculated', [
                'total_balance' => $totalBalance,
                'to_pay' => $toPayAmount,
                'yet_to_receive' => $yetToReceive,
            ]);
        }

        return Inertia::render('Wallet/Index', [
            'wallet' => array_merge($walletData, $roleSpecificData),
        ]);
    }

    /**
     * Get the total amount paid for an appointment invoice
     */
    protected function getAppointmentInvoicePaidAmount(int $appointmentInvoiceId): float
    {
        $transactions = \App\Models\Tenant\Transaction::where('invoice_id', $appointmentInvoiceId)
            ->where('type', 'invoice_payment')
            ->where('status', 'completed')
            ->get();

        return (float) $transactions->sum('amount');
    }

    /**
     * Get the total amount already invoiced to practitioner for an appointment
     * This counts ALL amounts included in practitioner invoices, regardless of payment status
     */
    protected function getAppointmentAlreadyInvoicedAmount(int $appointmentId, int $practitionerId): float
    {
        $practitionerInvoices = Invoices::where('invoiceable_type', 'practitioner')
            ->where('invoiceable_id', $practitionerId)
            ->get();

        $totalInvoiced = 0.0;

        foreach ($practitionerInvoices as $invoice) {
            $meta = $invoice->meta ?? [];
            $appointmentAmounts = $meta['appointment_amounts'] ?? [];

            // Handle both string and integer keys (JSON stores keys as strings)
            $appointmentIdStr = (string) $appointmentId;
            $appointmentIdInt = (int) $appointmentId;

            // Check both string and integer key formats
            $amount = null;
            if (isset($appointmentAmounts[$appointmentIdInt])) {
                $amount = (float) $appointmentAmounts[$appointmentIdInt];
            } elseif (isset($appointmentAmounts[$appointmentIdStr])) {
                $amount = (float) $appointmentAmounts[$appointmentIdStr];
            }

            if ($amount !== null && $amount > 0) {
                $totalInvoiced += $amount;
            }
        }

        return $totalInvoiced;
    }

    /**
     * Get the total amount paid for a practitioner invoice
     */
    protected function getPractitionerInvoicePaidAmount(int $practitionerInvoiceId): float
    {
        $transactions = \App\Models\Tenant\Transaction::where('invoice_id', $practitionerInvoiceId)
            ->where('type', 'invoice_payment')
            ->where('status', 'completed')
            ->get();

        return (float) $transactions->sum('amount');
    }

    /**
     * Get pending invoices for the practitioner
     * Returns array of invoices with invoice_number, remaining_amount, and total_invoiced
     */
    protected function getPractitionerPendingInvoices(int $practitionerId): array
    {
        $practitionerInvoices = Invoices::where('invoiceable_type', 'practitioner')
            ->where('invoiceable_id', $practitionerId)
            ->whereIn('status', ['pending', 'partial'])
            ->orderBy('created_at', 'desc')
            ->get();

        $pendingInvoices = [];

        foreach ($practitionerInvoices as $invoice) {
            $totalInvoiced = (float) $invoice->price;
            $paidAmount = $this->getPractitionerInvoicePaidAmount($invoice->id);
            $remainingAmount = max(0, $totalInvoiced - $paidAmount);

            $pendingInvoices[] = [
                'invoice_id' => $invoice->id,
                'invoice_number' => $invoice->invoice_number,
                'remaining_amount' => $remainingAmount,
                'total_invoiced' => $totalInvoiced,
            ];
        }

        return $pendingInvoices;
    }

    /**
     * Get generatable invoice amount for the practitioner
     * Returns the total amount available for new invoice generation
     */
    protected function getGeneratableInvoiceAmount(int $practitionerId): float
    {
        // Get appointment IDs where practitioner is assigned
        $appointmentIds = DB::table('appointment_practitioner')
            ->where('practitioner_id', $practitionerId)
            ->pluck('appointment_id');

        // Get completed appointments with their invoices
        $appointments = Appointment::whereIn('id', $appointmentIds)
            ->where('status', 'completed')
            ->get();

        $generatableAmount = 0.0;

        foreach ($appointments as $appointment) {
            // Check if invoice exists for this appointment
            $appointmentInvoice = Invoices::where('invoiceable_type', 'system')
                ->where('invoiceable_id', 0)
                ->whereJsonContains('meta->appointment_id', $appointment->id)
                ->first();

            if (! $appointmentInvoice) {
                continue; // Skip if no invoice exists
            }

            $invoicePrice = (float) $appointmentInvoice->price;
            $alreadyInvoiced = $this->getAppointmentAlreadyInvoicedAmount($appointment->id, $practitionerId);
            $availableAmount = max(0, $invoicePrice - $alreadyInvoiced);

            $generatableAmount += $availableAmount;
        }

        return round($generatableAmount, 2);
    }

    /**
     * Get completed appointments for invoice generation
     * Returns appointments with available amounts for creating practitioner invoices
     */
    protected function getPractitionerCompletedAppointments(User $user): array
    {
        $practitioner = Practitioner::where('user_id', $user->id)->first();

        if (! $practitioner) {
            return ['appointments' => [], 'total_sum' => 0, 'total_available' => 0, 'count' => 0];
        }

        // Get appointment IDs where practitioner is assigned
        $appointmentIds = DB::table('appointment_practitioner')
            ->where('practitioner_id', $practitioner->id)
            ->pluck('appointment_id');

        // Get completed appointments with their invoices
        $appointments = Appointment::whereIn('id', $appointmentIds)
            ->where('status', 'completed')
            ->with(['service:id,name'])
            ->orderBy('appointment_datetime', 'desc')
            ->get();

        $completedAppointments = [];
        $totalSum = 0;
        $totalAvailable = 0;

        foreach ($appointments as $appointment) {
            // Check if invoice exists for this appointment
            $appointmentInvoice = Invoices::where('invoiceable_type', 'system')
                ->where('invoiceable_id', 0)
                ->whereJsonContains('meta->appointment_id', $appointment->id)
                ->first();

            if (! $appointmentInvoice) {
                continue; // Skip if no invoice exists
            }

            // Get patient name from encrypted data
            $patient = $appointment->getPatientData();
            $patientName = $patient?->full_name ?? 'Unknown Patient';

            $invoicePrice = (float) $appointmentInvoice->price;
            $alreadyInvoiced = $this->getAppointmentAlreadyInvoicedAmount($appointment->id, $practitioner->id);
            $availableAmount = max(0, $invoicePrice - $alreadyInvoiced);

            // Only include appointments with available amount > 0
            if ($availableAmount <= 0) {
                continue;
            }

            $totalSum += $invoicePrice;
            $totalAvailable += $availableAmount;

            $completedAppointments[] = [
                'id' => $appointment->id,
                'patient_name' => $patientName,
                'service_name' => $appointment->service?->name ?? 'Unknown Service',
                'appointment_date' => $appointment->appointment_datetime->format('Y-m-d'),
                'invoice_price' => $invoicePrice,
                'already_invoiced' => $alreadyInvoiced,
                'available_amount' => $availableAmount,
                'invoice_id' => $appointmentInvoice->id,
                'invoice_number' => $appointmentInvoice->invoice_number,
            ];
        }

        return [
            'appointments' => $completedAppointments,
            'total_sum' => $totalSum,
            'total_available' => $totalAvailable,
            'count' => count($completedAppointments),
        ];
    }

    /**
     * Generate invoice for practitioner's completed appointments
     */
    public function generatePractitionerInvoice(Request $request)
    {
        // Log at the very beginning - before any logic
        Log::info('=== GENERATE PRACTITIONER INVOICE METHOD CALLED ===');
        Log::info('=== METHOD: '.$request->method().' ===');
        Log::info('=== PATH: '.$request->path().' ===');
        Log::info('=== USER: '.(Auth::check() ? Auth::id() : 'NOT AUTHED').' ===');

        Log::info('=== GENERATE PRACTITIONER INVOICE START ===', [
            'timestamp' => now()->toDateTimeString(),
        ]);
        Log::info('Request received', [
            'user_id' => Auth::id(),
            'user_email' => Auth::user()->email ?? 'not authenticated',
            'request_method' => $request->method(),
            'request_path' => $request->path(),
            'request_data' => $request->all(),
            'request_uri' => $request->getRequestUri(),
        ]);

        $user = Auth::user();

        if (! Auth::check()) {
            Log::error('User not authenticated');

            return response()->json(['success' => false, 'message' => 'Not authenticated'], 401);
        }

        if (! $user->hasRole('Practitioner')) {
            Log::warning('Non-practitioner attempted to generate invoice', ['user_id' => $user->id]);

            return response()->json([
                'success' => false,
                'message' => 'Only practitioners can generate invoices.',
            ], 403);
        }

        $practitioner = Practitioner::where('user_id', $user->id)->first();

        if (! $practitioner) {
            Log::error('Practitioner profile not found for user', ['user_id' => $user->id]);

            return response()->json([
                'success' => false,
                'message' => 'Practitioner profile not found.',
            ], 404);
        }

        Log::info('Practitioner found', ['practitioner_id' => $practitioner->id]);

        // Get practitioner's wallet
        $practitionerWallet = Wallet::getOrCreateUserWallet($user->id);
        Log::info('Practitioner wallet retrieved', ['wallet_id' => $practitionerWallet->id]);

        // Get completed appointments with available amounts
        // Note: We removed the check for existing invoices to allow multiple invoices
        $appointmentData = $this->getPractitionerCompletedAppointments($user);
        $availableAppointments = $appointmentData['appointments'] ?? [];

        if (empty($availableAppointments)) {
            Log::warning('No available appointments found for practitioner', ['practitioner_id' => $practitioner->id]);

            return redirect()->route('wallet.index')
                ->with('error', 'No available appointments found for invoicing.');
        }

        // Check for partial invoice generation
        $isPartialInvoice = $request->has('amount');
        $targetAmount = $isPartialInvoice ? (float) $request->input('amount') : null;
        $selectedAppointmentIds = $request->input('selected_appointments', []);

        // Calculate total available amount
        $totalAvailable = array_sum(array_column($availableAppointments, 'available_amount'));

        if ($isPartialInvoice && $targetAmount) {
            // Validate partial amount
            if ($targetAmount <= 0) {
                return redirect()->route('wallet.index')
                    ->with('error', 'Invoice amount must be greater than zero.');
            }

            if ($targetAmount > $totalAvailable) {
                return redirect()->route('wallet.index')
                    ->with('error', 'Invoice amount cannot exceed available amount of $'.number_format($totalAvailable, 2).'.');
            }

            // Filter by selected appointments if provided
            if (! empty($selectedAppointmentIds)) {
                $availableAppointments = array_filter($availableAppointments, function ($apt) use ($selectedAppointmentIds) {
                    return in_array($apt['id'], $selectedAppointmentIds);
                });
            }
        }

        // Collect invoice data (partial or full)
        $collectedAmount = 0;
        $appointmentAmounts = [];
        $lineItems = [];
        $finalAppointmentIds = [];

        foreach ($availableAppointments as $apt) {
            $available = (float) $apt['available_amount'];

            if ($available <= 0) {
                continue;
            }

            if ($isPartialInvoice && $targetAmount) {
                if ($collectedAmount >= $targetAmount) {
                    break;
                }

                $needed = $targetAmount - $collectedAmount;
                $amountToUse = min($available, $needed);
            } else {
                // Full invoice - use all available
                $amountToUse = $available;
            }

            $appointmentAmounts[$apt['id']] = $amountToUse;
            $finalAppointmentIds[] = $apt['id'];

            // Create line item
            $lineItems[] = [
                'desc' => "Professional Services - Appointment with {$apt['patient_name']}",
                'qty' => 1,
                'unit_price' => $amountToUse,
                'tax_rate' => 0,
                'tax_amount' => 0,
                'line_subtotal' => $amountToUse,
                'original_invoice_id' => $apt['invoice_id'],
                'appointment_id' => $apt['id'],
                'amount_invoiced' => $amountToUse,
            ];

            $collectedAmount += $amountToUse;
        }

        if ($collectedAmount <= 0) {
            Log::warning('No amount collected for invoice', [
                'practitioner_id' => $practitioner->id,
                'is_partial' => $isPartialInvoice,
                'target_amount' => $targetAmount,
            ]);

            return redirect()->route('wallet.index')
                ->with('error', 'No amount available for invoicing.');
        }

        // Create practitioner invoice
        Log::info('Creating practitioner invoice', [
            'practitioner_id' => $practitioner->id,
            'invoiceable_type' => 'practitioner',
            'invoiceable_id' => $practitioner->id,
            'is_partial' => $isPartialInvoice,
            'amount' => $collectedAmount,
            'appointment_count' => count($finalAppointmentIds),
        ]);

        $invoice = Invoices::create([
            'invoiceable_type' => 'practitioner',
            'invoiceable_id' => $practitioner->id,
            'reference_type' => null,
            'reference_id' => null,
            'customer_wallet_id' => $practitionerWallet->id,
            'subtotal' => $collectedAmount,
            'tax_total' => 0.00,
            'price' => $collectedAmount,
            'status' => 'pending',
            'meta' => [
                'appointments' => $finalAppointmentIds,
                'lines' => $lineItems,
                'appointment_amounts' => $appointmentAmounts,
            ],
        ]);

        Log::info('Practitioner invoice created successfully', [
            'practitioner_id' => $practitioner->id,
            'invoice_id' => $invoice->id,
            'invoice_number' => $invoice->invoice_number,
            'amount' => $collectedAmount,
            'is_partial' => $isPartialInvoice,
        ]);

        // Send email notifications
        $this->sendPractitionerInvoiceEmails($invoice, $user);

        Log::info('=== GENERATE PRACTITIONER INVOICE END ===');

        $message = $isPartialInvoice
            ? "Partial invoice generated successfully! Invoice Number: {$invoice->invoice_number}, Amount: $".number_format($collectedAmount, 2)
            : "Invoice generated successfully! Invoice Number: {$invoice->invoice_number}";

        return redirect()->route('wallet.index')
            ->with('success', $message);
    }

    /**
     * Send email notifications for practitioner invoice generation
     */
    protected function sendPractitionerInvoiceEmails(Invoices $invoice, User $practitionerUser): void
    {
        try {
            // Get practitioner details
            $practitioner = Practitioner::where('user_id', $practitionerUser->id)->first();
            $practitionerEmail = $practitioner->email ?? $practitionerUser->email;
            $practitionerName = trim(($practitioner->first_name ?? '').' '.($practitioner->last_name ?? ''));

            // Get tenant/clinic email from organization settings
            $tenantEmail = \App\Models\OrganizationSetting::getValue('practice_details_contact_email', '');

            if (empty($tenantEmail)) {
                // Fallback to admin emails
                $adminEmails = \App\Models\User::role('Admin')
                    ->whereNotNull('email')
                    ->pluck('email')
                    ->filter()
                    ->values()
                    ->all();

                $tenantEmail = ! empty($adminEmails) ? $adminEmails[0] : null;
            }

            // Get organization data
            $organizationData = [
                'name' => \App\Models\OrganizationSetting::getValue('practice_details_name', 'Practice'),
                'email' => $tenantEmail ?? '',
                'phone' => \App\Models\OrganizationSetting::getValue('practice_details_phone_number', ''),
                'currency' => \App\Models\OrganizationSetting::getValue('accounting_currency', 'CAD'),
            ];

            // Prepare invoice data
            $invoiceData = [
                'lines' => $invoice->meta['lines'] ?? [],
            ];

            // Send to tenant/clinic
            if ($tenantEmail) {
                \Mail::to($tenantEmail)->send(
                    new \App\Mail\PractitionerInvoiceNotificationMail(
                        $invoice,
                        $invoiceData,
                        [
                            'name' => $organizationData['name'],
                            'email' => $tenantEmail,
                        ],
                        $organizationData,
                        'tenant'
                    )
                );

                Log::info('Practitioner invoice email sent to tenant', [
                    'invoice_id' => $invoice->id,
                    'tenant_email' => $tenantEmail,
                ]);
            }

            // Send to practitioner
            if ($practitionerEmail) {
                \Mail::to($practitionerEmail)->send(
                    new \App\Mail\PractitionerInvoiceNotificationMail(
                        $invoice,
                        $invoiceData,
                        [
                            'name' => $practitionerName,
                            'email' => $practitionerEmail,
                        ],
                        $organizationData,
                        'practitioner'
                    )
                );

                Log::info('Practitioner invoice confirmation email sent', [
                    'invoice_id' => $invoice->id,
                    'practitioner_email' => $practitionerEmail,
                ]);
            }
        } catch (\Exception $e) {
            Log::error('Failed to send practitioner invoice emails', [
                'invoice_id' => $invoice->id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            // Don't fail invoice creation if email fails
        }
    }
}
