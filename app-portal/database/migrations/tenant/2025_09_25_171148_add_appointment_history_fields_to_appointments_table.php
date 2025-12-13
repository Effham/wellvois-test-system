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
        Schema::table('appointments', function (Blueprint $table) {
            // Add parent appointment ID - references the previous appointment in the chain
            $table->unsignedBigInteger('parent_appointment_id')->nullable()->after('id');
            $table->foreign('parent_appointment_id')->references('id')->on('appointments')->onDelete('set null');

            // Add root appointment ID - references the first appointment in the chain
            $table->unsignedBigInteger('root_appointment_id')->nullable()->after('parent_appointment_id');
            $table->foreign('root_appointment_id')->references('id')->on('appointments')->onDelete('set null');

            // Add index for better performance when querying appointment history
            $table->index(['root_appointment_id', 'created_at']);
            $table->index(['parent_appointment_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('appointments', function (Blueprint $table) {
            // Drop indexes first
            $table->dropIndex(['root_appointment_id', 'created_at']);
            $table->dropIndex(['parent_appointment_id']);

            // Drop foreign keys and columns
            $table->dropForeign(['parent_appointment_id']);
            $table->dropForeign(['root_appointment_id']);
            $table->dropColumn(['parent_appointment_id', 'root_appointment_id']);
        });
    }
};
