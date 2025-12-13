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
        Schema::dropIfExists('entity_references');
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::create('entity_references', function (Blueprint $table) {
            $table->id();
            $table->string('entity_type');
            $table->bigInteger('entity_id');
            $table->timestamp('first_accessed_at')->nullable();
            $table->timestamps();
        });
    }
};
