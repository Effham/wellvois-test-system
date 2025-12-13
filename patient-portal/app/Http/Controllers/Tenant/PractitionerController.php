<?php

namespace App\Http\Controllers\Tenant;

use App\Http\Controllers\Controller;
use App\Http\Resources\PractitionerListResource;
use App\Models\Location;
use App\Models\Practitioner;
use App\Models\PractitionerInvitation;
use App\Models\Service;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Spatie\Permission\Models\Role;

class PractitionerController extends Controller
{
    public function __construct()
    {
        $this->middleware('permission:view-practitioner')->only(['index', 'show', 'invitations', 'searchPractitioners', 'getLocations', 'getLocationAvailability', 'getPractitionerServices']);
        $this->middleware('permission:add-practitioner')->only(['create', 'store', 'storeBasicInfo', 'storeCombinedDetails', 'linkPractitioner', 'invite', 'inviteByEmail', 'showInviteForm']);
        $this->middleware('permission:update-practitioner')->only(['edit', 'update', 'storeProfessionalDetails', 'storeCombinedDetails', 'storeLocations', 'storeLocationAvailability', 'storePricing', 'storePractitionerServices', 'resendInvitation']);
        $this->middleware('permission:delete-practitioner')->only('destroy');
    }

    public function index(Request $request)
    {
        $currentTenantId = tenant('id');
        Log::info('PractitionerController::index() - Starting search', [
            'tenant_id' => $currentTenantId,
            'search_term' => $request->search,
            'has_search' => $request->has('search'),
            'search_empty' => empty($request->search),
        ]);

        // Get all practitioners from tenant database (already scoped to current tenant)
        $query = Practitioner::query();

        // Apply search filter if provided
        // Only search practitioners if we're on the practitioners tab or no tab specified
        $currentTab = $request->get('tab', 'practitioners');
        if ($request->has('search') && ! empty($request->search) && $currentTab === 'practitioners') {
            $search = $request->search;
            Log::info('PractitionerController::index() - Performing blind index search', [
                'search_term' => $search,
                'search_length' => strlen($search),
            ]);

            // Get practitioner IDs from tenant database that match search criteria
            Log::info('PractitionerController::index() - Searching tenant database', [
                'search_term' => $search,
            ]);

            // First, let's check if there are any practitioners at all
            $totalPractitioners = Practitioner::count();
            Log::info('PractitionerController::index() - Total practitioners in tenant DB', [
                'total_count' => $totalPractitioners,
            ]);

            // Check if blind indexes table has entries
            $blindIndexCount = DB::table('blind_indexes')->count();
            Log::info('PractitionerController::index() - Blind indexes table count', [
                'blind_index_count' => $blindIndexCount,
            ]);

            // Check for practitioners with blind indexes
            $practitionersWithBlindIndexes = DB::table('blind_indexes')
                ->where('indexable_type', 'App\\Models\\Practitioner')
                ->count();
            Log::info('PractitionerController::index() - Practitioner blind indexes count', [
                'practitioner_blind_index_count' => $practitionersWithBlindIndexes,
            ]);

            // Let's see what blind indexes exist for practitioners
            $existingBlindIndexes = DB::table('blind_indexes')
                ->where('indexable_type', 'App\\Models\\Practitioner')
                ->select('name', 'value', 'indexable_id')
                ->limit(5)
                ->get();
            Log::info('PractitionerController::index() - Sample blind indexes', [
                'sample_indexes' => $existingBlindIndexes->toArray(),
            ]);

            try {
                $matchingPractitionerIds = Practitioner::whereBlind('first_name', 'first_name_index', $search)
                    ->orWhereBlind('last_name', 'last_name_index', $search)
                    ->orWhereBlind('email', 'email_index', $search)
                    ->orWhereBlind('license_number', 'license_number_index', $search)
                    ->pluck('id')
                    ->toArray();

                Log::info('PractitionerController::index() - Blind index search results', [
                    'found_ids' => $matchingPractitionerIds,
                    'count' => count($matchingPractitionerIds),
                ]);
            } catch (\Exception $e) {
                Log::error('PractitionerController::index() - Blind index search failed', [
                    'error' => $e->getMessage(),
                    'trace' => $e->getTraceAsString(),
                ]);

                $matchingPractitionerIds = [];
            }

            Log::info('PractitionerController::index() - Blind index search completed', [
                'matching_ids' => $matchingPractitionerIds,
                'count' => count($matchingPractitionerIds),
            ]);

            // Filter by matching practitioner IDs
            if (! empty($matchingPractitionerIds)) {
                $query->whereIn('id', $matchingPractitionerIds);
                Log::info('PractitionerController::index() - Applied ID filter', [
                    'filtered_ids' => $matchingPractitionerIds,
                ]);
            } else {
                // If no matches found, return empty result
                $query->where('id', -1);
                Log::info('PractitionerController::index() - No matches found, returning empty result');
            }
        } else {
            Log::info('PractitionerController::index() - No search term provided, returning all practitioners');
        }

        $perPage = $request->get('perPage', 10);

        try {
            $practitioners = $query->latest('created_at')->paginate($perPage);

            Log::info('PractitionerController::index() - Query executed', [
                'total_results' => $practitioners->total(),
                'current_page' => $practitioners->currentPage(),
                'per_page' => $perPage,
                'practitioner_count' => $practitioners->count(),
            ]);
        } catch (\Exception $e) {
            Log::error('PractitionerController::index() - Error fetching practitioners', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            // Return empty paginated result
            $practitioners = new \Illuminate\Pagination\LengthAwarePaginator([], 0, $perPage);

            return redirect()->back()->with('error', 'Failed to load practitioners. Please run: php artisan practitioners:sync-from-central --clear');
        }

        // Generate S3 proxy URLs and add invitation_status for practitioners
        $practitioners->getCollection()->transform(function ($practitioner) {
            // Generate profile picture proxy URL if S3 key exists
            if ($practitioner->profile_picture_s3_key) {
                $cacheBuster = substr(md5($practitioner->profile_picture_s3_key), 0, 8);
                $practitioner->profile_picture_url = url("/profile-picture-proxy/{$practitioner->id}?v={$cacheBuster}");

                // Debug logging
                Log::info("Generated profile picture URL for {$practitioner->first_name} {$practitioner->last_name}", [
                    'practitioner_id' => $practitioner->id,
                    's3_key' => $practitioner->profile_picture_s3_key,
                    'cache_buster' => $cacheBuster,
                    'generated_url' => $practitioner->profile_picture_url,
                ]);
            } else {
                Log::info("No S3 key for {$practitioner->first_name} {$practitioner->last_name}", [
                    'practitioner_id' => $practitioner->id,
                    's3_key' => $practitioner->profile_picture_s3_key,
                    'legacy_path' => $practitioner->profile_picture_path,
                ]);
            }

            // Add invitation_status based on user_id and is_active
            if ($practitioner->user_id) {
                // Has user account - they're active
                $practitioner->invitation_status = 'ACCEPTED';
            } elseif ($practitioner->is_active) {
                // No user account but active - pending invitation
                $practitioner->invitation_status = 'PENDING_INVITATION';
            } else {
                // Inactive
                $practitioner->invitation_status = 'DECLINED';
            }

            return $practitioner;
        });

        Log::info('PractitionerController::index() - Transform completed, returning response', [
            'final_count' => $practitioners->count(),
            'has_search' => $request->has('search'),
            'search_term' => $request->search,
        ]);

        // Also load invitations for the invitations tab
        $invitationsQuery = PractitionerInvitation::where('tenant_id', $currentTenantId)
            ->with([
                'practitioner', // Load all practitioner columns for proper decryption
            ]);
        // Only search invitations if we're on the invitations tab
        if ($request->has('search') && ! empty($request->search) && $currentTab === 'invitations') {
            $search = $request->search;

            // Get practitioner IDs from central database that match search criteria
            $matchingPractitionerIds = tenancy()->central(function () use ($search) {
                return Practitioner::whereBlind('first_name', 'first_name_index', $search)
                    ->orWhereBlind('last_name', 'last_name_index', $search)
                    ->orWhereBlind('email', 'email_index', $search)
                    ->orWhereBlind('license_number', 'license_number_index', $search)
                    ->pluck('id')
                    ->toArray();
            });

            // Search both practitioner-based invitations and email-only invitations
            $invitationsQuery->where(function ($query) use ($matchingPractitionerIds, $search) {
                // Search by practitioner IDs
                if (! empty($matchingPractitionerIds)) {
                    $query->whereIn('practitioner_id', $matchingPractitionerIds);
                }
                // Also search email-only invitations by email
                $query->orWhere('email', 'like', "%{$search}%");
            });
        }
        $invitations = $invitationsQuery->orderBy('created_at', 'desc')->paginate($perPage);

        // Transform the invitations data
        $invitations->getCollection()->transform(function ($invitation) {
            // Handle both practitioner-based and email-only invitations
            // Try to get from central first (invitation relationship), then fallback to tenant
            try {
                if ($invitation->practitioner) {
                    $invitation->practitioner_name = $invitation->practitioner->first_name.' '.$invitation->practitioner->last_name;
                    $invitation->practitioner_title = $invitation->practitioner->title;
                } elseif ($invitation->practitioner_id) {
                    // Fallback: look up in tenant database
                    $tenantPractitioner = Practitioner::find($invitation->practitioner_id);
                    if ($tenantPractitioner) {
                        $invitation->practitioner_name = $tenantPractitioner->first_name.' '.$tenantPractitioner->last_name;
                        $invitation->practitioner_title = $tenantPractitioner->title;
                    } else {
                        $invitation->practitioner_name = null;
                        $invitation->practitioner_title = null;
                    }
                } else {
                    $invitation->practitioner_name = null;
                    $invitation->practitioner_title = null;
                }
            } catch (\Exception $e) {
                // If error accessing practitioner, set defaults
                $invitation->practitioner_name = null;
                $invitation->practitioner_title = null;
            }

            // Always use email from invitation (not practitioner) for consistency
            $invitation->practitioner_email = $invitation->email;
            $invitation->is_expired = $invitation->isExpired();
            $invitation->expires_in_days = now()->diffInDays($invitation->expires_at, false);

            return $invitation;
        });

        return Inertia::render('Practitioner/Index', [
            'items' => PractitionerListResource::collection($practitioners),
            'invitations' => $invitations,
            'filters' => [
                'search' => $request->search,
                'perPage' => $request->get('perPage', 10),
                'tab' => $request->get('tab', 'practitioners'),
            ],
        ]);
    }

    public function create()
    {
        $locations = \App\Models\Location::all();
        $services = \App\Models\Service::where('is_active', true)->get();

        return Inertia::render('Practitioner/Create', [
            'locations' => $locations,
            'services' => $services,
        ]);
    }

    /**
     * Search for existing practitioners by name and license number
     */
    public function searchPractitioners(Request $request)
    {
        $request->validate([
            'first_name' => ['required', 'string', 'min:2', 'regex:/^[a-zA-Z]+$/'],
            'last_name' => ['required', 'string', 'min:2', 'regex:/^[a-zA-Z]+$/'],
            'license_number' => ['nullable', 'string', 'min:2'],
        ], [
            'first_name.regex' => 'First name and last name can have letters only.',
            'last_name.regex' => 'First name and last name can have letters only.',
        ]);

        $firstName = $request->first_name;
        $lastName = $request->last_name;
        $licenseNumber = $request->license_number;
        $currentTenantId = tenant('id');

        // Search with exact first and last name matching using blind indexes (encrypted fields)
        $practitioners = null;
        tenancy()->central(function () use (&$practitioners, $firstName, $lastName, $licenseNumber) {
            $query = Practitioner::whereBlind('first_name', 'first_name_index', $firstName)
                ->whereBlind('last_name', 'last_name_index', $lastName);

            // If license number is provided, add it to the search (encrypted field)
            if ($licenseNumber) {
                $query->whereBlind('license_number', 'license_number_index', $licenseNumber);
            }

            // NOTE: No select() clause - CipherSweet needs all fields to decrypt properly
            $practitioners = $query->limit(10)->get();
        });

        // Mask the results for compliance
        $maskedPractitioners = $practitioners->map(function ($practitioner) {
            return [
                'id' => $practitioner->id,
                'first_name' => $this->maskString($practitioner->first_name, 1, 1),
                'last_name' => $this->maskString($practitioner->last_name, 1, 1),
                'email' => $this->maskEmail($practitioner->email),
                'title' => $practitioner->title,
                'license_number' => $practitioner->license_number ? $this->maskString($practitioner->license_number, 2, 2) : null,
                'display_name' => $this->maskString($practitioner->first_name, 1, 1).' '.
                               $this->maskString($practitioner->last_name, 1, 1),
            ];
        });

        return response()->json([
            'practitioners' => $maskedPractitioners,
        ]);
    }

    /**
     * Mask a string keeping first and last characters visible
     */
    private function maskString(string $str, int $start = 1, int $end = 1): string
    {
        $length = strlen($str);
        if ($length <= $start + $end) {
            return str_repeat('*', $length);
        }

        return substr($str, 0, $start).
               str_repeat('*', $length - $start - $end).
               substr($str, -$end);
    }

    /**
     * Mask an email address
     */
    private function maskEmail(string $email): string
    {
        $parts = explode('@', $email);
        if (count($parts) !== 2) {
            return $email;
        }

        $username = $parts[0];
        $domain = $parts[1];

        $maskedUsername = $this->maskString($username, 1, 1);

        return $maskedUsername.'@'.$domain;
    }

    /**
     * Link an existing practitioner to the current tenant
     */
    public function linkPractitioner(Request $request)
    {
        $request->validate([
            'practitioner_id' => ['required', 'integer'],
        ]);

        $practitionerId = $request->practitioner_id;
        $currentTenantId = tenant('id');

        // Check if practitioner already exists in this tenant
        $practitioner = Practitioner::find($practitionerId);
        if ($practitioner) {
            // Set flash message for already linked case
            return redirect()->back()->with('info', 'Practitioner is already part of this organization');
        }

        // If practitioner doesn't exist in tenant, we need to sync from central
        $centralPractitioner = tenancy()->central(function () use ($practitionerId) {
            return \App\Models\Practitioner::find($practitionerId);
        });

        if (! $centralPractitioner) {
            return redirect()->back()->withErrors(['error' => 'Practitioner not found']);
        }

        // Sync practitioner from central to tenant database
        $tenantPractitioner = Practitioner::syncFromCentral($centralPractitioner);

        // Link practitioner in central tenant_practitioners table
        tenancy()->central(function () use ($currentTenantId, $centralPractitioner) {
            DB::table('tenant_practitioners')->insert([
                'tenant_id' => $currentTenantId,
                'practitioner_id' => $centralPractitioner->id,
                'invitation_status' => 'PENDING_INVITATION',
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        });

        // Create wallet for practitioner in tenant database
        \App\Models\Tenant\Wallet::getOrCreatePractitionerWallet($tenantPractitioner->id);

        // Set flash message for success and redirect back
        return redirect()->back()->with('success', 'Practitioner linked successfully! The practitioner has been added to your organization.');
    }

    public function edit($id)
    {
        // Get practitioner from tenant database (already scoped to current tenant)
        $practitioner = Practitioner::findOrFail($id);

        $locations = \App\Models\Location::all();
        $services = \App\Models\Service::where('is_active', true)->get();

        // Allow editing at tenant level - each tenant can customize practitioner data
        return Inertia::render('Practitioner/Create', [
            'practitioner' => $practitioner,
            'canEditBasicInfo' => true, // Always allow editing at tenant level
            'canEditProfessionalDetails' => true, // Always allow editing at tenant level
            'locations' => $locations,
            'services' => $services,
        ]);
    }

    public function update(Request $request, $id)
    {
        Log::error('⚠️ WRONG PractitionerController::update() called - redirecting back instead of to settings');

        // Instead of redirecting to settings, redirect back with success message
        return redirect()->back()
            ->with('success', 'Profile updated successfully!');
    }

    public function destroy($id)
    {
        // Tenants cannot delete practitioners - they can only unlink them
        // This could be implemented later as an "unlink" function
        return redirect()->back()
            ->with('error', 'Practitioners cannot be deleted. They can only be unlinked from your tenant.');
    }

    public function validateEmail(Request $request)
    {
        $request->validate([
            'email' => 'required|email',
        ]);

        $email = $request->email;
        $existsInCentral = false;
        $existsInTenant = false;

        // Check central database for User (needs tenancy()->central())
        tenancy()->central(function () use (&$existsInCentral, $email) {
            $existsInCentral = User::where('email', $email)->exists();
        });

        // Check tenant database for existing practitioner
        $existsInTenant = Practitioner::where('email', $email)->exists();

        $isAvailable = ! $existsInCentral && ! $existsInTenant;

        return response()->json([
            'available' => $isAvailable,
            'existsInTenant' => $existsInTenant,
            'message' => $isAvailable ? 'Email is available.' : 'Email is already taken in the system.',
        ]);
    }

    /**
     * Store/Update basic info for practitioner
     */
    public function storeBasicInfo(Request $request)
    {
        // Debug logging
        Log::info('Tenant\PractitionerController: storeBasicInfo request received', [
            'has_s3_key' => $request->has('profile_picture_s3_key'),
            's3_key' => $request->input('profile_picture_s3_key'),
            's3_url' => $request->input('profile_picture_s3_url'),
            'practitioner_id' => $request->input('practitioner_id'),
            'request_keys' => array_keys($request->all()),
        ]);

        $validated = $request->validate([
            'practitioner_id' => ['nullable', 'integer'],
            'first_name' => ['required', 'string', 'max:255'],
            'last_name' => ['required', 'string', 'max:255'],
            'title' => ['nullable', 'string', 'max:100'],
            'email' => ['required', 'email', 'max:255'],
            'phone_number' => ['nullable', 'string', 'max:20'],
            'extension' => ['nullable', 'string', 'max:10'],
            'gender' => ['nullable', 'string', 'max:20'],
            'pronoun' => ['nullable', 'string', 'max:20'],
            'is_active' => ['boolean'],
            'short_bio' => ['nullable', 'string', 'max:500'],
            'full_bio' => ['nullable', 'string'],
            // S3 fields (prioritized)
            'profile_picture_s3_key' => ['nullable', 'string'],
            'profile_picture_s3_url' => ['nullable', 'string'],

            // Traditional file fields (fallback) - REMOVED for S3-only
            'profile_picture' => ['nullable', 'image', 'mimes:jpeg,png,jpg,gif', 'max:2048'],
            // S3 file uploads
            'resume_files_s3_keys' => ['nullable', 'array'],
            'resume_files_s3_keys.*' => ['nullable', 'string'],
            'licensing_docs_s3_keys' => ['nullable', 'array'],
            'licensing_docs_s3_keys.*' => ['nullable', 'string'],
            'certificates_s3_keys' => ['nullable', 'array'],
            'certificates_s3_keys.*' => ['nullable', 'string'],
        ]);

        $currentTenantId = tenant('id');

        // For existing practitioners, verify they exist in tenant database
        if ($validated['practitioner_id']) {
            // Get practitioner from tenant database
            $practitioner = Practitioner::find($validated['practitioner_id']);

            if (! $practitioner) {
                return redirect()->back()
                    ->withErrors(['basic_info' => 'Practitioner not found or not linked to this tenant.']);
            }

            // Allow editing at tenant level - each tenant can customize practitioner data
        }

        // First, create or get the practitioner to have the ID for file organization
        $practitioner = null;
        $practitionerId = null;

        if ($validated['practitioner_id']) {
            // Get existing practitioner
            $practitioner = Practitioner::findOrFail($validated['practitioner_id']);
            $practitionerId = $practitioner->id;
        } else {
            // For new practitioners, check email uniqueness first
            // Check tenant practitioners table and central users table
            $emailExistsInPractitioners = Practitioner::where('email', $validated['email'])->exists();
            $emailExistsInUsers = false;
            tenancy()->central(function () use (&$emailExistsInUsers, $validated) {
                $emailExistsInUsers = User::where('email', $validated['email'])->exists();
            });
            $emailExists = $emailExistsInPractitioners || $emailExistsInUsers;

            if ($emailExists) {
                return redirect()->back()
                    ->withInput()
                    ->withErrors(['email' => 'The email has already been taken.']);
            }

            // Create new practitioner (without files first to get ID)
            $practitioner = null;
            tenancy()->central(function () use (&$practitioner, $validated) {
                $practitioner = Practitioner::create([
                    ...$validated,
                    'meta_data' => ['is_onboarding' => 1], // 👈 set onboarding true when creating
                ]);
            });
            $practitionerId = $practitioner->id;

            // Link practitioner to tenant
            tenancy()->central(function () use ($currentTenantId, $practitionerId) {
                DB::table('tenant_practitioners')->insert([
                    'tenant_id' => $currentTenantId,
                    'practitioner_id' => $practitionerId,
                    'invitation_status' => 'PENDING_INVITATION',
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            });

            // Sync practitioner to tenant database
            Log::info('Syncing new practitioner to tenant database', [
                'practitioner_id' => $practitionerId,
                'tenant_id' => $currentTenantId,
            ]);

            try {
                $tenantPractitioner = Practitioner::syncFromCentral($practitioner);
                Log::info('Successfully synced practitioner to tenant database', [
                    'practitioner_id' => $practitionerId,
                    'tenant_record_id' => $tenantPractitioner->id,
                ]);

                // Update $practitioner reference to use tenant record
                $practitioner = $tenantPractitioner;
            } catch (\Exception $e) {
                Log::error('Failed to sync practitioner to tenant database', [
                    'practitioner_id' => $practitionerId,
                    'error' => $e->getMessage(),
                    'trace' => $e->getTraceAsString(),
                ]);

                return redirect()->back()
                    ->withErrors(['basic_info' => 'Failed to create practitioner record. Please try again.']);
            }

            // Create wallet for new practitioner in tenant database
            \App\Models\Tenant\Wallet::getOrCreatePractitionerWallet($practitionerId);

        }

        $profilePicturePath = null;
        $profilePictureS3Key = null;
        $profilePictureS3Url = null;

        // Handle profile picture - S3 only
        if ($request->filled('profile_picture_s3_key')) {
            $profilePictureS3Key = $validated['profile_picture_s3_key'];
            Log::info('PractitionerController storeBasicInfo: Using S3 profile picture', [
                's3Key' => $profilePictureS3Key,
                'practitionerId' => $practitionerId,
                'timestamp' => now()->toDateTimeString(),
            ]);
        }

        // Handle document file uploads - S3 only
        $documentS3Keys = [
            'resume_files' => [],
            'licensing_docs' => [],
            'certificates' => [],
        ];

        Log::info('PractitionerController storeBasicInfo: Processing S3 document keys', [
            'practitionerId' => $practitionerId,
            'hasResumeKeys' => $request->filled('resume_files_s3_keys'),
            'hasLicensingKeys' => $request->filled('licensing_docs_s3_keys'),
            'hasCertificateKeys' => $request->filled('certificates_s3_keys'),
            'timestamp' => now()->toDateTimeString(),
        ]);

        foreach (['resume_files', 'licensing_docs', 'certificates'] as $fileType) {
            $s3KeysField = $fileType.'_s3_keys';
            if ($request->filled($s3KeysField)) {
                $s3Keys = $request->input($s3KeysField);
                $documentS3Keys[$fileType] = is_array($s3Keys) ? $s3Keys : [$s3Keys];

                Log::info("PractitionerController storeBasicInfo: S3 keys received for {$fileType}", [
                    'practitionerId' => $practitionerId,
                    'fileType' => $fileType,
                    's3Keys' => $documentS3Keys[$fileType],
                    'count' => count($documentS3Keys[$fileType]),
                    'timestamp' => now()->toDateTimeString(),
                ]);
            }
        }

        // Update existing practitioner - save to TENANT database only
        if ($validated['practitioner_id']) {
            $practitionerId = $validated['practitioner_id'];

            // Get tenant-level practitioner record
            $tenantPractitioner = null;
            try {
                $tenantPractitioner = Practitioner::findOrFail($practitionerId);

                // Verify encryption is valid by accessing a field
                $testName = $tenantPractitioner->first_name;
            } catch (\Exception $e) {
                Log::error('Error accessing practitioner in storeBasicInfo', [
                    'practitioner_id' => $practitionerId,
                    'error' => $e->getMessage(),
                ]);

                throw $e;
            }

            // Merge existing document S3 keys with new uploads
            $existingResume = $tenantPractitioner->resume_files ?: [];
            $existingLicensing = $tenantPractitioner->licensing_docs ?: [];
            $existingCertificates = $tenantPractitioner->certificates ?: [];

            $updateData = array_merge($validated, [
                'resume_files' => array_merge($existingResume, $documentS3Keys['resume_files']),
                'licensing_docs' => array_merge($existingLicensing, $documentS3Keys['licensing_docs']),
                'certificates' => array_merge($existingCertificates, $documentS3Keys['certificates']),
            ]);

            // Handle profile picture - S3 only
            if ($profilePictureS3Key) {
                $updateData['profile_picture_s3_key'] = $profilePictureS3Key;
            } else {
                // No new upload, keep existing S3 key
                $updateData['profile_picture_s3_key'] = $tenantPractitioner->profile_picture_s3_key;
            }

            Log::info('PractitionerController storeBasicInfo: Updating TENANT-LEVEL practitioner with S3 data', [
                'practitionerId' => $practitionerId,
                'tenantPractitionerId' => $tenantPractitioner->id,
                'hasProfilePictureS3Key' => ! empty($profilePictureS3Key),
                'resumeFilesCount' => count($updateData['resume_files']),
                'licensingDocsCount' => count($updateData['licensing_docs']),
                'certificatesCount' => count($updateData['certificates']),
                'timestamp' => now()->toDateTimeString(),
            ]);

            // Update tenant-level record only
            $tenantPractitioner->update($updateData);
        }

        // For new practitioners, update S3 keys after processing - save to TENANT database
        if (! $validated['practitioner_id'] && ($profilePictureS3Key || ! empty($documentS3Keys['resume_files']) || ! empty($documentS3Keys['licensing_docs']) || ! empty($documentS3Keys['certificates']))) {
            // Use the practitioner that was just created
            $updateData = [
                'resume_files' => $documentS3Keys['resume_files'],
                'licensing_docs' => $documentS3Keys['licensing_docs'],
                'certificates' => $documentS3Keys['certificates'],
            ];

            // Handle profile picture for new practitioners - S3 only
            if ($profilePictureS3Key) {
                $updateData['profile_picture_s3_key'] = $profilePictureS3Key;
            }

            Log::info('PractitionerController storeBasicInfo: Updating new TENANT-LEVEL practitioner with S3 data', [
                'practitionerId' => $practitioner->id,
                'hasProfilePictureS3Key' => ! empty($profilePictureS3Key),
                'resumeFilesCount' => count($updateData['resume_files']),
                'licensingDocsCount' => count($updateData['licensing_docs']),
                'certificatesCount' => count($updateData['certificates']),
                'timestamp' => now()->toDateTimeString(),
            ]);

            $practitioner->update($updateData);
        }

        // Send consent email for new practitioners
        if (! $validated['practitioner_id']) {
            $this->sendConsentEmail($practitioner, $currentTenantId);
        }

        // For new practitioners, redirect back to the same form but with practitioner ID
        if (! $validated['practitioner_id']) {
            return redirect()->back()
                ->with('success', 'Basic information saved successfully. You can now access other tabs.')
                ->with('activeTab', 'professional') // Auto-switch to next tab
                ->with('practitioner_id', $practitionerId) // Pass practitioner ID in flash
                ->with('practitioner', $practitioner); // Pass full practitioner data
        }

        // For existing practitioners, redirect back with success
        return redirect()->back()
            ->with('success', 'Basic information updated successfully.');
    }

    /**
     * Store/Update combined basic info and professional details for practitioner
     */
    public function storeCombinedDetails(Request $request)
    {
        // Validate all required fields for both basic info and professional details
        $validated = $request->validate([
            'practitioner_id' => ['nullable', 'integer'],
            // Basic Info fields
            'first_name' => ['required', 'string', 'max:255'],
            'last_name' => ['required', 'string', 'max:255'],
            'title' => ['nullable', 'string', 'max:100'],
            'email' => ['required', 'email', 'max:255'],
            'phone_number' => ['nullable', 'string', 'max:20'],
            'extension' => ['nullable', 'string', 'max:10'],
            'gender' => ['nullable', 'string', 'max:20'],
            'pronoun' => ['nullable', 'string', 'max:20'],
            'is_active' => ['boolean'],
            'short_bio' => ['nullable', 'string', 'max:500'],
            'full_bio' => ['nullable', 'string'],
            // S3 fields (prioritized)
            'profile_picture_s3_key' => ['nullable', 'string'],
            'profile_picture_s3_url' => ['nullable', 'string'],
            // Traditional file fields (fallback)
            'profile_picture' => ['nullable', 'image', 'mimes:jpeg,png,jpg,gif', 'max:2048'],
            // Professional Details fields
            'credentials' => ['required', 'array', 'min:1'],
            'years_of_experience' => ['required', 'string'],
            'license_number' => ['required', 'string', 'max:100'],
            'professional_associations' => ['required', 'array', 'min:1'],
            'primary_specialties' => ['required', 'array', 'min:1'],
            'therapeutic_modalities' => ['required', 'array', 'min:1'],
            'client_types_served' => ['required', 'array', 'min:1'],
            'languages_spoken' => ['required', 'array', 'min:1'],
            // S3 file uploads
            'resume_files_s3_keys' => ['nullable', 'array'],
            'resume_files_s3_keys.*' => ['nullable', 'string'],
            'licensing_docs_s3_keys' => ['nullable', 'array'],
            'licensing_docs_s3_keys.*' => ['nullable', 'string'],
            'certificates_s3_keys' => ['nullable', 'array'],
            'certificates_s3_keys.*' => ['nullable', 'string'],
            'current_tab' => ['nullable', 'string'],
        ]);

        $currentTenantId = tenant('id');

        // Check if creating new practitioner or updating existing
        if ($validated['practitioner_id']) {
            // Update existing practitioner
            $practitioner = Practitioner::find($validated['practitioner_id']);

            if (! $practitioner) {
                return redirect()->back()
                    ->withErrors(['practitioner_id' => 'Practitioner not found or not linked to this tenant.']);
            }

            // Allow editing at tenant level - each tenant can customize practitioner data
        } else {
            // Create new practitioner - check email uniqueness first
            $emailExistsInPractitioners = Practitioner::where('email', $validated['email'])->exists();
            $emailExistsInUsers = false;
            tenancy()->central(function () use (&$emailExistsInUsers, $validated) {
                $emailExistsInUsers = User::where('email', $validated['email'])->exists();
            });
            $emailExists = $emailExistsInPractitioners || $emailExistsInUsers;

            if ($emailExists) {
                return redirect()->back()
                    ->withInput()
                    ->withErrors(['email' => 'The email has already been taken.']);
            }

            // Create new practitioner in tenant database
            // Build unique slug
            $base = Str::slug(trim(($validated['first_name'] ?? '').' '.($validated['last_name'] ?? '')));
            if ($base === '') {
                $emailPrefix = isset($validated['email']) ? strstr($validated['email'], '@', true) : Str::random(6);
                $base = Str::slug($emailPrefix);
            }

            $existing = Practitioner::where('slug', 'LIKE', $base.'%')->pluck('slug')->toArray();
            $slug = $base;
            if (in_array($slug, $existing, true)) {
                $max = 1;
                foreach ($existing as $s) {
                    if (preg_match('/^'.preg_quote($base, '/').'-(\d+)$/', $s, $m)) {
                        $max = max($max, (int) $m[1]);
                    }
                }
                $slug = $base.'-'.($max + 1);
            }

            Log::info('Practitioner creation: Final slug decided', ['final_slug' => $slug]);

            // Create practitioner in CENTRAL database first
            $centralPractitioner = null;
            tenancy()->central(function () use (&$centralPractitioner, $validated, $slug) {
                $centralPractitioner = Practitioner::create([
                    ...$validated,
                    'meta_data' => ['is_onboarding' => 1],
                ]);

                // Now set slug directly and save (bypasses $fillable)
                $centralPractitioner->slug = $slug;
                $centralPractitioner->saveQuietly();
            });

            $practitionerId = $centralPractitioner->id;

            Log::info('Practitioner creation: Created in central database', [
                'practitioner_id' => $practitionerId,
                'slug' => $slug,
            ]);

            // Link practitioner to tenant in central database
            tenancy()->central(function () use ($currentTenantId, $practitionerId) {
                DB::table('tenant_practitioners')->insert([
                    'tenant_id' => $currentTenantId,
                    'practitioner_id' => $practitionerId,
                    'invitation_status' => 'PENDING_INVITATION',
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            });

            // Sync practitioner to tenant database
            Log::info('Syncing new practitioner to tenant database', [
                'practitioner_id' => $practitionerId,
                'tenant_id' => $currentTenantId,
            ]);

            try {
                $practitioner = Practitioner::syncFromCentral($centralPractitioner);
                Log::info('Successfully synced practitioner to tenant database', [
                    'practitioner_id' => $practitionerId,
                    'tenant_record_id' => $practitioner->id,
                    'slug' => $practitioner->slug,
                ]);
            } catch (\Exception $e) {
                Log::error('Failed to sync practitioner to tenant database', [
                    'practitioner_id' => $practitionerId,
                    'error' => $e->getMessage(),
                    'trace' => $e->getTraceAsString(),
                ]);

                return redirect()->back()
                    ->withErrors(['professional_details' => 'Failed to create practitioner record. Please try again.']);
            }

            // Create wallet for new practitioner in tenant database
            \App\Models\Tenant\Wallet::getOrCreatePractitionerWallet($practitionerId);
        }

        // Handle file uploads (profile picture and documents)
        $profilePicturePath = null;
        $profilePictureS3Key = null;

        // Handle profile picture - S3 only
        if ($request->filled('profile_picture_s3_key')) {
            $profilePictureS3Key = $validated['profile_picture_s3_key'];
            Log::info('PractitionerController storeCombinedDetails: Using S3 profile picture', [
                's3Key' => $profilePictureS3Key,
                'practitionerId' => $practitioner->id,
                'timestamp' => now()->toDateTimeString(),
            ]);
        }

        // Handle document file uploads - S3 only
        $documentS3Keys = [
            'resume_files' => [],
            'licensing_docs' => [],
            'certificates' => [],
        ];

        Log::info('PractitionerController storeCombinedDetails: Processing S3 document keys', [
            'practitionerId' => $practitioner->id,
            'hasResumeKeys' => $request->filled('resume_files_s3_keys'),
            'hasLicensingKeys' => $request->filled('licensing_docs_s3_keys'),
            'hasCertificateKeys' => $request->filled('certificates_s3_keys'),
            'timestamp' => now()->toDateTimeString(),
        ]);

        foreach (['resume_files', 'licensing_docs', 'certificates'] as $fileType) {
            $s3KeysField = $fileType.'_s3_keys';
            if ($request->filled($s3KeysField)) {
                $s3Keys = $request->input($s3KeysField);
                $documentS3Keys[$fileType] = is_array($s3Keys) ? $s3Keys : [$s3Keys];

                Log::info("PractitionerController storeCombinedDetails: S3 keys received for {$fileType}", [
                    'practitionerId' => $practitioner->id,
                    'fileType' => $fileType,
                    's3Keys' => $documentS3Keys[$fileType],
                    'count' => count($documentS3Keys[$fileType]),
                    'timestamp' => now()->toDateTimeString(),
                ]);
            }
        }

        // Update practitioner with all data - S3 only - save to TENANT database
        // Use the practitioner that was created or retrieved earlier
        $existingResume = $practitioner->resume_files ?: [];
        $existingLicensing = $practitioner->licensing_docs ?: [];
        $existingCertificates = $practitioner->certificates ?: [];

        $updateData = array_merge($validated, [
            'resume_files' => array_merge($existingResume, $documentS3Keys['resume_files']),
            'licensing_docs' => array_merge($existingLicensing, $documentS3Keys['licensing_docs']),
            'certificates' => array_merge($existingCertificates, $documentS3Keys['certificates']),
        ]);

        // Handle profile picture - S3 only
        if ($profilePictureS3Key) {
            $updateData['profile_picture_s3_key'] = $profilePictureS3Key;
        }

        Log::info('PractitionerController storeCombinedDetails: Updating TENANT-LEVEL practitioner with S3 data', [
            'practitionerId' => $practitioner->id,
            'hasProfilePictureS3Key' => ! empty($profilePictureS3Key),
            'resumeFilesCount' => count($updateData['resume_files']),
            'licensingDocsCount' => count($updateData['licensing_docs']),
            'certificatesCount' => count($updateData['certificates']),
            'timestamp' => now()->toDateTimeString(),
        ]);

        $practitioner->update($updateData);

        // Send staff permissions consent email for all practitioners
        // (Static implementation - will be made conditional later)
        $currentTenantId = tenant('id');

        Log::info('Triggering consents for practitioner creation', [
            'practitioner_id' => $practitioner->id,
            'practitioner_email' => $practitioner->email,
            'tenant_id' => $currentTenantId,
        ]);

        // Trigger consents for practitioner creation
        app(\App\Services\ConsentTriggerService::class)->triggerConsentsForEntity('PRACTITIONER', 'creation', $practitioner);

        // Redirect back to the form with the next tab (locations) and success message
        // return redirect()->back()
        //     ->with('success', 'Basic information and professional details saved successfully!')
        //     ->with('activeTab', 'locations')
        //     ->with('practitioner_id', $practitioner->id);

        return redirect()->route('practitioners.edit', $practitioner->id)
            ->with('success', 'Basic information and professional details saved successfully!')
            ->with('activeTab', 'locations');
    }

    /**
     * Store/Update professional details for practitioner
     */
    public function storeProfessionalDetails(Request $request)
    {
        // Validate that practitioner_id is provided
        $request->validate([
            'practitioner_id' => ['required', 'integer'],
        ]);

        $validated = $request->validate([
            'credentials' => ['nullable', 'array'],
            'years_of_experience' => ['nullable', 'string'],
            'license_number' => ['nullable', 'string', 'max:100'],
            'professional_associations' => ['nullable', 'array'],
            'primary_specialties' => ['nullable', 'array'],
            'therapeutic_modalities' => ['nullable', 'array'],
            'client_types_served' => ['nullable', 'array'],
            'languages_spoken' => ['nullable', 'array'],
            // S3 file uploads
            'resume_files_s3_keys' => ['nullable', 'array'],
            'resume_files_s3_keys.*' => ['nullable', 'string'],
            'licensing_docs_s3_keys' => ['nullable', 'array'],
            'licensing_docs_s3_keys.*' => ['nullable', 'string'],
            'certificates_s3_keys' => ['nullable', 'array'],
            'certificates_s3_keys.*' => ['nullable', 'string'],
            'current_tab' => ['nullable', 'string'], // Add current tab tracking
        ]);

        $currentTenantId = tenant('id');

        // Get practitioner from tenant database
        $practitioner = Practitioner::find($request->practitioner_id);

        if (! $practitioner) {
            return redirect()->back()
                ->withErrors(['professional_details' => 'Practitioner not found or not linked to this tenant.']);
        }

        // Allow editing at tenant level - each tenant can customize practitioner data

        $practitionerId = $request->practitioner_id;

        // Handle document file uploads - S3 only
        $documentS3Keys = [
            'resume_files' => [],
            'licensing_docs' => [],
            'certificates' => [],
        ];

        Log::info('PractitionerController storeProfessionalDetails: Processing S3 document keys', [
            'practitionerId' => $practitionerId,
            'hasResumeKeys' => $request->filled('resume_files_s3_keys'),
            'hasLicensingKeys' => $request->filled('licensing_docs_s3_keys'),
            'hasCertificateKeys' => $request->filled('certificates_s3_keys'),
            'timestamp' => now()->toDateTimeString(),
        ]);

        foreach (['resume_files', 'licensing_docs', 'certificates'] as $fileType) {
            $s3KeysField = $fileType.'_s3_keys';
            if ($request->filled($s3KeysField)) {
                $s3Keys = $request->input($s3KeysField);
                $documentS3Keys[$fileType] = is_array($s3Keys) ? $s3Keys : [$s3Keys];

                Log::info("PractitionerController storeProfessionalDetails: S3 keys received for {$fileType}", [
                    'practitionerId' => $practitionerId,
                    'fileType' => $fileType,
                    's3Keys' => $documentS3Keys[$fileType],
                    'count' => count($documentS3Keys[$fileType]),
                    'timestamp' => now()->toDateTimeString(),
                ]);
            }
        }

        // Merge existing document S3 keys with new uploads
        $existingResume = $practitioner->resume_files ?: [];
        $existingLicensing = $practitioner->licensing_docs ?: [];
        $existingCertificates = $practitioner->certificates ?: [];

        // Remove file upload keys from validated data for the update
        $updateData = collect($validated)->except(['resume_files_s3_keys', 'licensing_docs_s3_keys', 'certificates_s3_keys'])->toArray();

        // Add merged S3 keys
        $updateData['resume_files'] = array_merge($existingResume, $documentS3Keys['resume_files']);
        $updateData['licensing_docs'] = array_merge($existingLicensing, $documentS3Keys['licensing_docs']);
        $updateData['certificates'] = array_merge($existingCertificates, $documentS3Keys['certificates']);

        Log::info('PractitionerController storeProfessionalDetails: Updating practitioner with S3 data', [
            'practitionerId' => $practitionerId,
            'resumeFilesCount' => count($updateData['resume_files']),
            'licensingDocsCount' => count($updateData['licensing_docs']),
            'certificatesCount' => count($updateData['certificates']),
            'timestamp' => now()->toDateTimeString(),
        ]);

        // Update professional details in TENANT database only
        $practitioner->update($updateData);

        // Send staff permissions consent email for all practitioners
        // (Static implementation - will be made conditional later)
        $currentTenantId = tenant('id');

        Log::info('Triggering consents for practitioner creation', [
            'practitioner_id' => $practitioner->id,
            'practitioner_email' => $practitioner->email,
            'tenant_id' => $currentTenantId,
        ]);

        // Trigger consents for practitioner creation
        app(\App\Services\ConsentTriggerService::class)->triggerConsentsForEntity('PRACTITIONER', 'creation', $practitioner);

        // If we have a current_tab, we're in edit mode - stay on the same page
        if (isset($validated['current_tab']) && $validated['current_tab']) {
            return redirect()->back()
                ->with('success', 'Professional details saved successfully.');
        }

        // Otherwise, redirect to settings (likely came from settings page)
        return redirect()->back()
            ->with('success', 'Professional details saved successfully.');
    }

    /**
     * Get locations for a practitioner (all locations with assignment status)
     */
    public function getLocations($practitionerId)
    {
        $currentTenantId = tenant('id');

        // Verify practitioner exists in tenant database
        $practitioner = Practitioner::find($practitionerId);
        if (! $practitioner) {
            return response()->json(['error' => 'Practitioner not found'], 404);
        }

        // Get practitioner location assignments (from tenant DB pivot table)
        $practitionerLocations = DB::table('location_practitioners')
            ->where('practitioner_id', $practitionerId)
            ->where('is_assigned', true) // Only get actually assigned locations
            ->get()
            ->pluck('location_id')
            ->toArray();

        // Get all locations from tenant database
        $allLocations = Location::get();

        $locations = $allLocations->map(function ($location) use ($practitionerLocations) {
            return [
                'id' => $location->id,
                'name' => $location->name,
                'timezone' => $location->timezone,
                'full_address' => $location->full_address,
                'phone_number' => $location->phone_number,
                'email_address' => $location->email_address,
                'is_active' => $location->is_active,
                'status' => $location->is_active ? 'Active' : 'Inactive',
                'is_assigned' => in_array($location->id, $practitionerLocations), // Read-only assignment status
            ];
        });

        return response()->json([
            'locations' => $locations,
        ]);
    }

    /**
     * Note: Location assignment is now handled in the locations module.
     * This method is kept for backward compatibility but redirects users appropriately.
     */
    public function storeLocations(Request $request)
    {
        // Validate that practitioner_id is provided
        $request->validate([
            'practitioner_id' => ['required', 'integer'],
        ]);

        // 🚀 NEW: Check if practitioner exists using CentralConnection trait
        if (! Practitioner::where('id', $request->practitioner_id)->exists()) {
            return redirect()->back()
                ->withErrors(['practitioner_id' => 'Practitioner not found.']);
        }

        // Since location assignment is handled in locations module, just redirect back
        return redirect()->back()
            ->with('success', 'Practitioner location settings updated successfully. Location assignments are managed in the Locations module.');
    }

    /**
     * Get availability for a practitioner at a specific location
     */
    public function getLocationAvailability($practitionerId, $locationId)
    {
        $currentTenantId = tenant('id');

        // Verify practitioner exists in tenant database
        $practitioner = Practitioner::find($practitionerId);
        if (! $practitioner) {
            return response()->json(['error' => 'Practitioner not found'], 404);
        }

        // Verify location exists in tenant database
        $location = Location::find($locationId);
        if (! $location) {
            return response()->json(['error' => 'Location not found'], 404);
        }

        // Get practitioner availability for this location from tenant database
        $availabilityRecords = DB::table('practitioner_availability')
            ->where('practitioner_id', $practitionerId)
            ->where('location_id', $locationId)
            ->select('day', 'start_time', 'end_time')
            ->orderBy('day')
            ->orderBy('start_time')
            ->get();

        // Group availability by day for frontend compatibility
        $availability = [];
        foreach ($availabilityRecords as $record) {
            if (! isset($availability[$record->day])) {
                $availability[$record->day] = [];
            }
            $availability[$record->day][] = [
                'start' => substr($record->start_time, 0, 5), // Remove seconds
                'end' => substr($record->end_time, 0, 5),
            ];
        }

        return response()->json([
            'availability' => $availability,
        ]);
    }

    /**
     * Store/Update availability for practitioner at a specific location
     */
    public function storeLocationAvailability(Request $request, $practitionerId, $locationId)
    {
        $currentTenantId = tenant('id');

        // Verify practitioner exists in tenant database
        $practitioner = Practitioner::find($practitionerId);
        if (! $practitioner) {
            return response()->json(['error' => 'Practitioner not found'], 404);
        }

        // Verify location exists in tenant database
        $location = Location::find($locationId);
        if (! $location) {
            return response()->json(['error' => 'Location not found'], 404);
        }

        $validated = $request->validate([
            'availability_schedule' => ['required', 'array'],
        ]);

        try {
            DB::beginTransaction();

            // Delete existing availability records for this practitioner and location
            DB::table('practitioner_availability')
                ->where('practitioner_id', $practitionerId)
                ->where('location_id', $locationId)
                ->delete();

            // Insert new availability records
            $records = [];
            foreach ($validated['availability_schedule'] as $day => $timeSlots) {
                if (is_array($timeSlots)) {
                    foreach ($timeSlots as $slot) {
                        if (isset($slot['start']) && isset($slot['end'])) {
                            $records[] = [
                                'practitioner_id' => $practitionerId,
                                'location_id' => $locationId,
                                'day' => $day,
                                'start_time' => $slot['start'].':00', // Add seconds
                                'end_time' => $slot['end'].':00',     // Add seconds
                                'created_at' => now(),
                                'updated_at' => now(),
                            ];
                        }
                    }
                }
            }

            // Insert all records at once
            if (! empty($records)) {
                DB::table('practitioner_availability')->insert($records);
            }

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Location availability updated successfully.',
            ]);

        } catch (\Exception $e) {
            DB::rollBack();

            return response()->json([
                'success' => false,
                'message' => 'Failed to update availability: '.$e->getMessage(),
            ], 500);
        }
    }

    /**
     * Store/Update pricing for practitioner
     */
    public function storePricing(Request $request)
    {
        // Validate that practitioner_id is provided
        $request->validate([
            'practitioner_id' => ['required', 'integer'],
        ]);

        $validated = $request->validate([
            'service_pricing' => ['nullable', 'array'],
            'current_tab' => ['nullable', 'string'], // Add current tab tracking
        ]);

        // 🚀 NEW: Check and update practitioner using CentralConnection trait
        $practitioner = Practitioner::find($request->practitioner_id);
        if (! $practitioner) {
            return redirect()->back()
                ->withErrors(['practitioner_id' => 'Please save the basic information first before adding pricing information.']);
        }

        $practitioner->update($validated);

        // If we have a current_tab, we're in edit mode - redirect back to the same page
        if (isset($validated['current_tab']) && $validated['current_tab']) {
            return redirect()->back()->with('success', 'Practitioner pricing updated successfully.');
        }

        // Otherwise, redirect to settings (likely came from settings page)
        return redirect()->back()
            ->with('success', 'Practitioner pricing updated successfully.');
    }

    /**
     * Get practitioner services with current pricing/status
     */
    public function getPractitionerServices($practitionerId)
    {
        $currentTenantId = tenant('id');

        // Verify practitioner exists in tenant database
        $practitioner = Practitioner::find($practitionerId);
        if (! $practitioner) {
            return response()->json(['error' => 'Practitioner not found'], 404);
        }

        // Get all active services from tenant database with practitioner-service relationships
        $services = Service::where('is_active', true)
            ->leftJoin('practitioner_services', function ($join) use ($practitionerId) {
                $join->on('services.id', '=', 'practitioner_services.service_id')
                    ->where('practitioner_services.practitioner_id', '=', $practitionerId);
            })
            ->select(
                'services.*',
                'practitioner_services.custom_price',
                'practitioner_services.custom_duration_minutes',
                'practitioner_services.is_offered'
            )
            ->get()
            ->map(function ($service) {
                // Add pivot data structure for frontend compatibility
                $service->pivot = [
                    'custom_price' => $service->custom_price,
                    'custom_duration_minutes' => $service->custom_duration_minutes,
                    'is_offered' => (bool) $service->is_offered,
                ];

                // Remove the direct attributes since we're using pivot
                unset($service->custom_price, $service->custom_duration_minutes, $service->is_offered);

                return $service;
            });

        return response()->json([
            'services' => $services,
        ]);
    }

    /**
     * Store/Update practitioner services and pricing
     */
    public function storePractitionerServices(Request $request, $practitionerId)
    {
        $currentTenantId = tenant('id');

        Log::info('🎯 storePractitionerServices called', [
            'practitioner_id' => $practitionerId,
            'tenant_id' => $currentTenantId,
            'raw_request' => $request->all(),
        ]);

        // Verify practitioner exists in tenant database
        $practitioner = Practitioner::find($practitionerId);
        if (! $practitioner) {
            Log::error('❌ Practitioner not found', [
                'practitioner_id' => $practitionerId,
                'tenant_id' => $currentTenantId,
            ]);

            return response()->json(['error' => 'Practitioner not found or not linked to this tenant'], 404);
        }

        Log::info('✅ Practitioner found and linked');

        $validated = $request->validate([
            'services' => ['required', 'array'],
            'services.*.id' => ['required', 'integer', 'exists:services,id'],
            'services.*.pivot.is_offered' => ['boolean'],
            'services.*.pivot.custom_price' => ['nullable', 'numeric', 'min:0'],
            'services.*.pivot.custom_duration_minutes' => ['nullable', 'integer', 'min:15', 'max:480'],
        ]);

        Log::info('✅ Validation passed', [
            'validated_services_count' => count($validated['services']),
            'validated_data' => $validated['services'],
        ]);

        // Process each service
        foreach ($validated['services'] as $index => $serviceData) {
            $serviceId = $serviceData['id'];
            $pivotData = $serviceData['pivot'] ?? [];
            $isOffered = $pivotData['is_offered'] ?? false;

            Log::info("🔄 Processing service #{$index}", [
                'service_id' => $serviceId,
                'pivot_data' => $pivotData,
                'is_offered' => $isOffered,
            ]);

            if ($isOffered) {
                Log::info('✅ Service is offered, preparing to save', ['service_id' => $serviceId]);

                // Create or update practitioner-service relationship
                $updateData = [
                    'is_offered' => true,
                    'updated_at' => now(),
                    'created_at' => now(),
                ];

                // Handle custom price - only set if explicitly provided and valid
                if (isset($pivotData['custom_price']) && $pivotData['custom_price'] !== '' && $pivotData['custom_price'] !== null) {
                    $updateData['custom_price'] = $pivotData['custom_price'];
                    Log::info('💰 Custom price set', [
                        'service_id' => $serviceId,
                        'custom_price' => $pivotData['custom_price'],
                    ]);
                } else {
                    $updateData['custom_price'] = null;
                    Log::info('⚠️ Custom price is null/empty', ['service_id' => $serviceId]);
                }

                // Handle custom duration - only set if explicitly provided and valid
                if (isset($pivotData['custom_duration_minutes']) && $pivotData['custom_duration_minutes'] !== '' && $pivotData['custom_duration_minutes'] !== null) {
                    $updateData['custom_duration_minutes'] = $pivotData['custom_duration_minutes'];
                } else {
                    $updateData['custom_duration_minutes'] = null;
                }

                Log::info('💾 Executing updateOrInsert', [
                    'practitioner_id' => $practitionerId,
                    'service_id' => $serviceId,
                    'update_data' => $updateData,
                ]);

                DB::table('practitioner_services')->updateOrInsert(
                    [
                        'practitioner_id' => $practitionerId,
                        'service_id' => $serviceId,
                    ],
                    $updateData
                );

                Log::info('✅ updateOrInsert executed successfully', ['service_id' => $serviceId]);

                // Verify the save
                $saved = DB::table('practitioner_services')
                    ->where('practitioner_id', $practitionerId)
                    ->where('service_id', $serviceId)
                    ->first();

                Log::info('🔍 Verification query result', [
                    'service_id' => $serviceId,
                    'saved_record' => $saved,
                ]);
            } else {
                Log::info('🗑️ Service not offered, removing if exists', ['service_id' => $serviceId]);

                // Remove practitioner-service relationship if not offered
                $deleted = DB::table('practitioner_services')
                    ->where('practitioner_id', $practitionerId)
                    ->where('service_id', $serviceId)
                    ->delete();

                Log::info('Deleted rows', ['service_id' => $serviceId, 'deleted_count' => $deleted]);
            }
        }

        Log::info('🎉 All services processed successfully');

        return response()->json([
            'success' => true,
            'message' => 'Services updated successfully.',
        ]);
    }

    /**
     * Check if practitioner has complete basic info
     */
    private function hasCompleteBasicInfo($practitioner)
    {
        $requiredBasicFields = [
            'first_name', 'last_name', 'email', 'phone_number',
        ];

        foreach ($requiredBasicFields as $field) {
            if (empty($practitioner->{$field})) {
                return false;
            }
        }

        return true;
    }

    /**
     * Check if practitioner has complete professional details
     * Fixed to properly handle Laravel array casts and detect truly empty professional data
     */
    private function hasCompleteProfessionalDetails($practitioner)
    {
        $requiredProfessionalFields = [
            'credentials', 'years_of_experience', 'license_number',
            'primary_specialties', 'therapeutic_modalities',
        ];

        foreach ($requiredProfessionalFields as $field) {
            $value = $practitioner->{$field};

            // Handle array fields (Laravel array cast converts null to empty array [])
            if (is_array($value)) {
                // Empty array means no data has been set
                if (empty($value)) {
                    return false;
                }
                // Check if array contains only empty values
                $filteredArray = array_filter($value, function ($item) {
                    return ! empty($item);
                });
                if (empty($filteredArray)) {
                    return false;
                }
            }
            // Handle string fields
            elseif (is_string($value)) {
                if (empty(trim($value))) {
                    return false;
                }
            }
            // Handle null values
            elseif (is_null($value)) {
                return false;
            }
        }

        return true;
    }

    public function invite(Request $request, $practitionerId)
    {
        $currentTenantId = tenant('id');

        // Get the tenant practitioner
        $practitioner = Practitioner::find($practitionerId);
        if (! $practitioner) {
            return back()->with('error', 'Practitioner not found.');
        }

        // Get the central practitioner ID from tenant practitioner
        $centralPractitionerId = $practitioner->central_practitioner_id;
        if (! $centralPractitionerId) {
            return back()->with('error', 'Practitioner is not properly linked to central database.');
        }

        // Check if practitioner is linked to this tenant using tenancy()->central()
        $existingRelation = null;
        tenancy()->central(function () use (&$existingRelation, $currentTenantId, $centralPractitionerId) {
            $existingRelation = DB::table('tenant_practitioners')
                ->where('tenant_id', $currentTenantId)
                ->where('practitioner_id', $centralPractitionerId)
                ->first();
        });

        if (! $existingRelation) {
            return back()->with('error', 'This practitioner is not linked to your practice. Please add them first.');
        }

        // Check if they have already accepted the invitation
        if ($existingRelation->invitation_status === 'ACCEPTED') {
            return back()->with('error', 'This practitioner has already accepted the invitation and is active in your practice.');
        }

        // Check if there's already a pending invitation for this tenant-practitioner combination
        // If exists, expire it so we can send a fresh one
        // Note: PractitionerInvitation uses central practitioner ID
        $existingInvitation = PractitionerInvitation::where('tenant_id', $currentTenantId)
            ->where('practitioner_id', $centralPractitionerId)
            ->where('status', 'pending')
            ->first();

        if ($existingInvitation) {
            // Expire the existing invitation
            $existingInvitation->update([
                'status' => 'expired',
            ]);
        }

        // Check if Practitioner role exists in tenant database before sending invitation
        $practitionerRole = Role::where('name', 'Practitioner')->first();

        if (! $practitionerRole) {
            return back()->with('error', 'Practitioner role does not exist. Please ask your administrator to create the Practitioner role with proper permissions before sending invitations.');
        }

        // Create invitation
        // Note: PractitionerInvitation uses central practitioner ID
        $invitation = PractitionerInvitation::create([
            'tenant_id' => $currentTenantId,
            'practitioner_id' => $centralPractitionerId,
            'email' => $practitioner->email,
            'token' => PractitionerInvitation::generateToken(),
            'expires_at' => now()->addDays(7),
            'sent_at' => now(),
        ]);

        // Load relationships for email
        $invitation->load(['tenant', 'practitioner']);

        // Send invitation email
        Log::info('Starting practitioner invitation email process', [
            'tenant_practitioner_id' => $practitionerId,
            'central_practitioner_id' => $centralPractitionerId,
            'practitioner_name' => $practitioner->first_name.' '.$practitioner->last_name,
            'practitioner_email' => $practitioner->email,
            'tenant_id' => $currentTenantId,
            'tenant_name' => tenant('company_name'),
            'invitation_id' => $invitation->id,
            'invitation_token' => $invitation->token,
            'expires_at' => $invitation->expires_at,
            'is_existing_user' => ! is_null($practitioner->user_id),
            'is_resent' => ! is_null($existingInvitation),
        ]);

        try {
            Log::info('Creating PractitionerInvitationMail instance', [
                'invitation_id' => $invitation->id,
                'practitioner_email' => $practitioner->email,
            ]);

            $mailInstance = new \App\Mail\Tenant\PractitionerInvitationMail($invitation);

            Log::info('Sending practitioner invitation email', [
                'to' => $practitioner->email,
                'invitation_id' => $invitation->id,
                'mail_class' => get_class($mailInstance),
            ]);

            Mail::to($practitioner->email)->send($mailInstance);

            Log::info('Practitioner invitation email sent successfully', [
                'practitioner_email' => $practitioner->email,
                'invitation_id' => $invitation->id,
                'sent_at' => now()->toISOString(),
            ]);

            // Update tenant_practitioners status to INVITED using tenancy()->central()
            // Note: tenant_practitioners uses central practitioner ID
            Log::info('Updating tenant_practitioners status to INVITED', [
                'tenant_id' => $currentTenantId,
                'central_practitioner_id' => $centralPractitionerId,
            ]);

            tenancy()->central(function () use ($currentTenantId, $centralPractitionerId) {
                DB::table('tenant_practitioners')
                    ->where('tenant_id', $currentTenantId)
                    ->where('practitioner_id', $centralPractitionerId)
                    ->update(['invitation_status' => 'INVITED']);
            });

            Log::info('Tenant practitioner status updated successfully', [
                'tenant_id' => $currentTenantId,
                'central_practitioner_id' => $centralPractitionerId,
                'status' => 'INVITED',
            ]);

            $practitionerName = $practitioner->first_name.' '.$practitioner->last_name;
            $actionWord = $existingInvitation ? 'resent' : 'sent';

            if ($practitioner->user_id) {
                $message = "Invitation {$actionWord} to {$practitionerName} to join your practice.";
            } else {
                $message = "Registration invitation {$actionWord} to {$practitionerName}. They will be able to set up their account and join your practice.";
            }

            if ($existingInvitation) {
                $message .= ' Previous invitation has been expired.';
            }

            Log::info('Practitioner invitation process completed successfully', [
                'practitioner_name' => $practitionerName,
                'action' => $actionWord,
                'message' => $message,
            ]);

            return back()->with('success', $message);
        } catch (\Exception $e) {
            Log::error('Failed to send practitioner invitation email', [
                'practitioner_id' => $practitionerId,
                'practitioner_email' => $practitioner->email,
                'tenant_id' => $currentTenantId,
                'invitation_id' => $invitation->id,
                'error' => $e->getMessage(),
                'error_code' => $e->getCode(),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
                'trace' => $e->getTraceAsString(),
            ]);

            // Delete the invitation if email fails
            Log::info('Deleting invitation due to email failure', [
                'invitation_id' => $invitation->id,
                'reason' => 'email_send_failed',
            ]);

            $invitation->delete();

            return back()->with('error', 'Failed to send invitation email. Please try again.');
        }
    }

    /**
     * Send email-only invitation (new flow - practitioner fills their own details)
     */
    public function inviteByEmail(Request $request)
    {
        $currentTenantId = tenant('id');

        // Validate email
        $validated = $request->validate([
            'email' => ['required', 'email', 'max:255'],
        ]);

        // Check if email already exists in central database (either as practitioner or user)
        $emailExists = false;
        $existingPractitioner = null;
        // tenancy()->central(function () use (&$emailExists, &$existingPractitioner, $validated) {
        //     $existingPractitioner = Practitioner::whereBlind('email', 'email_index', $validated['email'])->first();
        //     $emailExistsInUsers = User::where('email', $validated['email'])->exists();
        //     $emailExists = $existingPractitioner || $emailExistsInUsers;
        // });
        $currentTenantId = tenant('id');
        $email = $validated['email'];

        // Check if practitioner with this email already exists in tenant database
        $emailExists = Practitioner::where('email', $email)->exists();

        if ($emailExists) {
            return redirect()->back()
                ->withInput()
                ->withErrors(['email' => 'This email is already registered in the system. Please use a different email or contact the practitioner to join your practice.']);
        }

        // Check if there's already a pending invitation with this email
        $existingInvitation = PractitionerInvitation::where('tenant_id', $currentTenantId)
            ->where('email', $validated['email'])
            ->where('status', 'pending')
            ->first();

        if ($existingInvitation) {
            // Expire the existing invitation
            $existingInvitation->update([
                'status' => 'expired',
            ]);
        }

        // Check if Practitioner role exists in tenant database before sending invitation
        $practitionerRole = Role::where('name', 'Practitioner')->first();

        if (! $practitionerRole) {
            return back()->with('error', 'Practitioner role does not exist. Please ask your administrator to create the Practitioner role with proper permissions before sending invitations.');
        }

        // Create invitation without practitioner_id (they will register themselves)
        $invitation = PractitionerInvitation::create([
            'tenant_id' => $currentTenantId,
            'practitioner_id' => null, // No practitioner record yet
            'email' => $validated['email'],
            'token' => PractitionerInvitation::generateToken(),
            'status' => 'pending',
            'expires_at' => now()->addDays(7),
            'sent_at' => now(),
        ]);

        // Load tenant relationship for email (but not practitioner since it's null)
        $invitation->load('tenant');

        // Send invitation email
        try {
            Mail::to($validated['email'])->send(new \App\Mail\Tenant\PractitionerInvitationMail($invitation));

            $actionWord = $existingInvitation ? 'resent' : 'sent';
            $message = "Registration invitation {$actionWord} to {$validated['email']}. They will be able to fill in their details and join your practice.";

            if ($existingInvitation) {
                $message .= ' Previous invitation has been expired.';
            }

            return redirect()->route('practitioners.index')->with('success', $message);
        } catch (\Exception $e) {
            // Delete the invitation if email fails
            $invitation->delete();

            Log::error('Failed to send practitioner invitation email', [
                'email' => $validated['email'],
                'error' => $e->getMessage(),
            ]);

            return back()->with('error', 'Failed to send invitation email. Please try again.');
        }
    }

    /**
     * Invite multiple practitioners at once (for onboarding)
     */
    public function inviteMultiple(Request $request)
    {
        $validated = $request->validate([
            'emails' => 'required|array|min:1',
            'emails.*' => 'required|email|max:255',
        ]);

        $currentTenantId = tenant('id');

        if (! $currentTenantId) {
            return back()->with('error', 'Tenant not found');
        }

        // Get practitioner role
        $practitionerRole = Role::where('name', 'Practitioner')->first();

        if (! $practitionerRole) {
            return back()->with('error', 'Practitioner role does not exist. Please ask your administrator to create the Practitioner role with proper permissions before sending invitations.');
        }

        $invitations = [];
        $errors = [];

        foreach ($validated['emails'] as $email) {
            $email = strtolower(trim($email));

            // Check if invitation already exists
            $existingInvitation = PractitionerInvitation::where('tenant_id', $currentTenantId)
                ->where('email', $email)
                ->where('status', 'pending')
                ->first();

            if ($existingInvitation) {
                $errors[] = "Invitation already sent to {$email}";

                continue;
            }

            // Create invitation
            $invitation = PractitionerInvitation::create([
                'tenant_id' => $currentTenantId,
                'practitioner_id' => null,
                'email' => $email,
                'token' => PractitionerInvitation::generateToken(),
                'status' => 'pending',
                'expires_at' => now()->addDays(7),
                'sent_at' => now(),
            ]);

            $invitations[] = $invitation;

            // Send invitation email
            try {
                $invitation->load('tenant');
                Mail::to($email)->send(new \App\Mail\Tenant\PractitionerInvitationMail($invitation));
            } catch (\Exception $e) {
                Log::error('Failed to send practitioner invitation email', [
                    'email' => $email,
                    'error' => $e->getMessage(),
                ]);
                $invitation->delete();
                $errors[] = "Failed to send invitation to {$email}";
            }
        }

        if (count($invitations) === 0) {
            return back()->withErrors(['emails' => count($errors) > 0 ? $errors : ['Failed to send any invitations']]);
        }

        $successMessage = count($invitations).' invitation(s) sent successfully.';
        if (count($errors) > 0) {
            $successMessage .= ' Some errors: '.implode(', ', $errors);
        }

        return redirect()->route('practitioners.index')->with('success', $successMessage);
    }

    /**
     * Show the invite practitioner form
     */
    public function showInviteForm()
    {
        return Inertia::render('Practitioner/InvitePractitioner');
    }

    /**
     * Get all practitioner invitations for current tenant
     */
    public function invitations(Request $request)
    {
        $currentTenantId = tenant('id');

        $query = PractitionerInvitation::where('tenant_id', $currentTenantId)
            ->with(['practitioner', 'tenant']);

        // Apply search filter if provided
        if ($request->has('search') && ! empty($request->search)) {
            $search = $request->search;

            // Get practitioner IDs from central database that match search criteria
            $matchingPractitionerIds = tenancy()->central(function () use ($search) {
                return Practitioner::whereBlind('first_name', 'first_name_index', $search)
                    ->orWhereBlind('last_name', 'last_name_index', $search)
                    ->orWhereBlind('email', 'email_index', $search)
                    ->orWhereBlind('license_number', 'license_number_index', $search)
                    ->pluck('id')
                    ->toArray();
            });

            // Search both practitioner-based invitations and email-only invitations
            $query->where(function ($subQuery) use ($matchingPractitionerIds, $search) {
                // Search by practitioner IDs
                if (! empty($matchingPractitionerIds)) {
                    $subQuery->whereIn('practitioner_id', $matchingPractitionerIds);
                }
                // Also search email-only invitations by email
                $subQuery->orWhere('email', 'like', "%{$search}%");
            });
        }

        // Apply status filter if provided
        if ($request->has('status') && ! empty($request->status)) {
            $query->where('status', $request->status);
        }

        $perPage = $request->get('perPage', 10);
        $invitations = $query->orderBy('created_at', 'desc')->paginate($perPage);

        // Transform the data to include practitioner name and additional info
        $invitations->getCollection()->transform(function ($invitation) {
            // Handle both practitioner-based and email-only invitations
            // Try to get from central first (invitation relationship), then fallback to tenant
            try {
                if ($invitation->practitioner) {
                    $invitation->practitioner_name = $invitation->practitioner->first_name.' '.$invitation->practitioner->last_name;
                    $invitation->practitioner_title = $invitation->practitioner->title;
                } elseif ($invitation->practitioner_id) {
                    // Fallback: look up in tenant database
                    $tenantPractitioner = Practitioner::find($invitation->practitioner_id);
                    if ($tenantPractitioner) {
                        $invitation->practitioner_name = $tenantPractitioner->first_name.' '.$tenantPractitioner->last_name;
                        $invitation->practitioner_title = $tenantPractitioner->title;
                    } else {
                        $invitation->practitioner_name = null;
                        $invitation->practitioner_title = null;
                    }
                } else {
                    $invitation->practitioner_name = null;
                    $invitation->practitioner_title = null;
                }
            } catch (\Exception $e) {
                // If error accessing practitioner, set defaults
                $invitation->practitioner_name = null;
                $invitation->practitioner_title = null;
            }

            // Always use email from invitation (not practitioner) for consistency
            $invitation->practitioner_email = $invitation->email;
            $invitation->is_expired = $invitation->isExpired();
            $invitation->expires_in_days = now()->diffInDays($invitation->expires_at, false);

            return $invitation;
        });

        return Inertia::render('Practitioner/InvitationsStandalone', [
            'invitations' => $invitations,
            'filters' => [
                'search' => $request->search,
                'status' => $request->status,
                'perPage' => $request->get('perPage', 10),
            ],
        ]);
    }

    /**
     * Resend practitioner invitation by expiring old one and creating new
     */
    public function resendInvitation($invitationId)
    {
        $currentTenantId = tenant('id');

        $oldInvitation = PractitionerInvitation::where('id', $invitationId)
            ->where('tenant_id', $currentTenantId)
            ->with(['practitioner', 'tenant'])
            ->first();

        if (! $oldInvitation) {
            return back()->with('error', 'Invitation not found.');
        }

        if ($oldInvitation->status === 'accepted') {
            return back()->with('error', 'Cannot resend an already accepted invitation.');
        }

        try {
            DB::beginTransaction();

            // Step 1: Expire the old invitation
            $oldInvitation->update([
                'status' => 'expired',
            ]);

            // Step 2: Create a new invitation
            $newInvitation = PractitionerInvitation::create([
                'tenant_id' => $currentTenantId,
                'practitioner_id' => $oldInvitation->practitioner_id,
                'email' => $oldInvitation->email, // Use email directly, not from practitioner
                'token' => Str::random(64),
                'status' => 'pending',
                'expires_at' => now()->addDays(7),
                'sent_at' => now(),
            ]);

            // Load relationships for email
            $newInvitation->load(['tenant']);
            if ($newInvitation->practitioner_id) {
                $newInvitation->load('practitioner');
            }

            // Step 3: Send the new invitation email
            Mail::to($newInvitation->email)->send(new \App\Mail\Tenant\PractitionerInvitationMail($newInvitation));

            DB::commit();

            // Build success message based on whether practitioner exists
            if ($oldInvitation->practitioner) {
                $practitionerName = $oldInvitation->practitioner->first_name.' '.$oldInvitation->practitioner->last_name;
                $message = "New invitation has been sent to {$practitionerName} ({$oldInvitation->email}). Previous invitation has been expired.";
            } else {
                $message = "New registration invitation has been sent to {$oldInvitation->email}. Previous invitation has been expired.";
            }

            return back()->with('success', $message);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Failed to resend practitioner invitation', [
                'invitation_id' => $invitationId,
                'error' => $e->getMessage(),
            ]);

            return back()->with('error', 'Failed to resend invitation. Please try again.');
        }
    }

    /**
     * Send administrative access consent email to practitioner
     */
    private function sendConsentEmail(Practitioner $practitioner, string $tenantId)
    {
        try {
            // Get tenant information
            $tenant = \App\Models\Tenant::find($tenantId);

            if (! $tenant) {
                Log::error('Tenant not found for consent email', [
                    'tenant_id' => $tenantId,
                    'practitioner_id' => $practitioner->id,
                ]);

                return;
            }

            // Generate consent token
            $consentToken = \App\Http\Controllers\ConsentController::generateConsentToken(
                $practitioner->id,
                $tenant->id
            );

            // Generate consent URL
            $consentUrl = route('consent.administrative-access.show', $consentToken);

            Log::info('Sending administrative consent email', [
                'practitioner_id' => $practitioner->id,
                'practitioner_email' => $practitioner->email,
                'tenant_id' => $tenant->id,
                'tenant_name' => $tenant->company_name,
                'consent_url' => $consentUrl,
            ]);

            // Send email
            Mail::to($practitioner->email)->send(
                new \App\Mail\Tenant\PractitionerAdministrativeConsentMail(
                    $practitioner,
                    $tenant,
                    $consentUrl
                )
            );

            Log::info('Administrative consent email sent successfully', [
                'practitioner_id' => $practitioner->id,
                'practitioner_email' => $practitioner->email,
            ]);

        } catch (\Exception $e) {
            Log::error('Failed to send administrative consent email', [
                'practitioner_id' => $practitioner->id,
                'practitioner_email' => $practitioner->email,
                'tenant_id' => $tenantId,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
        }
    }

    /**
     * Send staff permissions consent email to practitioner
     */
    private function sendStaffPermissionsConsentEmail(Practitioner $practitioner, string $tenantId)
    {
        try {
            // Get tenant information
            $tenant = \App\Models\Tenant::find($tenantId);

            if (! $tenant) {
                Log::error('Tenant not found for staff permissions consent email', [
                    'tenant_id' => $tenantId,
                    'practitioner_id' => $practitioner->id,
                ]);

                return;
            }

            // Generate consent token
            $consentToken = \App\Http\Controllers\ConsentController::generateConsentToken(
                $practitioner->id,
                $tenant->id
            );

            // Generate consent URL
            $consentUrl = route('consent.staff-permissions.show', $consentToken);

            Log::info('Sending staff permissions consent email', [
                'practitioner_id' => $practitioner->id,
                'practitioner_email' => $practitioner->email,
                'tenant_id' => $tenant->id,
                'tenant_name' => $tenant->company_name,
                'consent_url' => $consentUrl,
            ]);

            // Send email
            Mail::to($practitioner->email)->send(
                new \App\Mail\Tenant\PractitionerStaffPermissionsConsentMail(
                    $practitioner,
                    $tenant,
                    $consentUrl
                )
            );

            Log::info('Staff permissions consent email sent successfully', [
                'practitioner_id' => $practitioner->id,
                'practitioner_email' => $practitioner->email,
            ]);

        } catch (\Exception $e) {
            Log::error('Failed to send staff permissions consent email', [
                'practitioner_id' => $practitioner->id,
                'practitioner_email' => $practitioner->email,
                'tenant_id' => $tenantId,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
        }
    }
}
