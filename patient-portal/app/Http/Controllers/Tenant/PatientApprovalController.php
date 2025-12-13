<?php

namespace App\Http\Controllers\Tenant;

use App\Http\Controllers\Controller;
use App\Models\Tenant\Appointment;
use App\Models\Tenant\Patient;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;

class PatientApprovalController extends Controller
{
    /**
     * Approve a patient registration request
     */
    public function approve(Patient $patient)
    {
        // Check if patient is in 'Requested' status
        if ($patient->registration_status !== 'Requested') {
            return back()->with('error', 'This patient registration has already been processed.');
        }

        try {
            // Approve the patient
            $patient->approve(Auth::id());

            // Update related appointments from 'Requested' to 'pending'
            $updatedCount = Appointment::where('patient_id', $patient->id)
                ->where('status', 'Requested')
                ->update(['status' => 'pending']);

            Log::info('Patient registration approved', [
                'patient_id' => $patient->id,
                'patient_name' => $patient->full_name,
                'approved_by' => Auth::id(),
                'appointments_updated' => $updatedCount,
            ]);

            $message = 'Patient registration approved successfully!';
            if ($updatedCount > 0) {
                $message .= " {$updatedCount} appointment(s) moved from requested to pending.";
            }

            return back()->with('success', $message);
        } catch (\Exception $e) {
            Log::error('Failed to approve patient registration', [
                'patient_id' => $patient->id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return back()->with('error', 'Failed to approve patient registration. Please try again.');
        }
    }

    /**
     * Reject a patient registration request
     */
    public function reject(Request $request, Patient $patient)
    {
        // Check if patient is in 'Requested' status
        if ($patient->registration_status !== 'Requested') {
            return back()->with('error', 'This patient registration has already been processed.');
        }

        // Validate rejection reason
        $validated = $request->validate([
            'rejection_reason' => 'required|string|min:10|max:500',
        ]);

        try {
            // Reject the patient
            $patient->reject($validated['rejection_reason']);

            // Cancel related appointments
            $cancelledCount = Appointment::where('patient_id', $patient->id)
                ->where('status', 'Requested')
                ->update(['status' => 'cancelled']);

            Log::info('Patient registration rejected', [
                'patient_id' => $patient->id,
                'patient_name' => $patient->full_name,
                'rejected_by' => Auth::id(),
                'rejection_reason' => $validated['rejection_reason'],
                'appointments_cancelled' => $cancelledCount,
            ]);

            $message = 'Patient registration rejected.';
            if ($cancelledCount > 0) {
                $message .= " {$cancelledCount} appointment(s) cancelled.";
            }

            return back()->with('success', $message);
        } catch (\Exception $e) {
            Log::error('Failed to reject patient registration', [
                'patient_id' => $patient->id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return back()->with('error', 'Failed to reject patient registration. Please try again.');
        }
    }
}
