<?php

use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;

if (! function_exists('centralUrl')) {
    function centralUrl($path = null)
    {
        $protocol = app()->environment('production') ? 'https' : 'http';
        $centralDomain = config('tenancy.central_domains')[0] ?? 'localhost';
        $centralUrl = "{$protocol}://{$centralDomain}".($protocol === 'http' ? ':8000' : '');

        if ($path) {
            return $centralUrl.'/'.ltrim($path, '/');
        }

        return $centralUrl;
    }
}

if (! function_exists('userTenants')) {
    function userTenants($user): array
    {
        $protocol = app()->environment('production') ? 'https' : 'http';

        if (! $user) {
            return [];
        }

        // Get user email (works whether $user is a model instance or has email property)
        $userEmail = is_object($user) && isset($user->email) ? $user->email : null;

        if (! $userEmail) {
            return [];
        }

        // Find the central user by email to get the central user ID
        $centralUser = tenancy()->central(function () use ($userEmail) {
            return \App\Models\User::where('email', $userEmail)->first();
        });

        if (! $centralUser) {
            return [];
        }

        $centralUserId = $centralUser->id;

        // Query tenant_user pivot table directly to get all tenants for this central user
        $tenantIds = tenancy()->central(function () use ($centralUserId) {
            return \Illuminate\Support\Facades\DB::table('tenant_user')
                ->where('user_id', $centralUserId)
                ->pluck('tenant_id')
                ->toArray();
        });

        // Get practitioner tenants from tenant_practitioners table
        $practitionerTenantIds = [];
        $centralPractitioner = tenancy()->central(function () use ($centralUserId) {
            return \App\Models\Practitioner::where('user_id', $centralUserId)->first();
        });

        if ($centralPractitioner) {
            $practitionerTenantIds = tenancy()->central(function () use ($centralPractitioner) {
                return \Illuminate\Support\Facades\DB::table('tenant_practitioners')
                    ->where('practitioner_id', $centralPractitioner->id)
                    ->pluck('tenant_id')
                    ->toArray();
            });
        }

        // Get patient tenants from tenant_patients table
        $patientTenantIds = [];
        $centralPatient = tenancy()->central(function () use ($centralUserId) {
            return \App\Models\Patient::where('user_id', $centralUserId)->first();
        });

        if ($centralPatient) {
            $patientTenantIds = tenancy()->central(function () use ($centralPatient) {
                return \Illuminate\Support\Facades\DB::table('tenant_patients')
                    ->where('patient_id', $centralPatient->id)
                    ->pluck('tenant_id')
                    ->toArray();
            });
        }

        // Merge all tenant IDs and remove duplicates
        $allTenantIds = array_unique(array_merge($tenantIds, $practitionerTenantIds, $patientTenantIds));

        if (empty($allTenantIds)) {
            return [];
        }

        // Load tenant details with domains
        return tenancy()->central(function () use ($allTenantIds, $protocol) {
            $tenants = \App\Models\Tenant::whereIn('id', $allTenantIds)
                ->with('domains')
                ->get();

            return $tenants->map(function ($tenant) use ($protocol) {
                return [
                    'id' => $tenant->id,
                    'name' => $tenant->company_name,
                    'domain' => $protocol.'://'.$tenant->domains->first()->domain.
                        ($protocol === 'http' ? ':8000' : ''),
                    'requires_billing_setup' => $tenant->requires_billing_setup ?? false,
                    'billing_status' => $tenant->billing_status ?? 'pending',
                ];
            })->toArray();
        });
    }
}

if (! function_exists('userHasTenants')) {
    function userHasTenants($user = null): bool
    {
        $user = $user ?? Auth::user();

        if (! $user) {
            return false;
        }

        return method_exists($user, 'tenants') && $user->tenants()->exists();
    }
}

if (! function_exists('isCentralDomain')) {
    /**
     * Check if the current request is on a central domain
     */
    function isCentralDomain(): bool
    {
        $host = request()->getHost();

        return in_array($host, config('tenancy.central_domains', []));
    }
}

if (! function_exists('getTenantMetaInformation')) {
    /**
     * Get meta information for the current tenant
     */
    function getTenantMetaInformation(?string $pageTitle = null): array
    {
        $tenant = tenant();
        $companyName = $tenant ? $tenant->company_name : config('app.name');

        // Get organization settings if in tenant context
        $practiceDetails = [];
        $appearance = [];

        if ($tenant) {
            try {
                $practiceDetails = \App\Models\OrganizationSetting::getByPrefix('practice_details_');
                $appearance = \App\Models\OrganizationSetting::getByPrefix('appearance_');
            } catch (\Exception $e) {
                // Silently handle if organization_settings table doesn't exist yet
            }
        }

        // Build title
        $title = $pageTitle ? "{$pageTitle} - {$companyName}" : $companyName;

        // Build description
        $description = 'Your trusted healthcare partner providing comprehensive medical services with a focus on quality care and patient satisfaction.';

        if (! empty($practiceDetails['practice_details_industry_type'])) {
            $industryType = $practiceDetails['practice_details_industry_type'];
            $description = "Professional {$industryType} services at {$companyName}. ".$description;
        }

        if (! empty($practiceDetails['practice_details_name']) && $practiceDetails['practice_details_name'] !== $companyName) {
            $description = $practiceDetails['practice_details_name'].' - '.$description;
        }

        // Get contact info
        $contactEmail = $practiceDetails['practice_details_contact_email'] ?? null;
        $phoneNumber = $practiceDetails['practice_details_phone_number'] ?? null;
        $websiteUrl = $practiceDetails['practice_details_website_url'] ?? null;

        // Get logo/favicon
        $logoUrl = null;
        $faviconUrl = '/favicon.ico'; // Default favicon

        if (! empty($appearance['appearance_logo_path'])) {
            $logoUrl = $appearance['appearance_logo_path'];
            $faviconUrl = $appearance['appearance_logo_path']; // Use logo as favicon if available
        }

        return [
            'title' => $title,
            'description' => $description,
            'company_name' => $companyName,
            'logo_url' => $logoUrl,
            'favicon_url' => $faviconUrl,
            'contact_email' => $contactEmail,
            'phone_number' => $phoneNumber,
            'website_url' => $websiteUrl,
            'theme_color' => $appearance['appearance_theme_color'] ?? '#3b82f6',
        ];
    }
}

if (! function_exists('determineUserRole')) {
    /**
     * Determine user role based on central database records.
     * Checks if the authenticated user is a practitioner, patient, or admin.
     */
    function determineUserRole(): string
    {
        $user = Auth::user();

        // Get the authenticated user's email
        $email = $user?->email;

        if (! $email) {
            return 'admin';
        }

        // Find the central user's ID by email on the central tenancy
        $centralUserId = tenancy()->central(function () use ($email) {
            $centralUser = \App\Models\User::where('email', $email)->select('id')->first();

            return $centralUser?->id;
        });

        if (! $centralUserId) {
            return 'admin';
        }

        // Check Practitioner role using the central user ID
        $isPractitioner = tenancy()->central(function () use ($centralUserId) {
            return \App\Models\Practitioner::where('user_id', $centralUserId)->exists();
        });

        if ($isPractitioner) {
            return 'practitioner';
        }

        // Check Patient role using the central user ID
        $isPatient = tenancy()->central(function () use ($centralUserId) {
            return \App\Models\Patient::where('user_id', $centralUserId)->exists();
        });

        if ($isPatient) {
            return 'patient';
        }

        // Default to admin if not matched
        return 'admin';
    }
}

if (! function_exists('generateUniqueSlug')) {
    /**
     * Generate a unique slug for a given Eloquent model.
     *
     * @param  string  $baseString  The base string to convert into a slug.
     * @param  string  $modelClass  The fully-qualified model class (e.g. App\Models\Practitioner::class).
     * @param  string  $slugColumn  The column name for the slug (default: 'slug').
     * @param  string|null  $fallback  Optional fallback string if baseString is empty (e.g. email or random).
     */
    function generateUniqueSlug(string $baseString, string $modelClass, string $slugColumn = 'slug', ?string $fallback = null): string
    {
        // Build the base slug
        $base = Str::slug(trim($baseString));

        if ($base === '') {
            $base = $fallback
                ? Str::slug(strstr($fallback, '@', true) ?: $fallback)
                : Str::slug(Str::random(6));
        }

        // Fetch existing similar slugs from the model
        $existing = $modelClass::where($slugColumn, 'LIKE', $base.'%')
            ->pluck($slugColumn)
            ->toArray();

        $slug = $base;

        // If slug already exists, find max number and increment
        if (in_array($slug, $existing, true)) {
            $max = 1;
            foreach ($existing as $s) {
                if (preg_match('/^'.preg_quote($base, '/').'-(\d+)$/', $s, $m)) {
                    $max = max($max, (int) $m[1]);
                }
            }
            $slug = $base.'-'.($max + 1);
        }

        return $slug;
    }
}

if (! function_exists('userHasPractitionerRecord')) {
    /**
     * Check if user has practitioner record in central OR any tenant
     *
     * @param  \App\Models\User|null  $user
     */
    function userHasPractitionerRecord($user): bool
    {
        if (! $user) {
            return false;
        }

        return tenancy()->central(function () use ($user) {
            // Check central practitioner table
            $centralPractitioner = \App\Models\Practitioner::where('user_id', $user->id)->first();
            if ($centralPractitioner) {
                // Check if this practitioner is assigned to any tenant via tenant_practitioners table
                $hasTenantAssignment = \Illuminate\Support\Facades\DB::table('tenant_practitioners')
                    ->where('practitioner_id', $centralPractitioner->id)
                    ->exists();

                if ($hasTenantAssignment) {
                    return true;
                }

                // Even without tenant assignment, if central record exists, user is a practitioner
                return true;
            }

            return false;
        });
    }
}

if (! function_exists('userHasPatientRecord')) {
    /**
     * Check if user has patient record in central OR any tenant
     *
     * @param  \App\Models\User|null  $user
     */
    function userHasPatientRecord($user): bool
    {
        if (! $user) {
            return false;
        }

        return tenancy()->central(function () use ($user) {
            // Check central patient table
            $centralPatient = \App\Models\Patient::where('user_id', $user->id)->first();
            if ($centralPatient) {
                // Check if this patient is assigned to any tenant via tenant_patients table
                $hasTenantAssignment = \Illuminate\Support\Facades\DB::table('tenant_patients')
                    ->where('patient_id', $centralPatient->id)
                    ->exists();

                if ($hasTenantAssignment) {
                    return true;
                }

                // Even without tenant assignment, if central record exists, user is a patient
                return true;
            }

            return false;
        });
    }
}
