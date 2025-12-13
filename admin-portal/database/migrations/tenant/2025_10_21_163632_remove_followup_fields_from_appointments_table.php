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
            $table->dropColumn([
                'send_intake_form',
                'send_appointment_confirmation',
                'add_to_calendar',
                'tag_with_referral_source',
            ]);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('appointments', function (Blueprint $table) {
            $table->boolean('send_intake_form')->default(true);
            $table->boolean('send_appointment_confirmation')->default(true);
            $table->boolean('add_to_calendar')->default(true);
            $table->boolean('tag_with_referral_source')->default(true);
        });
    }
};
