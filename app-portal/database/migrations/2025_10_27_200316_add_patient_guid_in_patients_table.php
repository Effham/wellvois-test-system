<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('patients', function (Blueprint $table) {
            $table->uuid('uid')->nullable()->after('id');
        });

        // 2) Backfill in batches WITHOUT using DB UUID() (replication-safe)
        // Use the query builder (not Eloquent) to avoid model events.
        DB::table('patients')
            ->whereNull('uid')
            ->orderBy('id')               // required for chunkById
            ->select('id')                // keep payload tiny
            ->chunkById(1000, function ($rows) {
                foreach ($rows as $row) {
                    DB::table('patients')
                        ->where('id', $row->id)
                        ->update(['uid' => (string) Str::uuid()]);
                }
            });

        // 3) Enforce NOT NULL + UNIQUE (add index after data is clean)
        Schema::table('patients', function (Blueprint $table) {
            $table->uuid('uid')->nullable(false)->change();
            $table->unique('uid');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('patients', function (Blueprint $table) {
            // drop the unique index first, then the column
            $table->dropUnique(['uid']);
            $table->dropColumn('uid');
        });
    }
};
