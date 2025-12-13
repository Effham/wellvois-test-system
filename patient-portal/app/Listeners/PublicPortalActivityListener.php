<?php

namespace App\Listeners;

use App\Models\Tenant\Appointment;
use App\Models\Tenant\Patient;
use App\Models\Tenant\RegisterFromPublicPortal;

class PublicPortalActivityListener
{
    /**
     * Log patient registration via public portal
     */
    public static function logPatientRegistration(Patient $patient, $tenantId, $appointmentId = null): void
    {
        activity()
            ->performedOn($patient)
            ->event('patient_registered_public_portal')
            ->withProperties([
                'patient_id' => $patient->id,
                'patient_email' => $patient->email,
                'patient_name' => $patient->first_name.' '.$patient->last_name,
                'tenant_id' => $tenantId,
                'appointment_id' => $appointmentId,
                'registration_source' => 'public_portal',
                'ip' => request()->ip(),
                'user_agent' => request()->userAgent(),
                'created_via_public_portal' => true,
            ])
            ->log("New patient {$patient->first_name} {$patient->last_name} registered via public portal");
    }

    /**
     * Log appointment booking via public portal
     */
    public static function logPublicPortalAppointment(Appointment $appointment, Patient $patient, $isNewPatient = false): void
    {
        activity()
            ->performedOn($appointment)
            ->event('appointment_booked_public_portal')
            ->withProperties([
                'appointment_id' => $appointment->id,
                'patient_id' => $appointment->patient_id,
                'patient_name' => $patient->first_name.' '.$patient->last_name,
                'patient_email' => $patient->email,
                'service_id' => $appointment->service_id,
                'appointment_datetime' => $appointment->appointment_datetime,
                'mode' => $appointment->mode,
                'booking_source' => $appointment->booking_source,
                'is_new_patient' => $isNewPatient,
                'tenant_id' => tenant('id'),
                'ip' => request()->ip(),
                'user_agent' => request()->userAgent(),
                'created_via_public_portal' => true,
            ])
            ->log("Appointment booked via public portal for patient {$patient->first_name} {$patient->last_name}");
    }

    /**
     * Log patient joining tenant via public portal
     */
    public static function logPatientJoinTenant($patient, $tenantId): void
    {
        activity()
            ->performedOn($patient)
            ->event('patient_joined_tenant_public_portal')
            ->withProperties([
                'patient_id' => $patient->id,
                'patient_email' => $patient->email,
                'patient_name' => $patient->first_name.' '.$patient->last_name,
                'tenant_id' => $tenantId,
                'join_source' => 'public_portal',
                'ip' => request()->ip(),
                'user_agent' => request()->userAgent(),
            ])
            ->log("Patient {$patient->first_name} {$patient->last_name} joined tenant via public portal");
    }

    /**
     * Log patient dashboard tenant switching
     */
    public static function logPatientTenantSwitch($patient, $fromTenant, $toTenant): void
    {
        activity()
            ->performedOn($patient)
            ->event('patient_tenant_switch')
            ->withProperties([
                'patient_id' => $patient->id,
                'patient_email' => $patient->email,
                'patient_name' => $patient->first_name.' '.$patient->last_name,
                'from_tenant_id' => $fromTenant,
                'to_tenant_id' => $toTenant,
                'switch_source' => 'patient_dashboard',
                'ip' => request()->ip(),
                'user_agent' => request()->userAgent(),
            ])
            ->log("Patient {$patient->first_name} {$patient->last_name} switched from tenant {$fromTenant} to tenant {$toTenant}");
    }

    /**
     * Log practitioner dashboard tenant switching
     */
    public static function logPractitionerTenantSwitch($practitioner, $fromTenant, $toTenant): void
    {
        activity()
            ->performedOn($practitioner)
            ->event('practitioner_tenant_switch')
            ->withProperties([
                'practitioner_id' => $practitioner->id,
                'practitioner_email' => $practitioner->email,
                'practitioner_name' => $practitioner->first_name.' '.$practitioner->last_name,
                'from_tenant_id' => $fromTenant,
                'to_tenant_id' => $toTenant,
                'switch_source' => 'practitioner_dashboard',
                'ip' => request()->ip(),
                'user_agent' => request()->userAgent(),
            ])
            ->log("Practitioner {$practitioner->first_name} {$practitioner->last_name} switched from tenant {$fromTenant} to tenant {$toTenant}");
    }

    /**
     * Log appointment status updates
     */
    public static function logAppointmentStatusUpdate(Appointment $appointment, $oldStatus, $newStatus, $updatedBy = null): void
    {
        activity()
            ->causedBy($updatedBy)
            ->performedOn($appointment)
            ->event('appointment_status_updated')
            ->withProperties([
                'appointment_id' => $appointment->id,
                'patient_id' => $appointment->patient_id,
                'old_status' => $oldStatus,
                'new_status' => $newStatus,
                'reason_for_update' => $appointment->reason_for_update,
                'tenant_id' => tenant('id'),
                'ip' => request()->ip(),
                'user_agent' => request()->userAgent(),
            ])
            ->log("Appointment {$appointment->id} status changed from {$oldStatus} to {$newStatus}");
    }

    /**
     * Log public portal registration tracking
     */
    public static function logPublicPortalRegistrationTracking(RegisterFromPublicPortal $registration): void
    {
        activity()
            ->performedOn($registration)
            ->event('public_portal_registration_tracked')
            ->withProperties([
                'patient_id' => $registration->patient_id,
                'user_id' => $registration->user_id,
                'registered_at' => $registration->registered_at,
                'tenant_id' => tenant('id'),
                'ip' => request()->ip(),
                'user_agent' => request()->userAgent(),
            ])
            ->log("Public portal registration tracked for patient ID {$registration->patient_id}");
    }
}
