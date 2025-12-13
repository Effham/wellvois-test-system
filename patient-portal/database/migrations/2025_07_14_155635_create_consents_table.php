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
            $table->string('entity_type');
            $table->bigInteger('entity_id');
            $table->string('tenant_id');

            $table->foreignId('user_id')->nullable()->constrained('users')->onDelete('set null');
            $table->json('permitted_columns')->nullable();

            // Consent details
            $table->enum('consent_type', ['explicit', 'auto', 'emergency'])->default('auto');
            $table->enum('consent_status', ['pending', 'granted', 'revoked', 'expired'])->default('granted');
            $table->timestamp('consented_at')->nullable();
            $table->timestamp('revoked_at')->nullable();
            $table->text('notes')->nullable();
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
