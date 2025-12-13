<?php

namespace App\Http\Controllers\Tenant;

use App\Http\Controllers\Controller;
use App\Models\Tenant\Consent;
use App\Models\Tenant\ConsentVersion;
use App\Models\Tenant\EntityConsent;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Inertia\Inertia;

class ConsentManagementController extends Controller
{
    public function __construct()
    {
        $this->middleware('permission:view-policies-consents')->only(['index', 'show', 'checkConsentAcceptance']);
        $this->middleware('permission:manage-consents')->only(['create', 'store', 'destroy', 'toggleVersion', 'checkTitle', 'acceptConsent', 'acceptDocumentUploadConsent']);
    }

    /**
     * Display a listing of consents.
     */
    public function index()
    {
        $consents = Consent::withActiveVersion()
            ->withCount('versions')
            ->orderBy('title')
            ->get()
            ->map(function ($consent) {
                return [
                    'id' => $consent->id,
                    'title' => $consent->title,
                    'key' => $consent->key,
                    'entity_type' => $consent->entity_type,
                    'is_required' => $consent->is_required,
                    'active_version' => $consent->activeVersion ? [
                        'id' => $consent->activeVersion->id,
                        'version' => $consent->activeVersion->version,
                        'status' => $consent->activeVersion->status,
                        'created_at' => $consent->activeVersion->created_at,
                    ] : null,
                    'versions_count' => $consent->versions_count,
                ];
            });

        return Inertia::render('Tenant/PoliciesConsents/Index', [
            'consents' => $consents,
        ]);
    }

    /**
     * Show the form for creating a new consent.
     */
    public function create(Request $request)
    {
        $existingConsent = null;

        // If creating a new version, fetch the existing consent data
        if ($request->has('existing_consent_id')) {
            $consent = Consent::with('activeVersion')->find($request->existing_consent_id);

            if ($consent) {
                $existingConsent = [
                    'id' => $consent->id,
                    'title' => $consent->title,
                    'key' => $consent->key,
                    'entity_type' => $consent->entity_type,
                    'is_required' => $consent->is_required,
                ];
            }
        }

        return Inertia::render('Tenant/PoliciesConsents/Create', [
            'existingConsentId' => $request->existing_consent_id,
            'existingConsent' => $existingConsent,
        ]);
    }

    /**
     * Store a newly created consent or version.
     */
    public function store(Request $request)
    {
        $request->validate([
            'title' => 'required|string|max:255',
            'entity_type' => 'required|in:USER,PATIENT,PRACTITIONER',
            'consent_body' => 'required|array',
            'is_new_version' => 'boolean',
            'existing_consent_id' => 'nullable|exists:consents,id',
            'is_required' => 'nullable|boolean',
            'trigger_points' => 'nullable|array',
        ]);

        if ($request->is_new_version && $request->existing_consent_id) {
            // Create new version of existing consent
            $consent = Consent::findOrFail($request->existing_consent_id);

            $version = ConsentVersion::create([
                'consent_id' => $consent->id,
                'consent_body' => $request->consent_body,
                'status' => 'ACTIVE', // This will automatically deactivate other versions
            ]);

            return redirect()
                ->route('policies-consents.show', $consent)
                ->with('success', "New version {$version->version} created successfully.");
        } else {
            // Create new consent
            $key = Str::slug($request->title, '_');

            // Ensure key is unique
            $originalKey = $key;
            $counter = 1;
            while (Consent::where('key', $key)->exists()) {
                $key = $originalKey.'_'.$counter;
                $counter++;
            }

            $consent = Consent::create([
                'key' => $key,
                'title' => $request->title,
                'entity_type' => $request->entity_type,
                'is_required' => $request->is_required ?? false,
                'trigger_points' => $request->trigger_points ?? null,
            ]);

            $version = ConsentVersion::create([
                'consent_id' => $consent->id,
                'consent_body' => $request->consent_body,
                'status' => 'ACTIVE',
            ]);

            return redirect()
                ->route('policies-consents.show', $consent)
                ->with('success', 'Consent created successfully.');
        }
    }

    /**
     * Display the specified consent with all its versions.
     */
    public function show(Consent $consent)
    {
        $consent->load(['versions' => function ($query) {
            $query->orderBy('version', 'desc');
        }]);

        $consentData = [
            'id' => $consent->id,
            'title' => $consent->title,
            'key' => $consent->key,
            'entity_type' => $consent->entity_type,
            'is_required' => $consent->is_required,
            'trigger_points' => $consent->trigger_points,
            'created_at' => $consent->created_at,
            'updated_at' => $consent->updated_at,
            'versions' => $consent->versions->map(function ($version) {
                return [
                    'id' => $version->id,
                    'version' => $version->version,
                    'status' => $version->status,
                    'consent_body' => $version->consent_body,
                    'created_at' => $version->created_at,
                    'updated_at' => $version->updated_at,
                ];
            }),
        ];

        // If this is an AJAX request, return JSON
        if (request()->wantsJson()) {
            return response()->json(['consent' => $consentData]);
        }

        return Inertia::render('Tenant/PoliciesConsents/Show', [
            'consent' => $consentData,
        ]);
    }

    /**
     * Check if a title already exists and return key and versions.
     */
    public function checkTitle(Request $request)
    {
        $request->validate([
            'title' => 'required|string|max:255',
        ]);

        $title = $request->title;
        $key = Str::slug($title, '_');

        $consent = Consent::where('key', $key)->first();

        if ($consent) {
            $versions = $consent->versions()
                ->orderBy('version', 'desc')
                ->get(['id', 'version', 'status', 'created_at']);

            return response()->json([
                'exists' => true,
                'consent' => [
                    'id' => $consent->id,
                    'title' => $consent->title,
                    'key' => $consent->key,
                    'entity_type' => $consent->entity_type,
                ],
                'versions' => $versions,
            ]);
        }

        return response()->json([
            'exists' => false,
            'suggested_key' => $key,
        ]);
    }

    /**
     * Toggle version active/inactive status.
     */
    public function toggleVersion(Request $request, ConsentVersion $version)
    {
        $request->validate([
            'status' => 'required|in:ACTIVE,INACTIVE',
        ]);

        try {
            $version->update(['status' => $request->status]);

            return back()->with('success', "Version {$version->version} status updated to {$request->status}.");
        } catch (\Exception $e) {
            return back()->with('error', 'Failed to update version status. Please try again.');
        }
    }

    /**
     * Accept a consent version.
     */
    public function acceptConsent(Request $request, ConsentVersion $version)
    {
        $request->validate([
            'consentable_type' => 'required|string',
            'consentable_id' => 'required|integer',
        ]);

        // Create entity consent record
        $entityConsent = \App\Models\Tenant\EntityConsent::create([
            'consent_version_id' => $version->id,
            'consentable_type' => $request->consentable_type,
            'consentable_id' => $request->consentable_id,
            'consented_at' => now(),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Consent accepted successfully.',
            'entity_consent' => $entityConsent,
        ]);
    }

    /**
     * Check if an entity has accepted a specific consent.
     */
    public function checkConsentAcceptance(Request $request)
    {
        $request->validate([
            'consent_key' => 'required|string',
            'consentable_type' => 'required|string',
            'consentable_id' => 'required|integer',
        ]);

        $consent = Consent::where('key', $request->consent_key)->first();

        if (! $consent) {
            return response()->json([
                'has_accepted' => false,
                'message' => 'Consent not found.',
            ]);
        }

        $hasAccepted = \App\Models\Tenant\EntityConsent::where('consent_version_id', $consent->activeVersion->id)
            ->where('consentable_type', $request->consentable_type)
            ->where('consentable_id', $request->consentable_id)
            ->exists();

        return response()->json([
            'has_accepted' => $hasAccepted,
            'consent' => $consent,
            'active_version' => $consent->activeVersion,
        ]);
    }

    public function archive(Request $request)
    {
        $consents = Consent::onlyTrashed() // Use onlyTrashed()
            ->withActiveVersion()
            ->withCount('versions')
            ->orderBy('title')
            ->get()
            ->map(function ($consent) {
                return [
                    'id' => $consent->id,
                    'title' => $consent->title,
                    'key' => $consent->key,
                    'entity_type' => $consent->entity_type,
                    'is_required' => $consent->is_required,
                    'active_version' => $consent->activeVersion ? [
                        'id' => $consent->activeVersion->id,
                        'version' => $consent->activeVersion->version,
                        'status' => $consent->activeVersion->status,
                        'created_at' => $consent->activeVersion->created_at,
                    ] : null,
                    'versions_count' => $consent->versions_count,
                    'deleted_at' => $consent->deleted_at, // Include deleted_at
                ];
            });

        return Inertia::render('Tenant/PoliciesConsents/Archive', [
            'consents' => $consents,
            // Assuming you have filters logic in place if needed, or pass empty array
            'filters' => [],
        ]);
    }

    /**
     * Restore a soft-deleted consent.
     */
    public function restore(Consent $consent)
    {
        try {
            $consent->restore();

            return back()->with('success', 'Consent policy has been restored successfully.');
        } catch (\Exception $e) {
            Log::error('Failed to restore consent policy', [
                'consent_id' => $consent->id,
                'error' => $e->getMessage(),
            ]);

            return back()->with('error', 'Failed to restore consent policy. Please try again.');
        }
    }

    /**
     * Remove the specified consent (now Soft Deletes).
     * The logic for checking entity consents remains to prevent permanent deletion.
     */
    public function destroy(Consent $consent)
    {
        // The permanent delete check remains to adhere to the existing business logic:
        // "Cannot delete consent that has been accepted by users. Please deactivate it instead."
        $hasAcceptedConsents = $consent->entityConsents()->exists();

        if ($hasAcceptedConsents) {
            // Because we want to *archive* the consent if accepted, we perform the soft delete here.
            // If the user has 'delete-policies-consents' permission (which is what usually maps to destroy),
            // and the consent has been accepted, we soft delete/archive it.
            // If the original intent of 'destroy' was permanent delete (which is prevented by the check),
            // we re-purpose it to be the archive (soft delete) action.
            try {
                $consent->delete();

                return back()->with('success', 'Consent policy has been archived successfully.');
            } catch (\Exception $e) {
                return back()->with('error', 'Failed to archive consent policy. Please try again.');
            }
        }

        // If no entity consents exist, proceed with permanent deletion as originally intended.
        $consent->forceDelete(); // Use forceDelete for permanent removal

        return redirect()
            ->route('policies-consents.index')
            ->with('success', 'Consent policy permanently deleted successfully.');
    }

    /**
     * Accept document upload consent.
     */
    public function acceptDocumentUploadConsent(Request $request)
    {
        try {
            // Get practitioner from authenticated user
            $user = auth()->user();
            if (! $user) {
                return response()->json([
                    'success' => false,
                    'message' => 'User not authenticated.',
                ], 401);
            }

            // Get practitioner from central database
            $practitioner = null;
            tenancy()->central(function () use (&$practitioner, $user) {
                $practitioner = \App\Models\Practitioner::where('user_id', $user->id)->first();
            });

            if (! $practitioner) {
                return response()->json([
                    'success' => false,
                    'message' => 'Practitioner not found.',
                ], 404);
            }

            // Get or create document security consent
            $consent = Consent::firstOrCreate(
                ['key' => 'document_security_consent'],
                [
                    'title' => 'Document Security Consent',
                    'entity_type' => 'PRACTITIONER',
                ]
            );

            // Create active version if it doesn't exist
            if (! $consent->activeVersion) {
                ConsentVersion::create([
                    'consent_id' => $consent->id,
                    'consent_body' => [
                        'heading' => 'Document Security Consent',
                        'description' => 'Required before uploading documents',
                        'content' => 'I acknowledge that when I download my Personal Health Information (PHI) from the secure Wellovis EMR to my personal device, the security and privacy of those files become my sole responsibility. I understand that Wellovis and my Practitioner cannot control or protect the downloaded files and will not be liable for any unauthorized access that occurs once the files have left the secure platform.',
                        'checkbox_text' => 'I confirm I understand the security risks of downloading my health documents from Wellovis.',
                        'security_notice' => 'This document will be accessible to the patient and may be downloaded to their personal device.',
                    ],
                    'status' => 'ACTIVE',
                ]);
            }

            // Check if practitioner has already accepted this consent
            $hasAccepted = EntityConsent::where('consent_version_id', $consent->activeVersion->id)
                ->where('consentable_type', 'App\\Models\\Practitioner')
                ->where('consentable_id', $practitioner->id)
                ->exists();

            if (! $hasAccepted) {
                // Create entity consent record
                EntityConsent::create([
                    'consent_version_id' => $consent->activeVersion->id,
                    'consentable_type' => 'App\\Models\\Practitioner',
                    'consentable_id' => $practitioner->id,
                    'consented_at' => now(),
                ]);

                Log::info('Document upload consent record created for practitioner', [
                    'practitioner_id' => $practitioner->id,
                    'consent_key' => 'document_security_consent',
                ]);
            }

            return response()->json([
                'success' => true,
                'message' => 'Document upload consent accepted successfully.',
            ]);

        } catch (\Exception $e) {
            Log::error('Failed to accept document upload consent', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to accept document upload consent.',
            ], 500);
        }
    }

    /**
     * Remove the specified consent.
     */
    // public function destroy(Consent $consent)
    // {
    //     // Check if any entity has accepted this consent
    //     $hasAcceptedConsents = $consent->entityConsents()->exists();

    //     if ($hasAcceptedConsents) {
    //         return back()->withErrors([
    //             'consent' => 'Cannot delete consent that has been accepted by users. Please deactivate it instead.',
    //         ]);
    //     }

    //     $consent->delete();

    //     return redirect()
    //         ->route('policies-consents.index')
    //         ->with('success', 'Consent deleted successfully.');
    // }
}
