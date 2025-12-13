<?php

namespace App\Http\Controllers\Tenant;

use App\Http\Controllers\Controller;
use App\Services\BedrockAIService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Log;

class AIChatController extends Controller
{
    public function __construct(
        private BedrockAIService $bedrockAI
    ) {}

    /**
     * Stream AI chat response with context awareness
     */
    public function stream(Request $request)
    {
        $validated = $request->validate([
            'message' => 'required|string|max:2000',
            'page_context' => 'nullable|array',
            'page_context.url' => 'nullable|string',
            'page_context.title' => 'nullable|string',
            'page_context.html' => 'nullable|string',
            'page_context.text' => 'nullable|string',
            'page_context.form_data' => 'nullable|array',
            'conversation_history' => 'nullable|array|max:10',
        ]);

        $userMessage = $validated['message'];
        $pageContext = $validated['page_context'] ?? null;
        $conversationHistory = $validated['conversation_history'] ?? [];

        // Load knowledge base
        $knowledgeBase = $this->loadKnowledgeBase();

        // Extract key entities and actions from user query for better matching
        $queryEntities = $this->extractQueryEntities($userMessage);

        // Determine if user is specifically asking about the current page
        $isCurrentPageQuery = $this->isCurrentPageQuery($userMessage);

        // Determine if query is asking for navigation/page links
        $isNavigationQuery = $this->isNavigationQuery($userMessage);

        // Determine if query is app-related
        $isAppRelated = $this->isAppRelatedQuery($userMessage, $pageContext) || $isCurrentPageQuery || $isNavigationQuery;

        Log::info('AI Chat Request - Initial', [
            'message' => $userMessage,
            'is_app_related' => $isAppRelated,
            'is_current_page_query' => $isCurrentPageQuery,
            'is_navigation_query' => $isNavigationQuery,
            'has_page_context' => ! empty($pageContext),
            'page_url' => $pageContext['url'] ?? 'N/A',
            'conversation_history_count' => count($conversationHistory),
        ]);

        return response()->stream(function () use ($userMessage, $pageContext, $knowledgeBase, $isAppRelated, $isCurrentPageQuery, $isNavigationQuery, $conversationHistory, $queryEntities) {
            try {
                Log::info('AI Chat - Building prompts', [
                    'is_app_related' => $isAppRelated,
                    'is_current_page_query' => $isCurrentPageQuery,
                    'knowledge_base_loaded' => ! empty($knowledgeBase),
                    'knowledge_base_size' => strlen($knowledgeBase),
                ]);

                // Build context-aware prompt
                $systemPrompt = $this->buildSystemPrompt($isAppRelated, $knowledgeBase, $pageContext, $isCurrentPageQuery, $isNavigationQuery, $userMessage);
                $userPrompt = $this->buildUserPrompt($userMessage, $pageContext, $isAppRelated, $isCurrentPageQuery, $isNavigationQuery, $conversationHistory, $knowledgeBase, $queryEntities);

                Log::info('AI Chat - Prompts built', [
                    'system_prompt_length' => strlen($systemPrompt),
                    'user_prompt_length' => strlen($userPrompt),
                ]);

                Log::info('AI Chat - Starting Bedrock stream');

                $chunksStreamed = 0;

                // Stream response from Bedrock with URL cleaning
                $buffer = '';
                $lastOutputLength = 0;
                $this->bedrockAI->streamResponse(
                    $userPrompt,
                    $systemPrompt,
                    function ($chunk) use (&$chunksStreamed, &$buffer, &$lastOutputLength) {
                        $chunksStreamed++;
                        $buffer .= $chunk;

                        // Clean URLs in markdown links: [text](url)
                        // Handle cases where URLs have trailing punctuation like [text](url).) or [text](url.)
                        $cleaned = preg_replace_callback(
                            '/\[([^\]]+)\]\(([^)]+?)([).,;:!?]*)\)/',
                            function ($matches) {
                                $linkText = $matches[1];
                                $url = rtrim($matches[2], ').,;:!?');

                                // Remove any trailing punctuation that was captured
                                return "[{$linkText}]({$url})";
                            },
                            $buffer
                        );

                        // Also handle cases where there might be extra closing parens: [text](url))
                        $cleaned = preg_replace_callback(
                            '/\[([^\]]+)\]\(([^)]+)\)([).,;:!?]+)/',
                            function ($matches) {
                                $linkText = $matches[1];
                                $url = rtrim($matches[2], ').,;:!?');
                                // Keep only one closing paren and move punctuation outside
                                $trailing = $matches[3];
                                // Remove extra closing parens, keep punctuation
                                $trailing = preg_replace('/^\)+/', '', $trailing);

                                return "[{$linkText}]({$url}){$trailing}";
                            },
                            $cleaned
                        );

                        // Output only the new portion
                        $newOutput = substr($cleaned, $lastOutputLength);
                        echo $newOutput;
                        $lastOutputLength = strlen($cleaned);

                        // Keep buffer manageable (last 1000 chars to catch complete links)
                        if (strlen($buffer) > 1000) {
                            $buffer = substr($buffer, -1000);
                            $lastOutputLength = max(0, $lastOutputLength - (strlen($buffer) - strlen($chunk)));
                        }

                        if (ob_get_level() > 0) {
                            ob_flush();
                        }
                        flush();
                    }
                );

                Log::info('AI Chat - Stream completed successfully', [
                    'chunks_streamed' => $chunksStreamed,
                ]);

            } catch (\Exception $e) {
                Log::error('AI Chat Stream Error', [
                    'error' => $e->getMessage(),
                    'error_class' => get_class($e),
                    'trace' => $e->getTraceAsString(),
                ]);

                echo 'I encountered an error processing your request. Please try again.';
                if (ob_get_level() > 0) {
                    ob_flush();
                }
                flush();
            }
        }, 200, [
            'Content-Type' => 'text/plain',
            'Cache-Control' => 'no-cache',
            'X-Accel-Buffering' => 'no',
        ]);
    }

    /**
     * Load the AI knowledge base
     */
    private function loadKnowledgeBase(): string
    {
        $knowledgeBasePath = base_path('AI_KNOWLEDGE_BASE.md');

        if (File::exists($knowledgeBasePath)) {
            return File::get($knowledgeBasePath);
        }

        Log::warning('Knowledge base file not found', ['path' => $knowledgeBasePath]);

        return '';
    }

    /**
     * Determine if the query is specifically about the CURRENT PAGE
     */
    private function isCurrentPageQuery(string $message): bool
    {
        $currentPageKeywords = [
            'this page', 'current page', 'on this page', 'this form',
            'these fields', 'this button', 'what do i see', 'what am i looking at',
            'explain this page', 'what is here', 'what\'s on this page',
            'on this screen', 'this screen', 'what are these',
        ];

        $messageLower = strtolower($message);

        foreach ($currentPageKeywords as $keyword) {
            if (str_contains($messageLower, $keyword)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Determine if the query is asking for navigation or page links
     */
    private function isNavigationQuery(string $message): bool
    {
        $navigationKeywords = [
            // Where queries
            'where can i', 'where do i', 'where is', 'where to', 'where can you',
            'where do you', 'where should i', 'where should i go',
            // How queries
            'how can i', 'how do i', 'how to', 'how can you', 'how do you',
            'how should i', 'how do you do', 'how can we',
            // Show/take/navigate queries
            'show me', 'show me the', 'take me to', 'take me',
            'navigate to', 'navigate', 'go to', 'go to the',
            'open', 'open the', 'access', 'access the',
            'find', 'find the', 'locate', 'locate the',
            'direct me', 'direct me to', 'how do i get to',
            // Page/link queries
            'what page', 'which page', 'page for', 'link to',
            'url for', 'link for', 'page link', 'give me the link',
            'can you show', 'can you take', 'can you direct',
            'what is the page', 'what\'s the page', 'which page do i',
            // Instruction queries that need navigation
            'i want to', 'i need to', 'help me', 'guide me to',
        ];

        $messageLower = strtolower($message);

        foreach ($navigationKeywords as $keyword) {
            if (str_contains($messageLower, $keyword)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Extract key entities and actions from user query
     *
     * @return array{entities: array<string>, actions: array<string>}
     */
    private function extractQueryEntities(string $message): array
    {
        $messageLower = strtolower($message);

        // Common entities in the EMR system with context awareness
        $entityKeywords = [
            'patient', 'practitioner', 'appointment', 'location', 'service',
            'user', 'role', 'permission', 'note', 'encounter', 'document',
            'invoice', 'wallet', 'consent', 'invitation', 'organization',
            'ledger', 'attendance', 'waiting_list', 'intake',
        ];

        // Common actions
        $actionKeywords = [
            'create', 'add', 'new', 'make', 'build', 'generate', 'register',
            'update', 'edit', 'modify', 'change', 'alter',
            'delete', 'remove', 'archive', 'destroy',
            'view', 'see', 'show', 'display', 'list', 'access', 'go to', 'navigate to',
            'manage', 'handle', 'process', 'administer', 'configure',
            'invite', 'send invitation',
        ];

        $entities = [];
        $actions = [];
        $context = [];

        // Enhanced entity extraction with context
        // Check for user/staff/admin context (RBAC management)
        if (preg_match('/\b(user|users|staff|admin user|rbac|role assignment|staff member)\b/i', $messageLower)) {
            // Check if it's about managing users (not patient/practitioner records)
            if (! preg_match('/\b(patient|practitioner|doctor|physician)\b/i', $messageLower)) {
                $entities[] = 'user';
                $context['user_type'] = 'rbac'; // Indicates RBAC user management
            }
        }

        // Check for patient records context
        if (preg_match('/\b(patient|patients|client|patient record|patient records)\b/i', $messageLower)) {
            $entities[] = 'patient';
            // Determine if it's about patient records (data) vs patient role
            if (preg_match('/\b(create|add|edit|manage|list|view|record|data|database|intake)\b/i', $messageLower)) {
                $context['patient_type'] = 'record'; // Patient record management
            } elseif (preg_match('/\b(dashboard|portal|my|own)\b/i', $messageLower)) {
                $context['patient_type'] = 'role'; // Patient role/dashboard
            } else {
                $context['patient_type'] = 'record'; // Default to record management
            }
        }

        // Check for practitioner records context
        if (preg_match('/\b(practitioner|practitioners|doctor|doctors|physician|physicians|provider)\b/i', $messageLower)) {
            $entities[] = 'practitioner';
            // Determine if it's about practitioner records (profiles) vs practitioner role
            if (preg_match('/\b(create|add|edit|manage|list|view|profile|settings|pricing|location|hours|invitation)\b/i', $messageLower)) {
                $context['practitioner_type'] = 'record'; // Practitioner profile management
            } elseif (preg_match('/\b(dashboard|my|own|assigned|session)\b/i', $messageLower)) {
                $context['practitioner_type'] = 'role'; // Practitioner role/dashboard
            } else {
                $context['practitioner_type'] = 'record'; // Default to record management
            }
        }

        // Extract other entities if not already captured
        foreach ($entityKeywords as $entity) {
            if (str_contains($messageLower, $entity) && ! in_array($entity, $entities)) {
                $entities[] = $entity;
            }
        }

        // Extract actions
        foreach ($actionKeywords as $action) {
            if (str_contains($messageLower, $action)) {
                $actions[] = $action;
            }
        }

        // Map common variations
        $variationMap = [
            'create' => ['add', 'new', 'make', 'generate', 'register'],
            'add' => ['create', 'new'],
            'new' => ['create', 'add'],
            'view' => ['see', 'show', 'display', 'list', 'access'],
            'edit' => ['update', 'modify', 'change'],
        ];

        // Expand actions with variations
        $expandedActions = $actions;
        foreach ($actions as $action) {
            if (isset($variationMap[$action])) {
                $expandedActions = array_merge($expandedActions, $variationMap[$action]);
            }
        }

        return [
            'entities' => array_unique($entities),
            'actions' => array_unique($expandedActions),
            'context' => $context,
        ];
    }

    /**
     * Determine if the query is app-related
     */
    private function isAppRelatedQuery(string $message, ?array $pageContext): bool
    {
        $appKeywords = [
            'appointment', 'patient', 'practitioner', 'schedule', 'settings',
            'location', 'service', 'user', 'role', 'permission', 'dashboard',
            'how do i', 'how to', 'where is', 'where can i', 'how can i',
            'create', 'add', 'update', 'delete', 'manage', 'view', 'edit',
            'new', 'make', 'build', 'remove', 'archive',
        ];

        $messageLower = strtolower($message);

        // Check for app-related keywords
        foreach ($appKeywords as $keyword) {
            if (str_contains($messageLower, $keyword)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Build system prompt based on context
     */
    private function buildSystemPrompt(bool $isAppRelated, string $knowledgeBase, ?array $pageContext, bool $isCurrentPageQuery, bool $isNavigationQuery = false, string $userMessage = ''): string
    {
        if (! $isAppRelated) {
            return 'You are Wellovis AI, a helpful and friendly assistant. Provide concise, accurate answers in a conversational tone. Keep responses under 200 words unless asked for more detail.';
        }

        $prompt = "You are Wellovis AI, an intelligent EMR (Electronic Medical Records) application assistant.\n\n";
        $prompt .= "**Your Role:**\n";
        $prompt .= "- Guide users through workflows and processes in the EMR system\n";
        $prompt .= "- Answer questions about how to accomplish tasks in the application\n";
        $prompt .= "- Explain features, permissions, roles, and access control\n";
        $prompt .= "- Provide step-by-step instructions when needed\n";
        $prompt .= "- Help users understand pages, forms, and available actions\n\n";

        if ($isCurrentPageQuery) {
            $prompt .= "**Current Context:**\n";
            $prompt .= "- The user is asking about the CURRENT PAGE they're viewing\n";
            $prompt .= "- Use the page context provided below to answer their question\n";
            $prompt .= "- Explain the page's purpose, fields, buttons, and available actions\n";
            $prompt .= "- Reference specific elements visible on the page\n\n";
        } else {
            $prompt .= "**Important Priority Rules:**\n";
            $prompt .= "- ALWAYS prioritize information from the Knowledge Base below\n";
            $prompt .= "- The Knowledge Base contains the authoritative, complete information about the application\n";
            $prompt .= "- For general questions (e.g., 'where can I add a practitioner?'), rely on the Knowledge Base\n";
            $prompt .= "- If you find partial information in the Knowledge Base, provide what you know and use it to give helpful guidance\n";
            $prompt .= "- If the Knowledge Base mentions related information (e.g., appointment creation mentions patient search), use that context to help the user\n";
            $prompt .= "- Never say 'I cannot provide' or 'I am limited' - always provide helpful information based on available context\n";
            $prompt .= "- If exact information isn't found, infer reasonable answers from related information in the Knowledge Base\n\n";
        }

        $prompt .= "**Response Guidelines:**\n";
        $prompt .= "- Be concise and actionable (under 200 words for simple queries)\n";
        $prompt .= "- Use bullet points for steps or lists\n";
        $prompt .= "- Provide exact navigation paths from the Knowledge Base when available (e.g., 'Go to Settings > Practitioners > Add Practitioner')\n";
        $prompt .= "- **Format links properly:** Always use markdown link format [Text](URL) - never show URLs in plain text or parentheses\n";
        $prompt .= "- **Link text clarity:** Use descriptive link text that matches the destination (e.g., 'Create Appointment' for /appointments/create, 'Appointments List' for /appointments)\n";
        $prompt .= "- If partial information exists, provide what you know and suggest where the user might find more details\n";
        $prompt .= "- Explain 'why' when describing constraints or permissions\n";
        $prompt .= "- Never fabricate information — stick to the knowledge base, but use all available context creatively\n";
        $prompt .= "- Always be helpful and constructive, even when information is incomplete\n";
        $prompt .= "- **UI Presentation:** Format responses cleanly with proper markdown - use links, bullet points, and clear structure\n\n";

        if ($isNavigationQuery) {
            $prompt .= "**CRITICAL: Navigation Query Detected**\n";
            $prompt .= "- The user is asking HOW or WHERE to do something, or wants to be shown/taken to a page\n";
            $prompt .= "- For ANY query asking HOW or WHERE to do something, you MUST ALWAYS include the full absolute URL\n";
            $prompt .= "- You MUST provide COMPLETE CONTEXT: explain what the page is for, what actions can be performed, who can access it, and any important constraints\n";
            $prompt .= "- **URL FORMATTING - CRITICAL:**\n";
            $prompt .= "  * ALWAYS format URLs as proper markdown links: [Link Text](URL)\n";
            $prompt .= "  * The link text should be descriptive and match the destination (e.g., 'Create Appointment' for /appointments/create, 'Appointments List' for /appointments)\n";
            $prompt .= "  * The URL must be the EXACT URL from the list below - use it exactly as shown\n";
            $prompt .= "  * DO NOT show URLs in plain text, parentheses, or as separate lines - always integrate them as markdown links\n";
            $prompt .= "  * Example CORRECT: 'Go to [Create Appointment](http://domain.com/appointments/create) to create a new appointment.'\n";
            $prompt .= "  * Example WRONG: 'Go to (http://domain.com/appointments/create)' or 'http://domain.com/appointments/create' or '[Appointments → Create](http://domain.com/appointments)'\n";
            $prompt .= "- **CRITICAL: URLs must be clean - no trailing punctuation, parentheses, or periods**\n";
            $prompt .= "- **URL format: [Text](http://domain.com/path) - the URL inside parentheses must end cleanly without any trailing characters**\n";
            $prompt .= "- Use the Page URLs provided below - they are already converted to absolute URLs\n";
            $prompt .= "- **IMPORTANT: Match the action requested with the correct page URL:**\n";
            $prompt .= "  * For 'create' or 'add' actions → use the /create URL (e.g., /patients/create, /appointments/create)\n";
            $prompt .= "  * For 'edit' or 'update' actions → use the base edit URL without dynamic segments (e.g., /appointments/{id}/edit becomes /appointments/edit)\n";
            $prompt .= "  * For 'view' or 'list' actions → use the index URL (e.g., /patients, /appointments)\n";
            $prompt .= "  * For 'show' or 'details' actions → use the base show URL without dynamic segments\n";
            $prompt .= "  * For 'invite' actions → use the /invite or /invitations URL\n";
            $prompt .= "- **CRITICAL: URLs with dynamic segments (like {id} or [appointment_id]) have been mapped to parent routes**\n";
            $prompt .= "- **For routes requiring IDs (like /appointments/{id}/manage-appointment):**\n";
            $prompt .= "  * The URL provided is the parent/index route (e.g., /appointments)\n";
            $prompt .= "  * You MUST provide navigation instructions: 'Go to [parent route], select an item, then [action]'\n";
            $prompt .= "  * Example: 'To manage an appointment, go to [Appointments](http://domain.com/appointments), select an appointment from the list, then click Manage'\n";
            $prompt .= "- **NEVER include dynamic segments like {id}, [appointment_id] in URLs - use the parent routes provided**\n";
            $prompt .= "- **NEVER provide URLs that don't exist (like /appointments/manage-appointment without an ID)**\n";
            $prompt .= "- The Page URLs list below includes action-specific mappings - use the one that matches the requested action\n";
            $prompt .= "- If a URL mapping includes '→ navigate via', use that navigation instruction\n";
            $prompt .= "- Provide BOTH: (1) Complete contextual information from the Knowledge Base AND (2) The correct parent URL with navigation instructions\n";
            $prompt .= "- Keep responses concise (under 200 words) - provide key information and the link\n";
            $prompt .= "- Do NOT repeat information - be direct and to the point\n";
            $prompt .= "- **RESPONSE FORMATTING:**\n";
            $prompt .= "  * Use clear, concise sentences with proper grammar\n";
            $prompt .= "  * Integrate the link naturally into the sentence flow\n";
            $prompt .= "  * Use proper markdown formatting for all links\n";
            $prompt .= "  * Keep the response well-structured and easy to read\n";
            $prompt .= "  * The link text should clearly indicate what the user will find at that URL\n";
            $prompt .= "- Example response formats:\n";
            $prompt .= "  For direct routes: 'To create a patient, go to [Create Patient](http://domain.com/patients/create). This page allows you to [brief description].'\n";
            $prompt .= "  For dynamic routes: 'To manage an appointment, go to [Appointments](http://domain.com/appointments), select an appointment from the list, then click Manage. This allows you to [brief description].'\n";
            $prompt .= "- **IMPORTANT:** The link text must match the actual destination URL (e.g., if URL is /appointments/create, link text should be 'Create Appointment' not 'Appointments')\n";
            $prompt .= "- **CRITICAL URL FORMATTING - READ CAREFULLY:**\n";
            $prompt .= "  * The URL inside parentheses MUST end cleanly with NO punctuation\n";
            $prompt .= "  * Punctuation ALWAYS goes AFTER the closing parenthesis, NEVER inside\n";
            $prompt .= "  * CORRECT examples:\n";
            $prompt .= "    - [Create Appointment](http://domain.com/appointments/create).\n";
            $prompt .= "    - [Patient List](http://domain.com/patients), then select a patient.\n";
            $prompt .= "  * WRONG examples (DO NOT DO THIS):\n";
            $prompt .= "    - [Create Appointment](http://domain.com/appointments/create).) ← extra closing paren\n";
            $prompt .= "    - [Create Appointment](http://domain.com/appointments/create.) ← period inside URL\n";
            $prompt .= "    - [Create Appointment](http://domain.com/appointments/create)) ← extra closing paren\n";
            $prompt .= "  * Before outputting ANY markdown link, check: URL ends cleanly, punctuation is outside\n";
            $prompt .= "- **NEVER show URLs in parentheses without markdown link formatting**\n";
            $prompt .= "- When user asks 'how can I' or 'where can I', provide both complete instructions AND the specific page URL link matching the action\n";
            $prompt .= "- Do NOT just provide the link - always include the full context about what can be done on that page\n\n";
        }

        if (! empty($knowledgeBase)) {
            // For current page queries, extract page-specific knowledge
            // For navigation queries, load full knowledge base to provide complete context
            // For general queries, use semantic search to find relevant content
            if ($isCurrentPageQuery && $pageContext) {
                $relevantKnowledge = $this->extractRelevantKnowledge($knowledgeBase, $pageContext);
            } elseif ($isNavigationQuery) {
                // For navigation queries, load full knowledge base to provide complete context along with URLs
                $relevantKnowledge = substr($knowledgeBase, 0, 12000);
            } else {
                // For general questions, use semantic search to find relevant content
                // Increase to 15000 chars for better context
                if (! empty($userMessage)) {
                    $relevantKnowledge = $this->findRelevantKnowledge($knowledgeBase, $userMessage);
                } else {
                    $relevantKnowledge = substr($knowledgeBase, 0, 15000);
                }
            }

            if ($relevantKnowledge) {
                $prompt .= "**Application Knowledge Base (USE THIS AS PRIMARY SOURCE):**\n\n";
                $prompt .= $relevantKnowledge."\n\n";
            }
        }

        return $prompt;
    }

    /**
     * Extract page URLs from knowledge base and return mappings
     *
     * @return array<string, string> Array mapping descriptions/actions to absolute URLs
     */
    private function extractPageUrlsFromKnowledge(string $knowledgeBase): array
    {
        $urlMappings = [];

        if (empty($knowledgeBase)) {
            return $urlMappings;
        }

        // Try to parse JSON structure from knowledge base
        // Look for JSON blocks in the markdown
        $jsonStart = strpos($knowledgeBase, '{');
        if ($jsonStart === false) {
            return $urlMappings;
        }

        // Find the end of the JSON structure (look for closing brace at root level)
        $jsonContent = '';
        $braceCount = 0;
        $inString = false;
        $escapeNext = false;

        for ($i = $jsonStart; $i < strlen($knowledgeBase); $i++) {
            $char = $knowledgeBase[$i];

            if ($escapeNext) {
                $jsonContent .= $char;
                $escapeNext = false;

                continue;
            }

            if ($char === '\\') {
                $escapeNext = true;
                $jsonContent .= $char;

                continue;
            }

            if ($char === '"' && ! $escapeNext) {
                $inString = ! $inString;
            }

            $jsonContent .= $char;

            if (! $inString) {
                if ($char === '{') {
                    $braceCount++;
                } elseif ($char === '}') {
                    $braceCount--;
                    if ($braceCount === 0) {
                        break;
                    }
                }
            }
        }

        // Try to decode JSON
        $decoded = json_decode($jsonContent, true);
        if (! is_array($decoded)) {
            // Fallback: extract URLs using regex patterns
            return $this->extractUrlsWithRegex($knowledgeBase);
        }

        // Extract URLs from knowledge structure
        foreach ($decoded as $tenantId => $tenantData) {
            if (! is_array($tenantData) || ! isset($tenantData['knowledge'])) {
                continue;
            }

            $knowledge = $tenantData['knowledge'];

            // Extract from "where_to_do_what" array
            if (isset($knowledge['where_to_do_what']) && is_array($knowledge['where_to_do_what'])) {
                foreach ($knowledge['where_to_do_what'] as $item) {
                    if (isset($item['action']) && isset($item['url'])) {
                        $action = $item['action'];
                        $url = $item['url'];
                        // Clean URL to remove dynamic segments
                        $cleanUrl = $this->cleanDynamicUrl($url);
                        $absoluteUrl = $this->generateAbsoluteUrl($cleanUrl);
                        $urlMappings[$action] = $absoluteUrl;

                        // Also add "where" description if available
                        if (isset($item['where'])) {
                            $urlMappings[$item['where']] = $absoluteUrl;
                        }
                    }
                }
            }

            // Extract from "navigation" object
            if (isset($knowledge['navigation']) && is_array($knowledge['navigation'])) {
                $this->extractNavigationUrls($knowledge['navigation'], $urlMappings);
            }

            // Extract from knowledge keys (URL paths) with action-specific mappings
            foreach ($knowledge as $key => $value) {
                if (is_string($key) && str_starts_with($key, '/') && is_array($value)) {
                    // Check if URL has dynamic segments
                    $hasDynamicSegment = preg_match('/\{[^}]+\}/', $key) || preg_match('/\[[^\]]+\]/', $key);

                    // Get cleaned URL (parent route if dynamic)
                    $cleanUrl = $this->cleanDynamicUrl($key);
                    $absoluteUrl = $this->generateAbsoluteUrl($cleanUrl);
                    $pageTitle = $value['page_title'] ?? '';
                    $module = $value['module'] ?? '';
                    $description = $value['description'] ?? '';

                    // Determine page type/action from URL pattern (use original key for pattern matching)
                    $pageType = $this->determinePageType($key);
                    $basePath = $this->getBasePath($key);

                    // Get navigation context for dynamic routes
                    $navigationContext = $hasDynamicSegment ? $this->getNavigationContext($key, $pageTitle, $module) : null;

                    // Map page title
                    if ($pageTitle) {
                        $urlMappings[$pageTitle] = $absoluteUrl;
                        // Add action-specific mappings
                        if ($pageType) {
                            $urlMappings["{$pageTitle} ({$pageType})"] = $absoluteUrl;
                            $urlMappings["{$module} {$pageType}"] = $absoluteUrl;
                        }

                        // Add navigation context for dynamic routes
                        if ($navigationContext) {
                            $urlMappings["{$pageTitle} (navigate via)"] = $absoluteUrl.' → '.$navigationContext;
                        }
                    }

                    // Map description
                    if ($description) {
                        $urlMappings[$description] = $absoluteUrl;
                    }

                    // Map by action keywords found in description
                    $actionKeywords = $this->extractActionKeywords($description, $pageTitle);
                    foreach ($actionKeywords as $action) {
                        if ($basePath) {
                            $urlMappings["{$action} {$basePath}"] = $absoluteUrl;
                            $urlMappings["{$action} {$module}"] = $absoluteUrl;
                        }
                    }

                    // Map user actions if available
                    if (isset($value['user_actions']) && is_array($value['user_actions'])) {
                        foreach ($value['user_actions'] as $userAction) {
                            $actionLower = strtolower($userAction);
                            if (preg_match('/\b(create|add|new|make|generate|register)\b/i', $actionLower)) {
                                $urlMappings["create {$basePath}"] = $absoluteUrl;
                                $urlMappings["add {$basePath}"] = $absoluteUrl;
                            } elseif (preg_match('/\b(edit|update|modify|change)\b/i', $actionLower)) {
                                $urlMappings["edit {$basePath}"] = $absoluteUrl;
                                $urlMappings["update {$basePath}"] = $absoluteUrl;
                            } elseif (preg_match('/\b(view|show|see|display|list)\b/i', $actionLower)) {
                                $urlMappings["view {$basePath}"] = $absoluteUrl;
                                $urlMappings["list {$basePath}"] = $absoluteUrl;
                            }
                        }
                    }
                }
            }
        }

        return $urlMappings;
    }

    /**
     * Recursively extract URLs from navigation structure
     */
    private function extractNavigationUrls(array $navigation, array &$urlMappings): void
    {
        foreach ($navigation as $key => $value) {
            if (is_array($value)) {
                if (isset($value['url']) && isset($value['label'])) {
                    // Clean URL to remove dynamic segments
                    $cleanUrl = $this->cleanDynamicUrl($value['url']);
                    $absoluteUrl = $this->generateAbsoluteUrl($cleanUrl);
                    $urlMappings[$value['label']] = $absoluteUrl;
                }
                // Recursively process nested structures
                $this->extractNavigationUrls($value, $urlMappings);
            }
        }
    }

    /**
     * Fallback: Extract URLs using regex patterns
     */
    private function extractUrlsWithRegex(string $knowledgeBase): array
    {
        $urlMappings = [];

        // Pattern to match "url": "/path" in JSON-like structures
        preg_match_all('/"url"\s*:\s*"([^"]+)"/', $knowledgeBase, $urlMatches);
        if (! empty($urlMatches[1])) {
            foreach ($urlMatches[1] as $url) {
                if (str_starts_with($url, '/')) {
                    // Clean URL to remove dynamic segments
                    $cleanUrl = $this->cleanDynamicUrl($url);
                    $absoluteUrl = $this->generateAbsoluteUrl($cleanUrl);
                    $urlMappings[$url] = $absoluteUrl;
                }
            }
        }

        // Pattern to match action/where mappings
        preg_match_all('/"action"\s*:\s*"([^"]+)".*?"url"\s*:\s*"([^"]+)"/s', $knowledgeBase, $actionMatches);
        if (! empty($actionMatches[1]) && ! empty($actionMatches[2])) {
            foreach ($actionMatches[1] as $index => $action) {
                $url = $actionMatches[2][$index] ?? null;
                if ($url && str_starts_with($url, '/')) {
                    // Clean URL to remove dynamic segments
                    $cleanUrl = $this->cleanDynamicUrl($url);
                    $absoluteUrl = $this->generateAbsoluteUrl($cleanUrl);
                    $urlMappings[$action] = $absoluteUrl;
                }
            }
        }

        return $urlMappings;
    }

    /**
     * Get parent route mapping for dynamic routes
     */
    private function getParentRouteMapping(): array
    {
        return [
            // Appointments
            '/appointments/{id}/manage' => '/appointments',
            '/appointments/{id}/manage-appointment' => '/appointments',
            '/appointments/{id}/edit' => '/appointments',
            '/appointments/{id}/session' => '/appointments',
            '/appointments/{id}/ai-summary' => '/appointments',
            '/appointments/{appointment}/manage' => '/appointments',
            '/appointments/[appointment_id]/manage-appointment' => '/appointments',
            '/appointments/{appointment}/session' => '/appointments',
            '/appointments/{appointment}/ai-summary' => '/appointments',

            // Patients
            '/patients/{id}' => '/patients',
            '/patients/{id}/edit' => '/patients',
            '/patients/{id}/edit-medical-history' => '/patients',
            '/patients/{id}/invite' => '/patients',
            '/patients/{patient}/edit' => '/patients',
            '/patients/{patient}/edit-medical-history' => '/patients',
            '/patients/{patient}/invite' => '/patients',

            // Invoices
            '/invoices/{id}' => '/invoices',
            '/invoices/{id}/edit' => '/invoices',
            '/invoices/{invoice}/transactions' => '/invoices',
            '/invoices/{invoice}/create-transaction' => '/invoices',

            // Practitioners
            '/practitioners/{id}' => '/settings/practitioners/list',
            '/practitioners/{id}/edit' => '/settings/practitioners/list',
            '/practitioners/{practitioner}/locations' => '/settings/practitioners/list',
            '/practitioners/{practitioner}/services' => '/settings/practitioners/list',

            // Encounters
            '/encounters/{id}/documents' => '/appointments',
            '/encounters/{encounter_id}/documents' => '/appointments',

            // Wallet
            '/wallet/{id}/recalculate' => '/wallet',
            '/wallet/{wallet}/recalculate' => '/wallet',
        ];
    }

    /**
     * Get navigation context for dynamic routes
     */
    private function getNavigationContext(string $url, string $pageTitle, string $module): string
    {
        $urlLower = strtolower($url);
        $basePath = $this->getBasePath($url);

        // Determine navigation instruction based on URL pattern
        if (str_contains($urlLower, '/manage') || str_contains($urlLower, 'manage-appointment')) {
            return "Go to {$basePath} list, select an item, then click Manage";
        }
        if (str_contains($urlLower, '/edit')) {
            return "Go to {$basePath} list, select an item, then click Edit";
        }
        if (str_contains($urlLower, '/session')) {
            return 'Go to appointments list, select an appointment, then click Start Session';
        }
        if (str_contains($urlLower, '/ai-summary')) {
            return 'Go to appointments list, select an appointment, then click AI Summary';
        }
        if (str_contains($urlLower, '/invite')) {
            return "Go to {$basePath} list, select an item, then click Invite";
        }
        if (str_contains($urlLower, '/transactions')) {
            return 'Go to invoices list, select an invoice, then view Transactions';
        }
        if (str_contains($urlLower, '/documents')) {
            return 'Go to appointments list, select an appointment, then view Documents';
        }
        if (preg_match('/\/\{[^}]+\}$/', $urlLower) || preg_match('/\/\[[^\]]+\]$/', $urlLower)) {
            return "Go to {$basePath} list, then select an item to view details";
        }

        return "Go to {$basePath} list, then select an item";
    }

    /**
     * Clean URL by removing dynamic segments or mapping to parent route
     */
    private function cleanDynamicUrl(string $url): string
    {
        // Check if this URL has a parent route mapping
        $parentMapping = $this->getParentRouteMapping();

        // Normalize URL for matching (handle both {id} and [id] formats)
        $normalizedUrl = preg_replace('/\{([^}]+)\}/', '{$1}', $url);
        $normalizedUrl = preg_replace('/\[([^\]]+)\]/', '{$1}', $normalizedUrl);

        // Try exact match first
        if (isset($parentMapping[$url])) {
            return $parentMapping[$url];
        }

        // Try normalized match
        if (isset($parentMapping[$normalizedUrl])) {
            return $parentMapping[$normalizedUrl];
        }

        // Try pattern matching for dynamic segments
        foreach ($parentMapping as $pattern => $parentRoute) {
            // Convert pattern to regex
            $regexPattern = preg_replace('/\{[^}]+\}/', '[^/]+', $pattern);
            $regexPattern = preg_replace('/\[[^\]]+\]/', '[^/]+', $regexPattern);
            $regexPattern = '#^'.$regexPattern.'$#';

            if (preg_match($regexPattern, $url)) {
                return $parentRoute;
            }
        }

        // If no parent mapping found, check if URL has dynamic segments
        $hasDynamicSegment = preg_match('/\{[^}]+\}/', $url) || preg_match('/\[[^\]]+\]/', $url);

        if ($hasDynamicSegment) {
            // Extract base path (first segment)
            $parts = explode('/', trim($url, '/'));
            if (! empty($parts[0])) {
                // Return parent index route
                return '/'.$parts[0];
            }
        }

        // Remove dynamic segments like {id}, [appointment_id], etc.
        $url = preg_replace('/\{[^}]+\}/', '', $url);
        $url = preg_replace('/\[[^\]]+\]/', '', $url);

        // Clean up double slashes
        $url = preg_replace('/\/+/', '/', $url);

        // Remove trailing slash if not root
        $url = rtrim($url, '/');
        if (empty($url)) {
            $url = '/';
        }

        return $url;
    }

    /**
     * Determine page type from URL pattern (index, create, edit, show, etc.)
     */
    private function determinePageType(string $url): ?string
    {
        $urlLower = strtolower($url);

        if (str_contains($urlLower, '/create')) {
            return 'create';
        }
        if (preg_match('/\/\d+\/edit/', $urlLower) || str_contains($urlLower, '/edit')) {
            return 'edit';
        }
        if (preg_match('/\/\d+\/manage/', $urlLower) || str_contains($urlLower, '/manage')) {
            return 'manage';
        }
        if (preg_match('/\/\d+\/invite/', $urlLower) || str_contains($urlLower, '/invite')) {
            return 'invite';
        }
        if (preg_match('/\/\d+$/', $urlLower) && ! str_contains($urlLower, '/edit') && ! str_contains($urlLower, '/create')) {
            return 'show';
        }
        if (str_contains($urlLower, '/invitations')) {
            return 'invitations';
        }
        if (str_contains($urlLower, '/index') || (preg_match('/^\/[^\/]+$/', $urlLower) && ! str_contains($urlLower, '{'))) {
            return 'index';
        }

        return null;
    }

    /**
     * Get base path/module name from URL
     */
    private function getBasePath(string $url): string
    {
        // Remove leading slash and extract base path
        $url = ltrim($url, '/');

        // Remove dynamic segments like {id}, [appointment_id]
        $url = preg_replace('/\{[^}]+\}/', '', $url);
        $url = preg_replace('/\[[^\]]+\]/', '', $url);

        // Extract first segment as base path
        $parts = explode('/', $url);
        $base = $parts[0] ?? '';

        // Map common paths to readable names
        $pathMap = [
            'patients' => 'patient',
            'practitioners' => 'practitioner',
            'appointments' => 'appointment',
            'invoices' => 'invoice',
            'notes' => 'note',
            'users' => 'user',
            'roles' => 'role',
            'services' => 'service',
            'locations' => 'location',
            'consents' => 'consent',
            'wallet' => 'wallet',
            'ledger' => 'ledger',
            'attendance' => 'attendance',
            'waiting-list' => 'waiting list',
            'intake' => 'intake',
        ];

        return $pathMap[$base] ?? $base;
    }

    /**
     * Extract action keywords from description and page title
     */
    private function extractActionKeywords(string $description, string $pageTitle): array
    {
        $text = strtolower($description.' '.$pageTitle);
        $actions = [];

        if (preg_match('/\b(create|add|new|make|generate|register)\b/', $text)) {
            $actions[] = 'create';
            $actions[] = 'add';
        }
        if (preg_match('/\b(edit|update|modify|change)\b/', $text)) {
            $actions[] = 'edit';
            $actions[] = 'update';
        }
        if (preg_match('/\b(view|show|see|display|list|index)\b/', $text)) {
            $actions[] = 'view';
            $actions[] = 'list';
        }
        if (preg_match('/\b(manage|handle|administer)\b/', $text)) {
            $actions[] = 'manage';
        }
        if (preg_match('/\b(invite|send invitation)\b/', $text)) {
            $actions[] = 'invite';
        }

        return array_unique($actions);
    }

    /**
     * Generate absolute URL from relative path
     */
    private function generateAbsoluteUrl(string $path): string
    {
        if (empty($path)) {
            return '';
        }

        // If already absolute, return as is
        if (str_starts_with($path, 'http://') || str_starts_with($path, 'https://')) {
            return $path;
        }

        // Ensure path starts with /
        if (! str_starts_with($path, '/')) {
            $path = '/'.$path;
        }

        // Use Laravel's url() helper to generate absolute URL
        return url($path);
    }

    /**
     * Find relevant knowledge using semantic/keyword matching
     */
    private function findRelevantKnowledge(string $knowledgeBase, string $userMessage): string
    {
        // Extract keywords from user message
        $queryEntities = $this->extractQueryEntities($userMessage);
        $keywords = array_merge($queryEntities['entities'], $queryEntities['actions']);

        // Add common related terms
        $relatedTerms = [];
        foreach ($queryEntities['entities'] as $entity) {
            $relatedTerms[] = $entity;
            // Add plural/singular variations
            if (str_ends_with($entity, 's')) {
                $relatedTerms[] = substr($entity, 0, -1);
            } else {
                $relatedTerms[] = $entity.'s';
            }
        }

        $allKeywords = array_unique(array_merge($keywords, $relatedTerms));

        if (empty($allKeywords)) {
            // No keywords found, return general knowledge
            return substr($knowledgeBase, 0, 15000);
        }

        // Try to find JSON structure first
        $jsonStart = strpos($knowledgeBase, '{');
        if ($jsonStart !== false) {
            // Extract JSON content
            $jsonContent = '';
            $braceCount = 0;
            $inString = false;
            $escapeNext = false;

            for ($i = $jsonStart; $i < strlen($knowledgeBase) && $i < $jsonStart + 50000; $i++) {
                $char = $knowledgeBase[$i];

                if ($escapeNext) {
                    $jsonContent .= $char;
                    $escapeNext = false;

                    continue;
                }

                if ($char === '\\') {
                    $escapeNext = true;
                    $jsonContent .= $char;

                    continue;
                }

                if ($char === '"' && ! $escapeNext) {
                    $inString = ! $inString;
                }

                $jsonContent .= $char;

                if (! $inString) {
                    if ($char === '{') {
                        $braceCount++;
                    } elseif ($char === '}') {
                        $braceCount--;
                        if ($braceCount === 0) {
                            break;
                        }
                    }
                }
            }

            $decoded = json_decode($jsonContent, true);
            if (is_array($decoded)) {
                $relevantSections = $this->searchKnowledgeBaseJson($decoded, $allKeywords);
                if (! empty($relevantSections)) {
                    return $relevantSections;
                }
            }
        }

        // Fallback: search entire knowledge base for keywords
        return $this->searchKnowledgeBaseText($knowledgeBase, $allKeywords);
    }

    /**
     * Search JSON knowledge base structure for relevant sections
     */
    private function searchKnowledgeBaseJson(array $decoded, array $keywords): string
    {
        $relevantSections = [];
        $foundUrls = [];

        foreach ($decoded as $tenantId => $tenantData) {
            if (! is_array($tenantData) || ! isset($tenantData['knowledge'])) {
                continue;
            }

            $knowledge = $tenantData['knowledge'];

            // Search in "where_to_do_what" array
            if (isset($knowledge['where_to_do_what']) && is_array($knowledge['where_to_do_what'])) {
                foreach ($knowledge['where_to_do_what'] as $item) {
                    $itemText = json_encode($item);
                    foreach ($keywords as $keyword) {
                        if (stripos($itemText, $keyword) !== false) {
                            $relevantSections[] = $itemText;
                            if (isset($item['url'])) {
                                $foundUrls[] = $item['url'];
                            }
                            break;
                        }
                    }
                }
            }

            // Search in page descriptions
            foreach ($knowledge as $key => $value) {
                if (is_string($key) && str_starts_with($key, '/') && is_array($value)) {
                    $pageText = json_encode($value);
                    foreach ($keywords as $keyword) {
                        if (stripos($pageText, $keyword) !== false) {
                            $relevantSections[] = $pageText;
                            $foundUrls[] = $key;
                            break;
                        }
                    }
                }
            }

            // Search in navigation
            if (isset($knowledge['navigation']) && is_array($knowledge['navigation'])) {
                $navText = json_encode($knowledge['navigation']);
                foreach ($keywords as $keyword) {
                    if (stripos($navText, $keyword) !== false) {
                        $relevantSections[] = $navText;
                        break;
                    }
                }
            }
        }

        if (! empty($relevantSections)) {
            $result = implode("\n\n", array_slice($relevantSections, 0, 20));
            // Add general context if we found specific matches
            if (strlen($result) < 5000) {
                $result .= "\n\n".substr(json_encode($decoded, JSON_PRETTY_PRINT), 0, 10000);
            }

            return substr($result, 0, 15000);
        }

        return '';
    }

    /**
     * Search knowledge base text for keywords
     */
    private function searchKnowledgeBaseText(string $knowledgeBase, array $keywords): string
    {
        $lines = explode("\n", $knowledgeBase);
        $relevantLines = [];
        $score = [];

        foreach ($lines as $lineNum => $line) {
            $lineLower = strtolower($line);
            $lineScore = 0;

            foreach ($keywords as $keyword) {
                $keywordLower = strtolower($keyword);
                if (str_contains($lineLower, $keywordLower)) {
                    $lineScore += substr_count($lineLower, $keywordLower);
                }
            }

            if ($lineScore > 0) {
                $relevantLines[$lineNum] = $lineScore;
            }
        }

        // Sort by score and get top matches
        arsort($relevantLines);
        $topLineNums = array_slice(array_keys($relevantLines), 0, 200);

        // Extract context around matches (5 lines before and after)
        $contextLines = [];
        foreach ($topLineNums as $lineNum) {
            $start = max(0, $lineNum - 5);
            $end = min(count($lines), $lineNum + 6);
            for ($i = $start; $i < $end; $i++) {
                if (! isset($contextLines[$i])) {
                    $contextLines[$i] = $lines[$i];
                }
            }
        }

        ksort($contextLines);
        $result = implode("\n", $contextLines);

        // If result is too short, add general knowledge
        if (strlen($result) < 3000) {
            $result = substr($knowledgeBase, 0, 15000);
        } else {
            $result = substr($result, 0, 15000);
        }

        return $result;
    }

    /**
     * Extract relevant knowledge based on current page context
     */
    private function extractRelevantKnowledge(string $knowledgeBase, ?array $pageContext): string
    {
        if (! $pageContext || empty($pageContext['url'])) {
            // Return a general excerpt
            return substr($knowledgeBase, 0, 3000);
        }

        $currentUrl = $pageContext['url'];
        $urlPath = parse_url($currentUrl, PHP_URL_PATH);

        // Try to find the specific page in the knowledge base
        $lines = explode("\n", $knowledgeBase);
        $relevantSection = [];
        $capturing = false;
        $captureDepth = 0;

        foreach ($lines as $line) {
            // Look for the URL in the JSON structure
            if (str_contains($line, '"'.$urlPath.'"') || str_contains($line, $urlPath)) {
                $capturing = true;
                $captureDepth = 0;
            }

            if ($capturing) {
                $relevantSection[] = $line;

                // Track JSON depth
                if (str_contains($line, '{')) {
                    $captureDepth++;
                }
                if (str_contains($line, '}')) {
                    $captureDepth--;
                    if ($captureDepth <= 0) {
                        $capturing = false;
                    }
                }

                // Stop if we've captured enough
                if (count($relevantSection) > 100) {
                    break;
                }
            }
        }

        $relevant = implode("\n", $relevantSection);

        // If no specific match, try semantic search as fallback
        if (empty($relevant)) {
            // Extract keywords from URL path
            $pathParts = explode('/', trim($urlPath, '/'));
            $keywords = array_filter($pathParts, fn ($part) => strlen($part) > 2);
            if (! empty($keywords)) {
                $relevant = $this->searchKnowledgeBaseText($knowledgeBase, array_values($keywords));
            }

            // If still empty, return general knowledge
            if (empty($relevant)) {
                return substr($knowledgeBase, 0, 3000);
            }
        }

        return $relevant;
    }

    /**
     * Build user prompt with context
     */
    private function buildUserPrompt(string $message, ?array $pageContext, bool $isAppRelated, bool $isCurrentPageQuery, bool $isNavigationQuery, array $conversationHistory, string $knowledgeBase = '', array $queryEntities = []): string
    {
        if (! $isAppRelated) {
            return $message;
        }

        $prompt = '';

        // Add conversation history
        if (! empty($conversationHistory)) {
            $prompt .= "**Recent Conversation:**\n\n";
            foreach (array_slice($conversationHistory, -3) as $exchange) {
                $prompt .= 'User: '.$exchange['user']."\n";
                $prompt .= 'Assistant: '.$exchange['assistant']."\n\n";
            }
        }

        // Add page URL mappings if navigation query detected
        if ($isNavigationQuery && ! empty($knowledgeBase)) {
            $pageUrls = $this->extractPageUrlsFromKnowledge($knowledgeBase);
            if (! empty($pageUrls)) {
                $prompt .= "**Page URLs Available (Match action with correct URL):**\n\n";

                // Group URLs by action type for better matching
                $groupedUrls = [
                    'create' => [],
                    'edit' => [],
                    'view' => [],
                    'list' => [],
                    'invite' => [],
                    'other' => [],
                ];

                foreach ($pageUrls as $description => $url) {
                    $descLower = strtolower($description);
                    $urlLower = strtolower($url);

                    // Categorize based on description and URL
                    if (str_contains($descLower, 'create') || str_contains($descLower, 'add') || str_contains($urlLower, '/create')) {
                        $groupedUrls['create'][$description] = $url;
                    } elseif (str_contains($descLower, 'edit') || str_contains($descLower, 'update') || str_contains($urlLower, '/edit')) {
                        $groupedUrls['edit'][$description] = $url;
                    } elseif (str_contains($descLower, 'invite') || str_contains($urlLower, '/invite') || str_contains($urlLower, '/invitations')) {
                        $groupedUrls['invite'][$description] = $url;
                    } elseif (str_contains($descLower, 'list') || str_contains($descLower, 'index') || (! str_contains($urlLower, '/') && ! str_contains($urlLower, '{'))) {
                        $groupedUrls['list'][$description] = $url;
                    } elseif (str_contains($descLower, 'view') || str_contains($descLower, 'show') || str_contains($descLower, 'details')) {
                        $groupedUrls['view'][$description] = $url;
                    } else {
                        $groupedUrls['other'][$description] = $url;
                    }
                }

                // Helper function to clean URL
                $cleanUrl = function ($url) {
                    return rtrim($url, ').,;:!?');
                };

                // Display grouped URLs with cleaned URLs
                if (! empty($groupedUrls['create'])) {
                    $prompt .= "**CREATE/ADD Actions:**\n";
                    foreach ($groupedUrls['create'] as $desc => $url) {
                        $clean = $cleanUrl($url);
                        $prompt .= "  - {$desc} → {$clean}\n";
                    }
                    $prompt .= "\n";
                }

                if (! empty($groupedUrls['edit'])) {
                    $prompt .= "**EDIT/UPDATE Actions:**\n";
                    foreach ($groupedUrls['edit'] as $desc => $url) {
                        $clean = $cleanUrl($url);
                        $prompt .= "  - {$desc} → {$clean}\n";
                    }
                    $prompt .= "\n";
                }

                if (! empty($groupedUrls['view'])) {
                    $prompt .= "**VIEW/SHOW Actions:**\n";
                    foreach ($groupedUrls['view'] as $desc => $url) {
                        $clean = $cleanUrl($url);
                        $prompt .= "  - {$desc} → {$clean}\n";
                    }
                    $prompt .= "\n";
                }

                if (! empty($groupedUrls['list'])) {
                    $prompt .= "**LIST/INDEX Pages:**\n";
                    foreach ($groupedUrls['list'] as $desc => $url) {
                        $clean = $cleanUrl($url);
                        $prompt .= "  - {$desc} → {$clean}\n";
                    }
                    $prompt .= "\n";
                }

                if (! empty($groupedUrls['invite'])) {
                    $prompt .= "**INVITE Actions:**\n";
                    foreach ($groupedUrls['invite'] as $desc => $url) {
                        $clean = $cleanUrl($url);
                        $prompt .= "  - {$desc} → {$clean}\n";
                    }
                    $prompt .= "\n";
                }

                if (! empty($groupedUrls['other'])) {
                    $prompt .= "**Other Pages:**\n";
                    foreach ($groupedUrls['other'] as $desc => $url) {
                        $clean = $cleanUrl($url);
                        $prompt .= "  - {$desc} → {$clean}\n";
                    }
                    $prompt .= "\n";
                }

                $prompt .= "**Important:** Match the user's requested action (create, edit, view, list, invite) with the corresponding URL from the groups above.\n";
                $prompt .= "**CRITICAL URL FORMATTING:**\n";
                $prompt .= "- Use URLs EXACTLY as shown above - they are already cleaned and ready to use\n";
                $prompt .= "- When creating markdown links, format as: [Link Text](URL)\n";
                $prompt .= "- The URL inside parentheses must NOT have any trailing punctuation\n";
                $prompt .= "- Place periods, commas, or other punctuation AFTER the closing parenthesis\n";
                $prompt .= "- Example: [Create Appointment](http://domain.com/appointments/create). ← period is AFTER the link\n";
                $prompt .= "- WRONG: [Create Appointment](http://domain.com/appointments/create).) ← punctuation inside URL\n\n";
            }
        }

        // ONLY add page context if user is explicitly asking about the current page
        if ($isCurrentPageQuery && $pageContext) {
            $prompt .= "**Current Page Context (User asked about THIS page specifically):**\n\n";

            if (! empty($pageContext['url'])) {
                $prompt .= 'URL: '.$pageContext['url']."\n";
            }

            if (! empty($pageContext['title'])) {
                $prompt .= 'Page Title: '.$pageContext['title']."\n";
            }

            if (! empty($pageContext['text'])) {
                // Limit text context to avoid token overflow
                $textContent = substr($pageContext['text'], 0, 1500);
                $prompt .= "\nVisible Text Content:\n".$textContent."\n";
            }

            if (! empty($pageContext['form_data'])) {
                $prompt .= "\nForm Fields:\n";
                foreach ($pageContext['form_data'] as $field) {
                    $status = ! empty($field['value']) ? 'filled' : 'empty';
                    $prompt .= '- '.($field['name'] ?? 'unnamed').' ('.$field['type'].'): '.$status;
                    if (! empty($field['placeholder'])) {
                        $prompt .= ' - '.$field['placeholder'];
                    }
                    $prompt .= "\n";
                }
            }

            $prompt .= "\n";
        } elseif ($pageContext && ! empty($pageContext['url'])) {
            // For general questions, only include the URL for context, not the page content
            $prompt .= "**Context:**\nUser is currently on: ".$pageContext['url']."\n";
            $prompt .= "(But this is a general question - answer from Knowledge Base only)\n\n";
        }

        $prompt .= "**User Question:**\n".$message;

        return $prompt;
    }

    /**
     * Quick context endpoint (non-streaming)
     */
    public function quickHelp(Request $request)
    {
        $validated = $request->validate([
            'url' => 'required|string',
            'action' => 'required|string|in:page_summary,form_help,next_steps',
        ]);

        $knowledgeBase = $this->loadKnowledgeBase();
        $relevantKnowledge = $this->extractRelevantKnowledge($knowledgeBase, ['url' => $validated['url']]);

        $prompts = [
            'page_summary' => 'In 2-3 sentences, explain what this page is for and who can access it.',
            'form_help' => 'List the key fields on this page and any important constraints users should know about.',
            'next_steps' => 'What are the typical next actions a user would take after visiting this page?',
        ];

        $systemPrompt = "You are Wellovis AI. Provide concise, actionable responses based on this context:\n\n".$relevantKnowledge;
        $userPrompt = $prompts[$validated['action']]."\n\nURL: ".$validated['url'];

        try {
            $response = $this->bedrockAI->generateSummary(null, $userPrompt, $systemPrompt);

            return response()->json([
                'success' => true,
                'content' => implode("\n", $response),
            ]);
        } catch (\Exception $e) {
            Log::error('Quick Help Error', ['error' => $e->getMessage()]);

            return response()->json([
                'success' => false,
                'error' => 'Unable to generate help content.',
            ], 500);
        }
    }
}
