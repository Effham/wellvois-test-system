<?php

namespace App\Http\Controllers\Tenant;

use App\Http\Controllers\Controller;
use App\Models\Tenant\EntityConsent;
use Illuminate\Http\Request;
use Inertia\Inertia;

class EntityConsentController extends Controller
{
    public function __construct()
    {
        $this->middleware('permission:view-consents')->only(['index', 'archive']);
        $this->middleware('permission:delete-consents')->only('destroy');
        $this->middleware('permission:restore-consents')->only('restore');
    }

    /**
     * Display a listing of active entity consents
     */
    public function index(Request $request)
    {
        $query = EntityConsent::with([
            'consentVersion.consent',
            'consentable',
        ])
            ->whereNull('deleted_at')
            ->orderBy('consented_at', 'desc');

        // Apply search filter if provided
        if ($request->has('search') && ! empty($request->search)) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('consentable_type', 'LIKE', "%{$search}%")
                    ->orWhere('consentable_id', 'LIKE', "%{$search}%")
                    ->orWhereHas('consentVersion.consent', function ($q) use ($search) {
                        $q->where('title', 'LIKE', "%{$search}%")
                            ->orWhere('key', 'LIKE', "%{$search}%");
                    });
            });
        }

        $perPage = $request->get('perPage', 10);
        $consents = $query->paginate($perPage);

        // Transform data for frontend
        $consents->getCollection()->transform(function ($entityConsent) {
            return [
                'id' => $entityConsent->id,
                'entity_type' => class_basename($entityConsent->consentable_type),
                'entity_id' => $entityConsent->consentable_id,
                'user' => $entityConsent->consentable ? $this->getEntityName($entityConsent->consentable) : 'N/A',
                'consent_type' => $entityConsent->consentVersion->consent->title ?? 'N/A',
                'consent_status' => 'granted',
                'consented_at' => $entityConsent->consented_at->format('Y-m-d H:i:s'),
            ];
        });

        return Inertia::render('Consents/Index', [
            'consents' => $consents,
            'filters' => [
                'search' => $request->search,
                'perPage' => $request->get('perPage', 10),
            ],
        ]);
    }

    // public function archive(Request $request)
    // {
    //     $consents = Consent::onlyTrashed() // Use onlyTrashed()
    //         ->withActiveVersion()
    //         ->withCount('versions')
    //         ->orderBy('title')
    //         ->get()
    //         ->map(function ($consent) {
    //             return [
    //                 'id' => $consent->id,
    //                 'title' => $consent->title,
    //                 'key' => $consent->key,
    //                 'entity_type' => $consent->entity_type,
    //                 'is_required' => $consent->is_required,
    //                 'active_version' => $consent->activeVersion ? [
    //                     'id' => $consent->activeVersion->id,
    //                     'version' => $consent->activeVersion->version,
    //                     'status' => $consent->activeVersion->status,
    //                     'created_at' => $consent->activeVersion->created_at,
    //                 ] : null,
    //                 'versions_count' => $consent->versions_count,
    //                 'deleted_at' => $consent->deleted_at, // Include deleted_at
    //             ];
    //         });

    //     return Inertia::render('Tenant/PoliciesConsents/Archive', [
    //         'consents' => $consents,
    //         // Assuming you have filters logic in place if needed, or pass empty array
    //         'filters' => [],
    //     ]);
    // }

    // /**
    //  * Restore a soft-deleted consent.
    //  */
    // public function restore(Consent $consent)
    // {
    //     try {
    //         $consent->restore();

    //         return back()->with('success', 'Consent policy has been restored successfully.');
    //     } catch (\Exception $e) {
    //         Log::error('Failed to restore consent policy', [
    //             'consent_id' => $consent->id,
    //             'error' => $e->getMessage(),
    //         ]);

    //         return back()->with('error', 'Failed to restore consent policy. Please try again.');
    //     }
    // }

    // /**
    //  * Remove the specified consent (now Soft Deletes).
    //  * The logic for checking entity consents remains to prevent permanent deletion.
    //  */
    // public function destroy(Consent $consent)
    // {
    //     // The permanent delete check remains to adhere to the existing business logic:
    //     // "Cannot delete consent that has been accepted by users. Please deactivate it instead."
    //     $hasAcceptedConsents = $consent->entityConsents()->exists();

    //     if ($hasAcceptedConsents) {
    //         // Because we want to *archive* the consent if accepted, we perform the soft delete here.
    //         // If the user has 'delete-policies-consents' permission (which is what usually maps to destroy),
    //         // and the consent has been accepted, we soft delete/archive it.
    //         // If the original intent of 'destroy' was permanent delete (which is prevented by the check),
    //         // we re-purpose it to be the archive (soft delete) action.
    //          try {
    //             $consent->delete();
    //             return back()->with('success', 'Consent policy has been archived successfully.');
    //         } catch (\Exception $e) {
    //              return back()->with('error', 'Failed to archive consent policy. Please try again.');
    //         }
    //     }

    //     // If no entity consents exist, proceed with permanent deletion as originally intended.
    //     $consent->forceDelete(); // Use forceDelete for permanent removal

    //     return redirect()
    //         ->route('policies-consents.index')
    //         ->with('success', 'Consent policy permanently deleted successfully.');
    // }

    /**
     * Get a human-readable name for the entity
     */
    protected function getEntityName($entity): string
    {
        if (! $entity) {
            return 'N/A';
        }

        if (method_exists($entity, 'getFullNameAttribute') || isset($entity->full_name)) {
            return $entity->full_name ?? 'N/A';
        }

        if (method_exists($entity, 'getDisplayNameAttribute') || isset($entity->display_name)) {
            return $entity->display_name ?? 'N/A';
        }

        if (isset($entity->name)) {
            return $entity->name;
        }

        if (isset($entity->first_name) && isset($entity->last_name)) {
            return "{$entity->first_name} {$entity->last_name}";
        }

        if (isset($entity->email)) {
            return $entity->email;
        }

        return "ID: {$entity->id}";
    }
}
