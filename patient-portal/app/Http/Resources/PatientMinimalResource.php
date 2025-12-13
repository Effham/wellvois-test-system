<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PatientMinimalResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * Minimal patient data for references (dropdowns, nested responses)
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        // Calculate age from date_of_birth
        $age = null;
        if ($this->date_of_birth) {
            $age = $this->date_of_birth->diffInYears(now());
        }

        return [
            'id' => $this->id,
            'first_name' => $this->first_name,
            'last_name' => $this->last_name,
            'full_name' => $this->first_name.' '.$this->last_name,
            'preferred_name' => $this->preferred_name,
            'display_name' => $this->display_name,
            'email' => $this->email,
            'phone_number' => $this->phone_number,
            'phone' => $this->phone_number, // Alias for frontend compatibility
            'health_number' => $this->health_number,
            'mrn' => $this->health_number, // Alias for frontend compatibility
            'date_of_birth' => $this->date_of_birth?->format('Y-m-d'),
            'dob' => $this->date_of_birth?->format('Y-m-d'), // Alias for frontend compatibility
            'gender' => $this->gender ?? null,
            'gender_pronouns' => $this->gender_pronouns,
            'client_type' => $this->client_type,
            'emergency_contact_phone' => $this->emergency_contact_phone,
            'age' => $age,
            // Medical data (set in route handler if available)
            'allergies' => $this->allergies ?? [],
            'conditions' => $this->conditions ?? [],
            'medical_conditions' => $this->conditions ?? [], // Alias for frontend compatibility
            'last_visit' => $this->last_visit ?? null,
        ];
    }
}
