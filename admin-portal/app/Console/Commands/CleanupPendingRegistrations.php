<?php

namespace App\Console\Commands;

use App\Models\PendingRegistration;
use Illuminate\Console\Command;

class CleanupPendingRegistrations extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'registrations:cleanup';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Clean up expired pending registrations';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $deleted = PendingRegistration::cleanupExpired();

        $this->info("Cleaned up {$deleted} expired pending registration(s)");

        return self::SUCCESS;
    }
}
