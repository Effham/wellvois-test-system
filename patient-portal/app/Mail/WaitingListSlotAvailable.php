<?php

namespace App\Mail;

use App\Models\AppointmentWaitlist;
use App\Models\Tenant\Appointment;
use App\Models\Tenant\Patient;
use Carbon\Carbon;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class WaitingListSlotAvailable extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    public $patient;

    public $waitingListEntry;

    public $appointmentDate;

    public $cancelledAppointment;

    public $acceptanceToken;

    public $acceptanceUrl;

    public $expiresAt;

    /**
     * Create a new message instance.
     */
    public function __construct(
        Patient $patient,
        AppointmentWaitlist $waitingListEntry,
        Carbon $appointmentDate,
        Appointment $cancelledAppointment,
        string $acceptanceToken
    ) {
        $this->patient = $patient;
        $this->waitingListEntry = $waitingListEntry;
        $this->appointmentDate = $appointmentDate;
        $this->cancelledAppointment = $cancelledAppointment;
        $this->acceptanceToken = $acceptanceToken;
        $this->expiresAt = now()->addHours(24);

        // Generate acceptance URL
        $tenant = tenant();
        $tenantDomain = $tenant->domains()->first()?->domain ?? 'localhost';

        // Use http for local development, https for production
        $scheme = app()->environment('local') ? 'http' : 'https';
        $port = app()->environment('local') ? ':8000' : '';

        $this->acceptanceUrl = "{$scheme}://{$tenantDomain}{$port}/waiting-list/accept/{$acceptanceToken}";
    }

    /**
     * Get the message envelope.
     */
    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Appointment Slot Available - Action Required',
        );
    }

    /**
     * Get the message content definition.
     */
    public function content(): Content
    {
        return new Content(
            view: 'emails.waiting-list-slot-available',
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
