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
        Schema::create('encounter_document_requests', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('encounter_id');
            $table->string('document_type'); // lab_result, imaging, prescription, etc.
            $table->string('title'); // e.g., "Blood Test Results", "X-Ray of Left Knee"
            $table->text('description')->nullable(); // Additional details about what's needed
            $table->string('priority')->default('normal'); // low, normal, high, urgent
            $table->string('status')->default('pending'); // pending, fulfilled, cancelled
            $table->unsignedBigInteger('requested_by_id')->nullable(); // User ID who requested
            $table->timestamp('requested_at')->nullable();
            $table->timestamp('fulfilled_at')->nullable();
            $table->unsignedBigInteger('fulfilled_by_document_id')->nullable(); // Link to uploaded document
            $table->text('notes')->nullable(); // Internal notes for the request
            $table->timestamps();

            // Simple indexes without constraints
            $table->index('encounter_id');
            $table->index('status');
            $table->index('document_type');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('encounter_document_requests');
    }
};
