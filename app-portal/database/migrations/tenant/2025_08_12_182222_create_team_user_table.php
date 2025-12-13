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
        Schema::create('team_user', function (Blueprint $table) {
            $table->id();
            $table->foreignId('team_id')->constrained()->onDelete('cascade');
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->string('role')->default('member'); // 'member', 'leader', 'admin'
            $table->boolean('is_active')->default(true); // User active in team
            $table->timestamp('joined_at')->nullable(); // When user joined team
            $table->json('permissions')->nullable(); // Team-specific permissions
            $table->timestamps();

            $table->unique(['team_id', 'user_id']); // Prevent duplicate memberships
            $table->index(['team_id', 'is_active']);
            $table->index(['user_id', 'is_active']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('team_user');
    }
};
