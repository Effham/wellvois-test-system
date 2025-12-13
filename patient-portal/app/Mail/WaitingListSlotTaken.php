<?php

namespace App\Mail;

use App\Models\AppointmentWaitlist;
use App\Models\Tenant\Patient;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class WaitingListSlotTaken extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    public $patient;

    public $waitingListEntry;

    /**
     * Create a new message instance.
     */
    public function __construct(
        Patient $patient,
        AppointmentWaitlist $waitingListEntry
    ) {
        $this->patient = $patient;
        $this->waitingListEntry = $waitingListEntry;
    }

    /**
     * Get the message envelope.
     */
    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Appointment Slot No Longer Available',
        );
    }

    /**
     * Get the message content definition.
     */
    public function content(): Content
    {
        return new Content(
            view: 'emails.waiting-list-slot-taken',
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
