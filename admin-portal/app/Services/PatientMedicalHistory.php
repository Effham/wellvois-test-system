<?php

namespace App\Services;

use App\Models\Tenant\FamilyMedicalHistory;
use App\Models\Tenant\KnownAllergy;
use App\Models\Tenant\Patient;
use App\Models\Tenant\PatientMedicalHistory as PatientMedicalHistoryModel;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class PatientMedicalHistory
{
    /**
     * Get all medical history data for a patient
     */
    public function getPatientMedicalData(int $patientId): array
    {
        try {
            $patient = Patient::findOrFail($patientId);

            return [
                'patient' => $patient,
                'family_medical_histories' => $this->getFamilyMedicalHistories($patientId),
                'patient_medical_histories' => $this->getPatientMedicalHistories($patientId),
                'known_allergies' => $this->getKnownAllergies($patientId),
            ];
        } catch (\Exception $e) {
            Log::error('Error fetching patient medical data', [
                'patient_id' => $patientId,
                'error' => $e->getMessage(),
            ]);

            return [
                'patient' => null,
                'family_medical_histories' => collect(),
                'patient_medical_histories' => collect(),
                'known_allergies' => collect(),
                'error' => 'Unable to fetch medical data',
            ];
        }
    }

    /**
     * Get family medical histories for a patient
     */
    public function getFamilyMedicalHistories(int $patientId): Collection
    {
        return FamilyMedicalHistory::where('patient_id', $patientId)
            ->orderBy('relationship_to_patient')
            ->orderBy('created_at', 'desc')
            ->get();
    }

    /**
     * Get patient medical histories
     */
    public function getPatientMedicalHistories(int $patientId): Collection
    {
        return PatientMedicalHistoryModel::where('patient_id', $patientId)
            ->orderBy('created_at', 'desc')
            ->get();
    }

    /**
     * Get known allergies for a patient
     */
    public function getKnownAllergies(int $patientId): Collection
    {
        return KnownAllergy::where('patient_id', $patientId)
            ->orderBy('severity')
            ->orderBy('created_at', 'desc')
            ->get();
    }

    /**
     * Create or update family medical histories
     */
    public function saveFamilyMedicalHistories(int $patientId, array $histories): array
    {
        Log::info('PatientMedicalHistory: Starting saveFamilyMedicalHistories', [
            'patient_id' => $patientId,
            'histories_count' => count($histories),
            'histories_data' => $histories,
        ]);

        DB::beginTransaction();

        try {
            // Delete existing records
            $deletedCount = FamilyMedicalHistory::where('patient_id', $patientId)->delete();
            Log::info('PatientMedicalHistory: Deleted existing family medical histories', [
                'patient_id' => $patientId,
                'deleted_count' => $deletedCount,
            ]);

            $savedHistories = [];

            foreach ($histories as $index => $history) {
                if (empty($history['relationship_to_patient']) || empty($history['summary'])) {
                    Log::warning('PatientMedicalHistory: Skipping incomplete family history entry', [
                        'patient_id' => $patientId,
                        'index' => $index,
                        'entry' => $history,
                    ]);

                    continue; // Skip incomplete entries
                }

                $savedHistory = FamilyMedicalHistory::create([
                    'patient_id' => $patientId,
                    'relationship_to_patient' => $history['relationship_to_patient'],
                    'summary' => $history['summary'],
                    'details' => $history['details'] ?? null,
                    'diagnosis_date' => ! empty($history['diagnosis_date']) ? $history['diagnosis_date'] : null,
                ]);

                Log::info('PatientMedicalHistory: Created family medical history', [
                    'patient_id' => $patientId,
                    'history_id' => $savedHistory->id,
                    'relationship' => $savedHistory->relationship_to_patient,
                ]);

                $savedHistories[] = $savedHistory;
            }

            DB::commit();

            Log::info('PatientMedicalHistory: Successfully saved family medical histories', [
                'patient_id' => $patientId,
                'saved_count' => count($savedHistories),
            ]);

            return [
                'success' => true,
                'data' => $savedHistories,
                'message' => 'Family medical histories saved successfully',
            ];

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('PatientMedicalHistory: Error saving family medical histories', [
                'patient_id' => $patientId,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return [
                'success' => false,
                'error' => 'Failed to save family medical histories: '.$e->getMessage(),
            ];
        }
    }

    /**
     * Create or update patient medical histories
     */
    public function savePatientMedicalHistories(int $patientId, array $histories): array
    {
        DB::beginTransaction();

        try {
            // Delete existing records
            PatientMedicalHistoryModel::where('patient_id', $patientId)->delete();

            $savedHistories = [];

            foreach ($histories as $history) {
                if (empty($history['disease'])) {
                    continue; // Skip incomplete entries
                }

                $savedHistory = PatientMedicalHistoryModel::create([
                    'patient_id' => $patientId,
                    'disease' => $history['disease'],
                    'recent_tests' => $history['recent_tests'] ?? null,
                ]);

                $savedHistories[] = $savedHistory;
            }

            DB::commit();

            return [
                'success' => true,
                'data' => $savedHistories,
                'message' => 'Patient medical histories saved successfully',
            ];

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Error saving patient medical histories', [
                'patient_id' => $patientId,
                'error' => $e->getMessage(),
            ]);

            return [
                'success' => false,
                'error' => 'Failed to save patient medical histories',
            ];
        }
    }

    /**
     * Create or update known allergies
     */
    public function saveKnownAllergies(int $patientId, array $allergies): array
    {
        DB::beginTransaction();

        try {
            // Delete existing records
            KnownAllergy::where('patient_id', $patientId)->delete();

            $savedAllergies = [];

            foreach ($allergies as $allergy) {
                if (empty($allergy['allergens']) || empty($allergy['type']) || empty($allergy['severity'])) {
                    continue; // Skip incomplete entries
                }

                $savedAllergy = KnownAllergy::create([
                    'patient_id' => $patientId,
                    'allergens' => $allergy['allergens'],
                    'type' => $allergy['type'],
                    'severity' => $allergy['severity'],
                    'reaction' => $allergy['reaction'] ?? null,
                    'notes' => $allergy['notes'] ?? null,
                ]);

                $savedAllergies[] = $savedAllergy;
            }

            DB::commit();

            return [
                'success' => true,
                'data' => $savedAllergies,
                'message' => 'Known allergies saved successfully',
            ];

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Error saving known allergies', [
                'patient_id' => $patientId,
                'error' => $e->getMessage(),
            ]);

            return [
                'success' => false,
                'error' => 'Failed to save known allergies',
            ];
        }
    }

    /**
     * Save all medical history data at once (used for intake)
     */
    public function saveAllMedicalHistories(int $patientId, array $data): array
    {
        DB::beginTransaction();

        try {
            $results = [];

            // Save family medical histories
            if (isset($data['family_medical_histories'])) {
                $familyResult = $this->saveFamilyMedicalHistories($patientId, $data['family_medical_histories']);
                $results['family_medical_histories'] = $familyResult;
            }

            // Save patient medical histories
            if (isset($data['patient_medical_histories'])) {
                $patientResult = $this->savePatientMedicalHistories($patientId, $data['patient_medical_histories']);
                $results['patient_medical_histories'] = $patientResult;
            }

            // Save known allergies
            if (isset($data['known_allergies'])) {
                $allergyResult = $this->saveKnownAllergies($patientId, $data['known_allergies']);
                $results['known_allergies'] = $allergyResult;
            }

            DB::commit();

            return [
                'success' => true,
                'results' => $results,
                'message' => 'All medical histories saved successfully',
            ];

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Error saving all medical histories', [
                'patient_id' => $patientId,
                'error' => $e->getMessage(),
            ]);

            return [
                'success' => false,
                'error' => 'Failed to save medical histories',
            ];
        }
    }

    /**
     * Check if patient has any medical history data
     */
    public function hasAnyMedicalHistory(int $patientId): bool
    {
        return FamilyMedicalHistory::where('patient_id', $patientId)->exists() ||
               PatientMedicalHistoryModel::where('patient_id', $patientId)->exists() ||
               KnownAllergy::where('patient_id', $patientId)->exists();
    }

    /**
     * Get medical history summary for dashboard
     */
    public function getMedicalHistorySummary(int $patientId): array
    {
        return [
            'family_histories_count' => FamilyMedicalHistory::where('patient_id', $patientId)->count(),
            'patient_histories_count' => PatientMedicalHistoryModel::where('patient_id', $patientId)->count(),
            'allergies_count' => KnownAllergy::where('patient_id', $patientId)->count(),
            'has_severe_allergies' => KnownAllergy::where('patient_id', $patientId)
                ->where('severity', 'severe')
                ->exists(),
        ];
    }

    /**
     * Delete a specific family medical history record
     */
    public function deleteFamilyMedicalHistory(int $patientId, int $historyId): bool
    {
        try {
            return FamilyMedicalHistory::where('patient_id', $patientId)
                ->where('id', $historyId)
                ->delete() > 0;
        } catch (\Exception $e) {
            Log::error('Error deleting family medical history', [
                'patient_id' => $patientId,
                'history_id' => $historyId,
                'error' => $e->getMessage(),
            ]);

            return false;
        }
    }

    /**
     * Delete a specific patient medical history record
     */
    public function deletePatientMedicalHistory(int $patientId, int $historyId): bool
    {
        try {
            return PatientMedicalHistoryModel::where('patient_id', $patientId)
                ->where('id', $historyId)
                ->delete() > 0;
        } catch (\Exception $e) {
            Log::error('Error deleting patient medical history', [
                'patient_id' => $patientId,
                'history_id' => $historyId,
                'error' => $e->getMessage(),
            ]);

            return false;
        }
    }

    /**
     * Delete a specific known allergy record
     */
    public function deleteKnownAllergy(int $patientId, int $allergyId): bool
    {
        try {
            return KnownAllergy::where('patient_id', $patientId)
                ->where('id', $allergyId)
                ->delete() > 0;
        } catch (\Exception $e) {
            Log::error('Error deleting known allergy', [
                'patient_id' => $patientId,
                'allergy_id' => $allergyId,
                'error' => $e->getMessage(),
            ]);

            return false;
        }
    }
}
