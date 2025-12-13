<?php

namespace App\Jobs;

use App\Models\Tenant\Encounter;
use App\Services\BedrockAIService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Throwable;

class GenerateRecordingAISummary implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public int $timeout = 600; // 10 minutes for AI generation

    public function __construct(
        public int $encounterId,
        public string $summaryType
    ) {}

    public function handle(BedrockAIService $bedrockService): void
    {
        $encounter = Encounter::findOrFail($this->encounterId);

        // Update status to processing
        $encounter->update([
            'recording_ai_summary_status' => 'processing',
            'recording_ai_summary_type' => $this->summaryType,
        ]);

        try {
            // Load recordings with transcriptions
            $recordings = $encounter->recordings()
                ->where('transcription_status', 'completed')
                ->whereNotNull('transcription_speaker_segments')
                ->orderBy('created_at', 'asc')
                ->get();

            if ($recordings->isEmpty()) {
                throw new \Exception('No completed transcriptions found for this encounter');
            }

            // Build transcript text from all recordings
            $transcriptText = $this->buildTranscriptText($recordings);

            if (empty($transcriptText)) {
                throw new \Exception('No valid transcription data found');
            }

            // Build the premium prompt
            $systemPrompt = $this->getSystemPrompt();
            $userPrompt = $this->buildPrompt($transcriptText, $this->summaryType);

            // Generate summary using Bedrock
            // Use Sonnet model for better quality summaries
            $bedrockService->setModelId('anthropic.claude-3-sonnet-20240229-v1:0');

            // Note: BedrockAIService.generateSummary uses max_tokens: 800 by default
            // For longer summaries, we could extend the service, but 800 should be sufficient
            $summaryBulletPoints = $bedrockService->generateSummary(null, $userPrompt, $systemPrompt);

            // Convert bullet points to formatted text
            $summaryText = implode("\n\n", array_map(function ($point) {
                return '• '.$point;
            }, $summaryBulletPoints));

            // Update encounter with generated summary
            $encounter->update([
                'recording_ai_summary' => $summaryText,
                'recording_ai_summary_status' => 'completed',
            ]);

            Log::info('GenerateRecordingAISummary - Summary generated successfully', [
                'encounter_id' => $encounter->id,
                'summary_type' => $this->summaryType,
                'summary_length' => strlen($summaryText),
            ]);

        } catch (\Exception $e) {
            Log::error('GenerateRecordingAISummary - Error generating summary', [
                'encounter_id' => $encounter->id,
                'summary_type' => $this->summaryType,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            $encounter->update([
                'recording_ai_summary_status' => 'failed',
            ]);

            throw $e;
        }
    }

    /**
     * Build transcript text from recordings with timestamps and speaker labels
     */
    private function buildTranscriptText($recordings): string
    {
        $transcriptSegments = [];

        foreach ($recordings as $recording) {
            $speakerSegments = $recording->transcription_speaker_segments ?? [];

            if (empty($speakerSegments)) {
                continue;
            }

            foreach ($speakerSegments as $segment) {
                $timestamp = $this->formatTimestamp($segment['start_time'] ?? 0);
                $speakerLabel = $segment['speaker_label'] ?? 'Unknown';

                // Get speaker name from metadata if available
                $speakerNames = $recording->metadata['speaker_names'] ?? [];
                $speakerName = $speakerNames[$speakerLabel] ?? "Speaker {$speakerLabel}";

                // Determine if speaker is Clinician or Patient based on label or name
                $speakerType = $this->determineSpeakerType($speakerLabel, $speakerName);

                $text = $segment['text'] ?? '';

                if (! empty($text)) {
                    $transcriptSegments[] = [
                        'timestamp' => $timestamp,
                        'speaker' => $speakerType,
                        'utterance' => $text,
                    ];
                }
            }
        }

        // Format segments into readable transcript
        $transcriptText = "TRANSCRIPTION DATA:\n\n";
        foreach ($transcriptSegments as $segment) {
            $transcriptText .= "Timestamp: {$segment['timestamp']}\n";
            $transcriptText .= "Speaker: {$segment['speaker']}\n";
            $transcriptText .= "Utterance: {$segment['utterance']}\n\n";
        }

        return $transcriptText;
    }

    /**
     * Format timestamp from seconds to HH:MM:SS
     */
    private function formatTimestamp(float $seconds): string
    {
        $hours = floor($seconds / 3600);
        $minutes = floor(($seconds % 3600) / 60);
        $secs = floor($seconds % 60);

        return sprintf('%02d:%02d:%02d', $hours, $minutes, $secs);
    }

    /**
     * Determine speaker type (Clinician, Patient, or Other)
     */
    private function determineSpeakerType(string $speakerLabel, string $speakerName): string
    {
        // Common patterns to identify clinician vs patient
        $clinicianKeywords = ['doctor', 'physician', 'practitioner', 'clinician', 'therapist', 'nurse', 'provider'];
        $nameLower = strtolower($speakerName);

        foreach ($clinicianKeywords as $keyword) {
            if (str_contains($nameLower, $keyword)) {
                return 'Clinician';
            }
        }

        // Default: if speaker label is "spk_0" or similar, assume Patient for first speaker
        // This is a heuristic - adjust based on your actual speaker identification logic
        if (preg_match('/spk_0|speaker\s*0/i', $speakerLabel)) {
            return 'Patient';
        }

        // Otherwise, try to infer from name
        if (str_contains($nameLower, 'patient') || str_contains($nameLower, 'client')) {
            return 'Patient';
        }

        // Default fallback
        return 'Other';
    }

    /**
     * Get the premium system prompt
     */
    private function getSystemPrompt(): string
    {
        return 'You are a clinical documentation assistant. Your task is to generate an accurate, medically reliable summary of a single clinical encounter using multiple timestamped, speaker-identified transcription segments from one appointment. Follow all instructions precisely.';
    }

    /**
     * Build the user prompt based on summary type
     */
    private function buildPrompt(string $transcriptText, string $summaryType): string
    {
        $prompt = "Input Format\n\n";
        $prompt .= "You will receive one or more transcripts.\n\n";
        $prompt .= "Each transcript contains multiple segments formatted like:\n";
        $prompt .= "Timestamp: HH:MM:SS\n";
        $prompt .= "Speaker: Clinician, Patient, or other identified participant\n";
        $prompt .= "Utterance: Verbatim text\n\n";
        $prompt .= "Treat all transcripts as belonging to the same appointment, in chronological order across all segments.\n\n";

        $prompt .= "Instructions\n\n";
        $prompt .= "1. Interpretation of Multiple Transcripts\n";
        $prompt .= "Merge all transcripts into a single continuous encounter timeline.\n";
        $prompt .= "Use timestamps and speaker labels to reconstruct the full interaction.\n";
        $prompt .= "Do not treat recordings as separate visits.\n\n";

        $prompt .= "2. Accuracy and Safety Requirements\n";
        $prompt .= "Do not hallucinate, infer, or speculate on any information not explicitly stated.\n";
        $prompt .= "If information is incomplete, uncertain, or contradictory, reflect this explicitly and neutrally.\n";
        $prompt .= "Maintain a professional, clinical tone appropriate for EMR documentation.\n";
        $prompt .= "Prefer clinician statements over patient self-interpretation when conflicts arise, but document both if both are relevant.\n\n";

        $prompt .= "3. Extraction Rules\n";
        $prompt .= "Extract only medically relevant information, including:\n";
        $prompt .= "- Chief complaint / reason for visit\n";
        $prompt .= "- History of present illness\n";
        $prompt .= "- Past medical history (only if mentioned)\n";
        $prompt .= "- Medications (current, reported, or newly recommended)\n";
        $prompt .= "- Allergies\n";
        $prompt .= "- Pertinent ROS findings\n";
        $prompt .= "- Physical exam findings described verbally\n";
        $prompt .= "- Diagnostic impressions shared by clinician\n";
        $prompt .= "- Plans, recommendations, follow-ups\n";
        $prompt .= "- Procedures or interventions performed\n";
        $prompt .= "- Any patient-provided contextual factors relevant to care\n\n";
        $prompt .= "Exclude:\n";
        $prompt .= "- Filler conversation, pleasantries, administrative remarks\n";
        $prompt .= "- Non-clinical small talk\n";
        $prompt .= "- Any clinical details not explicitly present in the transcripts\n\n";

        $prompt .= "4. Handling Repetition, Contradiction, or Ambiguity\n";
        $prompt .= "Combine repeated information without duplicating it.\n";
        $prompt .= "If the same detail appears with minor variation, choose the internally consistent version or describe the discrepancy briefly.\n";
        $prompt .= "Represent unclear information with phrases like \"Patient reports…\", \"Clinician notes…\", \"Unclear whether…\"\n\n";

        // Add summary type-specific instructions
        $prompt .= $this->getSummaryTypeInstructions($summaryType);

        $prompt .= "\n\nFinal Requirement\n\n";
        $prompt .= "Your output must only contain information directly supported by the transcripts. Do not add, infer, or expand beyond what is explicitly said.\n\n";

        // Add the actual transcript data
        $prompt .= $transcriptText;

        return $prompt;
    }

    /**
     * Get summary type-specific instructions
     */
    private function getSummaryTypeInstructions(string $summaryType): string
    {
        $instructions = [
            'plain_summary' => 'Generate a clear, comprehensive plain-language summary of the encounter.',
            'soap_note' => 'Format the summary as a SOAP note with Subjective, Objective, Assessment, and Plan sections.',
            'history_and_physical' => 'Format as a History and Physical examination note with detailed H&P sections.',
            'medical_encounter_summary' => 'Generate a standard medical encounter summary suitable for EMR documentation.',
            'progress_note' => 'Format as a progress note focusing on changes since last visit and current status.',
            'discharge_summary' => 'Format as a discharge summary with reason for visit, treatment provided, and discharge instructions.',
            'operative_note' => 'Format as an operative note if procedures were performed, otherwise use standard encounter format.',
            'procedure_note' => 'Format as a procedure note documenting any procedures performed during the encounter.',
            'emergency_encounter' => 'Format as an emergency encounter note with chief complaint, assessment, and disposition.',
            'prescription_summary' => 'Focus on medications discussed, prescribed, or modified during the encounter.',
            'lab_and_imaging_summary' => 'Focus on laboratory results and imaging studies discussed or ordered.',
            'chronic_disease_followup' => 'Format focusing on chronic disease management, monitoring, and treatment adjustments.',
            'pediatric_visit' => 'Format appropriate for pediatric documentation with age-appropriate considerations.',
            'antenatal_visit' => 'Format as an antenatal/prenatal visit note with pregnancy-specific documentation.',
            'psychiatry_summary' => 'Format as a psychiatry note with mental status exam, assessment, and treatment plan.',
            'telemedicine_summary' => 'Format as a telemedicine encounter note noting remote consultation format.',
        ];

        $instruction = $instructions[$summaryType] ?? $instructions['plain_summary'];

        return "5. Summary Format\n{$instruction}\n";
    }

    public function failed(Throwable $exception): void
    {
        $encounter = Encounter::find($this->encounterId);
        if ($encounter) {
            $encounter->update([
                'recording_ai_summary_status' => 'failed',
            ]);
        }

        Log::error('GenerateRecordingAISummary - Job failed', [
            'encounter_id' => $this->encounterId,
            'summary_type' => $this->summaryType,
            'error' => $exception->getMessage(),
        ]);
    }
}
