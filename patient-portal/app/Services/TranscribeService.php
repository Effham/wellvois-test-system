<?php

namespace App\Services;

use Aws\Exception\AwsException;
use Aws\TranscribeService\TranscribeServiceClient;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

/**
 * TranscribeService
 *
 * Service for transcribing audio files using AWS Transcribe.
 * Note: AWS Bedrock doesn't support audio transcription directly,
 * so we use Amazon Transcribe which is AWS's standard audio transcription service.
 */
class TranscribeService
{
    private TranscribeServiceClient $client;

    private string $region;

    private string $bucket;

    public function __construct()
    {
        $this->initializeClient();
    }

    /**
     * Initialize the Transcribe client with credentials
     */
    private function initializeClient(): void
    {
        $accessKey = config('services.bedrock.access_key');
        $secretKey = config('services.bedrock.secret_key');
        $this->region = config('services.bedrock.region', 'ca-central-1');
        $this->bucket = config('filesystems.disks.s3.bucket') ?? env('AWS_BUCKET');

        Log::info('TranscribeService - Initializing client', [
            'access_key_set' => ! empty($accessKey),
            'secret_key_set' => ! empty($secretKey),
            'region' => $this->region,
            'bucket' => $this->bucket,
        ]);

        if (! $accessKey || ! $secretKey) {
            throw new \Exception('AWS credentials not configured');
        }

        try {
            $this->client = new TranscribeServiceClient([
                'version' => 'latest',
                'region' => $this->region,
                'credentials' => [
                    'key' => $accessKey,
                    'secret' => $secretKey,
                ],
            ]);

            Log::info('TranscribeService - Client initialized successfully', [
                'region' => $this->region,
                'bucket' => $this->bucket,
            ]);
        } catch (\Exception $e) {
            Log::error('TranscribeService - Failed to initialize client', [
                'error' => $e->getMessage(),
                'region' => $this->region,
            ]);
            throw new \Exception('Failed to initialize TranscribeService client: '.$e->getMessage());
        }
    }

    /**
     * Start a transcription job for an audio file in S3
     *
     * @param  string  $jobName  Unique job name
     * @param  string  $s3Key  S3 key of the audio file
     * @param  string  $languageCode  Language code (default: en-US)
     * @return array Job details
     */
    public function startTranscriptionJob(string $jobName, string $s3Key, string $languageCode = 'en-US'): array
    {
        try {
            // Build S3 URI
            $mediaUri = "s3://{$this->bucket}/{$s3Key}";

            Log::info('TranscribeService - Starting transcription job', [
                'service' => 'TranscribeService',
                'job_name' => $jobName,
                's3_key' => $s3Key,
                's3_bucket' => $this->bucket,
                'media_uri' => $mediaUri,
                'language_code' => $languageCode,
                'region' => $this->region,
            ]);

            $result = $this->client->startTranscriptionJob([
                'TranscriptionJobName' => $jobName,
                'LanguageCode' => $languageCode,
                'Media' => [
                    'MediaFileUri' => $mediaUri,
                ],
                'MediaFormat' => $this->detectMediaFormat($s3Key),
                'Settings' => [
                    'ShowSpeakerLabels' => true,
                    'MaxSpeakerLabels' => 10,
                ],
            ]);

            Log::info('TranscribeService - Transcription job started successfully', [
                'job_name' => $jobName,
                'status' => $result['TranscriptionJob']['TranscriptionJobStatus'],
            ]);

            return [
                'success' => true,
                'job_name' => $jobName,
                'status' => $result['TranscriptionJob']['TranscriptionJobStatus'],
                'job' => $result['TranscriptionJob'],
            ];

        } catch (AwsException $e) {
            Log::error('TranscribeService - AWS Exception', [
                'message' => $e->getMessage(),
                'error_code' => $e->getAwsErrorCode(),
                'job_name' => $jobName,
            ]);
            throw new \Exception('AWS Transcribe error: '.$e->getMessage());
        } catch (\Exception $e) {
            Log::error('TranscribeService - General Exception', [
                'message' => $e->getMessage(),
                'job_name' => $jobName,
            ]);
            throw new \Exception('Transcription job failed: '.$e->getMessage());
        }
    }

    /**
     * Get transcription job status and results
     *
     * @param  string  $jobName  Transcription job name
     * @return array Job status and transcription text
     */
    public function getTranscriptionJob(string $jobName): array
    {
        try {
            $result = $this->client->getTranscriptionJob([
                'TranscriptionJobName' => $jobName,
            ]);

            $job = $result['TranscriptionJob'];
            $status = $job['TranscriptionJobStatus'];
            $transcriptionData = null;

            if ($status === 'COMPLETED' && isset($job['Transcript']['TranscriptFileUri'])) {
                // Download and parse the transcription result
                $transcriptionData = $this->downloadTranscription($job['Transcript']['TranscriptFileUri']);
            }

            return [
                'success' => true,
                'status' => $status,
                'transcription_text' => $transcriptionData['text'] ?? null,
                'transcription_timestamps' => $transcriptionData['timestamps'] ?? [],
                'transcription_speaker_segments' => $transcriptionData['speaker_segments'] ?? [],
                'job' => $job,
            ];

        } catch (AwsException $e) {
            Log::error('TranscribeService - Get Job AWS Exception', [
                'message' => $e->getMessage(),
                'error_code' => $e->getAwsErrorCode(),
                'job_name' => $jobName,
            ]);
            throw new \Exception('AWS Transcribe error: '.$e->getMessage());
        } catch (\Exception $e) {
            Log::error('TranscribeService - Get Job Exception', [
                'message' => $e->getMessage(),
                'job_name' => $jobName,
            ]);
            throw new \Exception('Failed to get transcription job: '.$e->getMessage());
        }
    }

    /**
     * Download and parse transcription result from S3 URI or HTTPS URL
     *
     * @param  string  $transcriptUri  S3 URI or HTTPS URL of the transcription result
     * @return array Transcription text and timestamps
     */
    private function downloadTranscription(string $transcriptUri): array
    {
        try {
            $jsonContent = null;

            // Handle S3 URI format: s3://bucket/key
            if (preg_match('/^s3:\/\/([^\/]+)\/(.+)$/', $transcriptUri, $matches)) {
                $bucket = $matches[1];
                $key = $matches[2];

                Log::info('TranscribeService - Downloading from S3 URI', [
                    'bucket' => $bucket,
                    'key' => $key,
                ]);

                // Download the JSON file from S3
                $disk = Storage::disk('s3');
                $jsonContent = $disk->get($key);

            } elseif (preg_match('/^https?:\/\//', $transcriptUri)) {
                // Handle HTTPS URL (signed URL from Transcribe)
                Log::info('TranscribeService - Downloading from HTTPS URL', [
                    'url_preview' => substr($transcriptUri, 0, 100).'...',
                ]);

                // Download using HTTP client
                $response = \Illuminate\Support\Facades\Http::timeout(30)->get($transcriptUri);

                if (! $response->successful()) {
                    throw new \Exception('Failed to download transcription: HTTP '.$response->status());
                }

                $jsonContent = $response->body();

            } else {
                // Try to parse HTTPS URL to extract bucket and key
                // Format: https://s3.region.amazonaws.com/bucket/key
                if (preg_match('/https?:\/\/s3[^\/]*\.amazonaws\.com\/([^\/]+)\/(.+?)(?:\?|$)/', $transcriptUri, $matches)) {
                    $bucket = $matches[1];
                    $key = $matches[2];

                    Log::info('TranscribeService - Parsed HTTPS URL to S3 location', [
                        'bucket' => $bucket,
                        'key' => $key,
                    ]);

                    // Download the JSON file from S3
                    $disk = Storage::disk('s3');
                    $jsonContent = $disk->get($key);

                } else {
                    throw new \Exception('Invalid transcript URI format: '.substr($transcriptUri, 0, 100));
                }
            }

            if (empty($jsonContent)) {
                throw new \Exception('Empty transcription result');
            }

            $transcriptData = json_decode($jsonContent, true);

            if (json_last_error() !== JSON_ERROR_NONE) {
                throw new \Exception('Invalid JSON in transcription result: '.json_last_error_msg());
            }

            if (! isset($transcriptData['results']['transcripts'][0]['transcript'])) {
                Log::warning('TranscribeService - Unexpected transcription format', [
                    'keys' => array_keys($transcriptData ?? []),
                    'results_keys' => array_keys($transcriptData['results'] ?? []),
                ]);
                throw new \Exception('Invalid transcription result format - missing transcripts');
            }

            // Extract transcription text
            $transcriptionText = $transcriptData['results']['transcripts'][0]['transcript'];

            // Extract timestamps from items if available
            $timestamps = [];
            $lastSpeakerLabel = null;
            if (isset($transcriptData['results']['items']) && is_array($transcriptData['results']['items'])) {
                foreach ($transcriptData['results']['items'] as $item) {
                    $itemType = $item['type'] ?? '';

                    if ($itemType === 'pronunciation' && isset($item['start_time'], $item['end_time'])) {
                        // Pronunciation items have timestamps and speaker labels
                        $speakerLabel = $item['speaker_label'] ?? null;
                        $lastSpeakerLabel = $speakerLabel; // Track last speaker for punctuation

                        $timestamps[] = [
                            'start_time' => (float) $item['start_time'],
                            'end_time' => (float) $item['end_time'],
                            'content' => $item['alternatives'][0]['content'] ?? '',
                            'confidence' => isset($item['alternatives'][0]['confidence']) ? (float) $item['alternatives'][0]['confidence'] : null,
                            'type' => 'pronunciation',
                            'speaker_label' => $speakerLabel,
                        ];
                    } elseif ($itemType === 'punctuation') {
                        // Punctuation items inherit speaker label from previous pronunciation item
                        $timestamps[] = [
                            'start_time' => null,
                            'end_time' => null,
                            'content' => $item['alternatives'][0]['content'] ?? '',
                            'confidence' => null,
                            'type' => 'punctuation',
                            'speaker_label' => $lastSpeakerLabel, // Inherit from previous pronunciation
                        ];
                    }
                }
            }

            // Build speaker-segmented transcription by grouping items with same speaker_label
            $speakerTranscriptions = [];
            if (! empty($timestamps)) {
                $currentSpeakerItems = [];
                $currentSpeakerLabel = null;
                $segmentStartTime = null;
                $segmentEndTime = null;

                foreach ($timestamps as $timestamp) {
                    $itemSpeakerLabel = $timestamp['speaker_label'] ?? null;

                    // If speaker label changes or we encounter a new speaker, finalize current segment
                    if ($currentSpeakerLabel !== null && $itemSpeakerLabel !== null && $itemSpeakerLabel !== $currentSpeakerLabel && $timestamp['type'] === 'pronunciation') {
                        // Finalize current segment
                        if (! empty($currentSpeakerItems)) {
                            $segmentText = '';
                            foreach ($currentSpeakerItems as $item) {
                                $segmentText .= $item['content'];
                            }

                            $speakerTranscriptions[] = [
                                'speaker_label' => $currentSpeakerLabel,
                                'start_time' => $segmentStartTime,
                                'end_time' => $segmentEndTime,
                                'text' => trim($segmentText),
                                'items' => $currentSpeakerItems,
                            ];
                        }

                        // Start new segment
                        $currentSpeakerItems = [];
                        $currentSpeakerLabel = $itemSpeakerLabel;
                        $segmentStartTime = $timestamp['start_time'];
                        $segmentEndTime = $timestamp['end_time'];
                        $currentSpeakerItems[] = $timestamp;
                    } elseif ($itemSpeakerLabel !== null && $currentSpeakerLabel === null && $timestamp['type'] === 'pronunciation') {
                        // Start first segment
                        $currentSpeakerLabel = $itemSpeakerLabel;
                        $segmentStartTime = $timestamp['start_time'];
                        $segmentEndTime = $timestamp['end_time'];
                        $currentSpeakerItems[] = $timestamp;
                    } elseif ($currentSpeakerLabel !== null) {
                        // Continue current segment (includes both pronunciation and punctuation)
                        if ($timestamp['type'] === 'pronunciation' && $timestamp['end_time'] !== null) {
                            $segmentEndTime = $timestamp['end_time'];
                        }
                        // Only add items that belong to current speaker (punctuation inherits speaker label)
                        if ($timestamp['speaker_label'] === $currentSpeakerLabel || $timestamp['type'] === 'punctuation') {
                            $currentSpeakerItems[] = $timestamp;
                        }
                    } elseif ($currentSpeakerLabel === null && $timestamp['type'] === 'punctuation') {
                        // Skip punctuation before first speaker segment
                        continue;
                    }
                }

                // Add final segment
                if (! empty($currentSpeakerItems) && $currentSpeakerLabel !== null) {
                    $segmentText = '';
                    foreach ($currentSpeakerItems as $item) {
                        $segmentText .= $item['content'];
                    }

                    $speakerTranscriptions[] = [
                        'speaker_label' => $currentSpeakerLabel,
                        'start_time' => $segmentStartTime,
                        'end_time' => $segmentEndTime,
                        'text' => trim($segmentText),
                        'items' => $currentSpeakerItems,
                    ];
                }
            }

            return [
                'text' => $transcriptionText,
                'timestamps' => $timestamps,
                'speaker_segments' => $speakerTranscriptions,
            ];

        } catch (\Exception $e) {
            Log::error('TranscribeService - Download Transcription Exception', [
                'message' => $e->getMessage(),
                'transcript_uri_preview' => substr($transcriptUri, 0, 200),
            ]);
            throw new \Exception('Failed to download transcription: '.$e->getMessage());
        }
    }

    /**
     * Detect media format from file extension
     *
     * @param  string  $s3Key  S3 key
     * @return string Media format
     */
    private function detectMediaFormat(string $s3Key): string
    {
        $extension = strtolower(pathinfo($s3Key, PATHINFO_EXTENSION));

        $formatMap = [
            'mp3' => 'mp3',
            'mp4' => 'mp4',
            'wav' => 'wav',
            'flac' => 'flac',
            'ogg' => 'ogg',
            'amr' => 'amr',
            'webm' => 'webm',
        ];

        return $formatMap[$extension] ?? 'mp3';
    }
}
