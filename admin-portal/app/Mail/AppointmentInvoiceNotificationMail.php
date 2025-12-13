<?php

namespace App\Mail;

use App\Models\Tenant\Invoices;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Address;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class AppointmentInvoiceNotificationMail extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    public function __construct(
        public Invoices $invoice,
        public array $invoiceData,
        public array $patientData,
        public array $organizationData
    ) {}

    public function envelope(): Envelope
    {
        $practiceName = $this->organizationData['name'] ?? 'Practice';
        $invoiceNumber = $this->invoice->invoice_number ?? "#{$this->invoice->id}";

        return new Envelope(
            from: new Address(
                config('mail.from.address'),
                $practiceName
            ),
            subject: "Appointment Invoice {$invoiceNumber} Created and Sent to Patient - {$practiceName}",
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.appointment-invoice-created',
            with: [
                'invoice' => $this->invoice,
                'invoiceData' => $this->invoiceData,
                'patient' => $this->patientData,
                'organization' => $this->organizationData,
            ],
        );
    }

    public function attachments(): array
    {
        return [];
    }
}
