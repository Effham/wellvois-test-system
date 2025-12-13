<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Delete any existing is_tenant_creation_complete records from organization_settings
        // This field has been moved to tenant_user table (central DB)
        try {
            $deleted = DB::table('organization_settings')
                ->whereIn('key', ['is_tenant_creation_complete', 'IsTenantCreationComplete'])
                ->delete();

            if ($deleted > 0) {
                Log::info('Removed is_tenant_creation_complete from organization_settings', [
                    'deleted_count' => $deleted,
                    'tenant_id' => tenant('id'),
                ]);
            }
        } catch (\Exception $e) {
            // If table doesn't exist or column doesn't exist, that's fine - migration is safe
            Log::warning('Could not remove is_tenant_creation_complete from organization_settings', [
                'error' => $e->getMessage(),
                'tenant_id' => tenant('id'),
            ]);
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // No need to restore - this field should not exist in organization_settings
        // It belongs in tenant_user table (central DB)
    }
};
