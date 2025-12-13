<?php

namespace App\Console\Commands;

use App\Models\Practitioner as TenantPractitioner;
use App\Models\Tenant;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class MigratePractitionerIdsToTenant extends Command
{
    protected $signature = 'practitioners:migrate-to-tenant-ids {--tenant=} {--dry-run}';

    protected $description = 'Migrate practitioner_id references from central IDs to tenant IDs in all tenant tables';

    public function handle(): int
    {
        $tenantId = $this->option('tenant');
        $dryRun = $this->option('dry-run');

        if ($dryRun) {
            $this->warn('DRY RUN MODE - No changes will be made');
        }

        if ($tenantId) {
            $tenants = Tenant::where('id', $tenantId)->get();
        } else {
            $tenants = Tenant::all();
        }

        foreach ($tenants as $tenant) {
            $this->info("Processing tenant: {$tenant->id}");

            tenancy()->initialize($tenant);

            try {
                // Get all tenant practitioners with their central_practitioner_id mapping
                $tenantPractitioners = TenantPractitioner::select('id', 'central_practitioner_id')->get();

                if ($tenantPractitioners->isEmpty()) {
                    $this->warn("No practitioners found for tenant {$tenant->id}, skipping...");
                    tenancy()->end();

                    continue;
                }

                // Create mapping: central_practitioner_id => tenant_practitioner_id
                $centralToTenantMap = $tenantPractitioners->pluck('id', 'central_practitioner_id')->toArray();

                // Also create a set of all tenant practitioner IDs for validation
                $tenantPractitionerIds = $tenantPractitioners->pluck('id')->toArray();

                $this->info("Found {$tenantPractitioners->count()} practitioners to map");

                // Tables to migrate with their practitioner_id column
                $tablesToMigrate = [
                    'appointment_practitioner' => 'practitioner_id',
                    'location_practitioners' => 'practitioner_id',
                    'practitioner_ratings' => 'practitioner_id',
                    'practitioner_tenant_settings' => 'practitioner_id',
                    'practitioner_portal_availability' => 'practitioner_id',
                    'practitioner_services' => 'practitioner_id',
                ];

                $totalUpdated = 0;

                foreach ($tablesToMigrate as $tableName => $columnName) {
                    if (! Schema::hasTable($tableName)) {
                        $this->warn("Table {$tableName} does not exist, skipping...");

                        continue;
                    }

                    // Get all rows with practitioner_id that need to be updated
                    $rows = DB::table($tableName)
                        ->whereNotNull($columnName)
                        ->get();

                    if ($rows->isEmpty()) {
                        $this->info("  Table {$tableName}: No rows to update");

                        continue;
                    }

                    $updatedCount = 0;
                    $skippedCount = 0;
                    $alreadyTenantIdCount = 0;

                    foreach ($rows as $row) {
                        $currentPractitionerId = $row->{$columnName};

                        // Check if this ID is already a tenant practitioner ID
                        if (in_array($currentPractitionerId, $tenantPractitionerIds)) {
                            $alreadyTenantIdCount++;

                            continue;
                        }

                        // Check if we have a mapping for this central practitioner ID
                        if (! isset($centralToTenantMap[$currentPractitionerId])) {
                            $this->warn("  Table {$tableName}: No tenant practitioner found for central ID {$currentPractitionerId} (row ID: {$row->id})");
                            $skippedCount++;

                            continue;
                        }

                        $tenantPractitionerId = $centralToTenantMap[$currentPractitionerId];

                        if (! $dryRun) {
                            DB::table($tableName)
                                ->where('id', $row->id)
                                ->update([$columnName => $tenantPractitionerId]);
                        }

                        $updatedCount++;
                    }

                    $statusParts = [];
                    if ($updatedCount > 0) {
                        $statusParts[] = "Updated {$updatedCount} rows";
                    }
                    if ($alreadyTenantIdCount > 0) {
                        $statusParts[] = "{$alreadyTenantIdCount} already using tenant IDs";
                    }
                    if ($skippedCount > 0) {
                        $statusParts[] = "Skipped {$skippedCount} rows (no mapping found)";
                    }

                    $this->info("  Table {$tableName}: ".(! empty($statusParts) ? implode(', ', $statusParts) : 'No changes needed'));
                    $totalUpdated += $updatedCount;
                }

                $this->info("✓ Completed tenant: {$tenant->id} - Total rows updated: {$totalUpdated}\n");
            } catch (\Exception $e) {
                $this->error("✗ Error for tenant {$tenant->id}: {$e->getMessage()}\n");
                $this->error($e->getTraceAsString());
            }

            tenancy()->end();
        }

        if ($dryRun) {
            $this->warn('DRY RUN COMPLETE - No changes were made');
        } else {
            $this->info('All done!');
        }

        return 0;
    }
}
