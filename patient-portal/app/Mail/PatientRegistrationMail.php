<?php

namespace App\Mail;

use App\Models\Tenant;
use App\Models\Tenant\Patient;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class PatientRegistrationMail extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    public $patient;

    public $tenant;

    public $clinicName;

    public $tenantTheme;

    /**
     * Create a new message instance.
     */
    public function __construct(Patient $patient, ?Tenant $tenant = null)
    {
        $this->patient = $patient;
        $this->tenant = $tenant ?? tenant();
        $this->clinicName = $this->tenant->company_name ?? 'Our Practice';

        // Pull theme color if you support multi-tenant appearance
        $this->tenantTheme = \App\Models\OrganizationSetting::getValue('appearance_theme_color') ?? '#0d6efd';
    }

    /**
     * Get the message envelope.
     */
    public function envelope(): Envelope
    {
        return new Envelope(
            subject: '📋 Information Recorded - '.$this->clinicName,
        );
    }

    /**
     * Get the message content definition.
     */
    public function content(): Content
    {
        return new Content(
            view: 'emails.patient-registration',
            with: [
                'patient' => $this->patient,
                'clinicName' => $this->clinicName,
                'patientName' => $this->patient->preferred_name ?: $this->patient->first_name,
                'fullName' => $this->patient->first_name.' '.$this->patient->last_name,
                'tenantTheme' => $this->tenantTheme,
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
