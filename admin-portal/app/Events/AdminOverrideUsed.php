<?php

namespace App\Events;

use App\Models\Tenant\Appointment;
use App\Models\User;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class AdminOverrideUsed
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public User $user;

    public ?Appointment $appointment;

    public string $overrideReason;

    public string $overrideType;

    public array $context;

    /**
     * Create a new event instance.
     *
     * @param  User  $user  The user who performed the override
     * @param  Appointment|null  $appointment  The appointment affected (if applicable)
     * @param  string  $overrideReason  The reason for override provided by user
     * @param  string  $overrideType  The type of override (availability_conflict, double_booking, etc.)
     * @param  array  $context  Additional context data
     */
    public function __construct(
        User $user,
        ?Appointment $appointment,
        string $overrideReason,
        string $overrideType = 'manual',
        array $context = []
    ) {
        $this->user = $user;
        $this->appointment = $appointment;
        $this->overrideReason = $overrideReason;
        $this->overrideType = $overrideType;
        $this->context = $context;
    }
}
