<?php

namespace App\Http\Controllers\Tenant;

use App\Http\Controllers\Controller;
use App\Models\Location;
use App\Models\OrganizationSetting;
use App\Models\Service;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Inertia\Inertia;

class ServiceController extends Controller
{
    public function __construct()
    {
        $this->middleware('permission:view-services')->only(['index', 'show', 'archived']);
        $this->middleware('permission:add-services')->only(['create', 'store']);
        $this->middleware('permission:update-services')->only(['edit', 'update', 'restore']);
        $this->middleware('permission:delete-services')->only(['destroy', 'forceDelete']);
    }

    public function index(Request $request)
    {
        $query = Service::select('id', 'name', 'category', 'default_price', 'is_active'); // This will automatically exclude soft deleted records

        // Apply search filter if provided
        if ($request->has('search') && ! empty($request->search)) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', '%'.$search.'%')
                    ->orWhere('category', 'like', '%'.$search.'%')
                    ->orWhere('description', 'like', '%'.$search.'%');
            });
        }

        $perPage = $request->get('perPage', 10);
        $services = $query->orderBy('name')->paginate($perPage);

        return Inertia::render('Services/Index', [
            'services' => $services,
            'filters' => [
                'search' => $request->search,
                'perPage' => $perPage,
            ],
        ]);
    }

    public function create()
    {
        return Inertia::render('Services/Create', [
            'categories' => $this->getServiceCategories(),
            'deliveryModes' => $this->getDeliveryModes(),
            'durations' => $this->getDurationOptions(),
        ]);
    }

    /**
     * Show onboarding service create page
     */
    public function onboardingCreate()
    {
        $appointmentType = OrganizationSetting::getValue('appointment_type', null);

        // Fetch existing services for this tenant
        $existingServices = Service::select([
            'id',
            'name',
            'category',
            'description',
            'delivery_modes',
            'default_price',
            'currency',
            'is_active',
        ])->get();

        return Inertia::render('onboarding-service-create', [
            'categories' => array_values($this->getServiceCategories()),
            'appointmentType' => $appointmentType,
            'existingServices' => $existingServices,
        ]);
    }

    public function store(Request $request)
    {
        Log::info('ServiceController::store - Request received', [
            'all_data' => $request->all(),
            'method' => $request->method(),
            'url' => $request->url(),
        ]);

        try {
            $data = $request->validate([
                'name' => ['required', 'string', 'max:255'],
                'category' => ['required', 'string', 'in:Individual,Couple,Group,Assessment,Family,Specialty,Follow-Up'],
                'description' => ['nullable', 'string'],
                'delivery_modes' => ['required', 'array', 'min:1'],
                'delivery_modes.*' => ['string', 'in:in-person,virtual'],

                'default_price' => ['required', 'numeric', 'min:0'],
                'currency' => ['nullable', 'string', 'max:3', 'in:CAD,USD'],
                'is_active' => ['boolean'],
            ]);

            Log::info('ServiceController::store - Validation passed', [
                'validated_data' => $data,
            ]);

            $data['currency'] = $data['currency'] ?? 'CAD';
            $data['is_active'] = $data['is_active'] ?? true;

            $service = Service::create($data);

            Log::info('ServiceController::store - Service created successfully', [
                'service_id' => $service->id,
                'service_name' => $service->name,
            ]);

            $this->sendServiceNotification($service, 'created');

            // Check if onboarding is complete (check if all required steps are done)
            $appointmentType = OrganizationSetting::getValue('appointment_type', null);
            $locationCount = Location::where('name', '!=', 'Virtual')->count();
            $serviceCount = Service::count();

            // Determine required steps based on questionnaire answers
            $requiredSteps = [];
            if ($appointmentType !== 'virtual') {
                $requiredSteps[] = 'location';
            }
            $requiredSteps[] = 'service';

            // Check if all required steps are completed
            $isComplete = true;
            foreach ($requiredSteps as $step) {
                switch ($step) {
                    case 'location':
                        if ($locationCount === 0) {
                            $isComplete = false;
                        }
                        break;
                    case 'service':
                        if ($serviceCount === 0) {
                            $isComplete = false;
                        }
                        break;
                }
            }

            // If all required steps are complete, check practitioner step
            if ($isComplete) {
                // Redirect to onboarding index to determine next step (practitioner or complete)
                return redirect()->route('onboarding.index')
                    ->with('success', 'Service created successfully!');
            }

            return redirect()->route('settings.services')
                ->with('success', 'Service created successfully.');
        } catch (\Illuminate\Validation\ValidationException $e) {
            Log::error('ServiceController::store - Validation failed', [
                'errors' => $e->errors(),
                'input' => $request->all(),
            ]);
            throw $e;
        } catch (\Exception $e) {
            Log::error('ServiceController::store - Exception caught', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return redirect()->back()
                ->withErrors(['error' => $e->getMessage()])
                ->withInput();
        }
    }

    public function edit(Service $service)
    {
        return Inertia::render('Services/Create', [
            'service' => $service,
            'categories' => $this->getServiceCategories(),
            'deliveryModes' => $this->getDeliveryModes(),
            'durations' => $this->getDurationOptions(),
        ]);
    }

    public function update(Request $request, Service $service)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'category' => ['required', 'string', 'in:Individual,Couple,Group,Assessment,Family,Specialty,Follow-Up'],
            'description' => ['nullable', 'string'],
            'delivery_modes' => ['required', 'array', 'min:1'],
            'delivery_modes.*' => ['string', 'in:in-person,virtual'],

            'default_price' => ['required', 'numeric', 'min:0'],
            'currency' => ['nullable', 'string', 'max:3', 'in:CAD,USD'],
            'is_active' => ['boolean'],
        ]);

        $data['currency'] = $data['currency'] ?? 'CAD';
        $data['is_active'] = $data['is_active'] ?? true;

        // Capture old values for diff
        $before = $service->only([
            'name',
            'category',
            'description',
            'delivery_modes',
            'default_price',
            'currency',
            'is_active',
        ]);

        $service->update($data);

        // Build changes array
        $changes = [];
        foreach ($data as $key => $newValue) {
            $oldValue = $before[$key] ?? null;

            // Handle array comparison for delivery_modes
            if ($key === 'delivery_modes') {
                sort($oldValue);
                sort($newValue);
                if ($oldValue != $newValue) {
                    $changes[$key] = ['old' => $oldValue, 'new' => $newValue];
                }
            } else {
                // Handle other fields
                if ($oldValue != $newValue) {
                    $changes[$key] = ['old' => $oldValue, 'new' => $newValue];
                }
            }
        }

        // Send notification email only if there are changes
        if (! empty($changes)) {
            $this->sendServiceNotification($service, 'updated', $changes);
        }

        // Check if onboarding is complete (check if all required steps are done)
        $appointmentType = OrganizationSetting::getValue('appointment_type', null);
        $locationCount = Location::where('name', '!=', 'Virtual')->count();
        $serviceCount = Service::count();

        // Determine required steps based on questionnaire answers
        $requiredSteps = [];
        if ($appointmentType !== 'virtual') {
            $requiredSteps[] = 'location';
        }
        $requiredSteps[] = 'service';

        // Check if all required steps are completed
        $isComplete = true;
        foreach ($requiredSteps as $step) {
            switch ($step) {
                case 'location':
                    if ($locationCount === 0) {
                        $isComplete = false;
                    }
                    break;
                case 'service':
                    if ($serviceCount === 0) {
                        $isComplete = false;
                    }
                    break;
            }
        }

        // If all required steps are complete, check practitioner step
        if ($isComplete) {
            // Redirect to onboarding index to determine next step (practitioner or complete)
            return redirect()->route('onboarding.index')
                ->with('success', 'Service updated successfully!');
        }

        return redirect()->route('settings.services')
            ->with('success', 'Service updated successfully.');
    }

    protected function sendServiceNotification(Service $service, string $action, array $changes = []): void
    {
        try {
            // Get organization name
            $orgName = \App\Models\OrganizationSetting::getValue('practice_details_name') ?? 'Organization';
            $organization = ['name' => $orgName];

            // Get admin recipients
            $recipients = \App\Models\User::role('Admin')
                ->whereNotNull('email')
                ->pluck('email')
                ->filter()
                ->unique()
                ->values()
                ->all();

            // Fallback to env admin email if no admins found
            if (empty($recipients) && env('ADMIN_EMAIL')) {
                $recipients = [env('ADMIN_EMAIL')];
            }

            if (empty($recipients)) {
                \Log::warning('Service notification: no admin recipients found', [
                    'service_id' => $service->id,
                    'action' => $action,
                ]);

                return;
            }

            // Optional: Generate service URL
            $serviceUrl = null;
            if (function_exists('route')) {
                try {
                    $serviceUrl = route('settings.services');
                } catch (\Throwable $e) {
                    // Route may not exist; ignore
                }
            }

            // Send the email
            Mail::to($recipients)->send(new \App\Mail\ServiceUpdatedMail(
                organization: $organization,
                service: $service,
                action: $action,
                updatedBy: auth()->user(),
                changes: $changes,
                serviceUrl: $serviceUrl,
                changedAt: now(),
            ));

            \Log::info('Service notification sent successfully', [
                'service_id' => $service->id,
                'service_name' => $service->name,
                'action' => $action,
                'recipients_count' => count($recipients),
            ]);

        } catch (\Throwable $e) {
            \Log::error('Failed to send service notification', [
                'service_id' => $service->id,
                'action' => $action,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
        }
    }

    public function destroy(Service $service)
    {
        $service->delete(); // This will now be a soft delete

        return redirect()->route('settings.services')
            ->with('success', 'Service archived successfully.');
    }

    /**
     * Display archived services
     */
    public function archived(Request $request)
    {
        $query = Service::onlyTrashed();

        // Apply search filter if provided
        if ($request->has('search') && ! empty($request->search)) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', '%'.$search.'%')
                    ->orWhere('category', 'like', '%'.$search.'%')
                    ->orWhere('description', 'like', '%'.$search.'%');
            });
        }

        $perPage = $request->get('perPage', 10);
        $services = $query->orderBy('deleted_at', 'desc')->paginate($perPage);

        return Inertia::render('Services/Archived', [
            'services' => $services,
            'filters' => [
                'search' => $request->search,
                'perPage' => $perPage,
            ],
        ]);
    }

    /**
     * Restore an archived service
     */
    public function restore($id)
    {
        $service = Service::onlyTrashed()->findOrFail($id);
        $service->restore();

        return redirect()->route('services.archived')
            ->with('success', 'Service restored successfully.');
    }

    /**
     * Permanently delete a service
     */
    public function forceDelete($id)
    {
        $service = Service::onlyTrashed()->findOrFail($id);
        $service->forceDelete();

        return redirect()->route('services.archived')
            ->with('success', 'Service permanently deleted.');
    }

    /**
     * Get available service categories
     */
    private function getServiceCategories(): array
    {
        return [
            'Individual' => 'Individual',
            'Couple' => 'Couple',
            'Group' => 'Group',
            'Assessment' => 'Assessment',
            'Family' => 'Family',
            'Specialty' => 'Specialty',
            'Follow-Up' => 'Follow-Up',
        ];
    }

    /**
     * Get available delivery modes
     */
    private function getDeliveryModes(): array
    {
        return [
            'in-person' => 'In-Person',
            'virtual' => 'Virtual',
        ];
    }

    /**
     * Get duration options in minutes
     */
    private function getDurationOptions(): array
    {
        return [
            15 => '15 minutes',
            30 => '30 minutes',
            45 => '45 minutes',
            60 => '60 minutes',
            75 => '75 minutes',
            90 => '90 minutes',
            120 => '2 hours',
            150 => '2.5 hours',
            180 => '3 hours',
        ];
    }

    /**
     * Complete onboarding for the tenant
     */
    private function completeOnboarding(): void
    {
        // Set isOnboardingComplete in OrganizationSettings
        OrganizationSetting::setValue('isOnboardingComplete', 'true');

        Log::info('[ONBOARDING] Completing onboarding from ServiceController:', [
            'tenant_id' => tenant('id'),
        ]);
    }
}
