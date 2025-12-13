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
        Schema::create('entity_consents', function (Blueprint $table) {
            $table->id();

            // Link to the specific content version that was accepted
            $table->foreignId('consent_version_id')
                ->constrained('consent_versions')
                ->onDelete('restrict') // Crucial: don't delete an accepted version
                ->comment('Links to the specific version of the consent text accepted.');

            // The Acceptance Data
            $table->timestamp('consented_at')->comment('The exact time the entity accepted the consent.');

            // Polymorphic Relationship (Who accepted it?)
            // Creates 'consentable_id' (unsignedBigInteger) and 'consentable_type' (string)
            $table->morphs('consentable');

            // Unique Index: Ensures an entity only accepts a specific version once.
            $table->unique(
                ['consentable_id', 'consentable_type', 'consent_version_id'],
                'consentable_version_unique'
            );
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('entity_consents');
    }
};
