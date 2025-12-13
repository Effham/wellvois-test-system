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
        Schema::create('locations', function (Blueprint $table) {
            $table->id();
            $table->string('name'); // Location Name
            $table->string('timezone'); // Timezone
            $table->string('address_lookup'); // Address Lookup
            $table->string('street_address'); // Street Address
            $table->string('apt_suite_unit')->nullable(); // Apt/Suite/Unit No. (optional)
            $table->string('city'); // City
            $table->string('postal_zip_code'); // Postal/ZIP Code
            $table->string('province'); // Province
            $table->string('phone_number'); // Phone Number
            $table->string('email_address'); // Email Address
            $table->boolean('is_active')->default(true); // Status (active/inactive)
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('locations');
    }
};
