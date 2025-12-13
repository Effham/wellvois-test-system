<?php

namespace App\Services;

use App\Models\Tenant\Appointment;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class VideoSessionActivityService
{
    /**
     * Log when a patient accesses their video session
     */
    public static function logPatientSessionAccess(Appointment $appointment, Request $request): void
    {
        try {
            // Get patient data from central database
            $patient = tenancy()->central(function () use ($appointment) {
                return \App\Models\Patient::find($appointment->patient_id);
            });

            if (! $patient) {
                Log::warning('Video session access logged but patient not found', [
                    'appointment_id' => $appointment->id,
                    'patient_id' => $appointment->patient_id,
                    'tenant_id' => tenant('id'),
                ]);

                return;
            }

            // Log the activity with proper subject and causer
            $activity = activity()
                ->performedOn($appointment) // Set the appointment as the subject
                ->event('video_session_accessed')
                ->withProperties([
                    'appointment_id' => $appointment->id,
                    'patient_id' => $patient->id,
                    'patient_name' => $patient->first_name.' '.$patient->last_name,
                    'patient_email' => $patient->email,
                    'participant_type' => 'patient',
                    'session_type' => 'video_appointment',
                    'tenant_id' => tenant('id'),
                    'tenant_name' => tenant('name'),
                    'appointment_datetime' => $appointment->appointment_datetime?->toISOString(),
                    'appointment_mode' => $appointment->mode,
                    'service_name' => $appointment->service?->name,
                    'ip' => $request->ip(),
                    'user_agent' => $request->userAgent(),
                    'access_timestamp' => now()->toISOString(),
                ])
                ->log("Patient {$patient->first_name} {$patient->last_name} accessed video session for appointment {$appointment->id}");

            // Debug logging
            Log::info('Video session activity logged', [
                'appointment_id' => $appointment->id,
                'patient_id' => $patient->id,
                'activity_id' => $activity?->id ?? 'null',
                'tenant_id' => tenant('id'),
            ]);

        } catch (\Exception $e) {
            Log::error('Failed to log patient video session access', [
                'appointment_id' => $appointment->id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
        }
    }

    /**
     * Log when an invited participant accesses the video session
     */
    public static function logInvitedParticipantSessionAccess(
        Appointment $appointment,
        string $participantEmail,
        string $participantName,
        Request $request
    ): void {
        try {
            // Log the activity with proper subject
            activity()
                ->performedOn($appointment) // Set the appointment as the subject
                ->event('video_session_accessed')
                ->withProperties([
                    'appointment_id' => $appointment->id,
                    'participant_email' => $participantEmail,
                    'participant_name' => $participantName,
                    'participant_type' => 'invited',
                    'session_type' => 'video_appointment',
                    'tenant_id' => tenant('id'),
                    'tenant_name' => tenant('name'),
                    'appointment_datetime' => $appointment->appointment_datetime?->toISOString(),
                    'appointment_mode' => $appointment->mode,
                    'service_name' => $appointment->service?->name,
                    'ip' => $request->ip(),
                    'user_agent' => $request->userAgent(),
                    'access_timestamp' => now()->toISOString(),
                ])
                ->log("Invited participant {$participantName} ({$participantEmail}) accessed video session for appointment {$appointment->id}");

        } catch (\Exception $e) {
            Log::error('Failed to log invited participant video session access', [
                'appointment_id' => $appointment->id,
                'participant_email' => $participantEmail,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
        }
    }

    /**
     * Log when a video session is started by a practitioner
     */
    public static function logVideoSessionStarted(Appointment $appointment, Request $request): void
    {
        try {
            $user = auth()->user();

            activity()
                ->causedBy($user)
                ->performedOn($appointment)
                ->event('video_session_started')
                ->withProperties([
                    'appointment_id' => $appointment->id,
                    'practitioner_id' => $user->id,
                    'practitioner_name' => $user->name,
                    'session_type' => 'video_appointment',
                    'tenant_id' => tenant('id'),
                    'tenant_name' => tenant('name'),
                    'appointment_datetime' => $appointment->appointment_datetime?->toISOString(),
                    'appointment_mode' => $appointment->mode,
                    'service_name' => $appointment->service?->name,
                    'ip' => $request->ip(),
                    'user_agent' => $request->userAgent(),
                    'start_timestamp' => now()->toISOString(),
                ])
                ->log("Practitioner {$user->name} started video session for appointment {$appointment->id}");

        } catch (\Exception $e) {
            Log::error('Failed to log video session start', [
                'appointment_id' => $appointment->id,
                'user_id' => auth()->id(),
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
        }
    }

    /**
     * Log when a video session is stopped by a practitioner
     */
    public static function logVideoSessionStopped(Appointment $appointment, Request $request): void
    {
        try {
            $user = auth()->user();

            activity()
                ->causedBy($user)
                ->performedOn($appointment)
                ->event('video_session_stopped')
                ->withProperties([
                    'appointment_id' => $appointment->id,
                    'practitioner_id' => $user->id,
                    'practitioner_name' => $user->name,
                    'session_type' => 'video_appointment',
                    'tenant_id' => tenant('id'),
                    'tenant_name' => tenant('name'),
                    'appointment_datetime' => $appointment->appointment_datetime?->toISOString(),
                    'appointment_mode' => $appointment->mode,
                    'service_name' => $appointment->service?->name,
                    'ip' => $request->ip(),
                    'user_agent' => $request->userAgent(),
                    'stop_timestamp' => now()->toISOString(),
                ])
                ->log("Practitioner {$user->name} stopped video session for appointment {$appointment->id}");

        } catch (\Exception $e) {
            Log::error('Failed to log video session stop', [
                'appointment_id' => $appointment->id,
                'user_id' => auth()->id(),
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
        }
    }

    /**
     * Log when a patient appointment link is sent
     */
    public static function logPatientLinkSent(Appointment $appointment, string $patientEmail, Request $request): void
    {
        try {
            $user = auth()->user();

            activity()
                ->causedBy($user)
                ->performedOn($appointment)
                ->event('patient_link_sent')
                ->withProperties([
                    'appointment_id' => $appointment->id,
                    'patient_email' => $patientEmail,
                    'practitioner_id' => $user->id,
                    'practitioner_name' => $user->name,
                    'tenant_id' => tenant('id'),
                    'tenant_name' => tenant('name'),
                    'appointment_datetime' => $appointment->appointment_datetime?->toISOString(),
                    'ip' => $request->ip(),
                    'user_agent' => $request->userAgent(),
                    'sent_timestamp' => now()->toISOString(),
                ])
                ->log("Patient appointment link sent to {$patientEmail} for appointment {$appointment->id}");

        } catch (\Exception $e) {
            Log::error('Failed to log patient link sent', [
                'appointment_id' => $appointment->id,
                'patient_email' => $patientEmail,
                'user_id' => auth()->id(),
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
        }
    }

    /**
     * Log when an invitation link is sent to additional participants
     */
    public static function logInvitationLinkSent(Appointment $appointment, string $participantEmail, string $participantName, Request $request): void
    {
        try {
            $user = auth()->user();

            activity()
                ->causedBy($user)
                ->performedOn($appointment)
                ->event('invitation_link_sent')
                ->withProperties([
                    'appointment_id' => $appointment->id,
                    'participant_email' => $participantEmail,
                    'participant_name' => $participantName,
                    'practitioner_id' => $user->id,
                    'practitioner_name' => $user->name,
                    'tenant_id' => tenant('id'),
                    'tenant_name' => tenant('name'),
                    'appointment_datetime' => $appointment->appointment_datetime?->toISOString(),
                    'ip' => $request->ip(),
                    'user_agent' => $request->userAgent(),
                    'sent_timestamp' => now()->toISOString(),
                ])
                ->log("Invitation link sent to {$participantName} ({$participantEmail}) for appointment {$appointment->id}");

        } catch (\Exception $e) {
            Log::error('Failed to log invitation link sent', [
                'appointment_id' => $appointment->id,
                'participant_email' => $participantEmail,
                'user_id' => auth()->id(),
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
        }
    }
}
