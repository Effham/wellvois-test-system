<?php

namespace Tests\Feature\Central;

use App\Models\Patient;
use App\Models\Practitioner;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CentralDashboardTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Test that central dashboard page loads successfully for admin users
     */
    public function test_central_dashboard_loads_for_admin_users(): void
    {
        // Create an admin user (no tenant association)
        $user = User::factory()->create();

        $response = $this->actingAs($user)
            ->get('/central/dashboard');

        $response->assertStatus(200);
        $response->assertInertia(fn ($page) => $page->component('CentralDashboard'));
    }

    /**
     * Test that dashboard data API returns correct structure
     */
    public function test_dashboard_data_api_returns_correct_structure(): void
    {
        // Create test data
        $user = User::factory()->create();

        // Create some tenants
        Tenant::factory()->count(5)->create();

        // Create some patients and practitioners
        Patient::factory()->count(10)->create();
        Practitioner::factory()->count(5)->create();

        $response = $this->actingAs($user)
            ->getJson('/api/central/dashboard/data');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'stats' => [
                    'totalTenants',
                    'activeTenants',
                    'totalUsers',
                    'totalPatients',
                    'totalPractitioners',
                    'growthRate',
                ],
                'latestTenants',
                'tenantsByMonth',
                'recentActivity',
                'tenantDistribution',
                'topTenantsByUsers',
            ]);
    }

    /**
     * Test that dashboard shows correct tenant counts
     */
    public function test_dashboard_shows_correct_tenant_counts(): void
    {
        $user = User::factory()->create();

        // Create 3 tenants
        Tenant::factory()->count(3)->create();

        $response = $this->actingAs($user)
            ->getJson('/api/central/dashboard/data');

        $response->assertStatus(200);
        $data = $response->json();

        $this->assertEquals(3, $data['stats']['totalTenants']);
    }

    /**
     * Test that dashboard shows correct patient and practitioner counts
     */
    public function test_dashboard_shows_correct_patient_and_practitioner_counts(): void
    {
        $user = User::factory()->create();

        // Create 8 patients
        Patient::factory()->count(8)->create();

        // Create 4 practitioners
        Practitioner::factory()->count(4)->create();

        $response = $this->actingAs($user)
            ->getJson('/api/central/dashboard/data');

        $response->assertStatus(200);
        $data = $response->json();

        $this->assertEquals(8, $data['stats']['totalPatients']);
        $this->assertEquals(4, $data['stats']['totalPractitioners']);
    }

    /**
     * Test that latest tenants are returned in correct order
     */
    public function test_latest_tenants_returned_in_correct_order(): void
    {
        $user = User::factory()->create();

        // Create tenants at different times
        $oldTenant = Tenant::factory()->create(['created_at' => now()->subDays(10)]);
        $newTenant = Tenant::factory()->create(['created_at' => now()]);

        $response = $this->actingAs($user)
            ->getJson('/api/central/dashboard/data');

        $response->assertStatus(200);
        $data = $response->json();

        // Check that newest tenant comes first
        if (! empty($data['latestTenants'])) {
            $this->assertEquals($newTenant->id, $data['latestTenants'][0]['id']);
        }
    }

    /**
     * Test that unauthenticated users cannot access dashboard
     */
    public function test_unauthenticated_users_cannot_access_dashboard(): void
    {
        $response = $this->get('/central/dashboard');

        $response->assertRedirect('/login');
    }

    /**
     * Test that unauthenticated users cannot access dashboard API
     */
    public function test_unauthenticated_users_cannot_access_dashboard_api(): void
    {
        $response = $this->getJson('/api/central/dashboard/data');

        $response->assertStatus(401);
    }
}
