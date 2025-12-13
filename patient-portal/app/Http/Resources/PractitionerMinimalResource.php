<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PractitionerMinimalResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * Minimal practitioner data for references (dropdowns, nested responses)
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'first_name' => $this->first_name,
            'last_name' => $this->last_name,
            'full_name' => $this->first_name.' '.$this->last_name,
            'display_name' => $this->display_name,
            'title' => $this->title,
            'slug' => $this->slug,
            'email' => $this->email,
            'phone_number' => $this->phone_number,
            'credentials' => $this->credentials,
            'profile_picture_s3_key' => $this->profile_picture_s3_key,
        ];
    }
}
