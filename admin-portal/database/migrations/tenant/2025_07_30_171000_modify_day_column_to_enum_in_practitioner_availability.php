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
        // First, clean up existing data to match enum values
        DB::table('practitioner_availability')->update([
            'day' => DB::raw('LOWER(day)'),
        ]);

        // Handle any non-standard day names
        $dayMappings = [
            'mon' => 'monday',
            'tue' => 'tuesday',
            'wed' => 'wednesday',
            'thu' => 'thursday',
            'fri' => 'friday',
            'sat' => 'saturday',
            'sun' => 'sunday',
        ];

        foreach ($dayMappings as $old => $new) {
            DB::table('practitioner_availability')
                ->where('day', $old)
                ->update(['day' => $new]);
        }

        // Delete any rows with invalid day values
        DB::table('practitioner_availability')
            ->whereNotIn('day', [
                'monday', 'tuesday', 'wednesday', 'thursday',
                'friday', 'saturday', 'sunday',
            ])
            ->delete();

        Schema::table('practitioner_availability', function (Blueprint $table) {
            // Change the day column from string to enum
            $table->enum('day', [
                'monday',
                'tuesday',
                'wednesday',
                'thursday',
                'friday',
                'saturday',
                'sunday',
            ])->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('practitioner_availability', function (Blueprint $table) {
            // Revert back to string
            $table->string('day')->change();
        });
    }
};
