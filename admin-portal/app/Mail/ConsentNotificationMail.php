<?php

namespace App\Mail;

use App\Models\Tenant\Consent;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class ConsentNotificationMail extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    public string $tenantTheme;

    public string $tenantFont;

    /**
     * Create a new message instance.
     */
    public function __construct(
        public Consent $consent,
        public $entity,
        public string $consentUrl
    ) {
        // Get tenant theme settings BEFORE queuing (while tenant context is available)
        $this->tenantTheme = \App\Models\OrganizationSetting::getValue('appearance_theme_color') ?? '#2563eb';
        $this->tenantFont = \App\Models\OrganizationSetting::getValue('appearance_font_family') ?? 'Arial, sans-serif';
    }

    /**
     * Get the message envelope.
     */
    public function envelope(): Envelope
    {
        return new Envelope(
            subject: $this->consent->is_required
                ? 'Required Consent: '.$this->consent->title
                : 'New Consent Available: '.$this->consent->title,
        );
    }

    /**
     * Get the message content definition.
     */
    public function content(): Content
    {
        return new Content(
            view: 'emails.consent-notification',
            with: [
                'consent' => $this->consent,
                'entity' => $this->entity,
                'consentUrl' => $this->consentUrl,
                'tenant' => tenant(),
                'tenantTheme' => $this->tenantTheme,
                'tenantFont' => $this->tenantFont,
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
