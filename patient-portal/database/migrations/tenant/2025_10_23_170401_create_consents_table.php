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
        Schema::create('consents', function (Blueprint $table) {
            $table->id();

            // Document Identifier
            $table->string('key')->unique()->comment('Programmatic key (e.g., privacy_policy)');
            $table->string('title')->comment('Human-readable title (e.g., Privacy Policy)');

            // Define allowed entities for this consent type
            $table->enum('entity_type', ['USER', 'PATIENT', 'PRACTITIONER'])
                ->comment('The type of entity that can accept this consent.');

            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('consents');
    }
};
