<?php

namespace App\Console\Commands;

use App\Models\Patient;
use App\Models\Tenant;
use App\Models\Tenant\Appointment;
use App\Models\Tenant\Consent;
use Illuminate\Console\Command;

class UpdateAppointmentConsentStatus extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'appointments:update-consent-status';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Update pending appointments to pending-consent if required consents are not accepted';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $this->info('Starting to update appointment statuses based on consent acceptance...');

        // Get all tenants
        $tenants = Tenant::all();
        $this->info("Found {$tenants->count()} tenants to process.");

        $totalUpdated = 0;
        $totalSkipped = 0;

        foreach ($tenants as $tenant) {
            $this->info("Processing tenant: {$tenant->company_name} (ID: {$tenant->id})");

            // Initialize tenancy for this tenant
            tenancy()->initialize($tenant);

            // Get all pending appointments
            $pendingAppointments = Appointment::where('status', 'pending')->get();

            $this->info("  Found {$pendingAppointments->count()} pending appointments");

            foreach ($pendingAppointments as $appointment) {
                // Get patient data
                $patient = tenancy()->central(function () use ($appointment) {
                    return Patient::find($appointment->patient_id);
                });

                if (! $patient) {
                    $this->warn("  Patient not found for appointment {$appointment->id}");
                    $totalSkipped++;

                    continue;
                }

                // Check if patient has accepted all required consents
                $hasAcceptedAllRequired = Consent::patientHasAcceptedAllRequired($patient);

                if (! $hasAcceptedAllRequired) {
                    // Update appointment status to pending-consent
                    $appointment->update(['status' => 'pending-consent']);
                    $this->line("  ✓ Updated appointment {$appointment->id} to pending-consent");
                    $totalUpdated++;
                } else {
                    $totalSkipped++;
                }
            }

            $this->info("  Completed processing {$tenant->company_name}");

            // End tenancy
            tenancy()->end();
        }

        $this->newLine();
        $this->info('Update completed!');
        $this->info("Total appointments updated: {$totalUpdated}");
        $this->info("Total appointments skipped: {$totalSkipped}");

        return Command::SUCCESS;
    }
}
