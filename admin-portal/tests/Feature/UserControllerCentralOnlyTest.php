<?php

namespace Tests\Feature;

use App\Models\Patient;
use App\Models\Practitioner;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class UserControllerCentralOnlyTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Test that users list only shows central-only users (not associated with any tenant)
     */
    public function test_users_index_only_shows_central_only_users(): void
    {
        // Create a role
        Role::create(['name' => 'Admin', 'guard_name' => 'web']);

        // Create a central-only user (should appear in list)
        $centralOnlyUser = User::factory()->create([
            'name' => 'Central Admin',
            'email' => 'central@example.com',
        ]);

        // Create a user with tenant association (should NOT appear)
        $tenantUser = User::factory()->create([
            'name' => 'Tenant User',
            'email' => 'tenant@example.com',
        ]);
        $tenant = Tenant::factory()->create();
        $tenantUser->tenants()->attach($tenant->id);

        // Create a patient user (should NOT appear)
        $patientUser = User::factory()->create([
            'name' => 'Patient User',
            'email' => 'patient@example.com',
        ]);
        Patient::factory()->create(['user_id' => $patientUser->id]);

        // Create a practitioner user (should NOT appear)
        $practitionerUser = User::factory()->create([
            'name' => 'Practitioner User',
            'email' => 'practitioner@example.com',
        ]);
        Practitioner::factory()->create(['user_id' => $practitionerUser->id]);

        // Make request to users index (with partial reload header to get data)
        $response = $this->actingAs($centralOnlyUser)
            ->withHeaders(['X-Inertia-Partial-Data' => 'users,roles'])
            ->get('/users');

        $response->assertStatus(200);

        // Get the users data from Inertia response
        $users = $response->viewData('page')['props']['users']['data'] ?? [];

        // Should only contain the central-only user
        $this->assertCount(1, $users, 'Should only show 1 central-only user');

        // Verify it's the correct user
        $userIds = collect($users)->pluck('id')->toArray();
        $this->assertContains($centralOnlyUser->id, $userIds, 'Central-only user should be in list');
        $this->assertNotContains($tenantUser->id, $userIds, 'Tenant user should NOT be in list');
        $this->assertNotContains($patientUser->id, $userIds, 'Patient user should NOT be in list');
        $this->assertNotContains($practitionerUser->id, $userIds, 'Practitioner user should NOT be in list');
    }

    /**
     * Test that search works correctly for central-only users
     */
    public function test_search_only_searches_central_only_users(): void
    {
        // Create a role
        Role::create(['name' => 'Admin', 'guard_name' => 'web']);

        // Create central-only users
        $centralUser1 = User::factory()->create([
            'name' => 'John Doe',
            'email' => 'john@central.com',
        ]);
        $centralUser2 = User::factory()->create([
            'name' => 'Jane Smith',
            'email' => 'jane@central.com',
        ]);

        // Create a tenant user with matching name (should NOT appear)
        $tenantUser = User::factory()->create([
            'name' => 'John Tenant',
            'email' => 'john@tenant.com',
        ]);
        $tenant = Tenant::factory()->create();
        $tenantUser->tenants()->attach($tenant->id);

        // Search for "John"
        $response = $this->actingAs($centralUser1)
            ->withHeaders(['X-Inertia-Partial-Data' => 'users,roles'])
            ->get('/users?search=John');

        $response->assertStatus(200);

        $users = $response->viewData('page')['props']['users']['data'] ?? [];

        // Should only find the central John, not the tenant John
        $this->assertCount(1, $users, 'Should only find 1 central user named John');
        $this->assertEquals($centralUser1->id, $users[0]['id']);
    }

    /**
     * Test that central-only user count is correct
     */
    public function test_central_only_user_count_is_accurate(): void
    {
        // Create a role
        Role::create(['name' => 'Admin', 'guard_name' => 'web']);

        // Create 5 central-only users
        $centralUsers = User::factory()->count(5)->create();

        // Create 3 users with various associations (should not be counted)
        $tenantUser = User::factory()->create();
        $tenant = Tenant::factory()->create();
        $tenantUser->tenants()->attach($tenant->id);

        $patientUser = User::factory()->create();
        Patient::factory()->create(['user_id' => $patientUser->id]);

        $practitionerUser = User::factory()->create();
        Practitioner::factory()->create(['user_id' => $practitionerUser->id]);

        // Get users list
        $response = $this->actingAs($centralUsers->first())
            ->withHeaders(['X-Inertia-Partial-Data' => 'users,roles'])
            ->get('/users');

        $response->assertStatus(200);

        $usersData = $response->viewData('page')['props']['users'] ?? [];

        // Total should be 5 (only central-only users)
        $this->assertEquals(5, $usersData['total'] ?? 0, 'Should show exactly 5 central-only users');
    }

    /**
     * Test that user who is both patient and has tenant association is excluded
     */
    public function test_user_with_multiple_associations_is_excluded(): void
    {
        // Create a role
        Role::create(['name' => 'Admin', 'guard_name' => 'web']);

        // Create a central-only user
        $centralUser = User::factory()->create(['name' => 'Central Only']);

        // Create a user with multiple associations
        $multiAssociationUser = User::factory()->create(['name' => 'Multi Association']);
        $tenant = Tenant::factory()->create();
        $multiAssociationUser->tenants()->attach($tenant->id);
        Patient::factory()->create(['user_id' => $multiAssociationUser->id]);

        // Get users list
        $response = $this->actingAs($centralUser)
            ->withHeaders(['X-Inertia-Partial-Data' => 'users,roles'])
            ->get('/users');

        $response->assertStatus(200);

        $users = $response->viewData('page')['props']['users']['data'] ?? [];

        // Should only show central user
        $this->assertCount(1, $users);
        $this->assertEquals($centralUser->id, $users[0]['id']);
    }
}
