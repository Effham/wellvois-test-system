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
        Schema::create('entity_references', function (Blueprint $table) {
            $table->id();
            $table->string('entity_type'); // 'patient', 'practitioner', etc.
            $table->bigInteger('entity_id'); // Central DB entity ID
            $table->timestamp('first_accessed_at')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('entity_references');
    }
};
