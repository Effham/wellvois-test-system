<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class EncounterResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'appointment_id' => $this->appointment_id,
            'status' => $this->status,

            // Core fields (encrypted at rest, decrypted on access)
            'chief_complaint' => $this->chief_complaint,
            'history_of_present_illness' => $this->history_of_present_illness,
            'examination_notes' => $this->examination_notes,
            'clinical_assessment' => $this->clinical_assessment,
            'treatment_plan' => $this->treatment_plan,
            'additional_notes' => $this->additional_notes,
            'note_type' => $this->note_type,

            // Vitals
            'blood_pressure_systolic' => $this->blood_pressure_systolic,
            'blood_pressure_diastolic' => $this->blood_pressure_diastolic,
            'heart_rate' => $this->heart_rate,
            'temperature' => $this->temperature,
            'respiratory_rate' => $this->respiratory_rate,
            'oxygen_saturation' => $this->oxygen_saturation,
            'weight' => $this->weight,
            'height' => $this->height,
            'bmi' => $this->bmi,

            // Session meta
            'session_recording' => $this->session_recording,
            'session_started_at' => $this->session_started_at?->format('Y-m-d H:i:s'),
            'session_completed_at' => $this->session_completed_at?->format('Y-m-d H:i:s'),
            'session_duration_seconds' => $this->session_duration_seconds,
            'session_type' => $this->session_type,

            // Mental health
            'mental_state_exam' => $this->mental_state_exam,
            'mood_affect' => $this->mood_affect,
            'thought_process' => $this->thought_process,
            'cognitive_assessment' => $this->cognitive_assessment,
            'risk_assessment' => $this->risk_assessment,
            'therapeutic_interventions' => $this->therapeutic_interventions,
            'session_goals' => $this->session_goals,
            'homework_assignments' => $this->homework_assignments,

            // AI fields
            'ai_summary' => $this->ai_summary,
            'report_sent_to_patient' => (bool) $this->report_sent_to_patient,

            // Relationships
            'prescriptions' => $this->whenLoaded('prescriptions', function () {
                return $this->prescriptions->map(function ($p) {
                    return [
                        'id' => $p->id,
                        'medicine_name' => $p->medicine_name,
                        'dosage' => $p->dosage,
                        'frequency' => $p->frequency,
                        'duration' => $p->duration,
                    ];
                });
            }),
            'document_requests' => $this->whenLoaded('documentRequests', function () {
                return $this->documentRequests->map(function ($r) {
                    return [
                        'id' => $r->id,
                        'document_type' => $r->document_type,
                        'title' => $r->title,
                        'description' => $r->description,
                        'priority' => $r->priority,
                        'by_practitioner' => (bool) $r->by_practitioner,
                        'status' => $r->status,
                    ];
                });
            }),
        ];
    }
}
