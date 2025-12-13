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

class PractitionerInvoiceNotificationMail extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    public function __construct(
        public Invoices $invoice,
        public array $invoiceData,
        public array $recipientData, // ['name' => ..., 'email' => ...]
        public array $organizationData,
        public string $recipientType // 'tenant' or 'practitioner'
    ) {}

    public function envelope(): Envelope
    {
        $practiceName = $this->organizationData['name'] ?? 'Practice';
        $invoiceNumber = $this->invoice->invoice_number ?? "#{$this->invoice->id}";

        if ($this->recipientType === 'tenant') {
            $subject = "New Practitioner Invoice {$invoiceNumber} - {$practiceName}";
        } else {
            $subject = "Invoice Generated Successfully - Invoice {$invoiceNumber}";
        }

        return new Envelope(
            from: new Address(
                config('mail.from.address'),
                $practiceName
            ),
            subject: $subject,
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.practitioner-invoice',
            with: [
                'invoice' => $this->invoice,
                'invoiceData' => $this->invoiceData,
                'recipient' => $this->recipientData,
                'organization' => $this->organizationData,
                'recipientType' => $this->recipientType,
            ],
        );
    }

    public function attachments(): array
    {
        return [];
    }
}
