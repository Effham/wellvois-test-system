<?php

namespace App\Console\Commands;

use App\Models\Patient as CentralPatient;
use App\Models\Tenant;
use App\Models\Tenant\Patient as TenantPatient;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class MigratePatientsToTenantDatabases extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'patients:migrate-to-tenants
                            {--tenant= : Migrate only for a specific tenant ID}
                            {--dry-run : Run without actually inserting data}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Migrate patient records from central database to tenant databases based on tenant_patients pivot table';

    private int $totalMigrated = 0;

    private int $totalSkipped = 0;

    private int $totalErrors = 0;

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $this->info('Starting patient migration from central to tenant databases...');
        $this->newLine();

        $tenantId = $this->option('tenant');
        $dryRun = $this->option('dry-run');

        if ($dryRun) {
            $this->warn('⚠️  DRY RUN MODE - No data will be written');
            $this->newLine();
        }

        // Get tenants to process
        $tenants = $tenantId
            ? Tenant::where('id', $tenantId)->get()
            : Tenant::all();

        if ($tenants->isEmpty()) {
            $this->error('No tenants found.');

            return self::FAILURE;
        }

        $this->info("Processing {$tenants->count()} tenant(s)...");
        $this->newLine();

        $progressBar = $this->output->createProgressBar($tenants->count());
        $progressBar->start();

        foreach ($tenants as $tenant) {
            $this->migrateTenantPatients($tenant, $dryRun);
            $progressBar->advance();
        }

        $progressBar->finish();
        $this->newLine(2);

        // Display summary
        $this->displaySummary();

        return self::SUCCESS;
    }

    /**
     * Migrate patients for a specific tenant
     */
    private function migrateTenantPatients(Tenant $tenant, bool $dryRun): void
    {
        tenancy()->initialize($tenant);

        $this->newLine();
        $this->info("🏢 Tenant: {$tenant->id}");

        // Get patient IDs linked to this tenant from central pivot table
        $patientIds = DB::connection('mysql')
            ->table('tenant_patients')
            ->where('tenant_id', $tenant->id)
            ->pluck('patient_id');

        if ($patientIds->isEmpty()) {
            $this->warn('   No patients linked to this tenant.');

            return;
        }

        $this->info("   Found {$patientIds->count()} patient(s) to migrate");

        foreach ($patientIds as $patientId) {
            $this->migratePatient($patientId, $tenant, $dryRun);
        }

        tenancy()->end();
    }

    /**
     * Migrate a single patient to tenant database
     */
    private function migratePatient(int $centralPatientId, Tenant $tenant, bool $dryRun): void
    {
        try {
            // Fetch patient from central database
            $centralPatient = tenancy()->central(function () use ($centralPatientId) {
                return CentralPatient::find($centralPatientId);
            });

            if (! $centralPatient) {
                $this->warn("   ⚠️  Central patient ID {$centralPatientId} not found - skipping");
                $this->totalSkipped++;

                return;
            }

            // Check if patient already exists in tenant database
            $existingTenantPatient = TenantPatient::where('external_patient_id', $centralPatientId)->first();

            if ($existingTenantPatient) {
                $this->totalSkipped++;

                return;
            }

            if ($dryRun) {
                $this->line("   [DRY RUN] Would migrate: {$centralPatient->full_name} (ID: {$centralPatientId})");
                $this->totalMigrated++;

                return;
            }

            // Create patient in tenant database
            $tenantPatient = TenantPatient::create([
                'uid' => $centralPatient->uid ?? (string) Str::uuid(),
                'health_number' => $centralPatient->health_number,
                'user_id' => $centralPatient->user_id,
                'external_patient_id' => $centralPatientId,
                'external_tenant_id' => $tenant->id,
                'first_name' => $centralPatient->first_name,
                'last_name' => $centralPatient->last_name,
                'preferred_name' => $centralPatient->preferred_name,
                'date_of_birth' => $centralPatient->date_of_birth,
                'gender' => $centralPatient->gender,
                'gender_pronouns' => $centralPatient->gender_pronouns,
                'client_type' => $centralPatient->client_type,
                'email' => $centralPatient->email,
                'phone_number' => $centralPatient->phone_number,
                'emergency_contact_phone' => $centralPatient->emergency_contact_phone,
                'address' => $centralPatient->address,
                'address_lookup' => $centralPatient->address_lookup,
                'street_address' => $centralPatient->street_address,
                'apt_suite_unit' => $centralPatient->apt_suite_unit,
                'city' => $centralPatient->city,
                'postal_zip_code' => $centralPatient->postal_zip_code,
                'province' => $centralPatient->province,
                'presenting_concern' => $centralPatient->presenting_concern,
                'goals_for_therapy' => $centralPatient->goals_for_therapy,
                'previous_therapy_experience' => $centralPatient->previous_therapy_experience,
                'current_medications' => $centralPatient->current_medications,
                'diagnoses' => $centralPatient->diagnoses,
                'history_of_hospitalization' => $centralPatient->history_of_hospitalization,
                'risk_safety_concerns' => $centralPatient->risk_safety_concerns,
                'other_medical_conditions' => $centralPatient->other_medical_conditions,
                'cultural_religious_considerations' => $centralPatient->cultural_religious_considerations,
                'accessibility_needs' => $centralPatient->accessibility_needs,
                'insurance_provider' => $centralPatient->insurance_provider,
                'policy_number' => $centralPatient->policy_number,
                'coverage_card_path' => $centralPatient->coverage_card_path,
                'consent_to_treatment' => $centralPatient->consent_to_treatment ?? false,
                'consent_to_data_storage' => $centralPatient->consent_to_data_storage ?? false,
                'privacy_policy_acknowledged' => $centralPatient->privacy_policy_acknowledged ?? false,
                'language_preferences' => $centralPatient->language_preferences,
                'best_time_to_contact' => $centralPatient->best_time_to_contact,
                'best_way_to_contact' => $centralPatient->best_way_to_contact,
                'consent_to_receive_reminders' => $centralPatient->consent_to_receive_reminders ?? false,
                'meta_data' => $centralPatient->meta_data,
                'is_active' => $centralPatient->is_active ?? true,
                'created_at' => $centralPatient->created_at,
                'updated_at' => $centralPatient->updated_at,
            ]);

            $this->totalMigrated++;

        } catch (\Exception $e) {
            $this->error("   ❌ Error migrating patient ID {$centralPatientId}: {$e->getMessage()}");
            $this->totalErrors++;
        }
    }

    /**
     * Display migration summary
     */
    private function displaySummary(): void
    {
        $this->info('═══════════════════════════════════════════════════════');
        $this->info('📊 Migration Summary');
        $this->info('═══════════════════════════════════════════════════════');
        $this->line("✅ Successfully migrated: {$this->totalMigrated}");
        $this->line("⏭️  Skipped (already exist): {$this->totalSkipped}");
        $this->line("❌ Errors: {$this->totalErrors}");
        $this->info('═══════════════════════════════════════════════════════');
    }
}
