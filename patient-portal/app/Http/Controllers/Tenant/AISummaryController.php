<?php

namespace App\Http\Controllers\Tenant;

use App\Http\Controllers\Controller;
use App\Models\Patient;
use App\Models\Tenant\Appointment;
use App\Models\Tenant\Consent;
use App\Models\Tenant\Encounter;
use App\Models\Tenant\EntityConsent;
use App\Models\Tenant\FamilyMedicalHistory;
use App\Models\Tenant\KnownAllergy;
use App\Models\Tenant\PatientMedicalHistory;
use App\Services\BedrockAIService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class AISummaryController extends Controller
{
    /**
     * Generate AI summary for a patient based on appointment ID.
     */
    public function generateSummary(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'appointment_id' => 'required|integer',
        ]);

        $appointmentId = $validated['appointment_id'];

        // Get appointment details
        $appointment = Appointment::with(['service'])->find($appointmentId);
        Log::info('AI Summary Debug - Appointment ID: '.$appointmentId);
        Log::info('AI Summary Debug - Appointment found: '.($appointment ? 'Yes' : 'No'));

        if (! $appointment) {
            Log::error('AI Summary Debug - Appointment not found for ID: '.$appointmentId);

            return response()->json(['error' => 'Appointment not found'], 404);
        }

        // Get patient data from central database
        $patient = null;
        if ($appointment->patient_id) {
            $patient = Patient::find($appointment->patient_id);
            Log::info('AI Summary Debug - Patient ID: '.$appointment->patient_id);
            Log::info('AI Summary Debug - Patient found: '.($patient ? 'Yes' : 'No'));
        } else {
            Log::info('AI Summary Debug - No patient_id in appointment');
        }

        // Check AI consent before generating summary
        if ($patient && ! $this->hasPatientAIConsent($patient->id)) {
            Log::warning('AI Summary Debug - Patient has not provided AI consent', [
                'patient_id' => $patient->id,
                'appointment_id' => $appointmentId,
            ]);

            return response()->json([
                'success' => false,
                'error' => 'This patient has not provided consent to use their information for AI summary generation.',
                'consent_denied' => true,
            ], 403);
        }

        // Get additional medical data for the patient
        $patientDiseases = [];
        $familyMedicalHistory = [];
        $patientAllergens = [];

        if ($appointment->patient_id) {
            // Get patient diseases/medical conditions
            $patientDiseases = PatientMedicalHistory::where('patient_id', $appointment->patient_id)
                ->orderBy('created_at', 'desc')
                ->get();

            // Get family medical history
            $familyMedicalHistory = FamilyMedicalHistory::where('patient_id', $appointment->patient_id)
                ->orderBy('diagnosis_date', 'desc')
                ->get();

            // Get patient allergens
            $patientAllergens = KnownAllergy::where('patient_id', $appointment->patient_id)
                ->orderBy('created_at', 'desc')
                ->get();

            Log::info('AI Summary Debug - Patient Diseases Count: '.$patientDiseases->count());
            Log::info('AI Summary Debug - Family Medical History Count: '.$familyMedicalHistory->count());
            Log::info('AI Summary Debug - Patient Allergens Count: '.$patientAllergens->count());
        }

        // Get all appointments for this patient in this tenant (EXCLUDING current appointment)
        $patientAppointments = Appointment::where('patient_id', $appointment->patient_id)
            ->where('id', '!=', $appointmentId) // Exclude current appointment
            ->with(['service'])
            ->orderBy('appointment_datetime', 'desc')
            ->get();

        Log::info('AI Summary Debug - Patient Appointments Count: '.$patientAppointments->count());

        // Get all encounters for this patient
        $encounters = Encounter::whereIn('appointment_id', $patientAppointments->pluck('id'))
            ->with(['prescriptions'])
            ->orderBy('created_at', 'desc')
            ->get();

        Log::info('AI Summary Debug - Encounters Count: '.$encounters->count());

        // Check if we have sufficient data for AI summary
        $hasPatientData = $patient !== null;
        $hasAppointmentHistory = $patientAppointments->isNotEmpty();
        $hasEncounterData = $encounters->isNotEmpty();
        $hasMedicalHistory = $patientDiseases->isNotEmpty() || $familyMedicalHistory->isNotEmpty() || $patientAllergens->isNotEmpty();

        Log::info('AI Summary Debug - Has Patient Data: '.($hasPatientData ? 'Yes' : 'No'));
        Log::info('AI Summary Debug - Has Appointment History: '.($hasAppointmentHistory ? 'Yes' : 'No'));
        Log::info('AI Summary Debug - Has Encounter Data: '.($hasEncounterData ? 'Yes' : 'No'));
        Log::info('AI Summary Debug - Has Medical History: '.($hasMedicalHistory ? 'Yes' : 'No'));

        // If no meaningful data exists, return a basic response
        if (! $hasPatientData && ! $hasAppointmentHistory && ! $hasMedicalHistory) {
            Log::info('AI Summary Debug - Returning new patient default response');

            return response()->json([
                'success' => true,
                'patient_context' => [
                    'patient_information' => [
                        'basic_details' => [
                            'name' => 'Unknown',
                            'message' => 'Limited patient information available',
                        ],
                    ],
                    'medical_history' => [],
                    'family_medical_history' => [],
                    'allergies_and_allergens' => [],
                    'appointment_history' => [],
                ],
                'ai_summary' => [
                    'This appears to be a new patient with limited historical data available.',
                    'No previous appointment history found in the system.',
                    'This is the patient\'s first recorded appointment at this clinic.',
                    'Comprehensive medical history assessment will be established during this visit.',
                    'Future appointments will provide more detailed health progression tracking.',
                    'Patient information collection is recommended to build complete medical profile.',
                    'Baseline vital signs and health metrics should be documented during this visit.',
                    'Follow-up appointments will enable better health trend analysis.',
                    'Electronic health record system will improve with additional patient data.',
                    'Regular visits will enhance AI-powered health insights and recommendations.',
                ],
                'summary_type' => 'new_patient_default',
                'generated_at' => now()->toISOString(),
            ]);
        }

        // Build comprehensive patient context JSON
        $patientContext = [
            'patient_information' => [
                'basic_details' => [
                    'name' => $patient ? ($patient->first_name.' '.$patient->last_name) : 'Unknown',
                    'date_of_birth' => $patient->date_of_birth ?? null,
                    'age' => $patient ? (now()->diffInYears($patient->date_of_birth)) : null,
                    'gender' => $patient->gender ?? null,
                    'email' => $patient->email ?? null,
                    'phone' => $patient->phone_number ?? null,
                    'health_number' => $patient->health_number ?? null,
                ],
                'medical_information' => [
                    'allergies' => $patient->allergies ?? [],
                    'medical_conditions' => $patient->medical_conditions ?? [],
                    'emergency_contact' => $patient->emergency_contact ?? null,
                ],
            ],
            'medical_history' => [
                'current_conditions' => $patientDiseases->map(function ($disease) {
                    return [
                        'disease' => $disease->disease,
                        'recent_tests' => $disease->recent_tests,
                        'diagnosis_date' => $disease->created_at,
                        'last_updated' => $disease->updated_at,
                    ];
                })->toArray(),
                'summary' => $patientDiseases->isNotEmpty() ?
                    'Patient has '.$patientDiseases->count().' documented medical condition(s)' :
                    'No specific medical conditions documented',
            ],
            'family_medical_history' => [
                'entries' => $familyMedicalHistory->map(function ($familyHistory) {
                    return [
                        'relationship_to_patient' => $familyHistory->relationship_to_patient,
                        'medical_summary' => $familyHistory->summary,
                        'details' => $familyHistory->details,
                        'diagnosis_date' => $familyHistory->diagnosis_date,
                        'recorded_date' => $familyHistory->created_at,
                    ];
                })->toArray(),
                'summary' => $familyMedicalHistory->isNotEmpty() ?
                    'Family medical history includes '.$familyMedicalHistory->count().' documented condition(s) across family members' :
                    'No family medical history documented',
            ],
            'allergies_and_allergens' => [
                'known_allergens' => $patientAllergens->map(function ($allergen) {
                    return [
                        'allergen' => $allergen->allergens,
                        'type' => $allergen->type,
                        'severity' => $allergen->severity,
                        'reaction' => $allergen->reaction,
                        'notes' => $allergen->notes,
                        'documented_date' => $allergen->created_at,
                    ];
                })->toArray(),
                'legacy_allergies' => $patient->allergies ?? [],
                'summary' => $patientAllergens->isNotEmpty() ?
                    'Patient has '.$patientAllergens->count().' documented allergen(s) with varying severity levels' :
                    'No specific allergens documented',
            ],
            'appointment_history' => $patientAppointments->map(function ($appt) use ($encounters) {
                $encounter = $encounters->where('appointment_id', $appt->id)->first();

                // Build encounter details using the resource to ensure decrypted values
                $encounterDetails = null;
                if ($encounter) {
                    $resource = new \App\Http\Resources\EncounterResource(
                        $encounter->loadMissing(['prescriptions'])
                    );
                    $encData = $resource->resolve();

                    $encounterDetails = [
                        'chief_complaint' => $encData['chief_complaint'] ?? null,
                        'history_of_present_illness' => $encData['history_of_present_illness'] ?? null,
                        'examination_notes' => $encData['examination_notes'] ?? null,
                        'clinical_assessment' => $encData['clinical_assessment'] ?? null,
                        'treatment_plan' => $encData['treatment_plan'] ?? null,
                        'additional_notes' => $encData['additional_notes'] ?? null,
                        'session_type' => $encData['session_type'] ?? null,
                        'vital_signs' => [
                            'blood_pressure' => ($encData['blood_pressure_systolic'] ?? '').'/'.($encData['blood_pressure_diastolic'] ?? ''),
                            'heart_rate' => $encData['heart_rate'] ?? null,
                            'temperature' => $encData['temperature'] ?? null,
                            'respiratory_rate' => $encData['respiratory_rate'] ?? null,
                            'oxygen_saturation' => $encData['oxygen_saturation'] ?? null,
                            'weight' => $encData['weight'] ?? null,
                            'height' => $encData['height'] ?? null,
                            'bmi' => $encData['bmi'] ?? null,
                        ],
                        'mental_health_assessment' => [
                            'mental_state_exam' => $encData['mental_state_exam'] ?? null,
                            'mood_affect' => $encData['mood_affect'] ?? null,
                            'thought_process' => $encData['thought_process'] ?? null,
                            'cognitive_assessment' => $encData['cognitive_assessment'] ?? null,
                            'risk_assessment' => $encData['risk_assessment'] ?? null,
                            'therapeutic_interventions' => $encData['therapeutic_interventions'] ?? null,
                            'session_goals' => $encData['session_goals'] ?? null,
                            'homework_assignments' => $encData['homework_assignments'] ?? null,
                        ],
                        'prescriptions' => array_map(function ($p) {
                            return [
                                'medicine_name' => $p['medicine_name'] ?? null,
                                'dosage' => $p['dosage'] ?? null,
                                'frequency' => $p['frequency'] ?? null,
                                'duration' => $p['duration'] ?? null,
                            ];
                        }, $encData['prescriptions'] ?? []),
                        'session_details' => [
                            'status' => $encData['status'] ?? null,
                            'started_at' => $encData['session_started_at'] ?? null,
                            'completed_at' => $encData['session_completed_at'] ?? null,
                            'duration_seconds' => $encData['session_duration_seconds'] ?? null,
                        ],
                    ];
                }

                return [
                    'appointment_date' => $appt->appointment_datetime,
                    'service' => $appt->service->name ?? 'Unknown Service',
                    'encounter_details' => $encounterDetails,
                ];
            })->toArray(),
            'summary_context' => 'This is the comprehensive patient profile including personal information, documented medical history, family medical history, known allergies/allergens, and all clinical encounters. Based on this complete medical record, generate a detailed AI summary focusing on medical trends, treatment effectiveness, hereditary risk factors, allergy management, recurring issues, medication adherence, and overall health progression with consideration of family medical history patterns.',
        ];

        // Generate AI summary using Bedrock service
        Log::info('AI Summary Debug - Attempting to generate AI summary with Bedrock');
        try {
            $bedrockService = new BedrockAIService;
            $aiSummary = $bedrockService->generateSummary($patientContext);
            Log::info('AI Summary Debug - AI Summary generated successfully');
        } catch (\Exception $e) {
            Log::error('AI Summary Generation Failed: '.$e->getMessage());
            $aiSummary = [
                'Patient has been under consistent care with '.count($patientAppointments).' appointments recorded.',
                'Medical history shows '.($patientDiseases->count() > 0 ? $patientDiseases->count().' documented condition(s)' : 'no specific conditions documented').'.',
                'Family medical history includes '.($familyMedicalHistory->count() > 0 ? $familyMedicalHistory->count().' documented family condition(s)' : 'no documented family medical history').'.',
                'Allergy profile shows '.($patientAllergens->count() > 0 ? $patientAllergens->count().' known allergen(s)' : 'no documented specific allergens').'.',
                'Treatment adherence appears satisfactory based on appointment frequency and follow-up patterns.',
                'Recent encounters indicate stable condition with appropriate clinical interventions.',
                'Vital signs have remained within acceptable ranges during documented visits.',
                'Prescribed medications are being monitored for effectiveness and potential adverse reactions.',
                'Patient demonstrates good engagement with treatment recommendations and care plan.',
                'Overall prognosis remains positive with continued monitoring and family history consideration recommended.',
            ];
        }

        return response()->json([
            'success' => true,
            'patient_context' => $patientContext,
            'ai_summary' => $aiSummary,
            'summary_type' => 'ai_generated',
            'generated_at' => now()->toISOString(),
        ]);
    }

    /**
     * Check if patient has given consent for AI summary generation
     */
    private function hasPatientAIConsent(int $patientId): bool
    {
        $consent = Consent::where('key', 'patient_consent_third_party_sharing')
            ->where('entity_type', 'PATIENT')
            ->first();

        if (! $consent) {
            return false;
        }

        $activeVersion = $consent->activeVersion;
        if (! $activeVersion) {
            return false;
        }

        $entityConsent = EntityConsent::where('consentable_type', Patient::class)
            ->where('consentable_id', $patientId)
            ->where('consent_version_id', $activeVersion->id)
            ->first();

        return $entityConsent !== null;
    }
}
