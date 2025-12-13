<?php

namespace App\Console\Commands;

use App\Mail\AppointmentReminderMail;
use App\Models\Practitioner;
use App\Models\Tenant;
use App\Models\Tenant\Patient;
use Carbon\Carbon;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class SendAppointmentReminder extends Command
{
    /**F
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'app:send-appointment-reminder {--dry-run : Preview emails without sending}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Send appointment reminders for tomorrow\'s appointments across all tenants';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $isDryRun = $this->option('dry-run');

        $this->info('Starting appointment reminder process...');

        if ($isDryRun) {
            $this->warn('DRY RUN MODE - No emails will be sent');
        }

        // Get tomorrow's date
        $tomorrowDate = Carbon::tomorrow();
        $this->info("Processing appointments for: {$tomorrowDate->toDateString()}");

        // Get all tenants
        $tenants = Tenant::all();
        $totalEmails = 0;
        $successCount = 0;
        $errorCount = 0;
        $canadaTz = 'America/Toronto';
        foreach ($tenants as $tenant) {
            try {
                $this->info("Processing tenant: {$tenant->company_name} (ID: {$tenant->id})");

                // Switch to tenant database
                tenancy()->initialize($tenant);

                // Get tomorrow's appointments with confirmed status
                $appointments = \App\Models\Tenant\Appointment::with(['service', 'location'])
                    ->select('appointments.*', 'appointment_practitioner.start_time', 'appointment_practitioner.end_time', 'appointment_practitioner.practitioner_id')
                    ->join('appointment_practitioner', 'appointments.id', '=', 'appointment_practitioner.appointment_id')
                    ->where('status', 'confirmed')
                    ->whereNotNull('appointment_practitioner.start_time')
                    ->whereDate('appointment_datetime', $tomorrowDate->toDateString())
                    // ->whereDate('appointments.appointment_datetime', '=', \Carbon\Carbon::parse($tomorrowDate))
                    ->get();

                $this->info("Found {$appointments->count()} appointments for {$tenant->company_name}");

                foreach ($appointments as $appointment) {
                    try {
                        // Get patient and practitioner from central database
                        $patient = null;
                        $practitioner = null;
                        $this->info("Found {$appointment->patient_id} ");

                        if ($appointment->patient_id) {
                            $patient = Patient::find($appointment->patient_id);
                        }

                        if ($appointment->practitioner_id) {
                            $practitioner = tenancy()->central(function () use ($appointment) {
                                return Practitioner::find($appointment->practitioner_id);
                            });
                        }

                        if (! $patient) {
                            $this->warn("Patient not found for appointment ID: {$appointment->id}");

                            continue;
                        }

                        if (! $patient->email) {
                            $this->warn("Patient email not found for appointment ID: {$appointment->id}");

                            continue;
                        }

                        if (! $practitioner) {
                            $this->warn("Practitioner not found for appointment ID: {$appointment->id}");

                            continue;
                        }

                        $appointmentDetails = [
                            'id' => $appointment->id,
                            'patient_name' => $patient->first_name.' '.$patient->last_name,
                            'practitioner_name' => $practitioner->first_name.' '.$practitioner->last_name,
                            'service_name' => $appointment->service ? $appointment->service->name : 'General Consultation',
                            'location_name' => $appointment->location ? $appointment->location->name : ($appointment->mode === 'virtual' ? 'Virtual' : 'Unknown Location'),
                            'appointment_datetime' => Carbon::parse($appointment->appointment_datetime),
                            'start_time' => Carbon::parse($appointment->start_time),
                            'end_time' => Carbon::parse($appointment->end_time),
                            'clinic_name' => $tenant->company_name,
                            'mode' => $appointment->mode,
                        ];

                        if ($isDryRun) {
                            $this->line("Would send email to: {$patient->email}");
                            $this->line("  Patient: {$appointmentDetails['patient_name']}");
                            $this->line("  Practitioner: {$appointmentDetails['practitioner_name']}");
                            $this->line("  Service: {$appointmentDetails['service_name']}");
                            $this->line("  Time: {$appointmentDetails['start_time']->format('H:i')} - {$appointmentDetails['end_time']->format('H:i')}");
                            $this->line("  Clinic: {$appointmentDetails['clinic_name']}");
                            $this->line('---');
                        } else {
                            // Send emails to both patient and practitioner
                            // Send to patient
                            Mail::to($patient->email)->send(
                                new AppointmentReminderMail($patient, $practitioner, $appointmentDetails, 'patient')
                            );

                            // Send to practitioner if they have an email
                            if ($practitioner->email) {
                                Mail::to($practitioner->email)->send(
                                    new AppointmentReminderMail($patient, $practitioner, $appointmentDetails, 'practitioner')
                                );
                            }

                            $this->info("Emails sent to patient ({$patient->email}) and practitioner ({$practitioner->email}) for appointment at {$appointmentDetails['start_time']->format('H:i')}");
                        }

                        $totalEmails++;
                        $successCount++;

                    } catch (\Exception $e) {
                        $this->error("Error processing appointment ID {$appointment->id}: ".$e->getMessage());
                        Log::error('Appointment reminder error', [
                            'appointment_id' => $appointment->id,
                            'tenant_id' => $tenant->id,
                            'error' => $e->getMessage(),
                            'trace' => $e->getTraceAsString(),
                        ]);
                        $errorCount++;
                    }
                }

                // Return to central database
                tenancy()->end();

            } catch (\Exception $e) {
                $this->error("Error processing tenant {$tenant->id}: ".$e->getMessage());
                Log::error('Tenant processing error in appointment reminders', [
                    'tenant_id' => $tenant->id,
                    'error' => $e->getMessage(),
                    'trace' => $e->getTraceAsString(),
                ]);

                // Make sure we return to central context even if there's an error
                try {
                    tenancy()->end();
                } catch (\Exception $endError) {
                    // Ignore end errors
                }

                $errorCount++;

                continue;
            }
        }

        // Summary
        $this->info('');
        $this->info('=== SUMMARY ===');

        if ($isDryRun) {
            $this->info("Total emails that would be sent: {$totalEmails}");
        } else {
            $this->info("Total emails processed: {$totalEmails}");
            $this->info("Successfully sent: {$successCount}");
        }

        if ($errorCount > 0) {
            $this->warn("Errors encountered: {$errorCount}");
        }

        if (! $isDryRun && $successCount > 0) {
            Log::info('Appointment reminders sent successfully', [
                'date' => $tomorrowDate->toDateString(),
                'total_emails' => $totalEmails,
                'success_count' => $successCount,
                'error_count' => $errorCount,
            ]);
        }

        $this->info('Appointment reminder process completed.');

        return Command::SUCCESS;
    }
}
