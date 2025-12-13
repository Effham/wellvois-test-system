<?php

namespace App\Mail;

use Carbon\Carbon;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;

class AppointmentUpdatedMail extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    // data passed to blade
    public $organization;

    public $patient;

    public $practitioners;

    public $appointment;

    public $tenantTimezone;

    public $oldStart;   // 'Y-m-d H:i' in tenant tz

    public $oldEnd;     // 'Y-m-d H:i' in tenant tz

    public $newStart;   // 'Y-m-d H:i' in tenant tz

    public $newEnd;     // 'Y-m-d H:i' in tenant tz

    public $reason;

    public $changes = [];

    public $viewUrl;

    public $updatedBy;

    public $isReschedule = false;

    public $tenantTheme;

    public function __construct(
        $organization,
        $patient,
        $practitioners,
        $appointment,
        string $tenantTimezone,
        ?string $oldStart,
        ?string $oldEnd,
        string $newStart,
        string $newEnd,
        ?string $reason = null,
        array $changes = [],
        ?string $viewUrl = null,
        $updatedBy = null,
        bool $isReschedule = false
    ) {
        $this->organization = $organization;
        $this->patient = $patient;
        $this->practitioners = collect($practitioners)->values();
        $this->appointment = $appointment;
        $this->tenantTimezone = $tenantTimezone;

        $this->oldStart = $oldStart;
        $this->oldEnd = $oldEnd;
        $this->newStart = $newStart;
        $this->newEnd = $newEnd;

        $this->reason = $reason;
        $this->changes = $changes;
        $this->viewUrl = $viewUrl;
        $this->updatedBy = $updatedBy;
        $this->isReschedule = $isReschedule;

        $this->tenantTheme = \App\Models\OrganizationSetting::getValue('appearance_theme_color') ?? '#0d6efd';
    }

    public function envelope(): Envelope
    {
        $orgName = is_object($this->organization)
            ? ($this->organization->name ?? 'Organization')
            : ($this->organization['name'] ?? 'Organization');
        $title = $this->appointment->service->name ?? ('Appointment #'.$this->appointment->id);

        $subject = $this->isReschedule
            ? "[$orgName] Appointment Rescheduled: {$title}"
            : "[$orgName] Appointment Updated: {$title}";

        return new Envelope(subject: $subject);
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.appointment-updated',
            with: [
                'organization' => $this->organization,
                'patient' => $this->patient,
                'practitioners' => $this->practitioners,
                'appointment' => $this->appointment,
                'tenantTimezone' => $this->tenantTimezone,
                'oldStart' => $this->oldStart,
                'oldEnd' => $this->oldEnd,
                'newStart' => $this->newStart,
                'newEnd' => $this->newEnd,
                'reason' => $this->reason,
                'changes' => $this->changes,
                'viewUrl' => $this->viewUrl,
                'updatedBy' => $this->updatedBy,
                'tenantTheme' => $this->tenantTheme,
                'isReschedule' => $this->isReschedule,
            ]
        );
    }

    public function attachments(): array
    {
        return [];
    }

    /* ===========================
     * Helpers to reduce controller
     * =========================== */

    /**
     * Capture OLD state before you modify the appointment.
     */
    public static function snapshot($appointment): array
    {
        return [
            'start_time' => optional($appointment->start_time)?->copy(),
            'end_time' => optional($appointment->end_time)?->copy(),
            'service_id' => (int) ($appointment->service_id ?? 0),
            'location_id' => (int) ($appointment->location_id ?? 0),
            'practitioner_ids' => DB::table('appointment_practitioner')
                ->where('appointment_id', $appointment->id)
                ->pluck('practitioner_id')
                ->map(fn ($v) => (int) $v)
                ->sort()->values()->all(),
        ];
    }

    /**
     * Build recipients: patient + current practitioners (after update).
     */
    protected static function resolveRecipients($appointment): array
    {
        // central fetches
        $patient = tenancy()->central(fn () => \App\Models\Patient::find($appointment->patient_id));
        $practitionerIds = DB::table('appointment_practitioner')
            ->where('appointment_id', $appointment->id)
            ->pluck('practitioner_id')
            ->map(fn ($v) => (int) $v)
            ->values()->all();
        $practitioners = tenancy()->central(fn () => \App\Models\Practitioner::whereIn('id', $practitionerIds)->get());

        $emails = [];
        if (! empty($patient?->email)) {
            $emails[] = $patient->email;
        }
        foreach ($practitioners as $p) {
            if (! empty($p->email)) {
                $emails[] = $p->email;
            }
        }
        $emails = array_values(array_unique(array_filter($emails)));
        if (empty($emails) && env('ADMIN_EMAIL')) {
            $emails = [env('ADMIN_EMAIL')];
        }

        return [$emails, $patient, $practitioners];
    }

    /**
     * Compute diffs, reschedule flag, prettified times, recipients and SEND.
     *
     * Call this AFTER you commit your DB update.
     */
    public static function sendForUpdate(
        $appointment,
        array $snapshot,
        string $tenantTimezone,
        ?string $reason = null,
        $updatedBy = null
    ): void {
        // refresh relations for display
        $after = $appointment->fresh(['service', 'location']);

        // gather recipients
        [$emails, $patient, $practitioners] = self::resolveRecipients($after);

        // compare old vs new
        $oldStartUtc = $snapshot['start_time']; // Carbon|null
        $oldEndUtc = $snapshot['end_time'];   // Carbon|null

        $newStartUtc = optional($after->start_time)?->copy();
        $newEndUtc = optional($after->end_time)?->copy();

        $timeChanged = ! ($oldStartUtc && $newStartUtc && $oldStartUtc->equalTo($newStartUtc))
                    || ! ($oldEndUtc && $newEndUtc && $oldEndUtc->equalTo($newEndUtc));

        $serviceChanged = (int) ($snapshot['service_id'] ?? 0) !== (int) ($after->service_id ?? 0);
        $locationChanged = (int) ($snapshot['location_id'] ?? 0) !== (int) ($after->location_id ?? 0);

        $newPracIds = DB::table('appointment_practitioner')
            ->where('appointment_id', $after->id)
            ->pluck('practitioner_id')->map(fn ($v) => (int) $v)->sort()->values()->all();
        $practitionersChanged = $snapshot['practitioner_ids'] !== $newPracIds;

        $isReschedule = $timeChanged && ! $serviceChanged && ! $locationChanged && ! $practitionersChanged;

        // human strings (tenant tz)
        $fmt = 'Y-m-d H:i';
        $oldStartStr = $oldStartUtc ? $oldStartUtc->copy()->setTimezone($tenantTimezone)->format($fmt) : null;
        $oldEndStr = $oldEndUtc ? $oldEndUtc->copy()->setTimezone($tenantTimezone)->format($fmt) : null;
        $newStartStr = $newStartUtc ? $newStartUtc->copy()->setTimezone($tenantTimezone)->format($fmt) : '';
        $newEndStr = $newEndUtc ? $newEndUtc->copy()->setTimezone($tenantTimezone)->format($fmt) : '';

        // change table
        $changes = [];
        if ($timeChanged) {
            $changes['Date & Time'] = [
                'old' => ($oldStartStr && $oldEndStr) ? "$oldStartStr → $oldEndStr" : '—',
                'new' => "$newStartStr → $newEndStr",
            ];
        }
        if ($serviceChanged) {
            $changes['Service'] = [
                'old' => optional($snapshot['service_id']) ? optional($after->service)->newQuery()->find($snapshot['service_id'])->name ?? '—' : '—',
                'new' => optional($after->service)->name ?? '—',
            ];
        }
        if ($locationChanged) {
            $changes['Location'] = [
                'old' => optional($snapshot['location_id']) ? optional($after->location)->newQuery()->find($snapshot['location_id'])->name ?? '—' : '—',
                'new' => optional($after->location)->name ?? '—',
            ];
        }
        if ($practitionersChanged) {
            $oldNames = tenancy()->central(fn () => \App\Models\Practitioner::whereIn('id', $snapshot['practitioner_ids'])->get()
                ->map(fn ($p) => trim(($p->first_name ?? '').' '.($p->last_name ?? '')))
                ->implode(', ')
            );
            $newNames = tenancy()->central(fn () => \App\Models\Practitioner::whereIn('id', $newPracIds)->get()
                ->map(fn ($p) => trim(($p->first_name ?? '').' '.($p->last_name ?? '')))
                ->implode(', ')
            );
            $changes['Practitioners'] = ['old' => $oldNames ?: '—', 'new' => $newNames ?: '—'];
        }

        // org + deep link
        $organization = [
            'name' => \App\Models\OrganizationSetting::getValue('practice_details_name') ?? 'Organization',
        ];
        $viewUrl = null;
        if (function_exists('route')) {
            try {
                $viewUrl = route('appointments.show', ['appointment' => $after->id]);
            } catch (\Throwable $e) {
            }
        }

        // build mailable
        $mailable = new self(
            organization: $organization,
            patient: $patient,
            practitioners: $practitioners,
            appointment: $after,
            tenantTimezone: $tenantTimezone,
            oldStart: $oldStartStr,
            oldEnd: $oldEndStr,
            newStart: $newStartStr,
            newEnd: $newEndStr,
            reason: $reason,
            changes: $changes,
            viewUrl: $viewUrl,
            updatedBy: $updatedBy,
            isReschedule: $isReschedule
        );

        // Queue the email (automatically queued because class implements ShouldQueue)
        Mail::to($emails)->send($mailable);
    }
}
