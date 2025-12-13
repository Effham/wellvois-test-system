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
        if (! Schema::hasTable('consent_definitions')) {
            Schema::create('consent_definitions', function (Blueprint $table) {
                $table->id();

                // Consent Text and Versioning
                $table->string('key')->comment('Programmatic identifier (e.g., hipaa_release)');
                $table->unsignedInteger('version')->default(1)->comment('Tracks changes to the content over time.');
                $table->string('heading');
                $table->json('body_json')->comment('Stores the rich text content (HTML/Markdown).');
                $table->boolean('is_active')->default(true)->comment('Is this the current active version for its key?');

                $table->timestamps();

                // Unique Constraint: Ensures no duplicate versions of the same consent key
                $table->unique(['key', 'version']);
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('consent_definitions');
    }
};
