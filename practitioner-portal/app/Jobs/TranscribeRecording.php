<?php

namespace App\Jobs;

use App\Models\Tenant\EncounterRecording;
use App\Services\TranscribeService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Throwable;

class TranscribeRecording implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 1; // Don't retry - we handle retries via status checks

    public int $timeout = 300; // 5 minutes max - should be enough to start the job

    public function backoff(): array
    {
        return [];
    }

    public function __construct(
        public int $recordingId
    ) {}

    public function handle(TranscribeService $transcribeService): void
    {
        $recording = EncounterRecording::findOrFail($this->recordingId);

        // Check if recording has S3 key
        if (! $recording->s3_key) {
            Log::error('TranscribeRecording - No S3 key found', [
                'recording_id' => $recording->id,
            ]);
            $recording->update([
                'transcription_status' => 'failed',
            ]);

            return;
        }

        // Check if already transcribed
        if ($recording->transcription_status === 'completed' && $recording->transcription) {
            Log::info('TranscribeRecording - Already transcribed', [
                'recording_id' => $recording->id,
            ]);

            return;
        }

        // If already processing, check status of existing job
        if ($recording->transcription_status === 'processing') {
            $metadata = $recording->metadata ?? [];
            $jobName = $metadata['transcribe_job_name'] ?? null;

            if ($jobName) {
                Log::info('TranscribeRecording - Checking status of existing job', [
                    'recording_id' => $recording->id,
                    'job_name' => $jobName,
                ]);

                $this->checkJobStatus($transcribeService, $recording, $jobName);

                return;
            }
        }

        try {
            // Check if already completed (prevent duplicate jobs)
            if ($recording->transcription_status === 'completed') {
                Log::info('TranscribeRecording - Already completed', [
                    'recording_id' => $recording->id,
                ]);

                return;
            }

            // Update status to processing
            $recording->update([
                'transcription_status' => 'processing',
            ]);

            Log::info('TranscribeRecording - Starting transcription', [
                'recording_id' => $recording->id,
                's3_key' => $recording->s3_key,
            ]);

            // Generate unique job name
            $jobName = 'transcribe-recording-'.$recording->id.'-'.time();

            // Start transcription job
            $result = $transcribeService->startTranscriptionJob(
                $jobName,
                $recording->s3_key
            );

            if ($result['success']) {
                Log::info('TranscribeRecording - Transcription job started', [
                    'recording_id' => $recording->id,
                    'job_name' => $jobName,
                    'status' => $result['status'],
                ]);

                // Store job name in metadata for status checking and reset check count
                $metadata = $recording->metadata ?? [];
                $metadata['transcribe_job_name'] = $jobName;
                $metadata['transcribe_check_count'] = 0; // Reset check count
                $recording->update(['metadata' => $metadata]);

                // Check status immediately (might be quick for small files)
                $this->checkJobStatus($transcribeService, $recording, $jobName);

            } else {
                throw new \Exception('Failed to start transcription job');
            }

        } catch (\Exception $e) {
            Log::error('TranscribeRecording - Transcription failed', [
                'recording_id' => $recording->id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            $recording->update([
                'transcription_status' => 'failed',
            ]);

            throw $e;
        }
    }

    /**
     * Check transcription job status (non-blocking, single check)
     * If still processing, dispatch a delayed job to check again
     */
    private function checkJobStatus(TranscribeService $transcribeService, EncounterRecording $recording, string $jobName): void
    {
        try {
            $result = $transcribeService->getTranscriptionJob($jobName);
            $status = $result['status'] ?? 'UNKNOWN';

            Log::info('TranscribeRecording - Checking job status', [
                'recording_id' => $recording->id,
                'job_name' => $jobName,
                'status' => $status,
            ]);

            if ($status === 'COMPLETED') {
                // Update recording with transcription, timestamps, and speaker segments
                // Always set arrays (even if empty) to ensure they're saved, not left as NULL
                $recording->update([
                    'transcription_status' => 'completed',
                    'transcription' => $result['transcription_text'] ?? '',
                    'transcription_timestamps' => $result['transcription_timestamps'] ?? [],
                    'transcription_speaker_segments' => $result['transcription_speaker_segments'] ?? [],
                ]);

                Log::info('TranscribeRecording - Transcription completed', [
                    'recording_id' => $recording->id,
                    'job_name' => $jobName,
                    'transcription_length' => strlen($result['transcription_text'] ?? ''),
                    'timestamps_count' => count($result['transcription_timestamps'] ?? []),
                    'speaker_segments_count' => count($result['transcription_speaker_segments'] ?? []),
                ]);

                return;

            } elseif ($status === 'FAILED') {
                $recording->update([
                    'transcription_status' => 'failed',
                ]);

                Log::error('TranscribeRecording - Transcription job failed', [
                    'recording_id' => $recording->id,
                    'job_name' => $jobName,
                ]);

                return;

            } elseif (in_array($status, ['IN_PROGRESS', 'QUEUED'])) {
                // Check attempt count before dispatching
                $metadata = $recording->metadata ?? [];
                $checkCount = ($metadata['transcribe_check_count'] ?? 0) + 1;
                $metadata['transcribe_check_count'] = $checkCount;

                if ($checkCount >= 30) { // Max 30 checks = ~5 minutes
                    $recording->update([
                        'transcription_status' => 'failed',
                        'metadata' => $metadata,
                    ]);

                    Log::error('TranscribeRecording - Max check attempts reached', [
                        'recording_id' => $recording->id,
                        'job_name' => $jobName,
                        'check_count' => $checkCount,
                    ]);

                    return;
                }

                $recording->update(['metadata' => $metadata]);

                // Still processing - dispatch a delayed job to check again in 10 seconds
                // This prevents blocking and allows the queue to process other jobs
                self::dispatch($recording->id)
                    ->delay(now()->addSeconds(10));

                Log::info('TranscribeRecording - Job still processing, will check again', [
                    'recording_id' => $recording->id,
                    'job_name' => $jobName,
                    'status' => $status,
                    'check_count' => $checkCount,
                ]);

                return;

            } else {
                // Unknown status - mark as failed after a reasonable wait
                Log::warning('TranscribeRecording - Unknown job status', [
                    'recording_id' => $recording->id,
                    'job_name' => $jobName,
                    'status' => $status,
                ]);

                // Check if we've been checking for too long (store attempt count in metadata)
                $metadata = $recording->metadata ?? [];
                $checkCount = ($metadata['transcribe_check_count'] ?? 0) + 1;
                $metadata['transcribe_check_count'] = $checkCount;

                if ($checkCount >= 30) { // Max 30 checks = ~5 minutes
                    $recording->update([
                        'transcription_status' => 'failed',
                        'metadata' => $metadata,
                    ]);

                    Log::error('TranscribeRecording - Max check attempts reached', [
                        'recording_id' => $recording->id,
                        'job_name' => $jobName,
                        'check_count' => $checkCount,
                    ]);
                } else {
                    $recording->update(['metadata' => $metadata]);

                    // Check again in 10 seconds
                    self::dispatch($recording->id)
                        ->delay(now()->addSeconds(10));
                }

                return;
            }

        } catch (\Exception $e) {
            Log::error('TranscribeRecording - Error checking job status', [
                'recording_id' => $recording->id,
                'job_name' => $jobName,
                'error' => $e->getMessage(),
            ]);

            // Check attempt count
            $metadata = $recording->metadata ?? [];
            $checkCount = ($metadata['transcribe_check_count'] ?? 0) + 1;
            $metadata['transcribe_check_count'] = $checkCount;

            if ($checkCount >= 30) {
                $recording->update([
                    'transcription_status' => 'failed',
                    'metadata' => $metadata,
                ]);
            } else {
                $recording->update(['metadata' => $metadata]);

                // Retry checking in 10 seconds
                self::dispatch($recording->id)
                    ->delay(now()->addSeconds(10));
            }
        }
    }

    public function failed(?Throwable $exception): void
    {
        $recording = EncounterRecording::find($this->recordingId);

        if ($recording) {
            $recording->update([
                'transcription_status' => 'failed',
            ]);

            Log::error('TranscribeRecording - Job failed', [
                'recording_id' => $this->recordingId,
                'error' => $exception?->getMessage(),
            ]);
        }
    }
}
