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

class InvoiceEmail extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    /**
     * Create a new message instance.
     */
    public function __construct(
        public Invoices $invoice,
        public array $invoiceData,
        public array $customerData,
        public array $organizationData
    ) {}

    /**
     * Get the message envelope.
     */
    public function envelope(): Envelope
    {
        $practiceName = $this->organizationData['name'] ?? 'Practice';
        $invoiceNumber = $this->invoice->invoice_number ?? "#{$this->invoice->id}";

        return new Envelope(
            from: new Address(
                config('mail.from.address'),
                $practiceName
            ),
            subject: "Invoice {$invoiceNumber} from {$practiceName}",
        );
    }

    /**
     * Get the message content definition.
     */
    public function content(): Content
    {
        return new Content(
            view: 'emails.invoice',
            with: [
                'invoice' => $this->invoice,
                'invoiceData' => $this->invoiceData,
                'customer' => $this->customerData,
                'organization' => $this->organizationData,
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
