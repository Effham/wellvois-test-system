<?php

namespace App\Http\Controllers\Tenant;

use App\Http\Controllers\UserController as BaseUserController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class UserController extends BaseUserController
{
    public function index(Request $request)
    {
        Log::info('Tenant\UserController::index called', [
            'url' => $request->url(),
            'tenant' => tenancy()->tenant?->id ?? 'none',
        ]);

        return parent::index($request);
    }
}
