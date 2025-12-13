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
        if (! Schema::hasTable('patient_invitations')) {
            Schema::create('patient_invitations', function (Blueprint $table) {
                $table->id();
                $table->string('tenant_id'); // Reference to tenants.id
                $table->unsignedBigInteger('patient_id'); // Reference to patients.id
                $table->string('email'); // Patient email for tracking
                $table->string('token')->unique(); // Unique invitation token
                $table->enum('status', ['pending', 'accepted', 'expired'])->default('pending');
                $table->timestamp('expires_at');
                $table->timestamp('sent_at')->nullable();
                $table->timestamp('accepted_at')->nullable();
                $table->timestamps();

                // Indexes for better performance
                $table->index(['tenant_id', 'patient_id']);
                $table->index('token');
                $table->index('email');
                $table->index('status');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('patient_invitations');
    }
};
