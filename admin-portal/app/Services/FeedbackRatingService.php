<?php

namespace App\Services;

use App\Models\Tenant\AppointmentFeedback;
use App\Models\Tenant\PractitionerRating;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class FeedbackRatingService
{
    /**
     * Rating Distribution Formula for Multiple Practitioners
     *
     * FORMULA EXPLANATION:
     * 1. Base Distribution: Equal split among all practitioners (baseline)
     * 2. Lead Practitioner Bonus: +20% of total rating
     * 3. Called Out Practitioner Bonus: +10% of total rating
     * 4. Remaining Points: Redistributed equally among all practitioners
     *
     * Example with 3 practitioners and 5-star rating:
     * - Base: 5 ÷ 3 = 1.67 points each
     * - Lead gets: 1.67 + (5 × 0.20) = 2.67 points
     * - Called out gets: 1.67 + (5 × 0.10) = 2.17 points
     * - Regular gets: 1.67 points
     * - Total verification: 2.67 + 2.17 + 1.67 = 6.51 (redistribute 1.51 excess)
     * - Final: Lead: 2.18, Called out: 1.77, Regular: 1.05 = 5.00 total
     */

    /**
     * Distribute rating points among practitioners based on their roles
     */
    public function distributeRating(
        int $totalRating,
        array $practitionerIds,
        ?int $leadPractitionerId = null,
        ?int $calledOutPractitionerId = null
    ): array {
        $practitionerCount = count($practitionerIds);

        if ($practitionerCount === 0) {
            return [];
        }

        // Get practitioner data from central database
        $practitioners = tenancy()->central(function () use ($practitionerIds) {
            return \App\Models\Practitioner::whereIn('id', $practitionerIds)->get();
        });

        $practitionersMap = $practitioners->keyBy('id');

        // Step 1: Initialize base distribution
        $basePoints = $totalRating / $practitionerCount;
        $distribution = [];

        foreach ($practitionerIds as $practitionerId) {
            $practitioner = $practitionersMap->get($practitionerId);
            if (! $practitioner) {
                continue;
            }

            $practitionerFullName = trim($practitioner->first_name.' '.$practitioner->last_name);

            $distribution[$practitionerId] = [
                'practitioner_id' => $practitionerId,
                'practitioner_name' => $practitionerFullName,
                'rating_points' => $basePoints,
                'rating_percentage' => 100 / $practitionerCount,
                'is_lead_practitioner' => false,
                'is_called_out' => false,
                'bonus_applied' => 0,
            ];
        }

        // Step 2: Apply bonuses for special roles

        // Lead practitioner gets 20% bonus
        if ($leadPractitionerId && isset($distribution[$leadPractitionerId])) {
            $leadBonus = $totalRating * 0.20;
            $distribution[$leadPractitionerId]['rating_points'] += $leadBonus;
            $distribution[$leadPractitionerId]['is_lead_practitioner'] = true;
            $distribution[$leadPractitionerId]['bonus_applied'] += $leadBonus;
        }

        // Called out practitioner gets 10% bonus
        if ($calledOutPractitionerId && $calledOutPractitionerId !== $leadPractitionerId && isset($distribution[$calledOutPractitionerId])) {
            $calledOutBonus = $totalRating * 0.10;
            $distribution[$calledOutPractitionerId]['rating_points'] += $calledOutBonus;
            $distribution[$calledOutPractitionerId]['is_called_out'] = true;
            $distribution[$calledOutPractitionerId]['bonus_applied'] += $calledOutBonus;
        }

        // Step 3: Normalize to ensure total equals original rating
        $currentTotal = array_sum(array_column($distribution, 'rating_points'));
        $adjustmentFactor = $totalRating / $currentTotal;

        foreach ($distribution as &$item) {
            $item['rating_points'] *= $adjustmentFactor;
            $item['rating_points'] = round($item['rating_points'], 2);
        }

        // Step 4: Calculate final percentages
        foreach ($distribution as &$item) {
            $item['rating_percentage'] = round(($item['rating_points'] / $totalRating) * 100, 2);
        }

        return array_values($distribution);
    }

    /**
     * Find practitioner ID by name
     */
    private function findPractitionerByName(Collection $practitioners, string $name): ?int
    {
        $practitioner = $practitioners->first(function ($p) use ($name) {
            $fullName = trim($p->first_name.' '.$p->last_name);

            return $fullName === $name;
        });

        return $practitioner ? $practitioner->id : null;
    }

    /**
     * Store feedback and distribute ratings
     */
    public function storeFeedback(
        int $appointmentId,
        int $patientId,
        array $feedbackData
    ): AppointmentFeedback {
        // Get practitioners for this appointment
        $practitionerIds = DB::table('appointment_practitioner')
            ->where('appointment_id', $appointmentId)
            ->pluck('practitioner_id')
            ->toArray();

        if (empty($practitionerIds)) {
            throw new \Exception('No practitioners found for this appointment');
        }

        // Create or update feedback
        $feedback = AppointmentFeedback::updateOrCreate(
            ['appointment_id' => $appointmentId],
            [
                'patient_id' => $patientId,
                'visit_rating' => $feedbackData['visit_rating'],
                'visit_led_by_id' => $feedbackData['visit_led_by_id'] ?? null,
                'call_out_person_id' => $feedbackData['call_out_person_id'] ?? null,
                'additional_feedback' => $feedbackData['additional_feedback'] ?? null,
                'is_editable' => true,
                'submitted_at' => now(),
                'last_edited_at' => now(),
            ]
        );

        // Clear existing ratings for this appointment
        PractitionerRating::where('appointment_id', $appointmentId)->delete();

        // Distribute rating among practitioners
        $distribution = $this->distributeRating(
            $feedbackData['visit_rating'],
            $practitionerIds,
            $feedbackData['visit_led_by_id'] ?? null,
            $feedbackData['call_out_person_id'] ?? null
        );

        // Store individual practitioner ratings
        foreach ($distribution as $item) {
            PractitionerRating::create([
                'appointment_id' => $appointmentId,
                'practitioner_id' => $item['practitioner_id'],
                'patient_id' => $patientId,
                'rating_points' => $item['rating_points'],
                'rating_percentage' => $item['rating_percentage'],
                'is_lead_practitioner' => $item['is_lead_practitioner'],
                'is_called_out' => $item['is_called_out'],
            ]);
        }

        return $feedback;
    }

    /**
     * Get practitioner's overall rating statistics
     */
    public function getPractitionerStats(int $practitionerId): array
    {
        $ratings = PractitionerRating::forPractitioner($practitionerId)->get();

        if ($ratings->isEmpty()) {
            return [
                'average_rating' => 0.0,
                'total_ratings' => 0,
                'rating_distribution' => [1 => 0, 2 => 0, 3 => 0, 4 => 0, 5 => 0],
                'lead_count' => 0,
                'called_out_count' => 0,
                'total_appointments' => 0,
            ];
        }

        return [
            'average_rating' => round($ratings->avg('rating_points'), 2),
            'total_ratings' => $ratings->count(),
            'rating_distribution' => PractitionerRating::getRatingDistributionForPractitioner($practitionerId),
            'lead_count' => $ratings->where('is_lead_practitioner', true)->count(),
            'called_out_count' => $ratings->where('is_called_out', true)->count(),
            'total_appointments' => $ratings->unique('appointment_id')->count(),
        ];
    }

    /**
     * Check if feedback exists and can be edited
     */
    public function canEditFeedback(int $appointmentId): array
    {
        $feedback = AppointmentFeedback::where('appointment_id', $appointmentId)->first();

        if (! $feedback) {
            return ['exists' => false, 'can_edit' => true, 'feedback' => null];
        }

        return [
            'exists' => true,
            'can_edit' => $feedback->canBeEdited(),
            'feedback' => $feedback,
        ];
    }
}
