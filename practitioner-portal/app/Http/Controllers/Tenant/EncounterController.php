<?php

namespace App\Http\Controllers\Tenant;

use App\Http\Controllers\Controller;
use App\Jobs\GenerateNoteSummary;
use App\Jobs\TranscribeRecording;
use App\Mail\Tenant\SessionRecordingConsentMail;
use App\Models\Tenant\Appointment;
use App\Models\Tenant\Consent;
use App\Models\Tenant\Encounter;
use App\Models\Tenant\EncounterRecording;
use App\Models\Tenant\EntityConsent;
use App\Models\Tenant\Patient;
use App\Services\BedrockAIService;
use App\Services\S3StorageService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;

class EncounterController extends Controller
{
    /**
     * Save or update an encounter session.
     */
    public function save(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'appointment_id' => 'required|integer',
            'chief_complaint' => 'nullable|string',
            'history_of_present_illness' => 'nullable|string',
            'examination_notes' => 'nullable|string',
            'clinical_assessment' => 'nullable|string',
            'treatment_plan' => 'nullable|string',
            'additional_notes' => 'nullable|string',
            'note_type' => 'nullable|string',

            'blood_pressure_systolic' => 'nullable|string',
            'blood_pressure_diastolic' => 'nullable|string',
            'heart_rate' => 'nullable|string',
            'temperature' => 'nullable|string',
            'respiratory_rate' => 'nullable|string',
            'oxygen_saturation' => 'nullable|string',
            'weight' => 'nullable|string',
            'height' => 'nullable|string',
            'bmi' => 'nullable|string',
            'session_recording' => 'nullable|string',
            'session_duration_seconds' => 'nullable|integer',
            'session_type' => 'nullable|string',
            // Mental health fields
            'mental_state_exam' => 'nullable|string',
            'mood_affect' => 'nullable|string',
            'thought_process' => 'nullable|string',
            'cognitive_assessment' => 'nullable|string',
            'risk_assessment' => 'nullable|string',
            'therapeutic_interventions' => 'nullable|string',
            'session_goals' => 'nullable|string',
            'homework_assignments' => 'nullable|string',
            'prescriptions' => 'nullable|array',
            'prescriptions.*.medicine_name' => 'required_with:prescriptions|string',
            'prescriptions.*.dosage' => 'nullable|string',
            'prescriptions.*.frequency' => 'nullable|string',
            'prescriptions.*.duration' => 'nullable|string',
            'document_requests' => 'nullable|array',
            'document_requests.*.document_type' => 'required_with:document_requests|string',
            'document_requests.*.title' => 'required_with:document_requests|string',
            'document_requests.*.description' => 'nullable|string',
            'document_requests.*.priority' => 'nullable|string|in:low,normal,high,urgent',
            'document_requests.*.by_practitioner' => 'nullable|boolean',
        ]);

        // Log received document requests for debugging
        Log::info('📥 BACKEND: Received document_requests', [
            'document_requests' => $validated['document_requests'] ?? [],
        ]);

        // Create or update encounter
        $encounter = Encounter::updateOrCreate(
            ['appointment_id' => $validated['appointment_id']],
            array_merge($validated, [
                'session_started_at' => $validated['session_started_at'] ?? now(),
            ])
        );

        // Only dispatch AI summary generation if note_type is provided
        if (! empty($validated['note_type'])) {
            GenerateNoteSummary::dispatch(
                \App\Models\Tenant\Encounter::class,
                $encounter->id,
                noteType: $validated['note_type'],
                simpleNote: $validated['additional_notes'] ?? null
            );
        }
        // Handle prescriptions
        if (isset($validated['prescriptions'])) {
            // Delete existing prescriptions
            $encounter->prescriptions()->delete();

            // Add new prescriptions
            foreach ($validated['prescriptions'] as $prescription) {
                if (! empty($prescription['medicine_name'])) {
                    $encounter->prescriptions()->create([
                        'medicine_name' => $prescription['medicine_name'],
                        'dosage' => $prescription['dosage'] ?? null,
                        'frequency' => $prescription['frequency'] ?? null,
                        'duration' => $prescription['duration'] ?? null,
                    ]);
                }
            }
        }

        // Handle document requests
        if (isset($validated['document_requests'])) {
            // Delete existing document requests that are still pending
            $encounter->documentRequests()->where('status', 'pending')->delete();

            // Add new document requests
            foreach ($validated['document_requests'] as $request) {
                if (! empty($request['document_type']) && ! empty($request['title'])) {
                    $encounter->documentRequests()->create([
                        'document_type' => $request['document_type'],
                        'title' => $request['title'],
                        'description' => $request['description'] ?? null,
                        'priority' => $request['priority'] ?? 'normal',
                        'by_practitioner' => $request['by_practitioner'] ?? false,
                        'requested_by_id' => Auth::id(),
                        'requested_at' => now(),
                        'status' => 'pending',
                    ]);
                }
            }

            // Log saved document requests for debugging
            Log::info('💾 BACKEND: Saved document_requests', [
                'count' => $encounter->documentRequests()->count(),
                'requests' => $encounter->documentRequests()->get()->map(function ($req) {
                    return [
                        'id' => $req->id,
                        'title' => $req->title,
                        'by_practitioner' => $req->by_practitioner,
                        'priority' => $req->priority,
                    ];
                }),
            ]);
        }

        // Load fresh encounter with relationships
        $encounter = $encounter->fresh([
            'prescriptions:id,encounter_id,medicine_name,dosage,frequency,duration',
            'documentRequests:id,encounter_id,document_type,title,description,status,priority,by_practitioner',
        ]);

        return response()->json([
            'success' => true,
            'encounter' => new \App\Http\Resources\EncounterResource($encounter),
            'message' => $encounter->wasRecentlyCreated ? 'Session saved successfully' : 'Session updated successfully',
        ]);
    }

    /**
     * Finish and complete an encounter session.
     */
    public function finish(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'encounter_id' => 'required|integer',
        ]);

        $encounter = Encounter::with([
            'prescriptions:id,encounter_id,medicine_name,dosage',
            'appointment.service:id,name',
        ])->findOrFail($validated['encounter_id']);

        // Generate AI summary based on encounter details
        $aiSummary = $this->generateEncounterAISummary($encounter);

        // Mark encounter as completed and store AI summary
        $encounter->update([
            'status' => 'completed',
            'session_completed_at' => now(),
            'ai_summary' => $aiSummary,
        ]);

        // Complete the appointment and create practitioner transactions
        $appointment = $encounter->appointment;
        $transactions = $appointment->markAsCompleted();

        return response()->json([
            'success' => true,
            'message' => 'Session completed successfully',
            'ai_summary_generated' => ! empty($aiSummary),
            'transactions_created' => count($transactions),
            'practitioner_payments_processed' => count($transactions) > 0,
        ]);
    }

    /**
     * Generate AI summary for a completed encounter.
     */
    private function generateEncounterAISummary(Encounter $encounter): ?string
    {
        try {
            // Create custom prompt based on encounter details
            $customPrompt = $this->buildEncounterPrompt($encounter);

            // System prompt for professional practitioner perspective
            $systemPrompt = 'You are a professional healthcare practitioner writing a comprehensive summary of a patient encounter. Your summary should be clinical, accurate, and provide valuable insights for continuity of care. Focus on key findings, assessments, treatments provided, and recommendations for follow-up care. Write in a professional medical tone suitable for medical records.';

            // Generate AI summary using Bedrock service
            $bedrockService = new BedrockAIService;
            $summaryBulletPoints = $bedrockService->generateSummary(null, $customPrompt, $systemPrompt);

            // Convert bullet points array to formatted string
            if (! empty($summaryBulletPoints)) {
                return implode("\n\n", array_map(function ($point) {
                    return '• '.$point;
                }, $summaryBulletPoints));
            }

            return null;

        } catch (\Exception $e) {
            Log::error('Encounter AI Summary Generation Failed', [
                'encounter_id' => $encounter->id,
                'error' => $e->getMessage(),
            ]);

            return null;
        }
    }

    /**
     * Build custom prompt based on encounter details.
     */
    private function buildEncounterPrompt(Encounter $encounter): string
    {
        $prompt = "Generate a comprehensive AI summary of the following patient encounter:\n\n";

        // Basic encounter information
        $prompt .= "ENCOUNTER DETAILS:\n";
        $prompt .= 'Date: '.($encounter->session_started_at ? $encounter->session_started_at->format('Y-m-d H:i:s') : 'Not recorded')."\n";
        $prompt .= 'Service: '.($encounter->appointment->service->name ?? 'Unknown Service')."\n";
        $prompt .= 'Session Type: '.($encounter->session_type ?? 'Standard Consultation')."\n";

        if ($encounter->session_duration_seconds) {
            $duration = gmdate('H:i:s', $encounter->session_duration_seconds);
            $prompt .= 'Session Duration: '.$duration."\n";
        }

        $prompt .= "\n";

        // Clinical information
        if ($encounter->chief_complaint) {
            $prompt .= "CHIEF COMPLAINT:\n".$encounter->chief_complaint."\n\n";
        }

        if ($encounter->history_of_present_illness) {
            $prompt .= "HISTORY OF PRESENT ILLNESS:\n".$encounter->history_of_present_illness."\n\n";
        }

        if ($encounter->examination_notes) {
            $prompt .= "EXAMINATION NOTES:\n".$encounter->examination_notes."\n\n";
        }

        if ($encounter->clinical_assessment) {
            $prompt .= "CLINICAL ASSESSMENT:\n".$encounter->clinical_assessment."\n\n";
        }

        if ($encounter->treatment_plan) {
            $prompt .= "TREATMENT PLAN:\n".$encounter->treatment_plan."\n\n";
        }

        // Vital signs
        $vitalSigns = [];
        if ($encounter->blood_pressure_systolic && $encounter->blood_pressure_diastolic) {
            $vitalSigns[] = 'Blood Pressure: '.$encounter->blood_pressure_systolic.'/'.$encounter->blood_pressure_diastolic.' mmHg';
        }
        if ($encounter->heart_rate) {
            $vitalSigns[] = 'Heart Rate: '.$encounter->heart_rate.' bpm';
        }
        if ($encounter->temperature) {
            $vitalSigns[] = 'Temperature: '.$encounter->temperature;
        }
        if ($encounter->respiratory_rate) {
            $vitalSigns[] = 'Respiratory Rate: '.$encounter->respiratory_rate.' breaths/min';
        }
        if ($encounter->oxygen_saturation) {
            $vitalSigns[] = 'Oxygen Saturation: '.$encounter->oxygen_saturation.'%';
        }
        if ($encounter->weight) {
            $vitalSigns[] = 'Weight: '.$encounter->weight;
        }
        if ($encounter->height) {
            $vitalSigns[] = 'Height: '.$encounter->height;
        }
        if ($encounter->bmi) {
            $vitalSigns[] = 'BMI: '.$encounter->bmi;
        }

        if (! empty($vitalSigns)) {
            $prompt .= "VITAL SIGNS:\n".implode("\n", $vitalSigns)."\n\n";
        }

        // Mental health assessment (if applicable)
        $mentalHealthFields = [];
        if ($encounter->mental_state_exam) {
            $mentalHealthFields[] = 'Mental State Exam: '.$encounter->mental_state_exam;
        }
        if ($encounter->mood_affect) {
            $mentalHealthFields[] = 'Mood/Affect: '.$encounter->mood_affect;
        }
        if ($encounter->thought_process) {
            $mentalHealthFields[] = 'Thought Process: '.$encounter->thought_process;
        }
        if ($encounter->cognitive_assessment) {
            $mentalHealthFields[] = 'Cognitive Assessment: '.$encounter->cognitive_assessment;
        }
        if ($encounter->risk_assessment) {
            $mentalHealthFields[] = 'Risk Assessment: '.$encounter->risk_assessment;
        }
        if ($encounter->therapeutic_interventions) {
            $mentalHealthFields[] = 'Therapeutic Interventions: '.$encounter->therapeutic_interventions;
        }
        if ($encounter->session_goals) {
            $mentalHealthFields[] = 'Session Goals: '.$encounter->session_goals;
        }
        if ($encounter->homework_assignments) {
            $mentalHealthFields[] = 'Homework Assignments: '.$encounter->homework_assignments;
        }

        if (! empty($mentalHealthFields)) {
            $prompt .= "MENTAL HEALTH ASSESSMENT:\n".implode("\n", $mentalHealthFields)."\n\n";
        }

        // Prescriptions
        if ($encounter->prescriptions && $encounter->prescriptions->count() > 0) {
            $prompt .= "PRESCRIPTIONS:\n";
            foreach ($encounter->prescriptions as $prescription) {
                $prompt .= '• '.$prescription->medicine_name;
                if ($prescription->dosage) {
                    $prompt .= ' - '.$prescription->dosage;
                }
                if ($prescription->frequency) {
                    $prompt .= ' ('.$prescription->frequency.')';
                }
                if ($prescription->duration) {
                    $prompt .= ' for '.$prescription->duration;
                }
                $prompt .= "\n";
            }
            $prompt .= "\n";
        }

        // Additional notes
        if ($encounter->additional_notes) {
            $prompt .= "ADDITIONAL NOTES:\n".$encounter->additional_notes."\n\n";
        }

        // Instructions for AI summary
        $prompt .= "Based on this encounter information, please provide a comprehensive professional summary that includes:\n";
        $prompt .= "• Key clinical findings and assessments\n";
        $prompt .= "• Treatment interventions provided\n";
        $prompt .= "• Patient response and condition status\n";
        $prompt .= "• Medications prescribed and rationale\n";
        $prompt .= "• Follow-up recommendations\n";
        $prompt .= "• Any concerns or areas requiring monitoring\n";
        $prompt .= "• Overall encounter outcome and next steps\n\n";
        $prompt .= 'Write this as a professional medical summary suitable for healthcare documentation and continuity of care.';

        return $prompt;
    }

    /**
     * Request recording consent from patient.
     */
    public function requestRecordingConsent(Request $request): JsonResponse
    {
        $request->validate([
            'appointment_id' => 'required|exists:appointments,id',
            'patient_id' => 'required|integer',
        ]);

        $appointment = Appointment::findOrFail($request->appointment_id);
        $patient = Patient::find($request->patient_id);
        $tenant = tenant();

        // Check if patient already has recording consent
        $consent = Consent::where('key', 'patient_consent_session_recording')
            ->with('activeVersion')
            ->first();

        if (! $consent || ! $consent->activeVersion) {
            return response()->json([
                'success' => false,
                'message' => 'Recording consent not configured',
            ], 500);
        }

        $hasConsent = EntityConsent::where('consent_version_id', $consent->activeVersion->id)
            ->where('consentable_type', Patient::class)
            ->where('consentable_id', $patient->id)
            ->exists();

        if ($hasConsent) {
            return response()->json([
                'success' => true,
                'message' => 'Patient already has recording consent',
            ]);
        }

        // Generate consent token
        $token = base64_encode($patient->id.'|'.$tenant->id.'|'.time().'|recording');
        $consentUrl = url("/consents/show/{$token}?patient_id={$patient->id}&type=recording");

        // Send email
        Mail::to($patient->email)->send(
            new SessionRecordingConsentMail($patient, $tenant, $consentUrl, $appointment->id)
        );

        return response()->json([
            'success' => true,
            'message' => 'Recording consent request sent to patient',
        ]);
    }

    /**
     * Check if patient has recording consent.
     */
    public function checkRecordingConsent(Request $request, $appointmentId): JsonResponse
    {
        $appointment = Appointment::findOrFail($appointmentId);
        $patient = Patient::find($appointment->patient_id);

        $consent = Consent::where('key', 'patient_consent_session_recording')
            ->with('activeVersion')
            ->first();

        if (! $consent || ! $consent->activeVersion) {
            return response()->json(['hasConsent' => false]);
        }

        $hasConsent = EntityConsent::where('consent_version_id', $consent->activeVersion->id)
            ->where('consentable_type', Patient::class)
            ->where('consentable_id', $patient->id)
            ->exists();

        return response()->json(['hasConsent' => $hasConsent]);
    }

    /**
     * Save recording audio file.
     */
    public function saveRecording(Request $request): JsonResponse
    {
        $request->validate([
            'appointment_id' => 'required|exists:appointments,id',
            'audio' => 'required|file|mimes:webm,mp3,wav|max:102400', // 100MB max
            'duration_seconds' => 'nullable|integer|min:0',
        ]);

        $appointment = Appointment::findOrFail($request->appointment_id);
        $tenant = tenant();

        // Get or create encounter for this appointment
        $encounter = Encounter::firstOrCreate(
            ['appointment_id' => $appointment->id],
            ['status' => 'in_progress']
        );

        try {
            // Upload to S3 using S3StorageService
            $s3Service = new S3StorageService;
            $uploadResult = $s3Service->uploadFile(
                $request->file('audio'),
                'encounter_recordings',
                [
                    'tenant_id' => $tenant->id,
                    'entity_id' => $encounter->id,
                    'custom_path' => "encounters/{$encounter->id}/recordings/".time().'_'.$request->file('audio')->getClientOriginalName(),
                    'visibility' => 'private',
                    'encrypt' => true,
                    'max_size' => 102400, // 100MB in KB
                ]
            );

            if (! $uploadResult['success']) {
                Log::error('Failed to upload recording to S3', [
                    'appointment_id' => $appointment->id,
                    'encounter_id' => $encounter->id,
                    'error' => $uploadResult['error'] ?? 'Unknown error',
                ]);

                return response()->json([
                    'success' => false,
                    'message' => 'Failed to upload recording to S3',
                    'error' => $uploadResult['error'] ?? 'Unknown error',
                ], 500);
            }

            // Save recording record to database
            $recording = EncounterRecording::create([
                'encounter_id' => $encounter->id,
                's3_key' => $uploadResult['file_path'],
                'file_name' => $request->file('audio')->getClientOriginalName(),
                'mime_type' => $request->file('audio')->getMimeType(),
                'file_size' => $request->file('audio')->getSize(),
                'duration_seconds' => $request->input('duration_seconds'),
                'metadata' => [
                    'original_name' => $request->file('audio')->getClientOriginalName(),
                    'uploaded_at' => now()->toISOString(),
                    'uploaded_by' => Auth::id(),
                ],
            ]);

            Log::info('Recording saved successfully', [
                'recording_id' => $recording->id,
                'encounter_id' => $encounter->id,
                'appointment_id' => $appointment->id,
                's3_key' => $uploadResult['file_path'],
            ]);

            // Automatically start transcription after saving
            $transcriptionStarted = $this->startTranscriptionForRecording($recording, $encounter);

            return response()->json([
                'success' => true,
                'recording_id' => $recording->id,
                's3_key' => $uploadResult['file_path'],
                'url' => $uploadResult['url'] ?? null,
                'message' => 'Recording saved successfully',
                'transcription_started' => $transcriptionStarted,
            ]);
        } catch (\Exception $e) {
            Log::error('Error saving recording', [
                'appointment_id' => $appointment->id,
                'encounter_id' => $encounter->id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to save recording',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get recordings for an encounter.
     */
    public function getRecordings(Encounter $encounter): JsonResponse
    {
        $recordings = $encounter->recordings()->orderBy('created_at', 'desc')->get();

        $s3Service = new S3StorageService;

        $recordingsWithUrls = $recordings->map(function ($recording) use ($encounter) {
            $playbackUrl = null;
            if ($recording->s3_key) {
                // Use proxy endpoint for playback to avoid CORS issues
                $playbackUrl = route('encounters.recordings.play', [
                    'encounter' => $encounter->id,
                    'recording' => $recording->id,
                ]);
            }

            return [
                'id' => $recording->id,
                'file_name' => $recording->file_name,
                'mime_type' => $recording->mime_type,
                'file_size' => $recording->file_size,
                'duration_seconds' => $recording->duration_seconds,
                'signed_url' => $playbackUrl, // Use proxy URL instead of direct S3 URL
                'created_at' => $recording->created_at,
                'transcription_status' => $recording->transcription_status,
                'transcription' => $recording->transcription,
                'transcription_timestamps' => $recording->transcription_timestamps,
                'transcription_speaker_segments' => $recording->transcription_speaker_segments,
                'speaker_names' => $recording->metadata['speaker_names'] ?? null,
            ];
        });

        return response()->json([
            'success' => true,
            'recordings' => $recordingsWithUrls,
        ]);
    }

    /**
     * Stream recording audio file with proper CORS headers.
     */
    public function streamRecording(Encounter $encounter, EncounterRecording $recording)
    {
        // Verify the recording belongs to this encounter
        if ($recording->encounter_id !== $encounter->id) {
            abort(404, 'Recording not found');
        }

        if (! $recording->s3_key) {
            abort(404, 'Recording file not found');
        }

        try {
            // Get content type
            $contentType = $recording->mime_type ?: 'audio/webm';

            // Use Storage facade to stream directly from S3
            // This is more memory efficient for large files
            $disk = Storage::disk('s3');

            // Skip existence check - it can fail due to S3 permissions
            // We'll try to stream and handle errors if the file doesn't exist
            $fileSize = $recording->file_size;

            // Try to get file size if not stored
            if (! $fileSize) {
                try {
                    $fileSize = $disk->size($recording->s3_key);
                } catch (\Exception $e) {
                    Log::warning('Could not get file size, will try to stream anyway', [
                        'recording_id' => $recording->id,
                        's3_key' => $recording->s3_key,
                        'error' => $e->getMessage(),
                    ]);
                }
            }

            // Stream the file with proper CORS headers
            return response()->stream(function () use ($disk, $recording) {
                try {
                    $stream = $disk->readStream($recording->s3_key);
                    if ($stream) {
                        fpassthru($stream);
                        fclose($stream);
                    } else {
                        Log::error('Failed to open stream for recording', [
                            'recording_id' => $recording->id,
                            's3_key' => $recording->s3_key,
                        ]);
                        http_response_code(404);
                        echo 'File not found';
                    }
                } catch (\Exception $e) {
                    Log::error('Error during stream', [
                        'recording_id' => $recording->id,
                        's3_key' => $recording->s3_key,
                        'error' => $e->getMessage(),
                    ]);
                    http_response_code(404);
                    echo 'File not found';
                }
            }, 200, [
                'Content-Type' => $contentType,
                'Content-Length' => $fileSize ?? '',
                'Accept-Ranges' => 'bytes',
                'Access-Control-Allow-Origin' => '*',
                'Access-Control-Allow-Methods' => 'GET, OPTIONS',
                'Access-Control-Allow-Headers' => 'Range',
                'Cache-Control' => 'public, max-age=3600',
            ]);
        } catch (\Exception $e) {
            Log::error('Failed to stream recording', [
                'recording_id' => $recording->id,
                'encounter_id' => $encounter->id,
                's3_key' => $recording->s3_key,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            abort(500, 'Failed to stream recording');
        }
    }

    /**
     * Update speaker names for a recording.
     */
    public function updateSpeakerNames(Encounter $encounter, EncounterRecording $recording, Request $request): JsonResponse
    {
        // Verify the recording belongs to this encounter
        if ($recording->encounter_id !== $encounter->id) {
            return response()->json([
                'success' => false,
                'message' => 'Recording not found for this encounter',
            ], 404);
        }

        $request->validate([
            'speaker_names' => 'required|array',
            'speaker_names.*' => 'nullable|string|max:255',
        ]);

        try {
            $metadata = $recording->metadata ?? [];
            $metadata['speaker_names'] = $request->speaker_names;

            $recording->update([
                'metadata' => $metadata,
            ]);

            Log::info('Speaker names updated', [
                'recording_id' => $recording->id,
                'encounter_id' => $encounter->id,
                'speaker_names' => $request->speaker_names,
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Speaker names updated successfully',
                'speaker_names' => $request->speaker_names,
            ]);

        } catch (\Exception $e) {
            Log::error('Failed to update speaker names', [
                'recording_id' => $recording->id,
                'encounter_id' => $encounter->id,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to update speaker names: '.$e->getMessage(),
            ], 500);
        }
    }

    /**
     * Start transcription for a recording.
     */
    public function transcribeRecording(Encounter $encounter, EncounterRecording $recording): JsonResponse
    {
        // Verify the recording belongs to this encounter
        if ($recording->encounter_id !== $encounter->id) {
            return response()->json([
                'success' => false,
                'message' => 'Recording not found for this encounter',
            ], 404);
        }

        // Check if already processing or completed
        if ($recording->transcription_status === 'processing') {
            return response()->json([
                'success' => false,
                'message' => 'Transcription is already in progress',
            ], 400);
        }

        if ($recording->transcription_status === 'completed' && $recording->transcription) {
            return response()->json([
                'success' => false,
                'message' => 'Recording is already transcribed',
            ], 400);
        }

        // Check if recording has S3 key
        if (! $recording->s3_key) {
            return response()->json([
                'success' => false,
                'message' => 'Recording file not found',
            ], 404);
        }

        try {
            // Update status to pending
            $recording->update([
                'transcription_status' => 'pending',
            ]);

            // Dispatch transcription job
            TranscribeRecording::dispatch($recording->id);

            Log::info('Transcription job dispatched', [
                'recording_id' => $recording->id,
                'encounter_id' => $encounter->id,
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Transcription job started',
                'recording' => [
                    'id' => $recording->id,
                    'transcription_status' => $recording->transcription_status,
                ],
            ]);

        } catch (\Exception $e) {
            Log::error('Failed to start transcription', [
                'recording_id' => $recording->id,
                'encounter_id' => $encounter->id,
                'error' => $e->getMessage(),
            ]);

            $recording->update([
                'transcription_status' => 'failed',
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to start transcription: '.$e->getMessage(),
            ], 500);
        }
    }

    /**
     * Start transcription for a recording (internal helper method).
     */
    private function startTranscriptionForRecording(EncounterRecording $recording, Encounter $encounter): bool
    {
        // Check if already processing or completed
        if ($recording->transcription_status === 'processing') {
            Log::info('Transcription already in progress', [
                'recording_id' => $recording->id,
                'encounter_id' => $encounter->id,
            ]);

            return false;
        }

        if ($recording->transcription_status === 'completed' && $recording->transcription) {
            Log::info('Recording already transcribed', [
                'recording_id' => $recording->id,
                'encounter_id' => $encounter->id,
            ]);

            return false;
        }

        // Check if recording has S3 key
        if (! $recording->s3_key) {
            Log::warning('Recording file not found for transcription', [
                'recording_id' => $recording->id,
                'encounter_id' => $encounter->id,
            ]);

            return false;
        }

        try {
            // Update status to pending
            $recording->update([
                'transcription_status' => 'pending',
            ]);

            // Dispatch transcription job
            TranscribeRecording::dispatch($recording->id);

            Log::info('Transcription job dispatched automatically after recording save', [
                'recording_id' => $recording->id,
                'encounter_id' => $encounter->id,
            ]);

            return true;
        } catch (\Exception $e) {
            Log::error('Failed to start transcription automatically', [
                'recording_id' => $recording->id,
                'encounter_id' => $encounter->id,
                'error' => $e->getMessage(),
            ]);

            $recording->update([
                'transcription_status' => 'failed',
            ]);

            return false;
        }
    }
}
