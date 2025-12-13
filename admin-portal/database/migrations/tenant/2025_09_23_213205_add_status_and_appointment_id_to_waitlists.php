<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('appointment_waitlists', function (Blueprint $table) {
            // Check if columns exist before adding them
            $columns = $this->getTableColumns('appointment_waitlists');

            // Add status column if it doesn't exist
            if (! in_array('status', $columns)) {
                $table->enum('status', ['waiting', 'offered', 'confirmed', 'expired', 'cancelled'])
                    ->default('waiting')
                    ->after('preferred_time');
            }

            // Add appointment_id column if it doesn't exist
            if (! in_array('appointment_id', $columns)) {
                $table->unsignedBigInteger('appointment_id')
                    ->nullable()
                    ->after('status')
                    ->comment('Links to appointment when patient is given a slot');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('appointment_waitlists', function (Blueprint $table) {
            $columns = $this->getTableColumns('appointment_waitlists');

            // Drop columns if they exist
            if (in_array('appointment_id', $columns)) {
                $table->dropColumn('appointment_id');
            }

            if (in_array('status', $columns)) {
                $table->dropColumn('status');
            }
        });
    }

    /**
     * Get table column names
     */
    private function getTableColumns(string $tableName): array
    {
        if (! Schema::hasTable($tableName)) {
            return [];
        }
        $columns = DB::select("DESCRIBE {$tableName}");

        return array_column($columns, 'Field');
    }
};
