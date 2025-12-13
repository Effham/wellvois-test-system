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
        Schema::create('consent_versions', function (Blueprint $table) {
            $table->id();

            // Foreign Key to the document type
            $table->foreignId('consent_id')
                ->constrained('consents')
                ->onDelete('cascade') // If a consent is deleted, all versions should go
                ->comment('Links to the overarching consent document.');

            // Versioning and Content
            $table->unsignedInteger('version')->default(1);
            $table->json('consent_body')->comment('The full text content, typically HTML/JSON.');
            $table->enum('status', ['DRAFT', 'ACTIVE', 'INACTIVE'])->default('DRAFT');

            $table->timestamps();

            // Composite Unique Index: Enforces one unique version number per document key
            $table->unique(['consent_id', 'version']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('consent_versions');
    }
};
