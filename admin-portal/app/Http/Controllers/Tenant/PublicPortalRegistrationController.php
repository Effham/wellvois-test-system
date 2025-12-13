<?php

namespace App\Http\Controllers\Tenant;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Inertia\Inertia;

class PublicPortalRegistrationController extends Controller
{
    public function __construct()
    {
        $this->middleware('permission:view-intake-queue')->only(['index']);
        $this->middleware('permission:add-intake-queue')->only(['create', 'store']);
        $this->middleware('permission:update-intake-queue')->only(['edit', 'update']);
        $this->middleware('permission:delete-intake-queue')->only('destroy');
    }

    public function index(Request $request)
    {
        $perPage = $request->get('perPage', 10);
        $search = $request->get('search');

        // Query patients with 'Requested' status from tenant database
        $query = \App\Models\Tenant\Patient::where('registration_status', 'Requested')
            ->with('appointments') // Load appointments to show if they have any
            ->orderBy('requested_at', 'desc');

        // Apply search filter using blind indexes (encrypted fields)
        if ($search) {
            $query->where(function ($q) use ($search) {
                $q->whereBlind('first_name', 'first_name_index', $search)
                    ->orWhereBlind('last_name', 'last_name_index', $search)
                    ->orWhereBlind('preferred_name', 'preferred_name_index', $search)
                    ->orWhereBlind('email', 'email_index', $search)
                    ->orWhereBlind('health_number', 'health_number_index', $search);
            });
        }

        $patients = $query->paginate($perPage)->withQueryString();

        // Transform the collection to add additional data
        $patients->getCollection()->transform(function ($patient) {
            // Load user data from tenant database
            $patient->user = \App\Models\User::find($patient->user_id);

            // Check if patient has appointments
            $patient->has_appointment = $patient->appointments->isNotEmpty();
            $patient->appointment_count = $patient->appointments->count();

            // Get first appointment if exists
            if ($patient->has_appointment) {
                $patient->first_appointment = $patient->appointments->first();
            }

            return $patient;
        });

        return Inertia::render('PublicPortalRegistrations/Index', [
            'registrations' => $patients,
            'filters' => [
                'search' => $search,
                'perPage' => $perPage,
            ],
        ]);
    }
}
