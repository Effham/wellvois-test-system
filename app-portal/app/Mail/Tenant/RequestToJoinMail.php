<?php

namespace App\Mail\Tenant;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class RequestToJoinMail extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    public string $patientEmail;

    public string $patientName;

    public string $healthCardNumber;

    public string $tenantName;

    public string $tenantEmail;

    /**
     * Create a new message instance.
     */
    public function __construct(
        string $patientEmail,
        string $patientName,
        string $healthCardNumber,
        string $tenantName,
        string $tenantEmail
    ) {
        $this->patientEmail = $patientEmail;
        $this->patientName = $patientName;
        $this->healthCardNumber = $healthCardNumber;
        $this->tenantName = $tenantName;
        $this->tenantEmail = $tenantEmail;
    }

    /**
     * Get the message envelope.
     */
    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Patient Registration Request for '.$this->tenantName,
            to: $this->tenantEmail,
        );
    }

    /**
     * Get the message content definition.
     */
    public function content(): Content
    {
        return new Content(
            html: 'emails.request_to_join',
            with: [
                'patientEmail' => $this->patientEmail,
                'patientName' => $this->patientName,
                'healthCardNumber' => $this->healthCardNumber,
                'tenantName' => $this->tenantName,
                'requestDate' => now()->format('F j, Y \a\t g:i A'),
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
