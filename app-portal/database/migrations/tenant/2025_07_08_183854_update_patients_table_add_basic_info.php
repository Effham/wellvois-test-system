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
            // Add new demographic fields
            $table->string('first_name')->after('user_id');
            $table->string('last_name')->after('first_name');
            $table->string('gender')->nullable()->after('last_name');
            $table->string('phone', 20)->nullable()->after('gender');
            $table->string('email')->nullable()->after('phone');
            $table->text('address')->nullable()->after('email');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('patients', function (Blueprint $table) {
            // Drop the newly added columns if rolling back
            $table->dropColumn([
                'first_name',
                'last_name',
                'gender',
                'phone',
                'email',
                'address',
            ]);
        });
    }
};
