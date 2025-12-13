<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // 1) Add the column as nullable (no default at DB level)
        Schema::table('patients', function (Blueprint $table) {
            $table->json('meta_data')->nullable(); // adjust position if you like
        });

        Schema::table('practitioners', function (Blueprint $table) {
            $table->json('meta_data')->nullable();
        });

        // 2) Backfill existing rows with an empty object {}
        // Use JSON_OBJECT() so it’s typed as JSON rather than a string
        DB::table('patients')->whereNull('meta_data')->update(['meta_data' => DB::raw('JSON_OBJECT()')]);
        DB::table('practitioners')->whereNull('meta_data')->update(['meta_data' => DB::raw('JSON_OBJECT()')]);

        // 3) (Optional) If you want NOT NULL at DB level (and your app always sends a value),
        // you can alter the columns after backfill. This still avoids a DEFAULT.
        // Commented out because inserts without meta_data would then fail unless your app sets it.
        /*
        Schema::table('patients', function (Blueprint $table) {
            $table->json('meta_data')->nullable(false)->change();
        });

        Schema::table('practitioners', function (Blueprint $table) {
            $table->json('meta_data')->nullable(false)->change();
        });
        */
    }

    public function down(): void
    {
        Schema::table('patients', function (Blueprint $table) {
            $table->dropColumn('meta_data');
        });

        Schema::table('practitioners', function (Blueprint $table) {
            $table->dropColumn('meta_data');
        });
    }
};
