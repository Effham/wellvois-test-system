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
            // Check if columns exist before dropping them
            $columns = $this->getTableColumns('appointment_waitlists');

            // Drop service-related fields from waitlists (appointments table will handle these)
            $fieldsToRemove = [
                'service_type',
                'service_name',
                'service_id',
                'location_id',
                'mode',
                'practitioner_ids',
            ];

            foreach ($fieldsToRemove as $field) {
                if (in_array($field, $columns)) {
                    $table->dropColumn($field);
                }
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('appointment_waitlists', function (Blueprint $table) {
            // Check if columns exist before adding them back
            $columns = $this->getTableColumns('appointment_waitlists');

            // Add back the service fields if they don't exist
            if (! in_array('service_type', $columns)) {
                $table->string('service_type')->after('patient_id');
            }

            if (! in_array('service_name', $columns)) {
                $table->string('service_name')->after('service_type');
            }

            if (! in_array('service_id', $columns)) {
                $table->unsignedBigInteger('service_id')->after('service_name');
            }

            if (! in_array('location_id', $columns)) {
                $table->unsignedBigInteger('location_id')->nullable()->after('service_id');
            }

            if (! in_array('mode', $columns)) {
                $table->enum('mode', ['in-person', 'virtual', 'hybrid'])->after('location_id');
            }

            if (! in_array('practitioner_ids', $columns)) {
                $table->json('practitioner_ids')->nullable()->after('mode');
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
