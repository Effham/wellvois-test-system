<?php

namespace App\Services;

use App\Models\OrganizationSetting;
use App\Models\Tenant\Appointment;
use App\Models\Tenant\Invoices;
use App\Models\Tenant\Service;
use App\Models\Tenant\Wallet;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class InvoiceGenerationService
{
    /**
     * Generate invoice for an appointment
     * Handles tax calculations, practitioner custom pricing, and patient wallet assignment
     */
    public function generateInvoiceForAppointment(Appointment $appointment): ?Invoices
    {
        try {
            // Check if invoice already exists for this appointment
            // Look for invoices with appointment_id stored in meta field
            $existingInvoice = Invoices::where('invoiceable_type', 'system')
                ->where('invoiceable_id', 0)
                ->whereJsonContains('meta->appointment_id', $appointment->id)
                ->first();

            if ($existingInvoice) {
                Log::info('Invoice already exists for appointment', [
                    'appointment_id' => $appointment->id,
                    'invoice_id' => $existingInvoice->id,
                ]);

                return $existingInvoice;
            }

            // Get patient wallet
            $patientWallet = Wallet::getOrCreatePatientWallet($appointment->patient_id);

            // Get service
            $service = $appointment->service;
            if (! $service) {
                Log::warning('Cannot create invoice: appointment has no service', [
                    'appointment_id' => $appointment->id,
                ]);

                return null;
            }

            // Get primary practitioner and their custom price
            $practitionerDetails = $this->getPrimaryPractitionerDetails($appointment);
            $practitionerName = $practitionerDetails['name'] ?? 'Practitioner';
            $customPrice = $practitionerDetails['custom_price'] ?? null;

            // Get base price (custom price or service default price)
            $basePrice = $customPrice ?? (float) $service->default_price;

            // Get tax settings from organization
            $taxSettings = $this->getTaxSettings();
            $taxEnabled = $taxSettings['enabled'];
            $taxRate = $taxSettings['rate'];
            $taxName = $taxSettings['name'];

            // Calculate subtotal
            $subtotal = round($basePrice, 4);

            // Calculate tax if enabled
            $taxAmount = $taxEnabled ? round($subtotal * ($taxRate / 100), 4) : 0.00;

            // Calculate total
            $totalPrice = round($subtotal + $taxAmount, 4);

            // Create invoice with meta lines
            $invoice = Invoices::create([
                'invoiceable_type' => 'system',
                'invoiceable_id' => 0,
                'reference_type' => \App\Models\Tenant\Appointment::class,
                'reference_id' => $appointment->id,
                'customer_wallet_id' => $patientWallet->id,
                'subtotal' => $subtotal,
                'tax_total' => $taxAmount,
                'price' => $totalPrice,
                'status' => 'pending',
                'meta' => [
                    'appointment_id' => $appointment->id,
                    'lines' => [
                        [
                            'desc' => "Appointment with {$practitionerName}",
                            'qty' => 1,
                            'unit_price' => $basePrice,
                            'tax_rate' => $taxEnabled ? $taxRate : 0,
                            'tax_amount' => $taxAmount,
                            'line_subtotal' => $basePrice,
                        ],
                    ],
                ],
            ]);

            Log::info('Invoice created for appointment', [
                'appointment_id' => $appointment->id,
                'invoice_id' => $invoice->id,
                'subtotal' => $subtotal,
                'tax_amount' => $taxAmount,
                'total' => $totalPrice,
                'custom_price_used' => $customPrice !== null,
            ]);

            // Send email notifications
            $this->sendAppointmentInvoiceEmails($invoice, $appointment);

            return $invoice;
        } catch (\Exception $e) {
            Log::error('Failed to create invoice for appointment', [
                'appointment_id' => $appointment->id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return null;
        }
    }

    /**
     * Get primary practitioner details (name and custom price)
     */
    protected function getPrimaryPractitionerDetails(Appointment $appointment): array
    {
        $primaryPractitioner = DB::table('appointment_practitioner')
            ->where('appointment_id', $appointment->id)
            ->where('is_primary', true)
            ->first();

        if (! $primaryPractitioner) {
            Log::warning('No primary practitioner found for appointment', [
                'appointment_id' => $appointment->id,
            ]);

            return ['name' => 'Practitioner', 'custom_price' => null];
        }

        $practitionerId = $primaryPractitioner->practitioner_id;

        // Get practitioner from central database
        $practitioner = tenancy()->central(function () use ($practitionerId) {
            return \App\Models\Practitioner::find($practitionerId);
        });

        $practitionerName = 'Practitioner';
        if ($practitioner) {
            $practitionerName = trim($practitioner->first_name.' '.$practitioner->last_name);
        }

        // Get custom price for this practitioner and service
        $customPrice = $this->getPractitionerServicePrice($practitionerId, $appointment->service_id);

        return [
            'name' => $practitionerName,
            'custom_price' => $customPrice > 0 ? $customPrice : null,
        ];
    }

    /**
     * Get practitioner's price for a service
     * Check custom_price first, then fallback to service default_price
     */
    protected function getPractitionerServicePrice(int $practitionerId, int $serviceId): float
    {
        // First check if practitioner has custom price for this service
        $practitionerService = DB::table('practitioner_services')
            ->where('practitioner_id', $practitionerId)
            ->where('service_id', $serviceId)
            ->where('is_offered', true)
            ->first();

        if ($practitionerService && $practitionerService->custom_price !== null) {
            return (float) $practitionerService->custom_price;
        }

        // Fallback to service default price
        $service = DB::table('services')->where('id', $serviceId)->first();

        return $service ? (float) $service->default_price : 0.00;
    }

    /**
     * Get tax settings from organization
     */
    protected function getTaxSettings(): array
    {
        $taxEnabled = OrganizationSetting::getValue('accounting_tax_enabled') === '1';
        $taxRate = $taxEnabled ? (float) OrganizationSetting::getValue('accounting_tax_rate', '0.00') : 0.00;
        $taxName = OrganizationSetting::getValue('accounting_tax_name', 'Tax');

        return [
            'enabled' => $taxEnabled,
            'rate' => $taxRate,
            'name' => $taxName,
        ];
    }

    /**
     * Send email notifications when appointment invoice is created
     */
    protected function sendAppointmentInvoiceEmails(Invoices $invoice, Appointment $appointment): void
    {
        try {
            // Get patient data
            $patient = $appointment->getPatientData();
            $patientEmail = $patient?->email ?? null;
            $patientName = $patient ? ($patient->preferred_name ?: trim(($patient->first_name ?? '').' '.($patient->last_name ?? ''))) : 'Patient';

            // Get organization data
            $organizationData = [
                'name' => OrganizationSetting::getValue('practice_details_name', 'Practice'),
                'email' => OrganizationSetting::getValue('practice_details_contact_email', ''),
                'phone' => OrganizationSetting::getValue('practice_details_phone_number', ''),
                'currency' => OrganizationSetting::getValue('accounting_currency', 'CAD'),
            ];

            // Get tenant email
            $tenantEmail = OrganizationSetting::getValue('practice_details_contact_email', '');

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

            // Prepare invoice data
            $invoiceData = [
                'lines' => $invoice->meta['lines'] ?? [],
            ];

            // Prepare customer/patient data
            $customerData = [
                'name' => $patientName,
                'email' => $patientEmail ?? '',
                'type' => 'patient',
            ];

            // Prepare patient data for tenant notification
            $patientData = [
                'name' => $patientName,
                'email' => $patientEmail ?? '',
            ];

            // Send invoice email to patient
            if ($patientEmail) {
                \Mail::to($patientEmail)->send(
                    new \App\Mail\InvoiceEmail(
                        $invoice,
                        $invoiceData,
                        $customerData,
                        $organizationData
                    )
                );

                Log::info('Appointment invoice email sent to patient', [
                    'invoice_id' => $invoice->id,
                    'patient_email' => $patientEmail,
                ]);
            }

            // Send notification email to tenant
            if ($tenantEmail) {
                \Mail::to($tenantEmail)->send(
                    new \App\Mail\AppointmentInvoiceNotificationMail(
                        $invoice,
                        $invoiceData,
                        $patientData,
                        $organizationData
                    )
                );

                Log::info('Appointment invoice notification sent to tenant', [
                    'invoice_id' => $invoice->id,
                    'tenant_email' => $tenantEmail,
                ]);
            }
        } catch (\Exception $e) {
            Log::error('Failed to send appointment invoice emails', [
                'invoice_id' => $invoice->id,
                'appointment_id' => $appointment->id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            // Don't fail invoice creation if email fails
        }
    }
}
