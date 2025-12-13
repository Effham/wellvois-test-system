<?php

namespace App\Http\Controllers\Tenant;

use App\Http\Controllers\Controller;
use App\Models\AppointmentWaitlist;
use Illuminate\Http\Request;
use Inertia\Inertia;

class WaitingListController extends Controller
{
    public function __construct()
    {
        $this->middleware('permission:view-waitlist')->only(['index']);
        $this->middleware('permission:add-waitlist')->only(['create', 'store']);
        $this->middleware('permission:update-waitlist')->only(['edit', 'update']);
        $this->middleware('permission:delete-waitlist')->only('destroy');
    }

    /**
     * Display the waiting list
     */
    public function index(Request $request)
    {
        $query = AppointmentWaitlist::select('id', 'patient_id', 'preferred_day', 'preferred_time', 'status', 'notes', 'created_at')
            ->with(['patient:id,first_name,last_name,email,phone_number'])
            ->where('status', 'waiting')
            ->latest();

        // Apply filters
        if ($request->filled('search')) {
            $search = $request->search;
            $query->whereHas('patient', function ($q) use ($search) {
                $q->where('first_name', 'like', "%{$search}%")
                    ->orWhere('last_name', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%");
            });
        }

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        if ($request->filled('preferred_day')) {
            $query->where('preferred_day', $request->preferred_day);
        }

        if ($request->filled('preferred_time')) {
            $query->where('preferred_time', $request->preferred_time);
        }

        $perPage = $request->get('perPage', 10);
        $waitlistEntries = $query->paginate($perPage);

        // Transform the data to match the expected frontend format
        $transformedData = $waitlistEntries->through(function ($entry) {
            return [
                'id' => $entry->id,
                'patient_name' => $entry->patient->first_name.' '.$entry->patient->last_name,
                'email' => $entry->patient->email,
                'phone_number' => $entry->patient->phone_number,
                'preferred_day' => $entry->preferred_day,
                'preferred_time' => $entry->preferred_time,
                'status' => $entry->status,
                'created_at' => $entry->created_at->toISOString(),
                'notes' => $entry->notes,
            ];
        });

        $filters = [
            'search' => $request->get('search', ''),
            'status' => $request->get('status', ''),
            'preferred_day' => $request->get('preferred_day', ''),
            'preferred_time' => $request->get('preferred_time', ''),
            'perPage' => $perPage,
        ];

        return Inertia::render('WaitingList/Index', [
            'items' => $transformedData,
            'filters' => $filters,
        ]);
    }
}
