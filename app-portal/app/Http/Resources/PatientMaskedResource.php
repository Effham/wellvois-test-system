<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PatientMaskedResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * Privacy-compliant masked data for patient search results
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'first_name' => $this->maskString($this->first_name, 1, 1),
            'last_name' => $this->maskString($this->last_name, 1, 1),
            'preferred_name' => $this->preferred_name ? $this->maskString($this->preferred_name, 1, 1) : null,
            'display_name' => $this->preferred_name ? $this->maskString($this->preferred_name, 1, 1) : $this->maskString($this->first_name, 1, 1).' '.$this->maskString($this->last_name, 1, 1),
            'email' => $this->maskEmail($this->email),
            'health_number' => $this->maskHealthNumber($this->health_number),
            'phone_number' => $this->maskPhoneNumber($this->phone_number),
            'date_of_birth' => $this->date_of_birth ? $this->maskDate($this->date_of_birth) : null,
            'gender_pronouns' => $this->gender_pronouns,
        ];
    }

    /**
     * Mask a string showing only first and last N characters
     */
    protected function maskString(?string $value, int $showFirst = 1, int $showLast = 1): string
    {
        if (! $value) {
            return 'N/A';
        }

        $length = strlen($value);

        if ($length <= ($showFirst + $showLast)) {
            return str_repeat('*', $length);
        }

        $first = substr($value, 0, $showFirst);
        $last = substr($value, -$showLast);
        $masked = str_repeat('*', max(1, $length - $showFirst - $showLast));

        return $first.$masked.$last;
    }

    /**
     * Mask email address
     */
    protected function maskEmail(?string $email): string
    {
        if (! $email) {
            return 'N/A';
        }

        $atPos = strpos($email, '@');
        if ($atPos === false) {
            return $this->maskString($email, 1, 1);
        }

        $localPart = substr($email, 0, $atPos);
        $domainPart = substr($email, $atPos);

        if (strlen($localPart) <= 3) {
            return str_repeat('*', strlen($localPart)).$domainPart;
        }

        $firstChars = substr($localPart, 0, 3);
        $maskedChars = str_repeat('*', max(1, strlen($localPart) - 3));

        return $firstChars.$maskedChars.$domainPart;
    }

    /**
     * Mask health number showing only first 4 characters
     */
    protected function maskHealthNumber(?string $healthNumber): string
    {
        if (! $healthNumber) {
            return 'N/A';
        }

        if (strlen($healthNumber) <= 4) {
            return str_repeat('*', strlen($healthNumber));
        }

        $visible = substr($healthNumber, 0, 4);
        $masked = str_repeat('*', max(1, strlen($healthNumber) - 4));

        return $visible.$masked;
    }

    /**
     * Mask phone number showing only last 4 digits
     */
    protected function maskPhoneNumber(?string $phoneNumber): string
    {
        if (! $phoneNumber) {
            return 'N/A';
        }

        // Remove all non-numeric characters for processing
        $digitsOnly = preg_replace('/\D/', '', $phoneNumber);

        if (strlen($digitsOnly) <= 4) {
            return str_repeat('*', strlen($digitsOnly));
        }

        $masked = str_repeat('*', strlen($digitsOnly) - 4);
        $visible = substr($digitsOnly, -4);

        return $masked.$visible;
    }

    /**
     * Mask date showing only year
     */
    protected function maskDate($date): string
    {
        if (! $date) {
            return 'N/A';
        }

        if ($date instanceof \DateTime || $date instanceof \DateTimeInterface) {
            return '****-**-** ('.$date->format('Y').')';
        }

        // If it's a string, extract the year
        $year = substr($date, 0, 4);

        return "****-**-** ({$year})";
    }
}
