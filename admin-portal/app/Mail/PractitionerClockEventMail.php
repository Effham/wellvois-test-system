<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class PractitionerClockEventMail extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    public $organization;     // array|model with ->name

    public $user;             // practitioner (array|model: name, email)

    public $eventType;        // 'clock_in' | 'clock_out'

    public $date;             // Y-m-d (tenant tz)

    public $clockInTime;      // H:i:s (tenant tz)

    public $clockOutTime;     // H:i:s|null (tenant tz)

    public $totalMinutes;     // int|null

    public $tenantTimezone;   // e.g. 'Asia/Karachi'

    public $timesheetUrl;     // optional deep link

    public $tenantTheme;      // hex color

    public function __construct(
        $organization,
        $user,
        string $eventType,
        string $date,
        string $clockInTime,
        ?string $clockOutTime,
        ?int $totalMinutes,
        string $tenantTimezone,
        ?string $timesheetUrl = null
    ) {
        $this->organization = $organization;
        $this->user = $user;
        $this->eventType = $eventType;
        $this->date = $date;
        $this->clockInTime = $clockInTime;
        $this->clockOutTime = $clockOutTime;
        $this->totalMinutes = $totalMinutes;
        $this->tenantTimezone = $tenantTimezone;
        $this->timesheetUrl = $timesheetUrl;

        $this->tenantTheme = \App\Models\OrganizationSetting::getValue('appearance_theme_color') ?? '#0d6efd';
    }

    public function envelope(): Envelope
    {
        $orgName = is_object($this->organization)
            ? ($this->organization->name ?? 'Organization')
            : ($this->organization['name'] ?? 'Organization');

        $subject = $this->eventType === 'clock_in'
            ? "[$orgName] Practitioner clocked in"
            : "[$orgName] Practitioner clocked out";

        return new Envelope(subject: $subject);
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.practitioner-clock-event',
            with: [
                'organization' => $this->organization,
                'user' => $this->user,
                'eventType' => $this->eventType,
                'date' => $this->date,
                'clockInTime' => $this->clockInTime,
                'clockOutTime' => $this->clockOutTime,
                'totalMinutes' => $this->totalMinutes,
                'tenantTimezone' => $this->tenantTimezone,
                'timesheetUrl' => $this->timesheetUrl,
                'tenantTheme' => $this->tenantTheme,
            ]
        );
    }

    public function attachments(): array
    {
        return [];
    }
}
