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
        // Drop team_user table first (has foreign key to teams)
        Schema::dropIfExists('team_user');

        // Then drop teams table
        Schema::dropIfExists('teams');
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Recreate teams table
        Schema::create('teams', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->text('description')->nullable();
            $table->string('color')->default('#3B82F6');
            $table->boolean('is_active')->default(true);
            $table->foreignId('created_by')->constrained('users')->onDelete('cascade');
            $table->json('settings')->nullable();
            $table->timestamps();

            $table->index('name');
            $table->index('is_active');
            $table->index('created_by');
        });

        // Recreate team_user table
        Schema::create('team_user', function (Blueprint $table) {
            $table->id();
            $table->foreignId('team_id')->constrained()->onDelete('cascade');
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->string('role')->default('member');
            $table->boolean('is_active')->default(true);
            $table->timestamp('joined_at')->nullable();
            $table->json('permissions')->nullable();
            $table->timestamps();

            $table->unique(['team_id', 'user_id']);
            $table->index(['team_id', 'is_active']);
            $table->index(['user_id', 'is_active']);
        });
    }
};
