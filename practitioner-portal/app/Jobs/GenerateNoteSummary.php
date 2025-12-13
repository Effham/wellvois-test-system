<?php

namespace App\Jobs;

use App\Models\Tenant\Encounter;
use App\Services\BedrockAIService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Throwable;

class GenerateNoteSummary implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    // ---- Match your DB enum exactly ----
    private const STATUS_PENDING = 'pending';

    private const STATUS_IN_PROGRESS = 'in_progress';

    private const STATUS_GENERATED = 'generated';

    private const STATUS_FAILED = 'failed';

    public int $tries = 3;

    public int $timeout = 120;

    public function backoff(): array
    {
        return [10, 30, 90];
    }

    /**
     * You can dispatch in two ways:
     *  A) Class + ID:
     *     GenerateNoteSummary::dispatch(\App\Models\Tenant\Encounter::class, $encounterId, 'soap');
     *  B) Model instance:
     *     GenerateNoteSummary::dispatch(modelClass: \App\Models\Tenant\Encounter::class, modelId: $encounter->id, model: $encounter, noteType: 'soap');
     *
     * IMPORTANT: $model is nullable AND has a default null to avoid uninitialized typed property errors.
     */
    public function __construct(
        public string $modelClass = Encounter::class,
        public int $modelId = 0,
        public ?Encounter $model = null,          // <-- DEFAULT NULL prevents the crash
        public string $noteType = 'narrative',
        public ?string $simpleNote = null
    ) {}

    public function handle(BedrockAIService $ai): void
    {
        /** @var Encounter $encounter */
        $encounter = $this->resolveEncounter(); // never touches $model unless it's set

        try {
            // set in-progress INSIDE try so catch can flip to failed
            $this->updateStatus($encounter, self::STATUS_IN_PROGRESS);

            Log::info('GenerateNoteSummary: started', [
                'encounter_id' => $encounter->id,
                'note_type' => $this->noteType,
            ]);

            // Build prompts
            $patientContext = $this->buildPatientContext($encounter);
            $systemPrompt = $this->systemPromptFor($this->noteType);
            $userPrompt = $this->userPromptFor($patientContext, $this->noteType, $this->simpleNote);

            // Stream AI -> final note (no PHP formatting)
            $buffer = '';
            $ai->streamResponse(
                prompt: $userPrompt,
                systemPrompt: $systemPrompt,
                callback: function (string $delta) use (&$buffer) {
                    $buffer .= $delta;
                }
            );

            $finalNote = trim($buffer);

            // Save + mark generated
            $encounter->ai_note = $finalNote;
            $encounter->save();
            $this->updateStatus($encounter, self::STATUS_GENERATED);

            Log::info('GenerateNoteSummary: completed', [
                'encounter_id' => $encounter->id,
                'status' => $encounter->ai_note_status,
            ]);

        } catch (Throwable $e) {
            // best-effort flip to FAILED
            try {
                $this->updateStatus($encounter, self::STATUS_FAILED);
            } catch (Throwable $ignored) {
                Log::error('GenerateNoteSummary: unable to set FAILED status', [
                    'encounter_id' => $encounter->id ?? $this->modelId,
                    'error' => $ignored->getMessage(),
                ]);
            }

            Log::error('GenerateNoteSummary: failed', [
                'encounter_id' => $encounter->id ?? $this->modelId,
                'error' => $e->getMessage(),
            ]);

            throw $e;
        }
    }

    public function failed(Throwable $e): void
    {
        // Double-ensure FAILED on terminal errors
        try {
            // Prefer modelId for a DB-level update (works even if hydration failed)
            ($this->modelClass)::query()
                ->whereKey($this->modelId)
                ->update(['ai_note_status' => self::STATUS_FAILED]);
        } catch (Throwable $ignored) {
            Log::error('GenerateNoteSummary: permanently failed and could not set status', [
                'encounter_id' => $this->modelId,
                'error' => $ignored->getMessage(),
            ]);
        }

        Log::error('GenerateNoteSummary: permanently failed', [
            'encounter_id' => $this->model?->id ?? $this->modelId, // safe: $model is nullable and initialized
            'error' => $e->getMessage(),
        ]);
    }

    // ---------- Helpers ----------

    /** Resolve Encounter from instance or class+id (safe wrt. nullable $model) */
    private function resolveEncounter(): Encounter
    {
        if ($this->model instanceof Encounter) {
            return $this->model; // Was passed directly and rehydrated by the queue
        }

        $model = ($this->modelClass)::query()->find($this->modelId);
        if (! $model instanceof Encounter) {
            throw new \RuntimeException("Encounter not found (class {$this->modelClass}, id {$this->modelId}).");
        }

        return $model;
    }

    /** Enum-safe status updates with good errors if enum mismatches */
    private function updateStatus(Encounter $encounter, string $status): void
    {
        $allowed = [
            self::STATUS_PENDING,
            self::STATUS_IN_PROGRESS,
            self::STATUS_GENERATED,
            self::STATUS_FAILED,
        ];
        if (! in_array($status, $allowed, true)) {
            throw new \InvalidArgumentException("Invalid ai_note_status: {$status}");
        }

        try {
            $encounter->update(['ai_note_status' => $status]);
        } catch (QueryException $qe) {
            Log::error('Encounter status update failed (enum mismatch?)', [
                'encounter_id' => $encounter->id,
                'status' => $status,
                'error' => $qe->getMessage(),
            ]);
            throw $qe;
        }
    }

    // --------- Prompting & context (unchanged in spirit) ---------

    private function systemPromptFor(string $noteType): string
    {
        $base = 'You are a clinical documentation assistant. Produce accurate, concise, and audit-ready notes. '
              .'Never invent data; if a field is missing, write "[Not documented]". Do not include PHI beyond the given inputs. '
              .'Return plain UTF-8 text with clear section headers only. No markdown, no code fences.';

        $templates = [
            'soap' => ' Required sections (in order): SUBJECTIVE, OBJECTIVE, ASSESSMENT, PLAN.',
            'dap' => ' Required sections (in order): DATA, ASSESSMENT, PLAN.',
            'birp' => ' Required sections (in order): BEHAVIOR, INTERVENTION, RESPONSE, PLAN.',
            'pie' => ' Required sections (in order): PROBLEM, INTERVENTION, EVALUATION.',
            'progress' => ' Required sections (in order): PROGRESS SUMMARY.',
            'discharge' => ' Required sections (in order): REASON FOR DISCHARGE, TREATMENT SUMMARY, RECOMMENDATIONS.',
            'narrative' => ' Required sections (in order): NARRATIVE.',
        ];

        $suffix = $templates[$noteType] ?? $templates['narrative'];

        return $base.$suffix.' Use short paragraphs and clinical tone.';
    }

    private function userPromptFor(array $patientContext, string $noteType, ?string $simpleNote): string
    {
        $ctx = $this->renderPatientContextForPrompt($patientContext);

        $noteTypeLabel = match ($noteType) {
            'soap' => 'SOAP Note', 'dap' => 'DAP Note', 'birp' => 'BIRP Note',
            'pie' => 'PIE Note', 'progress' => 'Progress Note',
            'discharge' => 'Discharge Note', default => 'Narrative Note',
        };

        $simple = trim((string) $simpleNote);
        $simpleBlock = $simple !== '' ? "\n\nRAW CLINICIAN NOTE:\n{$simple}" : '';

        return
"FORMAT TARGET: {$noteTypeLabel}

CONTEXT:
{$ctx}{$simpleBlock}

INSTRUCTIONS:
- Create a {$noteTypeLabel} strictly using the required sections and order from the system message.
- Summarize salient elements from the latest encounter; compare to prior visits when helpful.
- Use only information present in CONTEXT/RAW CLINICIAN NOTE; do not fabricate values.
- For vitals/meds/assessments that are missing, write \"[Not documented]\".
- Keep to 300–600 words unless narrative-only.
- End with a single newline, no extra metadata.";
    }

    private function renderPatientContextForPrompt(array $ctx): string
    {
        if (empty($ctx)) {
            return '[No structured context provided]';
        }

        $p = $ctx['patient_information']['basic_details'] ?? [];
        $lines = [];
        $lines[] = 'PATIENT INFORMATION:';
        $lines[] = 'Name: '.($p['name'] ?? '[Not documented]');
        $lines[] = 'Age: '.($p['age'] ?? '[Not documented]');
        $lines[] = 'Gender: '.($p['gender'] ?? '[Not documented]');
        $lines[] = '';

        $history = $ctx['appointment_history'] ?? [];
        $lines[] = 'APPOINTMENT HISTORY: '.count($history).' item(s)';
        $lines[] = '';

        foreach ($history as $i => $appt) {
            $n = $i + 1;
            $lines[] = "APPOINTMENT #{$n}";
            $lines[] = 'Date: '.($appt['appointment_date'] ?? '[Not documented]');
            $lines[] = 'Service: '.($appt['service'] ?? '[Not documented]');

            $enc = $appt['encounter_details'] ?? [];
            if (! empty($enc)) {
                if (! empty($enc['chief_complaint'])) {
                    $lines[] = 'Chief Complaint: '.$enc['chief_complaint'];
                }
                if (! empty($enc['clinical_assessment'])) {
                    $lines[] = 'Clinical Assessment: '.$enc['clinical_assessment'];
                }
                if (! empty($enc['treatment_plan'])) {
                    $lines[] = 'Treatment Plan: '.$enc['treatment_plan'];
                }

                $v = $enc['vital_signs'] ?? [];
                if (! empty($v)) {
                    $vitals = [];
                    if (! empty($v['blood_pressure'])) {
                        $vitals[] = 'BP '.$v['blood_pressure'];
                    }
                    if (! empty($v['heart_rate'])) {
                        $vitals[] = 'HR '.$v['heart_rate'];
                    }
                    if (! empty($v['temperature'])) {
                        $vitals[] = 'Temp '.$v['temperature'];
                    }
                    if (! empty($v['weight'])) {
                        $vitals[] = 'Weight '.$v['weight'];
                    }
                    if ($vitals) {
                        $lines[] = 'Vitals: '.implode(', ', $vitals);
                    }
                }

                $rxs = $enc['prescriptions'] ?? [];
                if ($rxs) {
                    $rxStr = [];
                    foreach ($rxs as $rx) {
                        $rxStr[] = trim(($rx['medicine_name'] ?? '?').' '.($rx['dosage'] ?? '').' '.($rx['frequency'] ?? ''));
                    }
                    $lines[] = 'Prescriptions: '.implode('; ', array_filter($rxStr));
                }

                $mh = $enc['mental_health_assessment'] ?? [];
                if (! empty($mh)) {
                    if (! empty($mh['mood_affect'])) {
                        $lines[] = 'Mood/Affect: '.$mh['mood_affect'];
                    }
                    if (! empty($mh['risk_assessment'])) {
                        $lines[] = 'Risk Assessment: '.$mh['risk_assessment'];
                    }
                    if (! empty($mh['therapeutic_interventions'])) {
                        $lines[] = 'Interventions: '.$mh['therapeutic_interventions'];
                    }
                }

                $sd = $enc['session_details'] ?? [];
                if (! empty($sd['status'])) {
                    $lines[] = 'Status: '.$sd['status'];
                }
            }

            $lines[] = '';
        }

        return implode("\n", $lines);
    }

    private function buildPatientContext(Encounter $encounter): array
    {
        $patient = $encounter->patient;
        if (! $patient) {
            return [];
        }

        $appointments = $patient->appointments()
            ->latest('scheduled_at')
            ->take(10)
            ->get();

        $appointmentHistory = [];
        foreach ($appointments as $appt) {
            $appointmentHistory[] = [
                'appointment_date' => optional($appt->scheduled_at)->toDateString(),
                'service' => $appt->service_name ?? $appt->service ?? null,
                'encounter_details' => [
                    'chief_complaint' => $appt->chief_complaint ?? null,
                    'clinical_assessment' => $appt->clinical_assessment ?? null,
                    'treatment_plan' => $appt->treatment_plan ?? null,
                    'vital_signs' => [
                        'blood_pressure' => $appt->bp ?? $appt->blood_pressure ?? null,
                        'heart_rate' => $appt->hr ?? $appt->heart_rate ?? null,
                        'temperature' => $appt->temperature ?? null,
                        'weight' => $appt->weight ?? null,
                    ],
                    'prescriptions' => collect($appt->prescriptions ?? [])->map(function ($rx) {
                        return [
                            'medicine_name' => $rx['medicine_name'] ?? null,
                            'dosage' => $rx['dosage'] ?? null,
                            'frequency' => $rx['frequency'] ?? null,
                        ];
                    })->all(),
                    'mental_health_assessment' => [
                        'mood_affect' => $appt->mood_affect ?? null,
                        'risk_assessment' => $appt->risk_assessment ?? null,
                        'therapeutic_interventions' => $appt->therapeutic_interventions ?? null,
                    ],
                    'session_details' => [
                        'status' => $appt->status ?? null,
                    ],
                ],
            ];
        }

        return [
            'patient_information' => [
                'basic_details' => [
                    'name' => $patient->full_name ?? ($patient->name ?? null),
                    'age' => $patient->age ?? null,
                    'gender' => $patient->gender ?? null,
                ],
            ],
            'appointment_history' => $appointmentHistory,
        ];
    }
}
