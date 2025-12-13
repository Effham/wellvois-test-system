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

class SessionRecordingConsentMail extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    public function __construct(
        public Patient $patient,
        public Tenant $tenant,
        public string $consentUrl,
        public string $appointmentId
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Session Recording Consent Required - '.$this->tenant->company_name,
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.session_recording_consent',
            with: [
                'patient' => $this->patient,
                'tenant' => $this->tenant,
                'consentUrl' => $this->consentUrl,
                'appointmentId' => $this->appointmentId,
            ]
        );
    }
}
