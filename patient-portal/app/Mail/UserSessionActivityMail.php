<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class UserSessionActivityMail extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    public $user;

    public $activityType; // 'login' or 'logout'

    public $activityTime;

    /**
     * Create a new message instance.
     */
    public function __construct($user, string $activityType, $activityTime)
    {
        $this->user = $user;
        $this->activityType = $activityType;
        $this->activityTime = $activityTime;

        // Log::info('UserSessionActivityMail created', [
        //     'user_id' => $user->id,
        //     'email' => $user->email,
        //     'type' => $activityType,
        //     'timestamp' => $activityTime,
        // ]);
    }

    /**
     * Get the message envelope.
     */
    public function envelope(): Envelope
    {
        return new Envelope(
            subject: ucfirst($this->activityType).' Notification - '.now()->format('F j, Y g:i A'),
        );
    }

    /**
     * Get the message content definition.
     */
    public function content(): Content
    {
        return new Content(
            view: 'emails.user-session-activity',
            with: [
                'user' => $this->user,
                'activityType' => $this->activityType,
                'activityTime' => $this->activityTime,
            ]
        );
    }

    public function attachments(): array
    {
        return [];
    }
}
