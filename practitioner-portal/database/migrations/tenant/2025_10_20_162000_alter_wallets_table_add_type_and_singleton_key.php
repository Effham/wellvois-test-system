<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Get the database name
        $database = DB::connection()->getDatabaseName();

        // Check if foreign key exists and drop it
        $foreignKeyExists = DB::select("
            SELECT CONSTRAINT_NAME 
            FROM information_schema.KEY_COLUMN_USAGE 
            WHERE TABLE_SCHEMA = ? 
            AND TABLE_NAME = 'wallets' 
            AND COLUMN_NAME = 'user_id' 
            AND CONSTRAINT_NAME LIKE '%foreign%'
        ", [$database]);

        if (! empty($foreignKeyExists)) {
            DB::statement('ALTER TABLE wallets DROP FOREIGN KEY '.$foreignKeyExists[0]->CONSTRAINT_NAME);
        }

        // Check if unique constraint exists and drop it
        $uniqueKeyExists = DB::select("
            SELECT CONSTRAINT_NAME 
            FROM information_schema.TABLE_CONSTRAINTS 
            WHERE TABLE_SCHEMA = ? 
            AND TABLE_NAME = 'wallets' 
            AND CONSTRAINT_TYPE = 'UNIQUE' 
            AND CONSTRAINT_NAME LIKE '%user_id%'
        ", [$database]);

        if (! empty($uniqueKeyExists)) {
            DB::statement('ALTER TABLE wallets DROP INDEX '.$uniqueKeyExists[0]->CONSTRAINT_NAME);
        }

        // Now make the changes
        Schema::table('wallets', function (Blueprint $table) {
            // Add type enum column (clinic or user), default to user - only if not exists
            if (! Schema::hasColumn('wallets', 'type')) {
                $table->enum('type', ['clinic', 'user'])->default('user')->after('id');
            }

            // Make user_id nullable since clinic wallet won't have a user_id
            $table->unsignedBigInteger('user_id')->nullable()->change();

            // Update balance to decimal(64, 2)
            $table->decimal('balance', 64, 2)->default(0.00)->change();

            // Add singleton_key for clinic wallet (nullable and unique) - only if not exists
            if (! Schema::hasColumn('wallets', 'singleton_key')) {
                $table->integer('singleton_key')->nullable()->unique()->after('balance');
            }

            // Re-add the foreign key constraint (now user_id is nullable)
            $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('wallets', function (Blueprint $table) {
            // Drop the foreign key
            $table->dropForeign(['user_id']);

            // Drop new columns
            $table->dropColumn(['type', 'singleton_key']);

            // Revert user_id to not nullable
            $table->unsignedBigInteger('user_id')->nullable(false)->change();

            // Revert balance size
            $table->decimal('balance', 10, 2)->default(0.00)->change();

            // Re-add unique constraint
            $table->unique('user_id');

            // Re-add foreign key
            $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
        });
    }
};
