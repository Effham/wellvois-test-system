<?php

namespace App\Services;

use App\Models\Tenant\License;
use Illuminate\Support\Facades\Log;
use Laravel\Cashier\Subscription\SubscriptionItem;

class LicenseService
{
    /**
     * Create licenses for a subscription item based on its quantity
     * Also handles quantity decreases by revoking excess licenses
     */
    public function createLicensesForSubscriptionItem(SubscriptionItem $subscriptionItem): void
    {
        if (! $subscriptionItem->quantity || $subscriptionItem->quantity <= 0) {
            Log::info('No licenses to create - subscription item has no quantity', [
                'subscription_item_id' => $subscriptionItem->id,
                'quantity' => $subscriptionItem->quantity,
            ]);

            // If quantity is 0, revoke all licenses for this subscription item
            $this->revokeAllLicensesForSubscriptionItem($subscriptionItem);

            return;
        }

        // Get existing licenses for this subscription item
        $existingLicenses = License::where('subscription_item_id', $subscriptionItem->id)->get();
        $existingCount = $existingLicenses->count();
        $targetQuantity = $subscriptionItem->quantity;

        // If we have the exact number of licenses, do nothing
        if ($existingCount === $targetQuantity) {
            Log::info('License count matches subscription quantity', [
                'subscription_item_id' => $subscriptionItem->id,
                'quantity' => $targetQuantity,
                'existing_count' => $existingCount,
            ]);

            return;
        }

        // If we need more licenses (quantity increased)
        if ($existingCount < $targetQuantity) {
            $licensesToCreate = $targetQuantity - $existingCount;
            $licensesCreated = 0;

            for ($i = 0; $i < $licensesToCreate; $i++) {
                License::create([
                    'subscription_item_id' => $subscriptionItem->id,
                    'license_key' => License::generateLicenseKey(),
                    'status' => 'available',
                ]);
                $licensesCreated++;
            }

            Log::info('Additional licenses created for subscription item', [
                'subscription_item_id' => $subscriptionItem->id,
                'quantity' => $targetQuantity,
                'existing_count' => $existingCount,
                'licenses_created' => $licensesCreated,
            ]);
        } else {
            // Quantity decreased - we have more licenses than needed
            $excessCount = $existingCount - $targetQuantity;

            Log::info('Subscription quantity decreased - revoking excess licenses', [
                'subscription_item_id' => $subscriptionItem->id,
                'old_quantity' => $existingCount,
                'new_quantity' => $targetQuantity,
                'excess_count' => $excessCount,
            ]);

            // Revoke excess licenses, starting with unassigned ones
            $this->revokeExcessLicenses($subscriptionItem, $excessCount);
        }
    }

    /**
     * Revoke excess licenses when subscription quantity decreases
     * Priority: Unassigned licenses first, then oldest assigned licenses
     */
    private function revokeExcessLicenses(SubscriptionItem $subscriptionItem, int $excessCount): void
    {
        // Get all licenses for this subscription item, ordered by status and creation date
        // Priority: available licenses first, then assigned licenses (oldest first)
        $licensesToRevoke = License::where('subscription_item_id', $subscriptionItem->id)
            ->orderByRaw("CASE WHEN status = 'available' THEN 0 WHEN status = 'assigned' THEN 1 ELSE 2 END")
            ->orderBy('created_at', 'asc')
            ->limit($excessCount)
            ->get();

        $revokedCount = 0;
        foreach ($licensesToRevoke as $license) {
            // If license is assigned, detach from practitioners first
            if ($license->status === 'assigned' && $license->practitioners()->count() > 0) {
                $license->practitioners()->detach();
            }

            // Revoke the license
            $license->update([
                'status' => 'revoked',
                'revoked_at' => now(),
                'assigned_at' => null,
            ]);

            $revokedCount++;
        }

        Log::info('Excess licenses revoked', [
            'subscription_item_id' => $subscriptionItem->id,
            'excess_count' => $excessCount,
            'revoked_count' => $revokedCount,
        ]);
    }

    /**
     * Revoke all licenses for a subscription item (when quantity becomes 0)
     */
    private function revokeAllLicensesForSubscriptionItem(SubscriptionItem $subscriptionItem): void
    {
        $licenses = License::where('subscription_item_id', $subscriptionItem->id)->get();

        foreach ($licenses as $license) {
            // Detach from practitioners if assigned
            if ($license->status === 'assigned' && $license->practitioners()->count() > 0) {
                $license->practitioners()->detach();
            }

            // Revoke the license
            $license->update([
                'status' => 'revoked',
                'revoked_at' => now(),
                'assigned_at' => null,
            ]);
        }

        Log::info('All licenses revoked for subscription item (quantity is 0)', [
            'subscription_item_id' => $subscriptionItem->id,
            'licenses_revoked' => $licenses->count(),
        ]);
    }

    /**
     * Create licenses for tenant based on number_of_seats
     * This is the primary method used by webhooks
     */
    public function createLicensesForTenantSeats($tenant): void
    {
        // Only initialize if not already in tenant context
        $wasAlreadyInTenantContext = tenancy()->initialized;
        if (! $wasAlreadyInTenantContext) {
            tenancy()->initialize($tenant);
        }

        try {
            $targetSeats = $tenant->number_of_seats ?? 0;

            if ($targetSeats <= 0) {
                Log::info('No licenses to create - tenant has no seats', [
                    'tenant_id' => $tenant->id,
                    'number_of_seats' => $targetSeats,
                ]);

                // Revoke all licenses if seats is 0
                $this->revokeAllLicenses();

                return;
            }

            // Get existing available and assigned licenses (not revoked)
            $existingLicenses = License::whereIn('status', ['available', 'assigned'])->get();
            $existingCount = $existingLicenses->count();

            Log::info('Checking license count for tenant', [
                'tenant_id' => $tenant->id,
                'target_seats' => $targetSeats,
                'existing_count' => $existingCount,
            ]);

            // If we have the exact number of licenses, do nothing
            if ($existingCount === $targetSeats) {
                Log::info('License count matches number of seats', [
                    'tenant_id' => $tenant->id,
                    'seats' => $targetSeats,
                    'existing_count' => $existingCount,
                ]);

                return;
            }

            // If we need more licenses (seats increased)
            if ($existingCount < $targetSeats) {
                $licensesToCreate = $targetSeats - $existingCount;
                $licensesCreated = 0;

                for ($i = 0; $i < $licensesToCreate; $i++) {
                    License::create([
                        'subscription_item_id' => null, // Not based on subscription items, based on number_of_seats
                        'license_key' => License::generateLicenseKey(),
                        'status' => 'available',
                    ]);
                    $licensesCreated++;
                }

                Log::info('Additional licenses created for tenant', [
                    'tenant_id' => $tenant->id,
                    'target_seats' => $targetSeats,
                    'existing_count' => $existingCount,
                    'licenses_created' => $licensesCreated,
                ]);
            } else {
                // Seats decreased - we have more licenses than needed
                $excessCount = $existingCount - $targetSeats;

                Log::info('Tenant seats decreased - revoking excess licenses', [
                    'tenant_id' => $tenant->id,
                    'old_seats' => $existingCount,
                    'new_seats' => $targetSeats,
                    'excess_count' => $excessCount,
                ]);

                // Revoke excess licenses, starting with unassigned ones
                $this->revokeExcessLicensesBySeats($excessCount);
            }
        } catch (\Exception $e) {
            Log::error('Failed to create licenses for tenant seats', [
                'tenant_id' => $tenant->id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            throw $e;
        } finally {
            // Only end tenant context if we initialized it
            if (! $wasAlreadyInTenantContext && tenancy()->initialized) {
                tenancy()->end();
            }
        }
    }

    /**
     * Revoke excess licenses when seats decrease
     * Priority: Unassigned licenses first, then oldest assigned licenses
     */
    private function revokeExcessLicensesBySeats(int $excessCount): void
    {
        // Get all available and assigned licenses, ordered by status and creation date
        // Priority: available licenses first, then assigned licenses (oldest first)
        $licensesToRevoke = License::whereIn('status', ['available', 'assigned'])
            ->orderByRaw("CASE WHEN status = 'available' THEN 0 WHEN status = 'assigned' THEN 1 ELSE 2 END")
            ->orderBy('created_at', 'asc')
            ->limit($excessCount)
            ->get();

        $revokedCount = 0;
        foreach ($licensesToRevoke as $license) {
            // If license is assigned, detach from practitioners first
            if ($license->status === 'assigned' && $license->practitioners()->count() > 0) {
                $license->practitioners()->detach();
            }

            // Revoke the license
            $license->update([
                'status' => 'revoked',
                'revoked_at' => now(),
                'assigned_at' => null,
            ]);

            $revokedCount++;
        }

        Log::info('Excess licenses revoked based on seats', [
            'excess_count' => $excessCount,
            'revoked_count' => $revokedCount,
        ]);
    }

    /**
     * Revoke all licenses (when seats becomes 0)
     */
    private function revokeAllLicenses(): void
    {
        $licenses = License::whereIn('status', ['available', 'assigned'])->get();

        foreach ($licenses as $license) {
            // Detach from practitioners if assigned
            if ($license->status === 'assigned' && $license->practitioners()->count() > 0) {
                $license->practitioners()->detach();
            }

            // Revoke the license
            $license->update([
                'status' => 'revoked',
                'revoked_at' => now(),
                'assigned_at' => null,
            ]);
        }

        Log::info('All licenses revoked (seats is 0)', [
            'licenses_revoked' => $licenses->count(),
        ]);
    }

    /**
     * Create licenses for all subscription items of a tenant (legacy method, kept for backward compatibility)
     */
    public function createLicensesForTenant($tenant): void
    {
        // Delegate to the new method
        $this->createLicensesForTenantSeats($tenant);
    }
}
