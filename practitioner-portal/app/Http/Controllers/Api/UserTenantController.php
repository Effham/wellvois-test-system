<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class UserTenantController extends Controller
{
    /**
     * Get all tenants for the authenticated user.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        $tenants = $user->tenants()->with('domains')->get();

        $tenantsData = $tenants->map(function ($tenant) {
            return [
                'id' => $tenant->id,
                'company_name' => $tenant->company_name ?? null,
                'domain' => $tenant->domains->first()?->domain ?? null,
                'created_at' => $tenant->created_at->toISOString(),
            ];
        });

        return response()->json([
            'success' => true,
            'data' => [
                'tenants' => $tenantsData,
            ],
        ]);
    }
}
