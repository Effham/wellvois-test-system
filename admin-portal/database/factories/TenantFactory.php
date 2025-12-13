<?php

namespace Database\Factories;

use App\Models\Tenant;
use Illuminate\Database\Eloquent\Factories\Factory;

class TenantFactory extends Factory
{
    protected $model = Tenant::class;

    public function definition(): array
    {
        return [
            'id' => $this->faker->unique()->slug(),
            'company_name' => $this->faker->company(),
            'is_onboarding' => false,
            'is_onboarding_settings' => false,
        ];
    }
}
