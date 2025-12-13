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
        Schema::table('patients', function (Blueprint $table) {
            $table->enum('registration_status', ['Requested', 'pending_invitation', 'Active', 'Rejected'])
                ->default('Active')
                ->after('is_active')
                ->index();
            $table->timestamp('requested_at')->nullable()->after('registration_status');
            $table->timestamp('approved_at')->nullable()->after('requested_at');
            $table->unsignedBigInteger('approved_by')->nullable()->after('approved_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('patients', function (Blueprint $table) {
            $table->dropColumn(['registration_status', 'requested_at', 'approved_at', 'approved_by']);
        });
    }
};
