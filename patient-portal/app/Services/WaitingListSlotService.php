<?php

namespace App\Services;

use App\Mail\WaitingListSlotAvailable;
use App\Models\AppointmentWaitlist;
use App\Models\Tenant\Appointment;
use App\Models\Tenant\Patient;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class WaitingListSlotService
{
    public function processAvailableSlot(Appointment $cancelledAppointment): void
    {
        Log::info('WAITLIST: Processing cancelled appointment', [
            'appointment_id' => $cancelledAppointment->id,
        ]);

        // Get appointment details - convert to local timezone first
        $utcDate = Carbon::parse($cancelledAppointment->appointment_datetime);

        // Convert UTC to local timezone for accurate day/time slot determination
        $localDate = $utcDate;
        if ($cancelledAppointment->location_id) {
            try {
                $localDate = \App\Services\SimpleTimezoneService::toLocal($utcDate, $cancelledAppointment->location_id);
            } catch (\Exception $e) {
                Log::warning('WAITLIST: Failed to convert to local timezone, using UTC', [
                    'appointment_id' => $cancelledAppointment->id,
                    'location_id' => $cancelledAppointment->location_id,
                    'error' => $e->getMessage(),
                ]);
                $localDate = $utcDate;
            }
        }

        $dayOfWeek = strtolower($localDate->format('l'));
        $hour = $localDate->hour;

        if ($hour >= 5 && $hour < 12) {
            $timeSlot = 'morning';
        } elseif ($hour >= 12 && $hour < 17) {
            $timeSlot = 'afternoon';
        } else {
            $timeSlot = 'evening';
        }

        Log::info('WAITLIST: Slot details', [
            'day' => $dayOfWeek,
            'time_slot' => $timeSlot,
            'utc_datetime' => $utcDate->format('Y-m-d H:i:s'),
            'local_datetime' => $localDate->format('Y-m-d H:i:s'),
            'location_id' => $cancelledAppointment->location_id,
            'hour_used' => $hour,
        ]);

        // Find waiting patients that match the cancelled appointment
        // Priority order:
        // 1. Exact date match (if they originally requested this specific date)
        // 2. Day and time preferences match
        $appointmentDateString = $localDate->format('Y-m-d H:i:s');

        $entries = AppointmentWaitlist::where('status', 'waiting')
            ->where(function ($q) use ($dayOfWeek, $timeSlot, $appointmentDateString) {
                // First priority: Exact original date match
                $q->where('original_requested_date', $appointmentDateString)
                  // Second priority: Day and time preferences
                    ->orWhere(function ($subQ) use ($dayOfWeek, $timeSlot) {
                        $subQ->where(function ($dayQ) use ($dayOfWeek) {
                            $dayQ->where('preferred_day', $dayOfWeek)->orWhere('preferred_day', 'any');
                        })
                            ->where(function ($timeQ) use ($timeSlot) {
                                $timeQ->where('preferred_time', $timeSlot)->orWhere('preferred_time', 'any');
                            });
                    });
            })
            ->whereNull('offered_at')
            ->orderByRaw('
                CASE 
                    WHEN original_requested_date = ? THEN 1 
                    ELSE 2 
                END, created_at
            ', [$appointmentDateString])
            ->get();

        if ($entries->isEmpty()) {
            Log::info('WAITLIST: No matching entries found');

            return;
        }

        Log::info('WAITLIST: Found entries', [
            'count' => $entries->count(),
            'entries' => $entries->map(function ($entry) {
                return [
                    'id' => $entry->id,
                    'patient_id' => $entry->patient_id,
                    'preferred_day' => $entry->preferred_day,
                    'preferred_time' => $entry->preferred_time,
                    'original_requested_date' => $entry->original_requested_date,
                    'created_at' => $entry->created_at,
                ];
            })->toArray(),
        ]);

        // Send emails to all
        foreach ($entries as $entry) {
            $token = bin2hex(random_bytes(16));

            $entry->update([
                'offered_at' => now(),
                'expires_at' => now()->addHours(24),
                'acceptance_token' => $token,
                'appointment_id' => $cancelledAppointment->id,
            ]);

            $patient = Patient::find($entry->patient_id);

            if ($patient) {
                try {
                    Mail::to($patient->email)->send(new WaitingListSlotAvailable(
                        $patient,
                        $entry,
                        $localDate,
                        $cancelledAppointment,
                        $token
                    ));
                    Log::info('WAITLIST: Email sent', ['patient' => $patient->email]);
                } catch (\Exception $e) {
                    Log::error('WAITLIST: Email failed', ['error' => $e->getMessage()]);
                }
            }
        }
    }

    public function getOfferDetails(string $token): array
    {
        $entry = AppointmentWaitlist::where('acceptance_token', $token)->first();

        if (! $entry) {
            return ['success' => false, 'message' => 'Invalid link'];
        }

        if ($entry->expires_at && $entry->expires_at->isPast()) {
            return ['success' => false, 'message' => 'Expired'];
        }

        $patient = tenancy()->central(fn () => Patient::find($entry->patient_id));
        $originalAppointment = Appointment::find($entry->appointment_id);

        return [
            'success' => true,
            'waitingListEntry' => $entry,
            'patient' => $patient,
            'appointmentDate' => Carbon::parse($entry->offered_at),
            'originalAppointment' => $originalAppointment,
            'expiresAt' => $entry->expires_at,
        ];
    }

    public function confirmSlotOffer(string $token): array
    {
        Log::info('WAITLIST: Confirming slot', ['token' => $token]);

        try {
            $entry = AppointmentWaitlist::where('acceptance_token', $token)->first();

            if (! $entry) {
                Log::info('WAITLIST: No entry found');

                return ['success' => false, 'message' => 'Invalid link'];
            }

            Log::info('WAITLIST: Entry found', [
                'id' => $entry->id,
                'status' => $entry->status,
            ]);

            if ($entry->status !== 'waiting') {
                Log::info('WAITLIST: Entry not waiting');

                return ['success' => false, 'message' => 'No longer available'];
            }

            if ($entry->expires_at && $entry->expires_at->isPast()) {
                Log::info('WAITLIST: Entry expired');

                return ['success' => false, 'message' => 'Expired'];
            }

            // Create appointment
            $originalAppointment = Appointment::find($entry->appointment_id);
            $appointmentDate = Carbon::parse($entry->offered_at);

            if ($originalAppointment) {
                $appointmentDate = Carbon::parse($originalAppointment->appointment_datetime);
            }

            // Determine parent and root appointment IDs for appointment history chain
            $parentAppointmentId = $originalAppointment ? $originalAppointment->id : null;
            $rootAppointmentId = null;

            if ($originalAppointment) {
                // If the original appointment has a root_appointment_id, use that
                // Otherwise, the original appointment itself is the root
                $rootAppointmentId = $originalAppointment->root_appointment_id ?: $originalAppointment->id;
            }

            $appointment = Appointment::create([
                'patient_id' => $entry->patient_id,
                'parent_appointment_id' => $parentAppointmentId,
                'root_appointment_id' => $rootAppointmentId,
                'appointment_datetime' => $appointmentDate,
                'start_time' => $appointmentDate,
                'end_time' => $appointmentDate->copy()->addMinutes(30), // Default 30 minutes, will be updated with original appointment duration
                'status' => 'confirmed',
                'booking_source' => 'waiting_list',
                'notes' => 'From waiting list',
                'service_id' => $originalAppointment->service_id ?? null,
                'location_id' => $originalAppointment->location_id ?? null,
                'mode' => $originalAppointment->mode ?? 'in-person',
                'stored_timezone' => $originalAppointment->stored_timezone ?? 'UTC',
                'needs_timezone_migration' => false,
                'send_intake_form' => false,
                'send_appointment_confirmation' => true,
                'add_to_calendar' => true,
                'tag_with_referral_source' => false,
            ]);

            // If this is the first appointment in a potential chain (no parent),
            // set root_appointment_id to its own ID
            if (! $appointment->parent_appointment_id && ! $appointment->root_appointment_id) {
                $appointment->update(['root_appointment_id' => $appointment->id]);
            }

            Log::info('WAITLIST: Appointment created', [
                'id' => $appointment->id,
                'parent_appointment_id' => $appointment->parent_appointment_id,
                'root_appointment_id' => $appointment->root_appointment_id,
            ]);

            // Copy practitioners from the original appointment to the new appointment
            if ($originalAppointment) {
                $originalPractitioners = DB::table('appointment_practitioner')
                    ->where('appointment_id', $originalAppointment->id)
                    ->get();

                Log::info('WAITLIST: Found original practitioners', [
                    'original_appointment_id' => $originalAppointment->id,
                    'practitioners_count' => $originalPractitioners->count(),
                ]);

                foreach ($originalPractitioners as $practitioner) {
                    // Calculate the time difference between original and new appointment
                    $originalDateTime = Carbon::parse($originalAppointment->appointment_datetime);
                    $timeDifference = $appointmentDate->diffInMinutes($originalDateTime, false);

                    // Adjust practitioner times based on the new appointment time
                    $newStartTime = Carbon::parse($practitioner->start_time)->addMinutes($timeDifference);
                    $newEndTime = Carbon::parse($practitioner->end_time)->addMinutes($timeDifference);

                    DB::table('appointment_practitioner')->insert([
                        'appointment_id' => $appointment->id,
                        'practitioner_id' => $practitioner->practitioner_id,
                        'start_time' => $newStartTime->format('Y-m-d H:i:s'),
                        'end_time' => $newEndTime->format('Y-m-d H:i:s'),
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);

                    Log::info('WAITLIST: Practitioner association created', [
                        'appointment_id' => $appointment->id,
                        'practitioner_id' => $practitioner->practitioner_id,
                        'start_time' => $newStartTime->format('Y-m-d H:i:s'),
                        'end_time' => $newEndTime->format('Y-m-d H:i:s'),
                    ]);
                }

                // Update appointment end time based on the latest practitioner end time
                if ($originalPractitioners->isNotEmpty()) {
                    $latestEndTime = $originalPractitioners->max('end_time');
                    $originalLatestEnd = Carbon::parse($latestEndTime);
                    $newLatestEnd = $originalLatestEnd->addMinutes($timeDifference);

                    $appointment->update([
                        'end_time' => $newLatestEnd,
                    ]);

                    Log::info('WAITLIST: Updated appointment end time', [
                        'appointment_id' => $appointment->id,
                        'end_time' => $newLatestEnd->format('Y-m-d H:i:s'),
                    ]);
                }
            }

            // Update entry
            $entry->update([
                'status' => 'confirmed',
                'appointment_id' => $appointment->id,
            ]);

            Log::info('WAITLIST: Entry updated to confirmed');

            // Mark others as expired
            AppointmentWaitlist::where('offered_at', $entry->offered_at)
                ->where('id', '!=', $entry->id)
                ->update(['status' => 'expired']);

            Log::info('WAITLIST: Others marked as expired');

            $patient = Patient::find($entry->patient_id);

            Log::info('WAITLIST: Success - returning result');

            return [
                'success' => true,
                'message' => 'Appointment confirmed!',
                'appointment' => $appointment->load(['service', 'location']),
                'patient' => $patient,
            ];

        } catch (\Exception $e) {
            Log::error('WAITLIST: Error confirming slot', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return [
                'success' => false,
                'message' => 'Error occurred',
            ];
        }
    }
}
