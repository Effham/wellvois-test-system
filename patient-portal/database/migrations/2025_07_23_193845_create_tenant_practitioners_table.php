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
        Schema::create('tenant_practitioners', function (Blueprint $table) {
            $table->id();
            $table->string('tenant_id'); // Reference to tenants.id
            $table->unsignedBigInteger('practitioner_id'); // Reference to practitioners.id
            $table->boolean('can_edit_professional_details')->default(true); // Lock after first professional detail added
            $table->timestamps();

            // Ensure unique combination per tenant per practitioner
            $table->unique(['tenant_id', 'practitioner_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('tenant_practitioners');
    }
};
