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
        Schema::table('notes', function (Blueprint $table) {
            // Remove column-based positioning fields since we're using DataTable with proper sorting
            $table->dropIndex(['user_id', 'column_index', 'position_in_column']);
            $table->dropColumn(['column_index', 'position_in_column']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('notes', function (Blueprint $table) {
            // Restore column-based positioning fields
            $table->integer('column_index')->default(0)->after('tags');
            $table->integer('position_in_column')->default(0)->after('column_index');
            $table->index(['user_id', 'column_index', 'position_in_column']);
        });
    }
};
