<?php

namespace App\Mail\Tenant;

use App\Models\Practitioner;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class PractitionerConsentAcceptedMail extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    public function __construct(
        public Practitioner $practitioner,
        public string $consentType,
        public string $consentedAt,
        public string $ipAddress,
        public string $tenantName
    ) {
        \Log::info('PractitionerConsentAcceptedMail created', [
            'practitioner_id' => $practitioner->id,
            'practitioner_name' => $practitioner->first_name.' '.$practitioner->last_name,
            'practitioner_email' => $practitioner->email,
            'consent_type' => $consentType,
            'consented_at' => $consentedAt,
            'ip_address' => $ipAddress,
            'tenant_name' => $tenantName,
        ]);
    }

    /**
     * Get the message envelope.
     */
    public function envelope(): Envelope
    {
        $subject = 'Practitioner Consent Accepted - '.$this->practitioner->first_name.' '.$this->practitioner->last_name;

        \Log::info('PractitionerConsentAcceptedMail envelope created', [
            'subject' => $subject,
            'practitioner_name' => $this->practitioner->first_name.' '.$this->practitioner->last_name,
        ]);

        return new Envelope(
            subject: $subject,
        );
    }

    /**
     * Get the message content definition.
     */
    public function content(): Content
    {
        $tenantTheme = \App\Models\OrganizationSetting::getValue('appearance_theme_color') ?? '#0d6efd';

        \Log::info('PractitionerConsentAcceptedMail content created', [
            'template' => 'emails.practitioner_consent_accepted',
            'tenant_theme' => $tenantTheme,
            'data_keys' => ['practitioner', 'consentType', 'consentedAt', 'ipAddress', 'tenantName', 'tenantTheme'],
        ]);

        return new Content(
            html: 'emails.practitioner_consent_accepted',
            with: [
                'practitioner' => $this->practitioner,
                'consentType' => $this->consentType,
                'consentedAt' => $this->consentedAt,
                'ipAddress' => $this->ipAddress,
                'tenantName' => $this->tenantName,
                'tenantTheme' => $tenantTheme,
            ]
        );
    }

    /**
     * Get the attachments for the message.
     *
     * @return array<int, \Illuminate\Mail\Mailables\Attachment>
     */
    public function attachments(): array
    {
        return [];
    }

    /**
     * Handle the job failure.
     */
    public function failed(\Throwable $exception): void
    {
        \Log::error('PractitionerConsentAcceptedMail failed to send', [
            'practitioner_id' => $this->practitioner->id,
            'practitioner_name' => $this->practitioner->first_name.' '.$this->practitioner->last_name,
            'error' => $exception->getMessage(),
            'trace' => $exception->getTraceAsString(),
        ]);
    }
}
