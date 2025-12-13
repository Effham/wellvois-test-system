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
        Schema::create('encounter_documents', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('encounter_id');
            $table->string('original_name');
            $table->string('file_name');
            $table->string('file_path');
            $table->string('mime_type');
            $table->unsignedBigInteger('file_size');
            $table->string('uploaded_by_type');
            $table->unsignedBigInteger('uploaded_by_id');
            $table->text('description')->nullable();
            $table->enum('document_type', ['imaging', 'lab_result', 'prescription', 'report', 'consent', 'additional', 'other'])->default('other');
            $table->unsignedBigInteger('document_request_id')->nullable(); // Link to specific request
            $table->timestamps();

            $table->index('encounter_id');
            $table->index(['uploaded_by_type', 'uploaded_by_id']);
            $table->index('document_type');
            $table->index('document_request_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('encounter_documents');
    }
};
