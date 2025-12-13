<?php

namespace App\Console\Commands;

use App\Models\Tenant;
use App\Models\Tenant\Appointment;
use App\Models\Tenant\Patient;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class SyncAppointmentsWithTenantPatients extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'appointments:sync-with-tenant-patients
                            {--tenant= : Sync only for a specific tenant ID}
                            {--dry-run : Run without actually updating data}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Sync appointments to reference tenant patient IDs instead of central patient IDs';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $isDryRun = $this->option('dry-run');
        $specificTenantId = $this->option('tenant');

        $this->info('Starting appointment sync process...');

        if ($isDryRun) {
            $this->warn('DRY RUN MODE - No data will be updated');
        }

        // Get tenants to process
        $tenants = $specificTenantId
            ? Tenant::where('id', $specificTenantId)->get()
            : Tenant::all();

        if ($tenants->isEmpty()) {
            $this->error('No tenants found to process.');

            return Command::FAILURE;
        }

        $this->info("Processing {$tenants->count()} tenant(s)...\n");

        $totalAppointments = 0;
        $totalUpdated = 0;
        $totalSkipped = 0;
        $totalErrors = 0;

        foreach ($tenants as $tenant) {
            try {
                $this->info("Processing tenant: {$tenant->company_name} (ID: {$tenant->id})");

                // Switch to tenant database
                tenancy()->initialize($tenant);

                // Get all appointments
                $appointments = Appointment::all();
                $appointmentCount = $appointments->count();

                $this->info("Found {$appointmentCount} appointments");

                $updated = 0;
                $skipped = 0;
                $errors = 0;

                foreach ($appointments as $appointment) {
                    try {
                        // Current patient_id references central DB patient
                        $centralPatientId = $appointment->patient_id;

                        if (! $centralPatientId) {
                            $this->warn("  Appointment {$appointment->id} has no patient_id, skipping");
                            $skipped++;

                            continue;
                        }

                        // Find tenant patient by external_patient_id (which should match the old central patient ID)
                        $tenantPatient = Patient::where('external_patient_id', $centralPatientId)->first();

                        if (! $tenantPatient) {
                            $this->warn("  Appointment {$appointment->id}: No tenant patient found with external_patient_id={$centralPatientId}");
                            $skipped++;

                            continue;
                        }

                        // Check if already synced
                        if ($appointment->patient_id === $tenantPatient->id) {
                            $this->line("  Appointment {$appointment->id}: Already synced (patient_id={$tenantPatient->id})");
                            $skipped++;

                            continue;
                        }

                        if ($isDryRun) {
                            $this->line("  [DRY RUN] Would update appointment {$appointment->id}: patient_id {$centralPatientId} → {$tenantPatient->id}");
                        } else {
                            // Update the appointment with new tenant patient ID
                            $appointment->update(['patient_id' => $tenantPatient->id]);
                            $this->info("  ✓ Updated appointment {$appointment->id}: patient_id {$centralPatientId} → {$tenantPatient->id}");
                        }

                        $updated++;

                    } catch (\Exception $e) {
                        $this->error("  Error processing appointment {$appointment->id}: ".$e->getMessage());
                        Log::error('Appointment sync error', [
                            'appointment_id' => $appointment->id,
                            'tenant_id' => $tenant->id,
                            'error' => $e->getMessage(),
                            'trace' => $e->getTraceAsString(),
                        ]);
                        $errors++;
                    }
                }

                $this->newLine();
                $this->info("Tenant {$tenant->company_name} summary:");
                $this->info("  Total appointments: {$appointmentCount}");
                $this->info("  Updated: {$updated}");
                $this->info("  Skipped: {$skipped}");
                if ($errors > 0) {
                    $this->error("  Errors: {$errors}");
                }
                $this->newLine();

                $totalAppointments += $appointmentCount;
                $totalUpdated += $updated;
                $totalSkipped += $skipped;
                $totalErrors += $errors;

                // Return to central context
                tenancy()->end();

            } catch (\Exception $e) {
                $this->error("Error processing tenant {$tenant->id}: ".$e->getMessage());
                Log::error('Tenant processing error in appointment sync', [
                    'tenant_id' => $tenant->id,
                    'error' => $e->getMessage(),
                    'trace' => $e->getTraceAsString(),
                ]);

                // Make sure we return to central context even if there's an error
                try {
                    tenancy()->end();
                } catch (\Exception $endError) {
                    // Ignore end errors
                }

                continue;
            }
        }

        // Final summary
        $this->info('');
        $this->info('=== FINAL SUMMARY ===');
        $this->info("Total tenants processed: {$tenants->count()}");
        $this->info("Total appointments: {$totalAppointments}");

        if ($isDryRun) {
            $this->info("Would update: {$totalUpdated}");
        } else {
            $this->info("Updated: {$totalUpdated}");
        }

        $this->info("Skipped: {$totalSkipped}");

        if ($totalErrors > 0) {
            $this->error("Errors: {$totalErrors}");
        }

        if (! $isDryRun && $totalUpdated > 0) {
            Log::info('Appointments synced with tenant patients successfully', [
                'total_appointments' => $totalAppointments,
                'updated' => $totalUpdated,
                'skipped' => $totalSkipped,
                'errors' => $totalErrors,
            ]);
        }

        $this->info('Appointment sync process completed.');

        return Command::SUCCESS;
    }
}
