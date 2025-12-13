<?php

// Script to link user to practitioner for calendar access
require_once 'vendor/autoload.php';

// Bootstrap Laravel
$app = require_once 'bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

echo "Link User to Practitioner\n";
echo "========================\n";

// Get user ID 1
$user = \App\Models\User::find(1);
if (! $user) {
    echo "❌ User ID 1 not found\n";
    exit;
}

echo "User: {$user->name} (ID: {$user->id})\n";

// Get practitioner ID 5 (who has appointments)
$practitioner = \App\Models\Practitioner::find(5);
if (! $practitioner) {
    echo "❌ Practitioner ID 5 not found\n";
    exit;
}

echo "Practitioner: {$practitioner->full_name} (ID: {$practitioner->id})\n";
echo 'Current user_id for this practitioner: '.($practitioner->user_id ?? 'NULL')."\n";

// Update practitioner to link to user ID 1
try {
    $practitioner->user_id = $user->id;
    $practitioner->save();

    echo "✅ Successfully linked user {$user->id} to practitioner {$practitioner->id}\n";

    // Verify the link
    $updatedPractitioner = \App\Models\Practitioner::find(5);
    echo "Verification - user_id is now: {$updatedPractitioner->user_id}\n";

} catch (\Exception $e) {
    echo '❌ Error linking user to practitioner: '.$e->getMessage()."\n";
}

echo "\nNow you can access the calendar as:\n";
echo "- User: {$user->name}\n";
echo "- Practitioner: {$practitioner->full_name}\n";
echo "- With appointments scheduled for tomorrow (2025-08-27)\n";
