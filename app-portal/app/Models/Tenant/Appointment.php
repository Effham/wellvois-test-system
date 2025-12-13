<?php

namespace App\Models\Tenant;

use App\Models\Location;
use App\Models\Practitioner;
use App\Models\Service;
use App\Services\WalletTransactionService;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;

class Appointment extends Model
{
    use LogsActivity;

    protected $fillable = [
        // Patient reference
        'patient_id',
        'contact_person',

        // Appointment History
        'parent_appointment_id',
        'root_appointment_id',

        // Appointment Details (only service_id, service details via relationship)
        'service_id',
        'location_id',
        'mode',
        'appointment_datetime',
        'start_time',
        'end_time',
        'date_time_preference',
        'booking_source',
        'admin_override',
        'client_type',

        // Status and tracking
        'status',
        'notes',
        'reason_for_update',
        'google_calendar_event_id',
        'stored_timezone',
        'needs_timezone_migration',
    ];

    protected $casts = [
        // Cast to datetime for proper handling of UTC times
        'appointment_datetime' => 'datetime',
        'start_time' => 'datetime',
        'end_time' => 'datetime',
        'needs_timezone_migration' => 'boolean',
    ];

    /**
     * Get the patient (from tenant database)
     */
    public function patient(): BelongsTo
    {
        return $this->belongsTo(Patient::class);
    }

    /**
     * Helper method to get patient data from tenant database
     *
     * @deprecated Use patient() relationship instead
     */
    public function getPatientData()
    {
        return $this->patient;
    }

    /**
     * Get the service
     */
    public function service(): BelongsTo
    {
        return $this->belongsTo(Service::class);
    }

    /**
     * Get the practitioners (from central database) - many-to-many relationship
     * Note: This relationship doesn't work across databases in Laravel,
     * so we handle practitioner loading manually in controllers
     */
    public function practitioners()
    {
        // This relationship is handled manually in controllers
        // due to cross-database limitations
        return collect([]);
    }

    /**
     * Get the first practitioner (for backward compatibility)
     */
    public function practitioner()
    {
        return null;
    }

    /**
     * Helper method to get practitioner data from tenant database
     */
    public function getPractitionerData()
    {
        $practitionerIds = \DB::table('appointment_practitioner')
            ->where('appointment_id', $this->id)
            ->pluck('practitioner_id');

        return \App\Models\Practitioner::whereIn('id', $practitionerIds)->get();
    }

    /**
     * Get the location
     */
    public function location(): BelongsTo
    {
        return $this->belongsTo(Location::class);
    }

    /**
     * Get the encounter for this appointment
     */
    public function encounter(): BelongsTo
    {
        return $this->belongsTo(Encounter::class);
    }

    /**
     * Get patient's full name
     */
    public function getPatientFullNameAttribute(): string
    {
        if ($this->patient) {
            return trim($this->patient->first_name.' '.$this->patient->last_name);
        }

        return 'Unknown Patient';
    }

    /**
     * Get patient's display name (preferred name or full name)
     */
    public function getPatientDisplayNameAttribute(): string
    {
        if ($this->patient) {
            return $this->patient->preferred_name ?: $this->patient_full_name;
        }

        return 'Unknown Patient';
    }

    /**
     * Get the parent appointment (previous appointment in chain)
     */
    public function parentAppointment(): BelongsTo
    {
        return $this->belongsTo(Appointment::class, 'parent_appointment_id');
    }

    /**
     * Get child appointments (appointments that came after this one in chain)
     */
    public function childAppointments()
    {
        return $this->hasMany(Appointment::class, 'parent_appointment_id');
    }

    /**
     * Get the root appointment (first appointment in chain)
     */
    public function rootAppointment(): BelongsTo
    {
        return $this->belongsTo(Appointment::class, 'root_appointment_id');
    }

    /**
     * Get all appointments in the same chain (including this one)
     */
    public function appointmentChain()
    {
        return $this->where('root_appointment_id', $this->root_appointment_id ?: $this->id)
            ->orderBy('created_at', 'asc');
    }

    /**
     * Scope for pending appointments
     */
    public function scopePending($query)
    {
        return $query->where('status', 'pending');
    }

    /**
     * Scope for confirmed appointments
     */
    public function scopeConfirmed($query)
    {
        return $query->where('status', 'confirmed');
    }

    /**
     * Scope for completed appointments
     */
    public function scopeCompleted($query)
    {
        return $query->where('status', 'completed');
    }

    /**
     * Scope for pending-consent appointments
     */
    public function scopePendingConsent($query)
    {
        return $query->where('status', 'pending-consent');
    }

    /**
     * Update appointment status from pending-consent to pending if all required consents are accepted
     */
    public function updateStatusIfConsentsAccepted(): bool
    {
        if ($this->status !== 'pending-consent') {
            return false;
        }

        $patient = $this->getPatientData();
        if (! $patient) {
            return false;
        }

        if (Consent::patientHasAcceptedAllRequired($patient)) {
            $this->update(['status' => 'pending']);

            return true;
        }

        return false;
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logFillable()
            ->logOnlyDirty()
            ->setDescriptionForEvent(fn (string $eventName) => "Appointment for patient ID {$this->patient_id} was {$eventName}");
    }

    /**
     * Convert appointment datetime from tenant timezone to UTC and save
     * Uses organization timezone setting instead of location timezone
     */
    public function setAppointmentFromTenantTime(string $datetime): void
    {
        $utcDateTime = \App\Services\TenantTimezoneService::convertToUTC($datetime);

        $this->appointment_datetime = $utcDateTime;
        $this->start_time = $utcDateTime;

        // Calculate end time (you might want to pass duration as parameter)
        $sessionDuration = config('appointments.default_session_duration', 60); // 60 minutes default
        $this->end_time = $utcDateTime->copy()->addMinutes($sessionDuration);

        $this->stored_timezone = \App\Services\TenantTimezoneService::getTenantTimezone();
        $this->needs_timezone_migration = false;
    }

    /**
     * @deprecated Use setAppointmentFromTenantTime() instead
     */
    public function setAppointmentFromLocationTime(string $datetime): void
    {
        // Forward to new method for backward compatibility
        $this->setAppointmentFromTenantTime($datetime);
    }

    /**
     * Get appointment datetime in tenant's organization timezone
     */
    public function getAppointmentDateTimeInTenantTimezone(): ?\Carbon\Carbon
    {
        if (! $this->appointment_datetime) {
            return null;
        }

        return \App\Services\TenantTimezoneService::convertToTenantTime($this->appointment_datetime);
    }

    /**
     * Get start time in tenant's organization timezone
     */
    public function getStartTimeInTenantTimezone(): ?\Carbon\Carbon
    {
        if (! $this->start_time) {
            return null;
        }

        return \App\Services\TenantTimezoneService::convertToTenantTime($this->start_time);
    }

    /**
     * Get end time in tenant's organization timezone
     */
    public function getEndTimeInTenantTimezone(): ?\Carbon\Carbon
    {
        if (! $this->end_time) {
            return null;
        }

        return \App\Services\TenantTimezoneService::convertToTenantTime($this->end_time);
    }

    /**
     * @deprecated Use getAppointmentDateTimeInTenantTimezone() instead
     */
    public function getAppointmentDateTimeInLocationTimezone(): ?\Carbon\Carbon
    {
        return $this->getAppointmentDateTimeInTenantTimezone();
    }

    /**
     * @deprecated Use getStartTimeInTenantTimezone() instead
     */
    public function getStartTimeInLocationTimezone(): ?\Carbon\Carbon
    {
        return $this->getStartTimeInTenantTimezone();
    }

    /**
     * @deprecated Use getEndTimeInTenantTimezone() instead
     */
    public function getEndTimeInLocationTimezone(): ?\Carbon\Carbon
    {
        return $this->getEndTimeInTenantTimezone();
    }

    /**
     * Get formatted appointment datetime for display in tenant timezone
     */
    public function getFormattedAppointmentDateTime(string $format = 'Y-m-d H:i'): ?string
    {
        $localDateTime = $this->getAppointmentDateTimeInTenantTimezone();

        return $localDateTime ? $localDateTime->format($format) : null;
    }

    /**
     * Get formatted date for display in tenant timezone
     */
    public function getFormattedDate(string $format = 'Y-m-d'): ?string
    {
        $localDateTime = $this->getAppointmentDateTimeInTenantTimezone();

        return $localDateTime ? $localDateTime->format($format) : null;
    }

    /**
     * Get formatted time for display in tenant timezone
     */
    public function getFormattedTime(string $format = 'H:i'): ?string
    {
        $localDateTime = $this->getAppointmentDateTimeInTenantTimezone();

        return $localDateTime ? $localDateTime->format($format) : null;
    }

    /**
     * Get tenant's organization timezone
     */
    public function getTenantTimezone(): string
    {
        return \App\Services\TenantTimezoneService::getTenantTimezone();
    }

    /**
     * Get tenant timezone abbreviation
     */
    public function getTenantTimezoneAbbreviation(): string
    {
        return \App\Services\TenantTimezoneService::getTenantTimezoneAbbreviation();
    }

    /**
     * @deprecated Use getTenantTimezone() instead
     */
    public function getLocationTimezone(): ?string
    {
        return $this->getTenantTimezone();
    }

    /**
     * @deprecated Use getTenantTimezoneAbbreviation() instead
     */
    public function getLocationTimezoneAbbreviation(): ?string
    {
        return $this->getTenantTimezoneAbbreviation();
    }

    /**
     * Check if appointment needs timezone migration
     */
    public function needsTimezoneMigration(): bool
    {
        return $this->needs_timezone_migration ||
               ($this->stored_timezone !== $this->getTenantTimezone());
    }

    /**
     * Convert appointment times for API/JSON responses with tenant timezone
     */
    public function toArrayWithTenantTimezone(): array
    {
        $array = $this->toArray();

        // Add tenant-converted times for frontend display
        $array['appointment_datetime_local'] = $this->getAppointmentDateTimeInTenantTimezone()?->toISOString();
        $array['start_time_local'] = $this->getStartTimeInTenantTimezone()?->toISOString();
        $array['end_time_local'] = $this->getEndTimeInTenantTimezone()?->toISOString();
        $array['formatted_date'] = $this->getFormattedDate();
        $array['formatted_time'] = $this->getFormattedTime();
        $array['formatted_datetime'] = $this->getFormattedAppointmentDateTime();
        $array['tenant_timezone'] = $this->getTenantTimezone();
        $array['tenant_timezone_abbr'] = $this->getTenantTimezoneAbbreviation();

        return $array;
    }

    /**
     * @deprecated Use toArrayWithTenantTimezone() instead
     */
    public function toArrayWithLocationTimezone(): array
    {
        return $this->toArrayWithTenantTimezone();
    }

    /**
     * Mark appointment as completed and process wallet transactions
     */
    public function markAsCompleted(): array
    {
        if ($this->status === 'completed') {
            return [];
        }

        // Update appointment status
        $this->update(['status' => 'completed']);

        // Process wallet transactions for practitioners
        $walletService = new WalletTransactionService;

        return $walletService->processAppointmentCompletion($this);
    }

    /**
     * Get practitioner transactions for this appointment
     */
    public function practitionerTransactions()
    {
        return \App\Models\Tenant\Transaction::where('accountable_type', self::class)
            ->where('accountable_id', $this->id)
            ->where('transaction_type', 'credit')
            ->get();
    }

    /**
     * Check if appointment has been financially processed
     */
    public function hasBeenFinanciallyProcessed(): bool
    {
        return $this->practitionerTransactions()->count() > 0;
    }
}
