<?php

namespace Tests\Unit;

use App\Models\Tenant;
use App\Models\User;
use App\Services\SecureSSOService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Tests\TestCase;

class SecureSSOServiceTest extends TestCase
{
    use RefreshDatabase;

    protected SecureSSOService $ssoService;

    protected function setUp(): void
    {
        parent::setUp();
        $this->ssoService = new SecureSSOService;
    }

    /** @test */
    public function it_generates_secure_sso_code()
    {
        $user = User::factory()->create();
        $tenant = Tenant::factory()->create();

        $code = $this->ssoService->generateSSOCode($user, $tenant);

        $this->assertIsString($code);
        $this->assertEquals(64, strlen($code));
        $this->assertTrue(Cache::has('sso_code_'.$code));
    }

    /** @test */
    public function it_exchanges_valid_code_for_user_data()
    {
        $user = User::factory()->create();
        $tenant = Tenant::factory()->create();

        // Create tenant membership
        $user->tenants()->attach($tenant);

        $code = $this->ssoService->generateSSOCode($user, $tenant);
        $userData = $this->ssoService->exchangeSSOCode($code);

        $this->assertNotNull($userData);
        $this->assertEquals($user->id, $userData['user_id']);
        $this->assertEquals($tenant->id, $userData['tenant_id']);
        $this->assertEquals($user->email, $userData['user_email']);
    }

    /** @test */
    public function it_invalidates_code_after_exchange()
    {
        $user = User::factory()->create();
        $tenant = Tenant::factory()->create();

        // Create tenant membership
        $user->tenants()->attach($tenant);

        $code = $this->ssoService->generateSSOCode($user, $tenant);

        // First exchange should work
        $userData = $this->ssoService->exchangeSSOCode($code);
        $this->assertNotNull($userData);

        // Second exchange should fail (single use)
        $userData = $this->ssoService->exchangeSSOCode($code);
        $this->assertNull($userData);
    }

    /** @test */
    public function it_rejects_invalid_code()
    {
        $invalidCode = 'invalid_code_that_does_not_exist';
        $userData = $this->ssoService->exchangeSSOCode($invalidCode);

        $this->assertNull($userData);
    }

    /** @test */
    public function it_rejects_code_for_user_without_tenant_membership()
    {
        $user = User::factory()->create();
        $tenant = Tenant::factory()->create();

        // Don't create tenant membership

        $code = $this->ssoService->generateSSOCode($user, $tenant);
        $userData = $this->ssoService->exchangeSSOCode($code);

        $this->assertNull($userData);
    }

    /** @test */
    public function it_generates_tenant_sso_url()
    {
        $tenant = Tenant::factory()->create();
        $tenant->domains()->create(['domain' => 'test-tenant.example.com']);

        $code = 'test_code_123';
        $url = $this->ssoService->generateTenantSSOUrl($code, $tenant);

        $this->assertStringContainsString('test-tenant.example.com', $url);
        $this->assertStringContainsString('/sso/start', $url);
        $this->assertStringContainsString('code=test_code_123', $url);
    }

    /** @test */
    public function it_validates_tenant_request()
    {
        $tenant = Tenant::factory()->create();
        $request = request();

        $isValid = $this->ssoService->validateTenantRequest($request, $tenant->id);

        $this->assertTrue($isValid);

        // Test with non-existent tenant
        $isValid = $this->ssoService->validateTenantRequest($request, 'non-existent-tenant');

        $this->assertFalse($isValid);
    }
}
