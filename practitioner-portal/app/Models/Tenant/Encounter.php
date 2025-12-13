<?php

namespace App\Models\Tenant;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use ParagonIE\CipherSweet\BlindIndex;
use ParagonIE\CipherSweet\EncryptedRow;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;
use Spatie\LaravelCipherSweet\Concerns\UsesCipherSweet;
use Spatie\LaravelCipherSweet\Contracts\CipherSweetEncrypted;

class Encounter extends Model implements CipherSweetEncrypted
{
    use HasFactory, LogsActivity, UsesCipherSweet;

    protected $fillable = [
        'appointment_id',
        'status',
        'chief_complaint',
        'history_of_present_illness',
        'examination_notes',
        'clinical_assessment',
        'treatment_plan',
        'additional_notes',
        'note_type',
        'ai_note',
        'ai_note_status',
        'blood_pressure_systolic',
        'blood_pressure_diastolic',
        'heart_rate',
        'temperature',
        'respiratory_rate',
        'oxygen_saturation',
        'weight',
        'height',
        'bmi',
        'session_recording',
        'session_started_at',
        'session_completed_at',
        'session_duration_seconds',
        'session_type',
        // Mental health fields
        'mental_state_exam',
        'mood_affect',
        'thought_process',
        'cognitive_assessment',
        'risk_assessment',
        'therapeutic_interventions',
        'session_goals',
        'homework_assignments',
        // AI fields
        'ai_summary',
        'report_sent_to_patient',
        // Recording AI Summary fields
        'recording_ai_summary_type',
        'recording_ai_summary',
        'recording_ai_summary_status',
    ];

    protected function casts(): array
    {
        return [
            'session_started_at' => 'datetime',
            'session_completed_at' => 'datetime',
            'session_duration_seconds' => 'integer',
            'report_sent_to_patient' => 'boolean',
        ];
    }

    /**
     * Get the appointment for this encounter.
     */
    public function appointment(): BelongsTo
    {
        return $this->belongsTo(Appointment::class);
    }

    /**
     * Get the prescriptions for this encounter.
     */
    public function prescriptions(): HasMany
    {
        return $this->hasMany(EncounterPrescription::class);
    }

    /**
     * Get the documents for this encounter.
     */
    public function documents(): HasMany
    {
        return $this->hasMany(EncounterDocument::class);
    }

    /**
     * Get the document requests for this encounter.
     */
    public function documentRequests(): HasMany
    {
        return $this->hasMany(EncounterDocumentRequest::class);
    }

    /**
     * Get the recordings for this encounter.
     */
    public function recordings(): HasMany
    {
        return $this->hasMany(EncounterRecording::class);
    }

    /**
     * Check if the encounter is completed.
     */
    public function isCompleted(): bool
    {
        return $this->status === 'completed';
    }

    /**
     * Check if the encounter is in progress.
     */
    public function isInProgress(): bool
    {
        return $this->status === 'in_progress';
    }

    /**
     * Mark the encounter as completed.
     */
    public function markAsCompleted(): void
    {
        $this->update([
            'status' => 'completed',
            'session_completed_at' => now(),
        ]);
    }

    /**
     * Configure CipherSweet encryption for sensitive encounter fields
     */
    public static function configureCipherSweet(EncryptedRow $encryptedRow): void
    {
        $encryptedRow
            // Fields with blind indexes (searchable) - nullable, so use addOptionalTextField
            ->addOptionalTextField('chief_complaint')
            ->addBlindIndex('chief_complaint', new BlindIndex('chief_complaint_index'))
            ->addOptionalTextField('risk_assessment')
            ->addBlindIndex('risk_assessment', new BlindIndex('risk_assessment_index'))

            // Fields without blind indexes (not searchable, but encrypted) - all nullable
            ->addOptionalTextField('history_of_present_illness')
            ->addOptionalTextField('examination_notes')
            ->addOptionalTextField('clinical_assessment')
            ->addOptionalTextField('treatment_plan')
            ->addOptionalTextField('additional_notes')
            ->addOptionalTextField('mental_state_exam')
            ->addOptionalTextField('mood_affect')
            ->addOptionalTextField('thought_process')
            ->addOptionalTextField('cognitive_assessment')
            ->addOptionalTextField('therapeutic_interventions')
            ->addOptionalTextField('session_goals')
            ->addOptionalTextField('homework_assignments')
            ->addOptionalTextField('ai_summary')
            ->addOptionalTextField('recording_ai_summary');
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logFillable()
            ->logOnlyDirty()
            ->setDescriptionForEvent(fn (string $eventName) => "Encounter for appointment ID {$this->appointment_id} was {$eventName}");
    }
}
