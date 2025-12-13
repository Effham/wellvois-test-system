<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class AppointmentNotificationMail extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    public $appointment;

    public $recipientType; // 'patient' or 'practitioner'

    public $status; // 'confirmed', 'completed', 'cancelled', 'declined'

    public $tenantTheme;

    /**
     * Create a new message instance.
     */
    public function __construct($appointment, $recipientType = 'patient', $status = 'confirmed')
    {
        $this->appointment = $appointment;
        $this->recipientType = $recipientType;
        $this->status = $status;
        $this->tenantTheme = \App\Models\OrganizationSetting::getValue('appearance_theme_color');
    }

    /**
     * Get the message envelope.
     */
    public function envelope(): Envelope
    {
        $subjects = [
            'confirmed' => 'Appointment Confirmed',
            'completed' => 'Appointment Completed',
            'cancelled' => 'Appointment Cancelled',
            'declined' => 'Appointment Declined',
        ];

        // Use appointment's formatted date if available, otherwise format the appointment datetime in location timezone
        $dateForSubject = $this->appointment->formatted_date ?? null;

        // If no formatted_date and this is an Eloquent model, try getFormattedDate method
        if (! $dateForSubject && method_exists($this->appointment, 'getFormattedDate')) {
            $dateForSubject = $this->appointment->getFormattedDate('M d, Y');
        }

        // If still no date, try to format from available data
        if (! $dateForSubject) {
            if (isset($this->appointment->appointment_datetime)) {
                $dateForSubject = date('M d, Y', strtotime($this->appointment->appointment_datetime));
            } elseif (isset($this->appointment->date)) {
                $dateForSubject = date('M d, Y', strtotime($this->appointment->date));
            } else {
                $dateForSubject = date('M d, Y'); // fallback to today
            }
        }

        $subject = ($subjects[$this->status] ?? 'Appointment Update').' - '.$dateForSubject;

        return new Envelope(
            subject: $subject,
        );
    }

    /**
     * Get the message content definition.
     */
    public function content(): Content
    {
        return new Content(
            view: 'emails.appointment-confirmation',
            with: [
                'appointment' => $this->appointment,
                'recipientType' => $this->recipientType,
                'status' => $this->status,
                'tenantTheme' => $this->tenantTheme,
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

    /**
     * Get status configuration for display
     */
    public function getStatusConfig()
    {
        $statusConfigs = [
            'confirmed' => [
                'icon' => '✅',
                'label' => 'CONFIRMED',
                'color' => '#28a745',
                'bg_color' => '#d4edda',
                'title' => '🏥 Appointment Confirmation',
                'subtitle' => 'Your appointment has been successfully confirmed',
            ],
            'completed' => [
                'icon' => '✓',
                'label' => 'COMPLETED',
                'color' => '#17a2b8',
                'bg_color' => '#d1ecf1',
                'title' => '🏥 Appointment Completed',
                'subtitle' => 'Your appointment has been completed',
            ],
            'cancelled' => [
                'icon' => '✘',
                'label' => 'CANCELLED',
                'color' => '#dc3545',
                'bg_color' => '#f8d7da',
                'title' => '🏥 Appointment Cancelled',
                'subtitle' => 'Your appointment has been cancelled',
            ],
            'declined' => [
                'icon' => '✘',
                'label' => 'DECLINED',
                'color' => '#fd7e14',
                'bg_color' => '#ffeaa7',
                'title' => '🏥 Appointment Declined',
                'subtitle' => 'Your appointment has been declined',
            ],
        ];

        return $statusConfigs[$this->status] ?? $statusConfigs['confirmed'];
    }
}
