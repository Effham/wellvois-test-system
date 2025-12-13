<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('practitioner_availability', function (Blueprint $table) {
            // location_id already exists from previous migration, but let's ensure it's there
            if (! Schema::hasColumn('practitioner_availability', 'location_id')) {
                $table->unsignedBigInteger('location_id')->after('practitioner_id');
            }

            // Add unique composite constraint for practitioner and location
            // Note: Using JSON availability_schedule, so we ensure one record per practitioner per location
            if (! $this->hasUniqueIndex('practitioner_availability', ['practitioner_id', 'location_id'])) {
                $table->unique(['practitioner_id', 'location_id'], 'unique_practitioner_location_availability');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('practitioner_availability', function (Blueprint $table) {
            // Drop the unique constraint
            if ($this->hasUniqueIndex('practitioner_availability', ['practitioner_id', 'location_id'])) {
                $table->dropUnique('unique_practitioner_location_availability');
            }
        });
    }

    /**
     * Check if a unique index exists on the given table and columns
     */
    private function hasUniqueIndex(string $table, array $columns): bool
    {
        try {
            $indexes = Schema::getConnection()->getDoctrineSchemaManager()->listTableIndexes($table);
            foreach ($indexes as $index) {
                if ($index->isUnique() && $index->getColumns() === $columns) {
                    return true;
                }
            }
        } catch (\Exception $e) {
            // If we can't check, assume it doesn't exist
        }

        return false;
    }
};
