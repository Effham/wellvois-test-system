<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class BatchConsentNotificationMail extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    public string $tenantTheme;

    public string $tenantFont;

    public ?string $tenantLogo;

    /**
     * Create a new message instance.
     */
    public function __construct(
        public Collection $consents,
        public $entity,
        public string $consentUrl,
        public string $triggerEvent
    ) {
        // Get tenant theme settings BEFORE queuing (while tenant context is available)
        $this->tenantTheme = \App\Models\OrganizationSetting::getValue('appearance_primary_color') ?? '#2563eb';
        $this->tenantFont = \App\Models\OrganizationSetting::getValue('appearance_font_family') ?? 'Arial, sans-serif';

        // Get logo S3 key and generate proxy URL
        $logoS3Key = \App\Models\OrganizationSetting::getValue('appearance_logo_s3_key');
        if (! empty($logoS3Key)) {
            $tenantId = tenant('id');
            $cacheBuster = substr(md5($logoS3Key), 0, 8);
            $this->tenantLogo = url("/logo-proxy/{$tenantId}?v={$cacheBuster}");
        } else {
            $this->tenantLogo = null;
        }
    }

    /**
     * Get the message envelope.
     */
    public function envelope(): Envelope
    {
        $requiredCount = $this->consents->where('is_required', true)->count();
        $totalCount = $this->consents->count();

        $subject = $requiredCount > 0
            ? "Action Required: {$requiredCount} Required Consent".($requiredCount > 1 ? 's' : '')
            : "New Consents Available ({$totalCount})";

        return new Envelope(
            subject: $subject,
        );
    }

    /**
     * Get the message content definition.
     */
    public function content(): Content
    {
        return new Content(
            view: 'emails.batch-consent-notification',
            with: [
                'consents' => $this->consents,
                'entity' => $this->entity,
                'consentUrl' => $this->consentUrl,
                'triggerEvent' => $this->triggerEvent,
                'tenant' => tenant(),
                'tenantTheme' => $this->tenantTheme,
                'tenantFont' => $this->tenantFont,
                'tenantLogo' => $this->tenantLogo,
            ],
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
}
