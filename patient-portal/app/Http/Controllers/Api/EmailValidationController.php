<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class EmailValidationController extends Controller
{
    /**
     * Check if email and/or workspace URL already exists in the database.
     */
    public function checkEmailExists(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'email' => 'required|email',
            'workspace_url' => 'nullable|string|max:255',
            'check_tenant' => 'nullable|boolean', // Optional: check if email exists in current tenant
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid input format',
                'errors' => $validator->errors(),
            ], 422);
        }

        $email = strtolower(trim($request->input('email')));
        $workspaceUrl = $request->input('workspace_url');
        $checkTenant = $request->input('check_tenant', false);

        try {
            // Check email in central database (users table)
            $emailExists = false;
            tenancy()->central(function () use (&$emailExists, $email) {
                $emailExists = DB::table('users')
                    ->whereRaw('LOWER(email) = ?', [$email])
                    ->exists();
            });

            $response = [
                'success' => true,
                'email_exists' => $emailExists,
                'email_message' => $emailExists
                    ? 'This email is already registered. The user can login with their existing password.'
                    : 'Email is available',
            ];

            // Optionally check if email exists in current tenant
            if ($checkTenant && tenancy()->initialized) {
                $emailExistsInTenant = \App\Models\User::whereRaw('LOWER(email) = ?', [$email])->exists();
                $response['email_exists_in_tenant'] = $emailExistsInTenant;
                if ($emailExistsInTenant) {
                    $response['email_message'] = 'A user with this email already exists in this tenant.';
                }
            }

            // Check workspace URL if provided
            if ($workspaceUrl) {
                $workspaceUrl = strtolower(trim($workspaceUrl));

                // Construct full domain (same logic as TenantController)
                $baseDomain = config('tenancy.central_domains')[0] ?? '';
                $fullDomain = $workspaceUrl.'.'.$baseDomain;

                // Check if domain exists in domains table
                $workspaceUrlExists = DB::table('domains')
                    ->where('domain', $fullDomain)
                    ->exists();

                $response['workspace_url_exists'] = $workspaceUrlExists;
                $response['workspace_url_message'] = $workspaceUrlExists
                    ? 'This workspace URL is already taken'
                    : 'Workspace URL is available';
            }

            return response()->json($response);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error checking availability',
                'email_exists' => false, // Default to false on error to not block registration
                'workspace_url_exists' => false,
            ], 500);
        }
    }
}
