<?php

namespace App\Mail;

use App\Models\Tenant;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class TenantWelcomeMail extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    public $tenant;

    public $adminName;

    public $adminEmail;

    public $loginUrl;

    public $tempPassword;

    /**
     * Create a new message instance.
     */
    public function __construct(Tenant $tenant, string $adminName, string $adminEmail, ?string $tempPassword = null)
    {
        $this->tenant = $tenant;
        $this->adminName = $adminName;
        $this->adminEmail = $adminEmail;
        $this->tempPassword = $tempPassword;

        // Get the tenant's domain for login URL
        $domain = $tenant->domains()->first();
        $this->loginUrl = $domain ? 'https://'.$domain->domain.'/login' : config('app.url').'/login';
    }

    /**
     * Get the message envelope.
     */
    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Welcome to Wellovis - Your Clinic Management System is Ready!',
        );
    }

    /**
     * Get the message content definition.
     */
    public function content(): Content
    {
        return new Content(
            view: 'emails.tenant-welcome',
            with: [
                'tenant' => $this->tenant,
                'adminName' => $this->adminName,
                'adminEmail' => $this->adminEmail,
                'loginUrl' => $this->loginUrl,
                'companyName' => $this->tenant->company_name,
                'tempPassword' => $this->tempPassword,
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
