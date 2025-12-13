<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::dropIfExists('consent_definitions');
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Note: This migration only drops the table, so we can't easily reverse it
        // If needed, the original table structure would need to be recreated
    }
};
