<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class PatientInvitationAcceptedMail extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    public $invitation;

    public $patient;

    public $tenant;

    public $isNewUser;

    /**
     * Create a new message instance.
     */
    public function __construct($invitation, $isNewUser = false)
    {
        // Ensure invitation has relationships loaded
        if ($invitation->relationLoaded('patient') && $invitation->relationLoaded('tenant')) {
            $this->invitation = $invitation;
            $this->patient = $invitation->patient;
            $this->tenant = $invitation->tenant;
        } else {
            // Force load relationships if not already loaded
            $this->invitation = $invitation->load(['patient', 'tenant']);
            $this->patient = $this->invitation->patient;
            $this->tenant = $this->invitation->tenant;
        }

        $this->isNewUser = $isNewUser;

        // Debug logging to check what we're getting
        Log::info('PatientInvitationAcceptedMail constructed', [
            'invitation_id' => $this->invitation->id,
            'patient_type' => gettype($this->patient),
            'patient_id' => $this->patient ? $this->patient->id : 'null',
            'tenant_type' => gettype($this->tenant),
            'tenant_id' => $this->tenant ? $this->tenant->id : 'null',
            'is_new_user' => $this->isNewUser,
        ]);
    }

    /**
     * Get the message envelope.
     */
    public function envelope(): Envelope
    {
        $subject = $this->isNewUser
            ? 'Welcome to '.($this->tenant->company_name ?? 'Our System').' - Account Created Successfully!'
            : 'Welcome to '.($this->tenant->company_name ?? 'Our System').' - Invitation Accepted!';

        return new Envelope(
            subject: $subject,
        );
    }

    /**
     * Get the message content definition.
     */
    public function content(): Content
    {
        // Prepare all variables for the view
        $viewData = [
            'invitation' => $this->invitation,
            'patient' => $this->patient,
            'tenant' => $this->tenant,
            'isNewUser' => $this->isNewUser,
            // Add computed values to avoid complex logic in Blade
            'patientDisplayName' => $this->getPatientDisplayName(),
            'welcomeMessage' => $this->getWelcomeMessage(),
            'nextSteps' => $this->getNextSteps(),
        ];

        // Debug log the view data
        Log::info('Email view data prepared', [
            'patient_name' => $viewData['patientDisplayName'],
            'company_name' => $this->tenant->company_name ?? 'Unknown',
            'is_new_user' => $this->isNewUser,
            'patient_email' => $this->patient->email ?? 'Unknown',
        ]);

        return new Content(
            view: 'emails.patient-invitation-accepted',
            with: $viewData
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
     * Get welcome message based on user type
     */
    public function getWelcomeMessage()
    {
        if ($this->isNewUser) {
            return "Your account has been successfully created and you're now part of our patient care system.";
        }

        return 'You have successfully joined our patient care system using your existing account.';
    }

    /**
     * Get next steps based on user type
     */
    public function getNextSteps()
    {
        $baseSteps = [
            'Log in to your patient portal to view and manage your appointments',
            'Complete your profile information if needed',
            'Review your upcoming appointments and medical information',
            'Contact us if you have any questions or need assistance',
        ];

        if ($this->isNewUser) {
            array_unshift($baseSteps, 'Keep your login credentials safe and secure');
        }

        return $baseSteps;
    }
}
