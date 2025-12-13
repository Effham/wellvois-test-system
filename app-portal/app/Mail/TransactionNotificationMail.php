<?php

namespace App\Mail;

use App\Models\Tenant\Invoices;
use App\Models\Tenant\Transaction;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Address;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class TransactionNotificationMail extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    public function __construct(
        public Invoices $invoice,
        public Transaction $transaction,
        public array $recipientData, // ['name' => ..., 'email' => ...]
        public array $organizationData,
        public string $invoiceType // 'appointment' or 'practitioner'
    ) {}

    public function envelope(): Envelope
    {
        $practiceName = $this->organizationData['name'] ?? 'Practice';
        $invoiceNumber = $this->invoice->invoice_number ?? "#{$this->invoice->id}";

        if ($this->invoiceType === 'appointment') {
            $subject = "Payment Received - Invoice {$invoiceNumber} - {$practiceName}";
        } else {
            $subject = "Payment Received - Invoice {$invoiceNumber} - {$practiceName}";
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
            view: 'emails.transaction-notification',
            with: [
                'invoice' => $this->invoice,
                'transaction' => $this->transaction,
                'recipient' => $this->recipientData,
                'organization' => $this->organizationData,
                'invoiceType' => $this->invoiceType,
            ],
        );
    }

    public function attachments(): array
    {
        return [];
    }
}
