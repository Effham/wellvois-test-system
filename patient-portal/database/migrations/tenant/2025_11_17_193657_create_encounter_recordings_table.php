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
        Schema::create('encounter_recordings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('encounter_id')->constrained('encounters')->onDelete('cascade');
            $table->string('s3_key')->comment('S3 key/path for the recording file');
            $table->string('file_name')->nullable()->comment('Original filename');
            $table->string('mime_type')->nullable()->comment('MIME type of the recording');
            $table->bigInteger('file_size')->nullable()->comment('File size in bytes');
            $table->integer('duration_seconds')->nullable()->comment('Duration of the recording in seconds');
            $table->text('metadata')->nullable()->comment('Additional metadata as JSON');
            $table->timestamps();

            $table->index('encounter_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('encounter_recordings');
    }
};
