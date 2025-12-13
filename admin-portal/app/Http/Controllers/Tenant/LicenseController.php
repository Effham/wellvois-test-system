<?php

namespace App\Http\Controllers\Tenant;

use App\Http\Controllers\Controller;
use App\Models\Tenant\License;
use App\Models\Practitioner;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class LicenseController extends Controller
{
    /**
     * Display a listing of licenses
     */
    public function index(Request $request): Response
    {
        $filters = $request->only(['status', 'search']);
        
        $licenses = License::query()
            ->with(['practitioners'])
            ->when($filters['status'] ?? null, function ($query, $status) {
                return $query->where('status', $status);
            })
            ->when($filters['search'] ?? null, function ($query, $search) {
                return $query->where(function ($q) use ($search) {
                    $q->where('license_key', 'like', "%{$search}%")
                      ->orWhere('notes', 'like', "%{$search}%");
                });
            })
            ->orderBy('created_at', 'desc')
            ->paginate(20);

        // Get practitioners for the attach form
        $practitioners = Practitioner::where('is_active', true)
            ->orderBy('first_name')
            ->orderBy('last_name')
            ->get(['id', 'first_name', 'last_name', 'email']);

        return Inertia::render('settings/licenses/Index', [
            'licenses' => $licenses,
            'practitioners' => $practitioners,
            'filters' => $filters,
        ]);
    }

    /**
     * Attach a license to a practitioner
     */
    public function attach(Request $request, License $license)
    {
        $validated = $request->validate([
            'practitioner_id' => 'required|exists:practitioners,id',
            'notes' => 'nullable|string|max:1000',
        ]);

        // Check if license is available
        if (!$license->isAvailable()) {
            return back()->withErrors([
                'license' => 'This license is not available for assignment.',
            ]);
        }

        // Check if practitioner already has a license
        $existingLicense = $license->practitioners()
            ->where('practitioner_id', $validated['practitioner_id'])
            ->exists();

        if ($existingLicense) {
            return back()->withErrors([
                'practitioner_id' => 'This practitioner already has this license assigned.',
            ]);
        }

        DB::transaction(function () use ($license, $validated) {
            // Attach license to practitioner
            $license->practitioners()->attach($validated['practitioner_id'], [
                'assigned_by' => Auth::id(),
                'assigned_at' => now(),
                'notes' => $validated['notes'] ?? null,
            ]);

            // Update license status
            $license->update([
                'status' => 'assigned',
                'assigned_at' => now(),
            ]);
        });

        return back()->with('success', 'License assigned successfully.');
    }

    /**
     * Detach a license from a practitioner
     */
    public function detach(Request $request, License $license, Practitioner $practitioner)
    {
        // Check if license is assigned to this practitioner
        if (!$license->practitioners()->where('practitioner_id', $practitioner->id)->exists()) {
            return back()->withErrors([
                'license' => 'This license is not assigned to this practitioner.',
            ]);
        }

        DB::transaction(function () use ($license, $practitioner) {
            // Detach license from practitioner
            $license->practitioners()->detach($practitioner->id);

            // Update license status if no practitioners are assigned
            if ($license->practitioners()->count() === 0) {
                $license->update([
                    'status' => 'available',
                    'assigned_at' => null,
                ]);
            }
        });

        return back()->with('success', 'License detached successfully.');
    }

    /**
     * Revoke a license
     */
    public function revoke(License $license)
    {
        DB::transaction(function () use ($license) {
            // Detach all practitioners
            $license->practitioners()->detach();

            // Update license status
            $license->update([
                'status' => 'revoked',
                'revoked_at' => now(),
                'assigned_at' => null,
            ]);
        });

        return back()->with('success', 'License revoked successfully.');
    }
}
