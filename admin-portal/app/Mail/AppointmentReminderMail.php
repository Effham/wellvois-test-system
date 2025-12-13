<?php

namespace App\Mail;

use Carbon\Carbon;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class AppointmentReminderMail extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    public $patient;

    public $practitioner;

    public $appointmentDetails;

    public $recipientType; // 'patient' or 'practitioner'

    /**
     * Create a new message instance.
     */
    public function __construct($patient, $practitioner, $appointmentDetails, $recipientType = 'patient')
    {
        $this->patient = $patient;
        $this->practitioner = $practitioner;
        $this->appointmentDetails = $appointmentDetails;
        $this->recipientType = $recipientType;

        // Debug logging
        Log::info('AppointmentReminderMail constructed', [
            'appointment_id' => $this->appointmentDetails['id'] ?? 'unknown',
            'patient_id' => $this->patient ? $this->patient->id : 'null',
            'practitioner_id' => $this->practitioner ? $this->practitioner->id : 'null',
            'recipient_type' => $this->recipientType,
            'appointment_date' => $this->appointmentDetails['appointment_datetime'] ?? 'unknown',
        ]);
    }

    /**
     * Get the message envelope.
     */
    public function envelope(): Envelope
    {
        $appointmentDate = Carbon::parse($this->appointmentDetails['appointment_datetime'])->format('M j, Y');
        $appointmentTime = Carbon::parse($this->appointmentDetails['start_time'])->format('g:i A');

        if ($this->recipientType === 'practitioner') {
            $subject = "Appointment Reminder - {$this->getPatientDisplayName()} on {$appointmentDate} at {$appointmentTime}";
        } else {
            $subject = "Appointment Reminder - Tomorrow at {$appointmentTime} with {$this->getPractitionerDisplayName()}";
        }

        return new Envelope(
            subject: $subject,
        );
    }

    /**
     * Get the message content definition.
     */
    public function content(): Content
    {
        $viewData = [
            'patient' => $this->patient,
            'practitioner' => $this->practitioner,
            'appointmentDetails' => $this->appointmentDetails,
            'recipientType' => $this->recipientType,
            'patientDisplayName' => $this->getPatientDisplayName(),
            'practitionerDisplayName' => $this->getPractitionerDisplayName(),
            'appointmentDate' => $this->getFormattedDate(),
            'appointmentTime' => $this->getFormattedTime(),
            'appointmentDuration' => $this->getFormattedDuration(),
            'isVirtual' => $this->appointmentDetails['mode'] === 'virtual',
            'locationName' => $this->appointmentDetails['location_name'],
            'serviceName' => $this->appointmentDetails['service_name'],
            'clinicName' => $this->appointmentDetails['clinic_name'],
        ];

        // Debug log the view data
        Log::info('Appointment reminder email view data prepared', [
            'recipient_type' => $this->recipientType,
            'appointment_id' => $this->appointmentDetails['id'],
            'patient_name' => $viewData['patientDisplayName'],
            'practitioner_name' => $viewData['practitionerDisplayName'],
            'appointment_date' => $viewData['appointmentDate'],
            'appointment_time' => $viewData['appointmentTime'],
        ]);

        $view = $this->recipientType === 'practitioner'
            ? 'emails.appointment-reminder-practitioner'
            : 'emails.appointment-reminder-patient';

        return new Content(
            view: $view,
            with: $viewData
        );
    }

    /**
     * Get the attachments for the message.
     */
    public function attachments(): array
    {
        return [];
    }

    /**
     * Get patient display name
     */
    public function getPatientDisplayName()
    {
        if (! $this->patient) {
            return 'Patient';
        }

        if ($this->patient->preferred_name) {
            return $this->patient->preferred_name;
        }

        return trim(($this->patient->first_name ?? '').' '.($this->patient->last_name ?? ''));
    }

    /**
     * Get practitioner display name
     */
    public function getPractitionerDisplayName()
    {
        if (! $this->practitioner) {
            return 'Doctor';
        }

        $title = '';
        if (isset($this->practitioner->title)) {
            $title = $this->practitioner->title.' ';
        }

        return $title.trim(($this->practitioner->first_name ?? '').' '.($this->practitioner->last_name ?? ''));
    }

    /**
     * Get formatted appointment date
     */
    public function getFormattedDate()
    {
        return Carbon::parse($this->appointmentDetails['appointment_datetime'])->format('l, F j, Y');
    }

    /**
     * Get formatted appointment time
     */
    public function getFormattedTime()
    {
        $startTime = Carbon::parse($this->appointmentDetails['start_time'])->format('g:i A');
        $endTime = Carbon::parse($this->appointmentDetails['end_time'])->format('g:i A');

        return "{$startTime} - {$endTime}";
    }

    /**
     * Get formatted duration
     */
    public function getFormattedDuration()
    {
        $start = Carbon::parse($this->appointmentDetails['start_time']);
        $end = Carbon::parse($this->appointmentDetails['end_time']);
        $duration = $start->diffInMinutes($end);

        if ($duration >= 60) {
            $hours = floor($duration / 60);
            $minutes = $duration % 60;

            if ($minutes > 0) {
                return "{$hours} hour".($hours > 1 ? 's' : '')." and {$minutes} minute".($minutes > 1 ? 's' : '');
            } else {
                return "{$hours} hour".($hours > 1 ? 's' : '');
            }
        } else {
            return "{$duration} minute".($duration > 1 ? 's' : '');
        }
    }
}
