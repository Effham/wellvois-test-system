<?php

namespace App\Listeners;

use App\Events\AppointmentStatusChanged;
use App\Services\WaitingListSlotService;
use Illuminate\Support\Facades\Log;

class ProcessWaitingListForCancelledAppointment
{
    protected $waitingListService;

    /**
     * Create the event listener.
     */
    public function __construct(WaitingListSlotService $waitingListService)
    {
        $this->waitingListService = $waitingListService;
    }

    /**
     * Handle the event.
     */
    public function handle(AppointmentStatusChanged $event): void
    {
        Log::info('WAITLIST LISTENER: AppointmentStatusChanged event received', [
            'appointment_id' => $event->appointment->id,
            'old_status' => $event->oldStatus,
            'new_status' => $event->newStatus,
            'appointment_datetime' => $event->appointment->appointment_datetime,
        ]);

        // Only process if appointment was cancelled or declined
        if (! in_array($event->newStatus, ['cancelled', 'declined'])) {
            Log::info('WAITLIST LISTENER: Not processing - status not cancelled/declined', [
                'status' => $event->newStatus,
            ]);

            return;
        }

        Log::info('WAITLIST LISTENER: Processing waiting list for cancelled appointment', [
            'appointment_id' => $event->appointment->id,
            'old_status' => $event->oldStatus,
            'new_status' => $event->newStatus,
            'appointment_datetime' => $event->appointment->appointment_datetime,
        ]);

        try {
            $this->waitingListService->processAvailableSlot($event->appointment);
        } catch (\Exception $e) {
            Log::error('Failed to process waiting list for cancelled appointment', [
                'appointment_id' => $event->appointment->id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            // Don't fail the job, just log the error
            // The appointment cancellation should still succeed
        }
    }
}
