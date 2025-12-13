<?php

namespace App\Mail\Tenant;

use App\Models\PractitionerInvitation;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

class PractitionerInvitationMail extends Mailable
{
    public PractitionerInvitation $invitation;

    public string $invitationUrl;

    public string $tenantName;

    public string $tenantTheme;

    /**
     * Create a new message instance.
     */
    public function __construct(PractitionerInvitation $invitation)
    {
        $this->invitation = $invitation;

        // Unset practitioner relationship if null to avoid issues
        if (is_null($invitation->practitioner_id)) {
            unset($invitation->practitioner);
        }

        $this->tenantName = $invitation->tenant->company_name ?? $invitation->tenant->id;

        // Create the invitation URL
        $this->invitationUrl = route('practitioner.invitation.accept', [
            'token' => $invitation->token,
        ]);

        // Pull theme color from organization settings
        $this->tenantTheme = \App\Models\OrganizationSetting::getValue('appearance_theme_color') ?? '#0d6efd';
    }

    /**
     * Get the message envelope.
     */
    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Invitation to join '.$this->tenantName.' as a Practitioner',
        );
    }

    /**
     * Get the message content definition.
     */
    public function content(): Content
    {
        // Load practitioner only if practitioner_id exists
        $practitioner = $this->invitation->practitioner_id
            ? $this->invitation->practitioner
            : null;

        return new Content(
            html: 'emails.practitioner_invitation',
            with: [
                'invitation' => $this->invitation,
                'practitioner' => $practitioner,
                'tenantName' => $this->tenantName,
                'invitationUrl' => $this->invitationUrl,
                'expiresAt' => $this->invitation->expires_at,
                'tenantTheme' => $this->tenantTheme,
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
}
