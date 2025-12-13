<?php

namespace Tests\Feature;

use App\Models\Location;
use App\Models\Practitioner;
use App\Models\Service;
use App\Models\Tenant;
use App\Models\Tenant\Appointment;
use App\Models\Tenant\Encounter;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class SessionsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        // Create permissions
        Permission::create(['name' => 'view-appointment']);

        // Create roles
        $practitionerRole = Role::create(['name' => 'Practitioner']);
        $practitionerRole->givePermissionTo('view-appointment');
    }

    public function test_practitioners_can_view_sessions()
    {
        // Create a tenant
        $tenant = Tenant::create(['id' => 'test-tenant']);

        // Create a practitioner user
        /** @var User $user */
        $user = User::factory()->create();
        $practitioner = Practitioner::create([
            'user_id' => $user->id,
            'first_name' => 'Dr. John',
            'last_name' => 'Doe',
            'email' => 'john.doe@example.com',
        ]);

        $user->assignRole('Practitioner');

        // Create service and location
        $service = Service::create(['name' => 'Consultation']);
        $location = Location::create(['name' => 'Main Office']);

        // Create an appointment
        $appointment = Appointment::create([
            'patient_id' => 1, // Mock patient ID
            'service_id' => $service->id,
            'location_id' => $location->id,
            'appointment_datetime' => now(),
            'status' => 'confirmed',
            'mode' => 'in-person',
        ]);

        // Create an encounter for the appointment
        $encounter = Encounter::create([
            'appointment_id' => $appointment->id,
            'status' => 'in_progress',
            'session_started_at' => now(),
        ]);

        // Test that practitioner can access sessions
        $response = $this->actingAs($user)
            ->get('/sessions');

        $response->assertStatus(200);
        $response->assertInertia(fn ($page) => $page->component('Sessions/Index')
        );
    }

    public function test_non_practitioners_cannot_view_sessions()
    {
        // Create a regular user without practitioner role
        /** @var User $user */
        $user = User::factory()->create();

        // Test that regular user cannot access sessions
        $response = $this->actingAs($user)
            ->get('/sessions');

        $response->assertStatus(403);
    }

    public function test_guests_cannot_view_sessions()
    {
        // Test that guests cannot access sessions
        $response = $this->get('/sessions');

        $response->assertRedirect('/login');
    }
}
