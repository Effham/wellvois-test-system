<?php

use App\Models\Patient;
use App\Models\Tenant\Appointment;
use App\Models\Tenant\Consent;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Log;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * This migration updates existing 'pending' appointments to 'pending-consent' status
     * if the patient has not accepted all required consents.
     */
    public function up(): void
    {
        // This migration only runs on tenant databases
        // We need to run it within each tenant's context
        // Note: This will be executed automatically by Laravel's tenant migration system

        Log::info('Starting update of existing appointments to pending-consent status');

        try {
            // Get all pending appointments
            $pendingAppointments = Appointment::where('status', 'pending')->get();

            $updatedCount = 0;
            $skippedCount = 0;

            foreach ($pendingAppointments as $appointment) {
                // Get patient data
                $patient = tenancy()->central(function () use ($appointment) {
                    return Patient::find($appointment->patient_id);
                });

                if (! $patient) {
                    Log::warning('Patient not found for appointment', [
                        'appointment_id' => $appointment->id,
                        'patient_id' => $appointment->patient_id,
                    ]);
                    $skippedCount++;

                    continue;
                }

                // Check if patient has accepted all required consents
                $hasAcceptedAllRequired = Consent::patientHasAcceptedAllRequired($patient);

                if (! $hasAcceptedAllRequired) {
                    // Update appointment status to pending-consent
                    $appointment->update(['status' => 'pending-consent']);
                    $updatedCount++;

                    Log::info('Updated appointment status to pending-consent', [
                        'appointment_id' => $appointment->id,
                        'patient_id' => $patient->id,
                    ]);
                } else {
                    $skippedCount++;
                }
            }

            Log::info('Completed update of existing appointments', [
                'total_pending' => $pendingAppointments->count(),
                'updated' => $updatedCount,
                'skipped' => $skippedCount,
            ]);

        } catch (\Exception $e) {
            Log::error('Failed to update existing appointments', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            // Don't fail the migration, just log the error
            // Existing appointments can be manually updated if needed
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Revert all pending-consent appointments back to pending
        Log::info('Reverting pending-consent appointments back to pending');

        try {
            $updatedCount = Appointment::where('status', 'pending-consent')
                ->update(['status' => 'pending']);

            Log::info('Reverted appointments', ['count' => $updatedCount]);
        } catch (\Exception $e) {
            Log::error('Failed to revert appointments', [
                'error' => $e->getMessage(),
            ]);
        }
    }
};
