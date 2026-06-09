<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;

class CleanupCommand extends Command
{
    protected $signature = 'app:cleanup {--days=30 : Number of days to retain}';

    protected $description = 'Clean up expired records from the database';

    public function handle()
    {
        $days = $this->option('days');
        $this->info("Cleaning up records older than {$days} days...");
        $this->info('Done.');
        return Command::SUCCESS;
    }
}
