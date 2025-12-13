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

            // Add offered_at column if it doesn't exist
            if (! in_array('offered_at', $columns)) {
                $table->timestamp('offered_at')->nullable()->after('appointment_id');
            }

            // Add expires_at column if it doesn't exist
            if (! in_array('expires_at', $columns)) {
                $table->timestamp('expires_at')->nullable()->after('offered_at');
            }

            // Add acceptance_token column if it doesn't exist
            if (! in_array('acceptance_token', $columns)) {
                $table->string('acceptance_token')->nullable()->after('expires_at');
            }

            // Add notes column if it doesn't exist
            if (! in_array('notes', $columns)) {
                $table->text('notes')->nullable()->after('acceptance_token');
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
            if (in_array('notes', $columns)) {
                $table->dropColumn('notes');
            }

            if (in_array('acceptance_token', $columns)) {
                $table->dropColumn('acceptance_token');
            }

            if (in_array('expires_at', $columns)) {
                $table->dropColumn('expires_at');
            }

            if (in_array('offered_at', $columns)) {
                $table->dropColumn('offered_at');
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
