<?php

namespace App\Services;

use Aws\BedrockRuntime\BedrockRuntimeClient;
use Aws\Exception\AwsException;
use Illuminate\Support\Facades\Log;

class BedrockAIService
{
    private BedrockRuntimeClient $client;

    private string $modelId;

    private string $systemPrompt;

    public function __construct()
    {
        $this->initializeClient();
        $this->setDefaults();
    }

    /**
     * Initialize the Bedrock Runtime client with credentials
     */
    private function initializeClient(): void
    {
        $accessKey = config('services.bedrock.access_key');
        $secretKey = config('services.bedrock.secret_key');
        $region = config('services.bedrock.region');

        Log::info('BedrockAI Service - Initializing client', [
            'access_key_set' => ! empty($accessKey),
            'secret_key_set' => ! empty($secretKey),
            'region' => $region,
        ]);

        if (! $accessKey || ! $secretKey) {
            throw new \Exception('AWS Bedrock credentials not configured');
        }

        $this->client = new BedrockRuntimeClient([
            'version' => 'latest',
            'region' => $region,
            'credentials' => [
                'key' => $accessKey,
                'secret' => $secretKey,
            ],
        ]);
    }

    /**
     * Set default configuration for AI generation
     */
    private function setDefaults(): void
    {
        // Use Claude 3 Haiku model (widely available and cost-effective)
        $this->modelId = 'anthropic.claude-3-haiku-20240307-v1:0';
        $this->systemPrompt = 'You are a medical AI assistant that generates comprehensive patient summaries. Provide insights in bullet points that highlight medical trends, treatment effectiveness, and health progression.';
    }

    /**
     * Generate AI summary from patient context data
     */
    public function generateSummary(?array $patientContext = null, string $customPrompt = '', string $systemPrompt = ''): array
    {
        $prompt = $patientContext != null ? $this->buildPrompt($patientContext) : $customPrompt;

        $requestPayload = [
            'anthropic_version' => 'bedrock-2023-05-31',
            'max_tokens' => 800,
            'temperature' => 0.7,
            'system' => $systemPrompt ?? $this->systemPrompt,
            'messages' => [
                [
                    'role' => 'user',
                    'content' => $prompt,
                ],
            ],
        ];

        try {
            $response = $this->client->invokeModel([
                'modelId' => $this->modelId,
                'body' => json_encode($requestPayload),
                'contentType' => 'application/json',
            ]);

            $responseBody = json_decode($response['body']->getContents(), true);

            if (! isset($responseBody['content'][0]['text'])) {
                Log::error('BedrockAI Service - Invalid response structure', [
                    'response' => $responseBody,
                ]);
                throw new \Exception('Invalid response from Bedrock API');
            }

            $content = $responseBody['content'][0]['text'];
            $bulletPoints = $this->parseResponseToBulletPoints($content);

            Log::info('BedrockAI Service - Summary generated successfully', [
                'bullet_points_count' => count($bulletPoints),
            ]);

            return $bulletPoints;

        } catch (AwsException $e) {
            Log::error('BedrockAI Service - AWS Exception', [
                'message' => $e->getMessage(),
                'error_code' => $e->getAwsErrorCode(),
            ]);
            throw new \Exception('Bedrock AWS error: '.$e->getMessage());
        } catch (\Exception $e) {
            Log::error('BedrockAI Service - General Exception', [
                'message' => $e->getMessage(),
            ]);
            throw new \Exception('Bedrock API request failed: '.$e->getMessage());
        }
    }

    /**
     * Build comprehensive prompt for AI
     */
    private function buildPrompt(array $patientContext): string
    {
        $patient = $patientContext['patient_information']['basic_details'];
        $appointmentHistory = $patientContext['appointment_history'];

        $prompt = "Generate a comprehensive medical summary for this patient:\n\n";

        // Patient Basic Information
        $prompt .= "PATIENT INFORMATION:\n";
        $prompt .= 'Name: '.($patient['name'] ?? 'Unknown')."\n";
        $prompt .= 'Age: '.($patient['age'] ?? 'Unknown')."\n";
        $prompt .= 'Gender: '.($patient['gender'] ?? 'Unknown')."\n";

        // Appointment History with Encounter Details
        if (! empty($appointmentHistory)) {
            $prompt .= "\nAPPOINTMENT HISTORY (".count($appointmentHistory)." appointments):\n\n";

            foreach ($appointmentHistory as $index => $appointment) {
                $appointmentNum = $index + 1;
                $prompt .= "APPOINTMENT #{$appointmentNum}:\n";
                $prompt .= 'Date: '.$appointment['appointment_date']."\n";
                $prompt .= 'Service: '.$appointment['service']."\n";

                if ($appointment['encounter_details']) {
                    $encounter = $appointment['encounter_details'];

                    if ($encounter['chief_complaint']) {
                        $prompt .= 'Chief Complaint: '.$encounter['chief_complaint']."\n";
                    }

                    if ($encounter['clinical_assessment']) {
                        $prompt .= 'Clinical Assessment: '.$encounter['clinical_assessment']."\n";
                    }

                    if ($encounter['treatment_plan']) {
                        $prompt .= 'Treatment Plan: '.$encounter['treatment_plan']."\n";
                    }

                    // Vital Signs
                    if (! empty($encounter['vital_signs'])) {
                        $vitals = $encounter['vital_signs'];
                        $vitalsList = [];
                        if ($vitals['blood_pressure']) {
                            $vitalsList[] = 'BP: '.$vitals['blood_pressure'];
                        }
                        if ($vitals['heart_rate']) {
                            $vitalsList[] = 'HR: '.$vitals['heart_rate'];
                        }
                        if ($vitals['temperature']) {
                            $vitalsList[] = 'Temp: '.$vitals['temperature'];
                        }
                        if ($vitals['weight']) {
                            $vitalsList[] = 'Weight: '.$vitals['weight'];
                        }

                        if (! empty($vitalsList)) {
                            $prompt .= 'Vital Signs: '.implode(', ', $vitalsList)."\n";
                        }
                    }

                    // Prescriptions
                    if (! empty($encounter['prescriptions'])) {
                        $prompt .= 'Prescriptions: ';
                        $prescriptions = [];
                        foreach ($encounter['prescriptions'] as $prescription) {
                            $prescriptions[] = $prescription['medicine_name'].' '.
                                             $prescription['dosage'].' '.
                                             $prescription['frequency'];
                        }
                        $prompt .= implode(', ', $prescriptions)."\n";
                    }

                    // Mental Health Assessment (if applicable)
                    if (! empty($encounter['mental_health_assessment'])) {
                        $mental = $encounter['mental_health_assessment'];
                        if ($mental['mood_affect']) {
                            $prompt .= 'Mood/Affect: '.$mental['mood_affect']."\n";
                        }
                        if ($mental['risk_assessment']) {
                            $prompt .= 'Risk Assessment: '.$mental['risk_assessment']."\n";
                        }
                        if ($mental['therapeutic_interventions']) {
                            $prompt .= 'Interventions: '.$mental['therapeutic_interventions']."\n";
                        }
                    }

                    $prompt .= 'Status: '.($encounter['session_details']['status'] ?? 'Unknown')."\n";
                }

                $prompt .= "\n---\n\n";
            }
        }

        $prompt .= "\nPlease provide a comprehensive medical summary in bullet points covering:\n";
        $prompt .= "• Overall health trends and patterns\n";
        $prompt .= "• Treatment effectiveness and medication compliance\n";
        $prompt .= "• Recurring health issues or concerns\n";
        $prompt .= "• Vital signs progression\n";
        $prompt .= "• Mental health status (if applicable)\n";
        $prompt .= "• Risk factors and prevention recommendations\n";
        $prompt .= "• Areas requiring continued monitoring\n";
        $prompt .= "• Overall patient health trajectory\n\n";
        $prompt .= 'Focus on actionable insights that would help healthcare providers make informed decisions.';

        return $prompt;
    }

    /**
     * Parse AI response into bullet points
     */
    private function parseResponseToBulletPoints(string $content): array
    {
        // Clean the content
        $content = trim($content);

        // Split by bullet points or numbered items
        $lines = preg_split('/\n(?=\s*[•\-\*\d+\.\)\s])/u', $content);

        $bulletPoints = [];
        foreach ($lines as $line) {
            $cleanedLine = trim($line);
            // Remove bullet point characters and numbers
            $cleanedLine = preg_replace('/^\s*[•\-\*\d+\.\)]+\s*/', '', $cleanedLine);
            $cleanedLine = trim($cleanedLine);

            if (! empty($cleanedLine) && strlen($cleanedLine) > 10) {
                $bulletPoints[] = $cleanedLine;
            }
        }

        // Ensure we have at least some content
        if (empty($bulletPoints)) {
            // Fallback: split by sentences if no bullet points found
            $sentences = preg_split('/[.!?]+/', $content);
            foreach ($sentences as $sentence) {
                $sentence = trim($sentence);
                if (! empty($sentence) && strlen($sentence) > 20) {
                    $bulletPoints[] = $sentence.'.';
                }
            }
        }

        return array_slice($bulletPoints, 0, 10); // Limit to 10 points
    }

    /**
     * Set custom model ID
     */
    public function setModelId(string $modelId): self
    {
        $this->modelId = $modelId;

        return $this;
    }

    /**
     * Set custom system prompt
     */
    public function setSystemPrompt(string $systemPrompt): self
    {
        $this->systemPrompt = $systemPrompt;

        return $this;
    }

    /**
     * Get current model ID
     */
    public function getModelId(): string
    {
        return $this->modelId;
    }

    /**
     * Stream response token by token
     */
    public function streamResponse(string $prompt, string $systemPrompt, callable $callback): void
    {
        // IMPORTANT: Do NOT include 'stream' => true in the payload
        // Streaming is controlled by using invokeModelWithResponseStream method
        $requestPayload = [
            'anthropic_version' => 'bedrock-2023-05-31',
            'max_tokens' => 1000,
            'temperature' => 0.7,
            'system' => $systemPrompt,
            'messages' => [
                [
                    'role' => 'user',
                    'content' => $prompt,
                ],
            ],
        ];

        Log::info('BedrockAI Service - Preparing streaming request', [
            'model_id' => $this->modelId,
            'system_prompt_length' => strlen($systemPrompt),
            'user_prompt_length' => strlen($prompt),
            'max_tokens' => $requestPayload['max_tokens'],
        ]);

        try {
            $response = $this->client->invokeModelWithResponseStream([
                'modelId' => $this->modelId,
                'body' => json_encode($requestPayload),
                'contentType' => 'application/json',
            ]);

            Log::info('BedrockAI Service - Stream connection established');

            // Process streaming response
            $eventStream = $response['body'];
            $chunkCount = 0;
            $totalTextLength = 0;

            foreach ($eventStream as $event) {
                Log::debug('BedrockAI Service - Event received', [
                    'event_keys' => array_keys($event),
                ]);

                if (isset($event['chunk'])) {
                    // Handle both object and array responses
                    if (is_object($event['chunk']) && method_exists($event['chunk'], 'getContents')) {
                        $chunkContent = $event['chunk']->getContents();
                    } elseif (is_array($event['chunk'])) {
                        $chunkContent = json_encode($event['chunk']);
                    } else {
                        $chunkContent = (string) $event['chunk'];
                    }

                    Log::debug('BedrockAI Service - Chunk content extracted', [
                        'content_length' => strlen($chunkContent),
                        'content_preview' => substr($chunkContent, 0, 100),
                    ]);

                    $chunk = json_decode($chunkContent, true);

                    if (! $chunk) {
                        Log::warning('BedrockAI Service - Failed to parse chunk', [
                            'raw_content' => $chunkContent,
                        ]);

                        continue;
                    }

                    // AWS Bedrock wraps the actual data in a "bytes" field
                    // The bytes field contains a JSON-encoded string that needs to be decoded again
                    if (isset($chunk['bytes'])) {
                        $chunk = json_decode($chunk['bytes'], true);

                        if (! $chunk) {
                            Log::warning('BedrockAI Service - Failed to parse bytes content', [
                                'bytes_content' => $chunk['bytes'] ?? 'N/A',
                            ]);

                            continue;
                        }
                    }

                    if (isset($chunk['type'])) {
                        switch ($chunk['type']) {
                            case 'message_start':
                                Log::debug('BedrockAI Service - Message start received');
                                break;

                            case 'content_block_start':
                                Log::debug('BedrockAI Service - Content block start');
                                break;

                            case 'content_block_delta':
                                if (isset($chunk['delta']['text'])) {
                                    $text = $chunk['delta']['text'];
                                    $chunkCount++;
                                    $totalTextLength += strlen($text);
                                    $callback($text);

                                    if ($chunkCount % 10 === 0) {
                                        Log::debug('BedrockAI Service - Streaming progress', [
                                            'chunks_sent' => $chunkCount,
                                            'total_text_length' => $totalTextLength,
                                        ]);
                                    }
                                }
                                break;

                            case 'content_block_stop':
                                Log::debug('BedrockAI Service - Content block stop');
                                break;

                            case 'message_delta':
                                Log::debug('BedrockAI Service - Message delta', [
                                    'stop_reason' => $chunk['delta']['stop_reason'] ?? null,
                                ]);
                                break;

                            case 'message_stop':
                                Log::info('BedrockAI Service - Message stop received');
                                break;

                            case 'error':
                                Log::error('BedrockAI Service - Stream error chunk', ['error' => $chunk]);
                                throw new \Exception('Bedrock streaming error: '.json_encode($chunk));
                        }
                    }
                }
            }

            Log::info('BedrockAI Service - Stream completed successfully', [
                'total_chunks' => $chunkCount,
                'total_text_length' => $totalTextLength,
            ]);

        } catch (AwsException $e) {
            Log::error('BedrockAI Service - AWS Stream Exception', [
                'message' => $e->getMessage(),
                'error_code' => $e->getAwsErrorCode(),
                'error_type' => $e->getAwsErrorType(),
                'request_id' => $e->getAwsRequestId(),
            ]);
            throw new \Exception('Bedrock AWS streaming error: '.$e->getMessage());
        } catch (\Exception $e) {
            Log::error('BedrockAI Service - Stream Exception', [
                'message' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            throw new \Exception('Bedrock streaming failed: '.$e->getMessage());
        }
    }

    /**
     * Format practitioner notes into a structured text block
     *
     * @param  string  $notes  The AI-generated or user-entered note content
     * @param  string  $noteType  The note type identifier (e.g. 'soap', 'dap', 'birp', etc.)
     * @return string Formatted note ready for database storage
     */
    public function formatPractitionerNote(string $notes, string $noteType): string
    {
        $notes = trim($notes);
        $noteType = strtolower(trim($noteType));

        // Define structured templates for each note type
        $templates = [
            'soap' => [
                'label' => 'SOAP Note',
                'sections' => ['Subjective', 'Objective', 'Assessment', 'Plan'],
            ],
            'dap' => [
                'label' => 'DAP Note',
                'sections' => ['Data', 'Assessment', 'Plan'],
            ],
            'birp' => [
                'label' => 'BIRP Note',
                'sections' => ['Behavior', 'Intervention', 'Response', 'Plan'],
            ],
            'pie' => [
                'label' => 'PIE Note',
                'sections' => ['Problem', 'Intervention', 'Evaluation'],
            ],
            'narrative' => [
                'label' => 'Narrative Note',
                'sections' => ['Narrative'],
            ],
            'progress' => [
                'label' => 'Progress Note',
                'sections' => ['Progress Summary'],
            ],
            'discharge' => [
                'label' => 'Discharge Note',
                'sections' => ['Reason for Discharge', 'Treatment Summary', 'Recommendations'],
            ],
        ];

        // Validate note type or default to narrative
        $template = $templates[$noteType] ?? $templates['narrative'];

        // Build structured note text
        $formatted = "=== {$template['label']} ===\n\n";

        // Split the input notes into paragraphs
        $paragraphs = preg_split('/\n\s*\n/', $notes);

        // Assign each paragraph to sections if possible
        foreach ($template['sections'] as $index => $section) {
            $content = $paragraphs[$index] ?? '';
            $formatted .= strtoupper($section).":\n";
            $formatted .= ($content ? trim($content) : '[No content provided]')."\n\n";
        }

        // Add metadata footer
        $formatted .= "---\nGenerated on: ".now()->format('Y-m-d H:i:s')."\n";

        return $formatted;
    }
}
