<?php

namespace App\Console\Commands;

use App\Models\Patient;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class RegeneratePatientBlindIndexes extends Command
{
    protected $signature = 'patient:regenerate-blind-indexes';

    protected $description = 'Regenerate blind indexes for all Patient records';

    public function handle(): int
    {
        $this->info('Starting blind index regeneration for Patient model...');
        $this->newLine();

        // Step 1: Delete existing blind indexes
        $this->line('Step 1: Deleting existing Patient blind indexes...');
        $deletedCount = DB::table('blind_indexes')
            ->where('indexable_type', Patient::class)
            ->delete();
        $this->info("  ✓ Deleted {$deletedCount} existing blind indexes");
        $this->newLine();

        // Step 2: Regenerate blind indexes for all patients
        $this->line('Step 2: Regenerating blind indexes for all patients...');
        $patients = Patient::all();
        $this->info("  Found {$patients->count()} patients");

        $bar = $this->output->createProgressBar($patients->count());
        $bar->start();

        foreach ($patients as $patient) {
            $patient->updateBlindIndexes();
            $bar->advance();
        }

        $bar->finish();
        $this->newLine();
        $this->info('  ✓ Blind indexes regenerated for all patients');
        $this->newLine();

        // Step 3: Verify results
        $this->line('Step 3: Verifying blind indexes...');
        $indexCounts = DB::table('blind_indexes')
            ->where('indexable_type', Patient::class)
            ->selectRaw('indexable_id, count(*) as index_count')
            ->groupBy('indexable_id')
            ->get();

        $totalIndexes = DB::table('blind_indexes')
            ->where('indexable_type', Patient::class)
            ->count();

        $this->table(
            ['Patient ID', 'Blind Index Count'],
            $indexCounts->map(fn ($row) => [$row->indexable_id, $row->index_count])
        );

        $this->newLine();
        $this->info("✓ Total blind indexes created: {$totalIndexes}");
        $this->info('✓ Patient lookup should now work correctly!');
        $this->newLine();

        return self::SUCCESS;
    }
}
