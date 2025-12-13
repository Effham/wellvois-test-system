<?php

namespace App\Listeners;

use App\Models\Tenant\EncounterDocument;
use Illuminate\Support\Facades\Auth;

class DocumentActivityListener
{
    /**
     * Log document upload events
     */
    public static function logDocumentUpload(EncounterDocument $document, $uploadSource = 'admin_panel'): void
    {
        $user = Auth::user();

        activity()
            ->causedBy($user)
            ->performedOn($document)
            ->event('document_uploaded')
            ->withProperties([
                'document_id' => $document->id,
                'encounter_id' => $document->encounter_id,
                'original_name' => $document->original_name,
                'file_size' => $document->file_size,
                'mime_type' => $document->mime_type,
                'document_type' => $document->document_type,
                'upload_source' => $uploadSource,
                's3_key' => $document->s3_key,
                'tenant_id' => tenant('id'),
                'ip' => request()->ip(),
                'user_agent' => request()->userAgent(),
            ])
            ->log("Document '{$document->original_name}' uploaded to encounter {$document->encounter_id}");
    }

    /**
     * Log document download/view events
     */
    public static function logDocumentAccess(EncounterDocument $document, $accessType = 'view'): void
    {
        $user = Auth::user();

        activity()
            ->causedBy($user)
            ->performedOn($document)
            ->event('document_accessed')
            ->withProperties([
                'document_id' => $document->id,
                'encounter_id' => $document->encounter_id,
                'original_name' => $document->original_name,
                'access_type' => $accessType, // 'view', 'download', 'print'
                'document_type' => $document->document_type,
                'tenant_id' => tenant('id'),
                'ip' => request()->ip(),
                'user_agent' => request()->userAgent(),
            ])
            ->log("Document '{$document->original_name}' {$accessType}ed by {$user->name}");
    }

    /**
     * Log document request events
     */
    public static function logDocumentRequest($documentRequest, $requestedBy): void
    {
        activity()
            ->causedBy($requestedBy)
            ->performedOn($documentRequest)
            ->event('document_requested')
            ->withProperties([
                'document_request_id' => $documentRequest->id,
                'encounter_id' => $documentRequest->encounter_id,
                'document_type' => $documentRequest->document_type,
                'title' => $documentRequest->title,
                'priority' => $documentRequest->priority,
                'tenant_id' => tenant('id'),
                'ip' => request()->ip(),
                'user_agent' => request()->userAgent(),
            ])
            ->log("Document request '{$documentRequest->title}' created for encounter {$documentRequest->encounter_id}");
    }

    /**
     * Log document request fulfillment
     */
    public static function logDocumentRequestFulfilled($documentRequest, $fulfilledDocument): void
    {
        $user = Auth::user();

        activity()
            ->causedBy($user)
            ->performedOn($documentRequest)
            ->event('document_request_fulfilled')
            ->withProperties([
                'document_request_id' => $documentRequest->id,
                'encounter_id' => $documentRequest->encounter_id,
                'fulfilled_by_document_id' => $fulfilledDocument->id,
                'document_name' => $fulfilledDocument->original_name,
                'tenant_id' => tenant('id'),
                'ip' => request()->ip(),
                'user_agent' => request()->userAgent(),
            ])
            ->log("Document request '{$documentRequest->title}' fulfilled with document '{$fulfilledDocument->original_name}'");
    }
}
