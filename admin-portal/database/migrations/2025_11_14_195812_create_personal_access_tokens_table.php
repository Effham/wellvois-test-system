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
        $tableName = 'personal_access_tokens';

        if (! Schema::hasTable($tableName)) {
            // Table doesn't exist, create it with all columns
            Schema::create($tableName, function (Blueprint $table) {
                $table->id();
                $table->morphs('tokenable');
                $table->text('name');
                $table->string('token', 64)->unique();
                $table->text('abilities')->nullable();
                $table->timestamp('last_used_at')->nullable();
                $table->timestamp('expires_at')->nullable()->index();
                $table->timestamps();
            });
        } else {
            // Table exists, check and add missing columns
            $columns = $this->getTableColumns($tableName);
            $indexes = $this->getTableIndexes($tableName);

            Schema::table($tableName, function (Blueprint $table) use ($columns, $indexes) {
                if (! in_array('id', $columns)) {
                    $table->id()->first();
                }
                if (! in_array('tokenable_type', $columns)) {
                    $table->string('tokenable_type')->after('id');
                }
                if (! in_array('tokenable_id', $columns)) {
                    $table->unsignedBigInteger('tokenable_id')->after('tokenable_type');
                }
                if (! in_array('name', $columns)) {
                    $table->text('name')->after('tokenable_id');
                }
                if (! in_array('token', $columns)) {
                    $table->string('token', 64)->unique()->after('name');
                } elseif (! $this->hasUniqueIndex($indexes, 'token')) {
                    // Add unique constraint on token if column exists but constraint doesn't
                    $table->unique('token');
                }
                if (! in_array('abilities', $columns)) {
                    $table->text('abilities')->nullable()->after('token');
                }
                if (! in_array('last_used_at', $columns)) {
                    $table->timestamp('last_used_at')->nullable()->after('abilities');
                }
                if (! in_array('expires_at', $columns)) {
                    $table->timestamp('expires_at')->nullable()->after('last_used_at');
                }
                // Add index on expires_at if column exists but index doesn't
                if (in_array('expires_at', $columns) && ! $this->hasIndex($indexes, 'expires_at')) {
                    $table->index('expires_at');
                }
                if (! in_array('created_at', $columns)) {
                    $table->timestamp('created_at')->nullable()->after('expires_at');
                }
                if (! in_array('updated_at', $columns)) {
                    $table->timestamp('updated_at')->nullable()->after('created_at');
                }
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('personal_access_tokens');
    }

    /**
     * Get table column names
     */
    private function getTableColumns(string $tableName): array
    {
        if (! Schema::hasTable($tableName)) {
            return [];
        }

        $columns = DB::select("DESCRIBE {$tableName}");

        return array_column($columns, 'Field');
    }

    /**
     * Get table indexes with details
     */
    private function getTableIndexes(string $tableName): array
    {
        if (! Schema::hasTable($tableName)) {
            return [];
        }

        return DB::select("SHOW INDEXES FROM {$tableName}");
    }

    /**
     * Check if column has unique index
     */
    private function hasUniqueIndex(array $indexes, string $columnName): bool
    {
        foreach ($indexes as $index) {
            $indexArray = (array) $index;
            $colName = $indexArray['Column_name'] ?? $indexArray['column_name'] ?? null;
            $nonUnique = $indexArray['Non_unique'] ?? $indexArray['non_unique'] ?? null;

            if ($colName === $columnName && $nonUnique === 0) {
                return true;
            }
        }

        return false;
    }

    /**
     * Check if column has index
     */
    private function hasIndex(array $indexes, string $columnName): bool
    {
        foreach ($indexes as $index) {
            $indexArray = (array) $index;
            $colName = $indexArray['Column_name'] ?? $indexArray['column_name'] ?? null;

            if ($colName === $columnName) {
                return true;
            }
        }

        return false;
    }
};
