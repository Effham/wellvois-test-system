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

        Schema::table('practitioners', function (Blueprint $table) {
            // Change encrypted fields to TEXT to accommodate CipherSweet encryption
            // Encrypted data is much longer than plain text
            $table->text('first_name')->nullable()->change();
            $table->text('last_name')->nullable()->change();
            $table->text('title')->nullable()->change();
            $table->text('phone_number')->nullable()->change();
            $table->text('extension')->nullable()->change();
            $table->text('gender')->nullable()->change();
            $table->text('pronoun')->nullable()->change();
            $table->text('license_number')->nullable()->change();
        });

        // Add unique index back with length specification for TEXT column
        // MySQL requires a length prefix for TEXT columns in indexes

    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Drop the TEXT-based unique index

        Schema::table('practitioners', function (Blueprint $table) {
            $table->string('first_name')->nullable()->change();
            $table->string('last_name')->nullable()->change();
            $table->string('title')->nullable()->change();
            $table->string('phone_number')->nullable()->change();
            $table->string('extension')->nullable()->change();
            $table->string('gender')->nullable()->change();
            $table->string('pronoun')->nullable()->change();
            $table->string('license_number')->nullable()->change();
        });

        // Add back the standard unique index on varchar column

    }
};
