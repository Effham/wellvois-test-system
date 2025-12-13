<?php

namespace App\Services;

use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\URL;

/**
 * Service for generating signed URLs for appointment video sessions
 * Provides secure, time-limited access to video sessions
 */
class AppointmentSignedUrlService
{
    /**
     * Generate a signed URL for patient appointment access
     */
    public function generatePatientAppointmentUrl(int $appointmentId, int $expiresMinutes = 60): string
    {
        $expiresAt = now()->addMinutes($expiresMinutes);

        $payload = [
            'appointment_id' => $appointmentId,
            'participant_type' => 'patient',
            'expires_at' => $expiresAt->timestamp,
            'issued_at' => now()->timestamp,
        ];

        $signedData = Crypt::encrypt($payload);

        return URL::signedRoute('appointments.patient-view', [
            'appointment' => $appointmentId,
            'token' => $signedData,
        ], $expiresAt);
    }

    /**
     * Generate a signed URL for invited participant access
     */
    public function generateInvitedParticipantUrl(int $appointmentId, string $email, int $expiresMinutes = 60): string
    {
        $expiresAt = now()->addMinutes($expiresMinutes);

        $payload = [
            'appointment_id' => $appointmentId,
            'participant_type' => 'invited',
            'email' => $email,
            'expires_at' => $expiresAt->timestamp,
            'issued_at' => now()->timestamp,
        ];

        $signedData = Crypt::encrypt($payload);

        return URL::signedRoute('appointments.invited-view', [
            'appointment' => $appointmentId,
            'token' => $signedData,
        ], $expiresAt);
    }

    /**
     * Verify and decode a signed URL token
     */
    public function verifyToken(string $token): ?array
    {
        try {
            $payload = Crypt::decrypt($token);

            // Check if token has expired
            if (isset($payload['expires_at']) && $payload['expires_at'] < now()->timestamp) {
                Log::warning('Signed URL token has expired', [
                    'expires_at' => $payload['expires_at'],
                    'current_time' => now()->timestamp,
                ]);

                return null;
            }

            return $payload;
        } catch (\Exception $e) {
            Log::warning('Failed to verify signed URL token', [
                'error' => $e->getMessage(),
            ]);

            return null;
        }
    }

    /**
     * Generate a signed URL for practitioner access (for reference)
     */
    public function generatePractitionerAppointmentUrl(int $appointmentId, int $expiresMinutes = 480): string
    {
        $expiresAt = now()->addMinutes($expiresMinutes);

        $payload = [
            'appointment_id' => $appointmentId,
            'participant_type' => 'practitioner',
            'expires_at' => $expiresAt->timestamp,
            'issued_at' => now()->timestamp,
        ];

        $signedData = Crypt::encrypt($payload);

        return URL::signedRoute('appointments.practitioner-view', [
            'appointment' => $appointmentId,
            'token' => $signedData,
        ], $expiresAt);
    }
}
