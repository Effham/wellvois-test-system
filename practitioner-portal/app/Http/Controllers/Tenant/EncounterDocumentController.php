<?php

namespace App\Http\Controllers\Tenant;

use App\Http\Controllers\Controller;
use App\Mail\Tenant\PractitionerDocumentUploadedMail;
use App\Models\Patient;
use App\Models\Practitioner;
use App\Models\Tenant\Encounter;
use App\Models\Tenant\EncounterDocument;
use App\Models\Tenant\EncounterDocumentRequest;
use App\Services\DocumentAccessTokenService;
use App\Services\S3BucketService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class EncounterDocumentController extends Controller
{
    public function __construct(
        protected S3BucketService $s3Service
    ) {
        Log::info('[EncounterDocumentController] Constructor called - S3BucketService injected');
    }

    /**
     * Show the form for creating a new document.
     */
    public function create(Encounter $encounter)
    {
        $this->loadEncounterWithPatient($encounter);

        return inertia('Encounters/Documents/Upload', [
            'encounter' => $encounter,
            'documentRequests' => [],
            'existingDocuments' => [],
        ]);
    }

    /**
     * Show the upload page with requested documents.
     */
    public function upload(Encounter $encounter)
    {
        $this->loadEncounterWithPatient($encounter);

        // Load document requests with their linked documents
        $encounter->load(['documentRequests' => function ($query) {
            $query->with('linkedDocuments')->orderBy('created_at', 'desc');
        }, 'documents']);

        // Check user role to determine which column is editable
        $userRole = determineUserRole();

        return inertia('Encounters/Documents/Upload', [
            'encounter' => $encounter,
            'documentRequests' => $encounter->documentRequests,
            'existingDocuments' => $encounter->documents,
            'userRole' => $userRole,
        ]);
    }

    /**
     * Store newly uploaded documents.
     */
    public function store(Request $request, Encounter $encounter)
    {
        // Only S3 uploads are supported
        $validated = $request->validate([
            's3_keys' => 'required|array',
            's3_keys.*' => 'required|string',
            // Remove s3_urls validation - we don't store signed URLs
            'file_names' => 'required|array',
            'file_names.*' => 'required|string',
            'mime_types' => 'nullable|array',
            'mime_types.*' => 'nullable|string',
            'file_sizes' => 'nullable|array',
            'file_sizes.*' => 'nullable|integer',
            'document_request_id' => 'nullable|exists:encounter_document_requests,id',
            'document_type' => 'nullable|string',
            'description' => 'nullable|string',
        ]);

        $uploadedDocuments = [];
        $documentRequest = null;

        // If uploading for a specific request, get the request details
        if (isset($validated['document_request_id'])) {
            $documentRequest = EncounterDocumentRequest::find($validated['document_request_id']);
        }

        // Handle S3 uploaded files - store ONLY S3 keys
        foreach ($validated['s3_keys'] as $index => $s3Key) {
            $originalName = $validated['file_names'][$index];
            $mimeType = $validated['mime_types'][$index] ?? 'application/octet-stream';
            $fileSize = $validated['file_sizes'][$index] ?? 0;
            // DO NOT use s3_urls - signed URLs should be generated on demand

            \Log::info('EncounterDocumentController: Creating S3 document', [
                'encounter_id' => $encounter->id,
                's3_key' => $s3Key,
                'original_name' => $originalName,
                'mime_type' => $mimeType,
                'file_size' => $fileSize,
            ]);

            // Extract file extension from original name
            $extension = pathinfo($originalName, PATHINFO_EXTENSION);

            // Determine document type
            $documentType = 'other';
            if ($documentRequest) {
                $documentType = $documentRequest->document_type;
            } elseif (isset($validated['document_type'])) {
                $documentType = $validated['document_type'];
            }

            // Create document record with S3 key and metadata
            $document = $encounter->documents()->create([
                'original_name' => $originalName,
                'file_name' => basename($s3Key), // Use S3 key basename as filename
                's3_key' => $s3Key, // Store S3 key in dedicated field
                // Remove file_path - not needed for S3 files
                'mime_type' => $mimeType, // Use provided mime type
                'file_size' => $fileSize, // Use provided file size
                'uploaded_by_type' => get_class(Auth::user()),
                'uploaded_by_id' => Auth::id(),
                'document_type' => $documentType,
                'description' => $validated['description'] ?? null,
                'document_request_id' => $validated['document_request_id'] ?? null,
            ]);

            \Log::info('EncounterDocumentController: S3 document created', [
                'document_id' => $document->id,
                'final_s3_key' => $document->s3_key,
            ]);

            $uploadedDocuments[] = $document;

            // Log the document upload
            \App\Listeners\DocumentActivityListener::logDocumentUpload($document, 's3_upload');
        }

        // If this was for a document request, mark it as fulfilled
        // We mark it fulfilled after the first document, but all documents are linked
        if ($documentRequest && ! $documentRequest->isFulfilled()) {
            $documentRequest->markAsFulfilled($uploadedDocuments[0]->id);

            // Log the document request fulfillment
            \App\Listeners\DocumentActivityListener::logDocumentRequestFulfilled($documentRequest, $uploadedDocuments[0]);
        }

        // Send email notification if practitioner uploaded document for a "by_practitioner" request
        if ($documentRequest && $documentRequest->by_practitioner) {
            Log::info('📧 Starting email notification flow for practitioner document upload', [
                'encounter_id' => $encounter->id,
                'document_request_id' => $documentRequest->id,
                'tenant_initialized' => tenancy()->initialized,
                'current_connection' => config('database.default'),
            ]);

            // Check if uploader is a practitioner
            // Get user ID before entering central context to avoid connection mismatch
            $currentUserId = Auth::id();

            Log::info('🔐 Checking if uploader is practitioner', [
                'user_id' => $currentUserId,
            ]);

            $isPractitionerUpload = tenancy()->central(function () use ($currentUserId) {
                return Practitioner::where('user_id', $currentUserId)->exists();
            });

            Log::info('✅ Practitioner check completed', [
                'is_practitioner' => $isPractitionerUpload,
                'tenant_initialized' => tenancy()->initialized,
                'current_connection' => config('database.default'),
            ]);

            if ($isPractitionerUpload) {
                Log::info('📨 Calling sendDocumentUploadNotification');
                $this->sendDocumentUploadNotification($encounter, $documentRequest, $uploadedDocuments);
                Log::info('✅ sendDocumentUploadNotification completed successfully');
            }
        }

        $message = count($uploadedDocuments) === 1
            ? 'Document uploaded successfully!'
            : count($uploadedDocuments).' documents uploaded successfully!';

        Log::info('🎯 [FINAL] Store method completed, returning response', [
            'encounter_id' => $encounter->id,
            'documents_uploaded' => count($uploadedDocuments),
            'tenant_initialized' => tenancy()->initialized,
            'current_connection' => config('database.default'),
        ]);

        return back()->with('success', $message);
    }

    /**
     * Display a specific document.
     */
    public function show(Encounter $encounter, EncounterDocument $document)
    {
        $this->loadEncounterWithPatient($encounter);

        return inertia('Encounters/Documents/Show', [
            'encounter' => $encounter,
            'document' => $document,
        ]);
    }

    /**
     * Download a document.
     */
    public function download(Encounter $encounter, EncounterDocument $document)
    {
        // Ensure the document belongs to this encounter
        if ($document->encounter_id !== $encounter->id) {
            abort(403, 'Access denied');
        }

        // Check if this is an S3 document
        if ($document->s3_key) {
            Log::info('Generating S3 temporary download URL', [
                'document_id' => $document->id,
                's3_key' => $document->s3_key,
            ]);

            try {
                Log::info('[EncounterDocumentController] Using injected S3BucketService', [
                    's3_service_class' => get_class($this->s3Service),
                    's3_key' => $document->s3_key,
                ]);

                // Generate a temporary URL that expires in 15 minutes
                $temporaryUrl = $this->s3Service->temporaryUrl($document->s3_key, now()->addMinutes(15));

                // Redirect to the S3 temporary URL for direct download
                return redirect($temporaryUrl);
            } catch (\Exception $e) {
                Log::error('Failed to generate S3 download URL', [
                    'document_id' => $document->id,
                    's3_key' => $document->s3_key,
                    'error' => $e->getMessage(),
                ]);
                abort(500, 'Unable to access document in cloud storage');
            }
        }

        // All documents must use S3 - no traditional file path support
        abort(404, 'Document not found. Only S3-stored documents are supported.');
    }

    /**
     * Update a document.
     */
    public function update(Request $request, Encounter $encounter, EncounterDocument $document)
    {
        $validated = $request->validate([
            'description' => 'nullable|string',
            'document_type' => 'nullable|string',
        ]);

        $document->update($validated);

        return back()->with('success', 'Document updated successfully!');
    }

    /**
     * Delete a document.
     */
    public function destroy(Encounter $encounter, EncounterDocument $document)
    {
        $document->delete(); // This will also delete the physical file via the model's booted method

        return back()->with('success', 'Document deleted successfully!');
    }

    /**
     * Get document count for an encounter.
     */
    public function count(Encounter $encounter)
    {
        return response()->json([
            'count' => $encounter->documents()->count(),
            'pending_requests' => $encounter->documentRequests()->where('status', 'pending')->count(),
        ]);
    }

    /**
     * Load encounter with patient data from central database.
     */
    private function loadEncounterWithPatient(Encounter $encounter): void
    {
        // Load the appointment with service
        $encounter->load('appointment.service');

        // Manually load patient from central database
        if ($encounter->appointment && $encounter->appointment->patient_id) {
            $patient = tenancy()->central(function () use ($encounter) {
                return Patient::find($encounter->appointment->patient_id);
            });
            $encounter->appointment->patient = $patient;
        }
    }

    /**
     * Send email notification to patient when practitioner uploads documents.
     */
    private function sendDocumentUploadNotification(Encounter $encounter, EncounterDocumentRequest $documentRequest, array $uploadedDocuments): void
    {
        try {
            Log::info('🔔 [STEP 1] Starting sendDocumentUploadNotification', [
                'encounter_id' => $encounter->id,
                'tenant_initialized' => tenancy()->initialized,
                'current_connection' => config('database.default'),
            ]);

            // Load patient and practitioner from central database
            Log::info('🔄 [STEP 2] Loading patient data from central database');

            // Extract all tenant data BEFORE entering central context to avoid cross-context issues
            $currentUserId = Auth::id();
            $patientId = $encounter->appointment->patient_id;

            Log::info('📋 Extracted tenant data before central context', [
                'patient_id' => $patientId,
                'user_id' => $currentUserId,
            ]);

            $patientData = tenancy()->central(function () use ($patientId, $currentUserId) {
                $patient = Patient::find($patientId);
                $practitioner = Practitioner::where('user_id', $currentUserId)->first();

                return [
                    'patient' => $patient,
                    'practitioner' => $practitioner,
                ];
            });

            Log::info('✅ [STEP 3] Patient data loaded', [
                'patient_found' => isset($patientData['patient']),
                'practitioner_found' => isset($patientData['practitioner']),
                'tenant_initialized' => tenancy()->initialized,
                'current_connection' => config('database.default'),
            ]);

            $patient = $patientData['patient'];
            $practitioner = $patientData['practitioner'];

            if (! $patient || ! $patient->email) {
                Log::warning('Cannot send document upload notification: Patient email not found', [
                    'encounter_id' => $encounter->id,
                    'patient_id' => $encounter->appointment->patient_id,
                ]);

                return;
            }

            Log::info('🔑 [STEP 4] Generating secure access token');

            // Get the primary document (first uploaded document)
            $primaryDocument = $uploadedDocuments[0];

            // Generate secure access token with the primary document ID
            $tokenService = new DocumentAccessTokenService;
            $token = $tokenService->generateToken(
                $patient->id,
                $encounter->id,
                $patient->email,
                [$primaryDocument->id]
            );

            Log::info('✅ [STEP 5] Token generated, preparing email data', [
                'tenant_initialized' => tenancy()->initialized,
                'current_connection' => config('database.default'),
            ]);

            // Generate access URL
            $accessUrl = route('documents.access', ['token' => $token]);

            // Get organization settings for clinic name
            $clinicName = tenant('company_name') ?? config('app.name');

            // Prepare practitioner name
            $practitionerName = 'Your Practitioner';
            if ($practitioner) {
                $practitionerName = trim($practitioner->first_name.' '.$practitioner->last_name);
            }

            // Prepare document list - only include the primary document that fulfills the request
            $documents = [
                [
                    'name' => $primaryDocument->original_name,
                    'type' => $primaryDocument->document_type_display,
                ],
            ];

            // Prepare email data
            $emailData = [
                'patient_name' => trim($patient->first_name.' '.$patient->last_name),
                'practitioner_name' => $practitionerName,
                'clinic_name' => $clinicName,
                'document_title' => $documentRequest->title,
                'upload_date' => now()->format('F j, Y \a\t g:i A'),
                'access_url' => $accessUrl,
                'documents' => $documents,
            ];

            Log::info('📧 [STEP 6] Sending email', [
                'patient_email' => $patient->email,
                'tenant_initialized' => tenancy()->initialized,
                'current_connection' => config('database.default'),
            ]);

            // Send email
            Mail::to($patient->email)->send(new PractitionerDocumentUploadedMail($emailData));

            Log::info('✅ [STEP 7] Email sent successfully', [
                'encounter_id' => $encounter->id,
                'patient_id' => $patient->id,
                'patient_email' => $patient->email,
                'documents_count' => count($uploadedDocuments),
                'tenant_initialized' => tenancy()->initialized,
                'current_connection' => config('database.default'),
            ]);
        } catch (\Exception $e) {
            Log::error('❌ [ERROR] Failed to send document upload notification', [
                'encounter_id' => $encounter->id,
                'error' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
                'tenant_initialized' => tenancy()->initialized,
                'current_connection' => config('database.default'),
                'trace' => $e->getTraceAsString(),
            ]);
        }
    }
}
