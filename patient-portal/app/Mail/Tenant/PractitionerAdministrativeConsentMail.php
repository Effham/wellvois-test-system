<?php

namespace App\Mail\Tenant;

use App\Models\Practitioner;
use App\Models\Tenant;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class PractitionerAdministrativeConsentMail extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    public function __construct(
        public Practitioner $practitioner,
        public Tenant $tenant,
        public string $consentUrl
    ) {
        Log::info('PractitionerAdministrativeConsentMail created', [
            'practitioner_id' => $practitioner->id,
            'practitioner_email' => $practitioner->email,
            'tenant_id' => $tenant->id,
            'tenant_name' => $tenant->company_name,
            'consent_url' => $consentUrl,
        ]);
    }

    public function envelope(): Envelope
    {
        Log::info('PractitionerAdministrativeConsentMail envelope method called', [
            'practitioner_email' => $this->practitioner->email,
            'tenant_name' => $this->tenant->company_name,
        ]);

        return new Envelope(
            subject: 'Administrative Access Consent Required - '.$this->tenant->company_name,
        );
    }

    public function content(): Content
    {
        Log::info('PractitionerAdministrativeConsentMail content method called', [
            'practitioner_email' => $this->practitioner->email,
            'consent_url' => $this->consentUrl,
        ]);

        return new Content(
            view: 'emails.practitioner_administrative_consent',
            with: [
                'practitioner' => $this->practitioner,
                'tenant' => $this->tenant,
                'consentUrl' => $this->consentUrl,
            ]
        );
    }

    public function failed(\Throwable $exception): void
    {
        Log::error('PractitionerAdministrativeConsentMail failed to send', [
            'practitioner_id' => $this->practitioner->id,
            'practitioner_email' => $this->practitioner->email,
            'tenant_id' => $this->tenant->id,
            'error' => $exception->getMessage(),
            'trace' => $exception->getTraceAsString(),
        ]);
    }
}
