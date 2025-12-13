<?php

namespace App\Console\Commands;

use App\Models\Patient;
use App\Models\Practitioner;
use App\Models\Tenant;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Stancl\Tenancy\Concerns\HasATenantsOption;

class SyncWalletsCommand extends Command
{
    use HasATenantsOption;

    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'wallets:sync
                            {--tenants=* : Specific tenant(s) to sync (optional)}
                            {--force : Force re-sync even if wallets exist}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Sync polymorphic wallets for all tenants, patients, and practitioners';

    protected int $systemWalletsCreated = 0;

    protected int $patientWalletsCreated = 0;

    protected int $practitionerWalletsCreated = 0;

    protected int $tenantsProcessed = 0;

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $this->newLine();
        $this->info('═══════════════════════════════════════════════');
        $this->info('  Wallet Synchronization');
        $this->info('═══════════════════════════════════════════════');
        $this->newLine();

        // Get tenants to process (uses HasATenantsOption trait)
        $tenants = $this->getTenants();

        if ($tenants->isEmpty()) {
            $this->warn('⚠️  No tenants found to process.');

            return self::SUCCESS;
        }

        $this->line("Tenants: {$tenants->count()}");
        $this->newLine();

        // Process each tenant
        foreach ($tenants as $tenant) {
            $this->info("▶ Processing tenant: {$tenant->id}");

            $tenant->run(function () use ($tenant) {
                $this->processTenant($tenant);
            });

            $this->newLine();
        }

        // Display summary
        $this->info('═══════════════════════════════════════════════');
        $this->displaySummary();
        $this->info('═══════════════════════════════════════════════');

        return self::SUCCESS;
    }

    /**
     * Process a single tenant (called within tenant context)
     */
    protected function processTenant(Tenant $tenant): void
    {
        $this->tenantsProcessed++;

        // 1. Ensure system wallet exists
        $this->ensureSystemWallet();
        $this->line('  ✓ System wallet verified');

        // 2. Get all patients for this tenant from central database
        $patientIds = $this->getPatientIdsForTenant($tenant->id);
        $this->line("  → Found {$patientIds->count()} patients");

        // 3. Create wallets for each patient
        $patientCount = 0;
        foreach ($patientIds as $patientId) {
            if ($this->ensurePatientWallet($patientId)) {
                $patientCount++;
            }
        }
        if ($patientCount > 0) {
            $this->line("  ✓ Created {$patientCount} patient wallets");
        }

        // 4. Get all practitioners for this tenant from central database
        $practitionerIds = $this->getPractitionerIdsForTenant($tenant->id);
        $this->line("  → Found {$practitionerIds->count()} practitioners");

        // 5. Create wallets for each practitioner
        $practitionerCount = 0;
        foreach ($practitionerIds as $practitionerId) {
            if ($this->ensurePractitionerWallet($practitionerId)) {
                $practitionerCount++;
            }
        }
        if ($practitionerCount > 0) {
            $this->line("  ✓ Created {$practitionerCount} practitioner wallets");
        }
    }

    /**
     * Get patient IDs associated with a tenant from central database
     */
    protected function getPatientIdsForTenant(string $tenantId)
    {
        return DB::connection('central')
            ->table('tenant_patients')
            ->where('tenant_id', $tenantId)
            ->pluck('patient_id');
    }

    /**
     * Get practitioner IDs associated with a tenant from central database
     */
    protected function getPractitionerIdsForTenant(string $tenantId)
    {
        return DB::connection('central')
            ->table('tenant_practitioners')
            ->where('tenant_id', $tenantId)
            ->pluck('practitioner_id');
    }

    /**
     * Ensure system (clinic) wallet exists
     */
    protected function ensureSystemWallet(): bool
    {
        $exists = DB::table('wallets')
            ->where('owner_type', 'system')
            ->whereNull('owner_id')
            ->where('singleton_key', 1)
            ->exists();

        if ($exists && ! $this->option('force')) {
            return false;
        }

        if ($exists && $this->option('force')) {
            DB::table('wallets')
                ->where('owner_type', 'system')
                ->whereNull('owner_id')
                ->where('singleton_key', 1)
                ->update([
                    'currency' => 'CAD',
                    'updated_at' => now(),
                ]);

            return false;
        }

        // Create new system wallet
        DB::table('wallets')->insert([
            'owner_type' => 'system',
            'owner_id' => null,
            'balance' => '0.0000',
            'singleton_key' => 1,
            'currency' => 'CAD',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->systemWalletsCreated++;

        return true;
    }

    /**
     * Ensure wallet exists for a patient
     */
    protected function ensurePatientWallet(int $patientId): bool
    {
        $exists = DB::table('wallets')
            ->where('owner_type', 'patient')
            ->where('owner_id', $patientId)
            ->exists();

        if ($exists && ! $this->option('force')) {
            return false;
        }

        if ($exists && $this->option('force')) {
            DB::table('wallets')
                ->where('owner_type', 'patient')
                ->where('owner_id', $patientId)
                ->update([
                    'currency' => 'PKR',
                    'updated_at' => now(),
                ]);

            return false;
        }

        // Create new patient wallet
        DB::table('wallets')->insert([
            'owner_type' => 'patient',
            'owner_id' => $patientId,
            'balance' => '0.0000',
            'singleton_key' => null,
            'currency' => 'PKR',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->patientWalletsCreated++;

        return true;
    }

    /**
     * Ensure wallet exists for a practitioner
     */
    protected function ensurePractitionerWallet(int $practitionerId): bool
    {
        $exists = DB::table('wallets')
            ->where('owner_type', 'practitioner')
            ->where('owner_id', $practitionerId)
            ->exists();

        if ($exists && ! $this->option('force')) {
            return false;
        }

        if ($exists && $this->option('force')) {
            DB::table('wallets')
                ->where('owner_type', 'practitioner')
                ->where('owner_id', $practitionerId)
                ->update([
                    'currency' => 'PKR',
                    'updated_at' => now(),
                ]);

            return false;
        }

        // Create new practitioner wallet
        DB::table('wallets')->insert([
            'owner_type' => 'practitioner',
            'owner_id' => $practitionerId,
            'balance' => '0.0000',
            'singleton_key' => null,
            'currency' => 'PKR',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->practitionerWalletsCreated++;

        return true;
    }

    /**
     * Display summary of operations
     */
    protected function displaySummary(): void
    {
        $totalCreated = $this->systemWalletsCreated + $this->patientWalletsCreated + $this->practitionerWalletsCreated;

        if ($totalCreated > 0) {
            $this->info("🎉 Created {$totalCreated} new wallets across {$this->tenantsProcessed} tenants");
            $this->line("   • System: {$this->systemWalletsCreated}");
            $this->line("   • Patient: {$this->patientWalletsCreated}");
            $this->line("   • Practitioner: {$this->practitionerWalletsCreated}");
        } else {
            $this->info("✅ All wallets already exist for {$this->tenantsProcessed} tenants");
            $this->line('   Use --force to update existing wallets');
        }

        $this->newLine();
        $this->line('💡 Tip: Use --tenants=clinic1,clinic2 to sync specific tenants');
    }
}
