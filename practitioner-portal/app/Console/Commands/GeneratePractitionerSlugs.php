<?php

namespace App\Console\Commands;

use App\Models\Practitioner;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class GeneratePractitionerSlugs extends Command
{
    /**
     * The name and signature of the console command.
     */
    protected $signature = 'practitioners:generate-slugs';

    /**
     * The console command description.
     */
    protected $description = 'Generate unique slugs for practitioners where slug is NULL.';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $this->info('🔍 Starting slug generation for practitioners without a slug...');
        Log::info('GeneratePractitionerSlugs: started', ['timestamp' => now()->toDateTimeString()]);

        $count = 0;
        $practitioners = Practitioner::whereNull('slug')->get();

        if ($practitioners->isEmpty()) {
            $this->info('✅ All practitioners already have slugs.');
            Log::info('GeneratePractitionerSlugs: no missing slugs found');

            return Command::SUCCESS;
        }

        foreach ($practitioners as $practitioner) {
            $base = Str::slug(trim(($practitioner->first_name ?? '').' '.($practitioner->last_name ?? '')));
            if ($base === '') {
                $emailPrefix = isset($practitioner->email)
                    ? strstr($practitioner->email, '@', true)
                    : Str::random(6);
                $base = Str::slug($emailPrefix);
            }

            // Find similar slugs to determine suffix
            $existing = Practitioner::where('slug', 'LIKE', $base.'%')
                ->pluck('slug')
                ->toArray();

            $slug = $base;
            if (in_array($slug, $existing, true)) {
                $max = 1;
                foreach ($existing as $s) {
                    if (preg_match('/^'.preg_quote($base, '/').'-(\d+)$/', $s, $m)) {
                        $max = max($max, (int) $m[1]);
                    }
                }
                $slug = $base.'-'.($max + 1);
            }

            $practitioner->slug = $slug;
            $practitioner->saveQuietly();
            $count++;

            $this->line("✅ [{$practitioner->id}] {$practitioner->first_name} {$practitioner->last_name} → {$slug}");

            Log::info('GeneratePractitionerSlugs: created slug', [
                'practitioner_id' => $practitioner->id,
                'slug' => $slug,
                'timestamp' => now()->toDateTimeString(),
            ]);
        }

        $this->info("🎉 Completed! {$count} slugs generated.");
        Log::info('GeneratePractitionerSlugs: completed', [
            'count' => $count,
            'timestamp' => now()->toDateTimeString(),
        ]);

        return Command::SUCCESS;
    }
}
