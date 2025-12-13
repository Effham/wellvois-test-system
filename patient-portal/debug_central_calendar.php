<?php

// Debug script for Central CalendarController
require_once 'vendor/autoload.php';

// Bootstrap Laravel
$app = require_once 'bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

echo "Debug: Central CalendarController\n";
echo "=================================\n";

// Simulate auth user (ID 1)
$user = \App\Models\User::find(1);
if (! $user) {
    echo "User ID 1 not found\n";
    exit;
}

echo "User: {$user->name} (ID: {$user->id})\n";

// Check practitioner
$practitioner = \App\Models\Practitioner::where('user_id', $user->id)->first();
if (! $practitioner) {
    echo "❌ No practitioner found for user ID {$user->id}\n";

    // Show all practitioners and their user IDs
    echo "\nAll practitioners:\n";
    $allPractitioners = \App\Models\Practitioner::limit(10)->get();
    foreach ($allPractitioners as $p) {
        echo "  - ID: {$p->id}, Name: {$p->full_name}, User ID: ".($p->user_id ?? 'NULL')."\n";
    }

    // For debugging, let's use practitioner ID 5 who has appointments
    $practitioner = \App\Models\Practitioner::find(5);
    if (! $practitioner) {
        echo "❌ Could not find practitioner ID 5 either\n";
        exit;
    }
    echo "\n🔧 Using practitioner ID 5 for debugging: {$practitioner->full_name}\n";
}

echo "Practitioner: {$practitioner->full_name} (ID: {$practitioner->id})\n";

// Check practitioner-tenant relationships
try {
    $tenantIds = $practitioner->tenants()->pluck('tenant_id')->toArray();
    echo 'Tenants for practitioner: '.implode(', ', $tenantIds)."\n";

    if (empty($tenantIds)) {
        echo "❌ Practitioner not assigned to any tenants\n";

        // Show all tenants
        $allTenants = \App\Models\Tenant::limit(5)->get();
        echo "Available tenants:\n";
        foreach ($allTenants as $t) {
            echo "  - ID: {$t->id}, Name: ".($t->company_name ?? 'Unknown')."\n";
        }
        exit;
    }
} catch (\Exception $e) {
    echo '❌ Error getting tenant relationships: '.$e->getMessage()."\n";
    echo "This suggests practitioner->tenants() relationship may not exist or be configured properly\n";

    // Let's manually check if practitioner_tenant pivot table exists
    try {
        $hasPivotTable = \Schema::hasTable('practitioner_tenant');
        echo 'practitioner_tenant table exists: '.($hasPivotTable ? 'YES' : 'NO')."\n";

        if ($hasPivotTable) {
            $pivotData = \DB::table('practitioner_tenant')
                ->where('practitioner_id', $practitioner->id)
                ->get();
            echo "Pivot data for practitioner {$practitioner->id}: {$pivotData->count()} records\n";
            foreach ($pivotData as $record) {
                echo "  - Tenant ID: {$record->tenant_id}\n";
            }
        }
    } catch (\Exception $pivotError) {
        echo '❌ Error checking pivot table: '.$pivotError->getMessage()."\n";
    }

    // For debugging, let's manually use the first tenant
    $tenant = \App\Models\Tenant::first();
    if (! $tenant) {
        echo "❌ No tenants found in system\n";
        exit;
    }
    $tenantIds = [$tenant->id];
    echo "🔧 Using first tenant for debugging: {$tenant->id}\n";
}

$appointments = [];

// Fetch appointments from tenants
foreach ($tenantIds as $tenantId) {
    echo "\n--- Processing Tenant ID: {$tenantId} ---\n";

    try {
        $tenant = \App\Models\Tenant::find($tenantId);
        if (! $tenant) {
            echo "❌ Tenant {$tenantId} not found\n";

            continue;
        }

        $companyName = $tenant->company_name ?? 'Unknown Clinic';
        echo "Tenant: {$companyName}\n";

        // Switch to tenant database
        tenancy()->initialize($tenant);
        echo "✅ Tenant context initialized\n";

        // Check if appointment_practitioner table exists in tenant
        $hasTable = \Schema::hasTable('appointment_practitioner');
        echo 'appointment_practitioner table exists in tenant: '.($hasTable ? 'YES' : 'NO')."\n";

        if (! $hasTable) {
            echo "❌ appointment_practitioner table missing in tenant database\n";
            tenancy()->end();

            continue;
        }

        // Try the UPDATED query from CalendarController
        $tenantAppointments = \App\Models\Tenant\Appointment::with(['service', 'location'])
            ->select('appointments.*', 'appointment_practitioner.start_time', 'appointment_practitioner.end_time')
            ->join('appointment_practitioner', 'appointments.id', '=', 'appointment_practitioner.appointment_id')
            ->where('appointment_practitioner.practitioner_id', $practitioner->id)
            ->whereIn('status', ['confirmed', 'pending']) // Updated to include pending
            ->whereNotNull('appointment_practitioner.start_time')
            ->orderBy('appointment_practitioner.start_time', 'asc')
            ->limit(5)
            ->get();

        echo "Found {$tenantAppointments->count()} confirmed/pending appointments\n";

        foreach ($tenantAppointments as $appointment) {
            // Simulate the appointment processing from CalendarController
            $startTime = \Carbon\Carbon::parse($appointment->start_time);
            $endTime = \Carbon\Carbon::parse($appointment->end_time);
            $durationMinutes = $startTime->diffInMinutes($endTime);

            echo "  - ID: {$appointment->id}, Status: {$appointment->status}, Start: {$appointment->start_time}, Duration: {$durationMinutes}min\n";

            // Add to appointments array (simulate controller logic)
            $appointments[] = [
                'id' => $appointment->id,
                'tenant_id' => $tenantId,
                'title' => ($appointment->service ? $appointment->service->name : 'Appointment').' - Unknown Patient',
                'date' => $startTime->format('Y-m-d'),
                'time' => $startTime->format('H:i'),
                'duration' => $durationMinutes,
                'status' => $appointment->status,
            ];
        }

        // Also check all appointments (not just confirmed)
        $allTenantAppointments = \App\Models\Tenant\Appointment::select('appointments.*', 'appointment_practitioner.start_time', 'appointment_practitioner.end_time')
            ->join('appointment_practitioner', 'appointments.id', '=', 'appointment_practitioner.appointment_id')
            ->where('appointment_practitioner.practitioner_id', $practitioner->id)
            ->whereNotNull('appointment_practitioner.start_time')
            ->orderBy('appointment_practitioner.start_time', 'asc')
            ->limit(5)
            ->get();

        echo "Found {$allTenantAppointments->count()} total appointments (any status)\n";

        foreach ($allTenantAppointments as $appointment) {
            echo "  - ID: {$appointment->id}, Status: {$appointment->status}, Start: {$appointment->start_time}\n";
        }

        tenancy()->end();

    } catch (\Exception $e) {
        echo "❌ Error processing tenant {$tenantId}: ".$e->getMessage()."\n";
        echo 'Stack trace: '.$e->getTraceAsString()."\n";

        try {
            tenancy()->end();
        } catch (\Exception $endError) {
            // Ignore end errors
        }

        continue;
    }
}

echo "\n=== Summary ===\n";
echo 'Total appointments found: '.count($appointments)."\n";
