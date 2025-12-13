<?php

namespace App\Observers;

use App\Models\Tenant\Appointment;
use App\Models\Tenant\EntityConsent;

class EntityConsentObserver
{
    /**
     * Handle the EntityConsent "created" event.
     */
    public function created(EntityConsent $entityConsent): void
    {
        // Check if this is a patient consent acceptance
        if ($entityConsent->consentable_type === \App\Models\Tenant\Patient::class) {
            // Get all pending-consent appointments for this patient
            $appointments = Appointment::where('patient_id', $entityConsent->consentable_id)
                ->where('status', 'pending-consent')
                ->get();

            // Try to update each appointment's status
            foreach ($appointments as $appointment) {
                $appointment->updateStatusIfConsentsAccepted();
            }
        }
    }

    /**
     * Handle the EntityConsent "updated" event.
     */
    public function updated(EntityConsent $entityConsent): void
    {
        //
    }

    /**
     * Handle the EntityConsent "deleted" event.
     */
    public function deleted(EntityConsent $entityConsent): void
    {
        //
    }

    /**
     * Handle the EntityConsent "restored" event.
     */
    public function restored(EntityConsent $entityConsent): void
    {
        //
    }

    /**
     * Handle the EntityConsent "force deleted" event.
     */
    public function forceDeleted(EntityConsent $entityConsent): void
    {
        //
    }
}
