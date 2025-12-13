<?php

namespace App\Http\Controllers;

use App\Models\Tenant\Appointment;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class TestActivityController extends Controller
{
    public function testActivityLogging(Request $request)
    {
        try {
            // Get the first appointment to test with
            $appointment = Appointment::first();

            if (! $appointment) {
                return response()->json(['error' => 'No appointments found'], 404);
            }

            // Test basic activity logging
            $activity = activity()
                ->performedOn($appointment)
                ->event('test_video_session')
                ->withProperties([
                    'test_property' => 'test_value',
                    'appointment_id' => $appointment->id,
                    'tenant_id' => tenant('id'),
                ])
                ->log("Test video session activity for appointment {$appointment->id}");

            Log::info('Test activity created', [
                'activity_id' => $activity?->id ?? 'null',
                'appointment_id' => $appointment->id,
                'tenant_id' => tenant('id'),
            ]);

            // Check if it was saved to database
            $savedActivity = \Spatie\Activitylog\Models\Activity::where('event', 'test_video_session')->first();

            return response()->json([
                'success' => true,
                'activity_id' => $activity?->id ?? 'null',
                'saved_activity_id' => $savedActivity?->id ?? 'null',
                'appointment_id' => $appointment->id,
                'tenant_id' => tenant('id'),
                'database_connection' => config('database.default'),
                'activity_log_table' => config('activitylog.table_name', 'activity_log'),
            ]);

        } catch (\Exception $e) {
            Log::error('Test activity logging failed', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return response()->json([
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ], 500);
        }
    }
}
