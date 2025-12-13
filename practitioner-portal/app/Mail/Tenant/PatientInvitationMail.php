<?php

namespace App\Mail\Tenant;

use App\Models\Tenant\PatientInvitation;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

class PatientInvitationMail extends Mailable
{
    public PatientInvitation $invitation;

    public string $invitationUrl;

    public string $tenantName;

    public string $tenantTheme;

    /**
     * Create a new message instance.
     */
    public function __construct(PatientInvitation $invitation)
    {
        $this->invitation = $invitation;

        // Get tenant information from current tenant context
        $tenant = tenant();
        $this->tenantName = $tenant->company_name ?? $tenant->id;

        // Create the invitation URL
        $this->invitationUrl = route('patient.invitation.accept', [
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
            subject: 'Invitation to join '.$this->tenantName.' as a Patient',
        );
    }

    /**
     * Get the message content definition.
     */
    public function content(): Content
    {
        return new Content(
            html: 'emails.patient_invitation',
            with: [
                'invitation' => $this->invitation,
                'patient' => $this->invitation->patient,
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
