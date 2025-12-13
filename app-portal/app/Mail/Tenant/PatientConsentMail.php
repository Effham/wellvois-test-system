<?php

namespace App\Mail\Tenant;

use App\Models\Tenant;
use App\Models\Tenant\Patient;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class PatientConsentMail extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    public function __construct(
        public Patient $patient,
        public Tenant $tenant,
        public string $consentUrl
    ) {
        Log::info('PatientConsentMail created', [
            'patient_id' => $patient->id,
            'patient_email' => $patient->email,
            'tenant_id' => $tenant->id,
            'tenant_name' => $tenant->company_name,
            'consent_url' => $consentUrl,
        ]);
    }

    public function envelope(): Envelope
    {
        Log::info('PatientConsentMail envelope method called', [
            'patient_email' => $this->patient->email,
            'tenant_name' => $this->tenant->company_name,
        ]);

        return new Envelope(
            subject: 'Consent Required - '.$this->tenant->company_name,
        );
    }

    public function content(): Content
    {
        Log::info('PatientConsentMail content method called', [
            'patient_email' => $this->patient->email,
            'consent_url' => $this->consentUrl,
        ]);

        return new Content(
            view: 'emails.patient_consent',
            with: [
                'patient' => $this->patient,
                'tenant' => $this->tenant,
                'consentUrl' => $this->consentUrl,
            ]
        );
    }

    public function failed(\Throwable $exception): void
    {
        Log::error('PatientConsentMail failed to send', [
            'patient_id' => $this->patient->id,
            'patient_email' => $this->patient->email,
            'tenant_id' => $this->tenant->id,
            'error' => $exception->getMessage(),
            'trace' => $exception->getTraceAsString(),
        ]);
    }
}
