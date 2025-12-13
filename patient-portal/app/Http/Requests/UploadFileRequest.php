<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UploadFileRequest extends FormRequest
{
    public function authorize(): bool
    {
        // Add your auth logic here. For now, allow if authenticated:
        return auth()->check() ?: true;
    }

    public function rules(): array
    {
        return [
            'file' => ['required', 'file', 'max:10240'], // 10 MB
            // optionally accept a custom key/prefix:
            'key' => ['nullable', 'string'],
            // optionally accept minutes for signed URL:
            'expires_minutes' => ['nullable', 'integer', 'min:1', 'max:1440'],
        ];
    }
}
