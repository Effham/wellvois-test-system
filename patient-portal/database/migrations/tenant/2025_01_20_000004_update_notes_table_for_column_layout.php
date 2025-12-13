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
            // Remove old position and z_index columns
            $table->dropColumn(['position', 'z_index']);

            // Add new column-based positioning
            $table->integer('column_index')->default(0)->after('tags'); // Which column (0, 1, 2, etc.)
            $table->integer('position_in_column')->default(0)->after('column_index'); // Position within that column

            // Add index for efficient querying
            $table->index(['user_id', 'column_index', 'position_in_column']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('notes', function (Blueprint $table) {
            // Remove new columns
            $table->dropIndex(['user_id', 'column_index', 'position_in_column']);
            $table->dropColumn(['column_index', 'position_in_column']);

            // Restore old columns
            $table->json('position')->nullable();
            $table->integer('z_index')->default(1);
        });
    }
};
