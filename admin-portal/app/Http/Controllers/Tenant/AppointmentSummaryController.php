<?php

namespace App\Http\Controllers\Tenant;

use App\Http\Controllers\Controller;
use App\Models\Patient;
use App\Models\Practitioner;
use App\Models\Tenant\Appointment;
use App\Models\Tenant\Encounter;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class AppointmentSummaryController extends Controller
{
    /**
     * Display appointment summaries for the authenticated practitioner.
     */
    public function index()
    {
        $user = Auth::user();
        $practitioner = Practitioner::where('user_id', $user->id)->first();

        if (! $practitioner) {
            abort(403, 'Access denied. You are not registered as a practitioner.');
        }

        // Get appointments assigned to this practitioner with completed encounters
        $appointmentIds = DB::table('appointment_practitioner')
            ->where('practitioner_id', $practitioner->id)
            ->pluck('appointment_id');

        $encounters = Encounter::whereIn('appointment_id', $appointmentIds)
            ->where('status', 'completed')
            ->with(['prescriptions'])
            ->orderBy('created_at', 'desc')
            ->get();

        $summariesData = [];

        foreach ($encounters as $encounter) {
            // Get appointment details
            $appointment = Appointment::with(['service'])->find($encounter->appointment_id);

            // Get patient details
            $patient = null;
            if ($appointment && $appointment->patient_id) {
                $patient = Patient::find($appointment->patient_id);
            }

            if ($appointment && $patient) {
                $summariesData[] = [
                    'id' => $encounter->id,
                    'appointment_id' => $appointment->id,
                    'appointment_date' => $appointment->appointment_datetime,
                    'patient_name' => $patient->first_name.' '.$patient->last_name,
                    'service_name' => $appointment->service->name ?? 'Unknown Service',
                    'encounter_date' => $encounter->created_at,
                    'status' => $encounter->status,
                    'summary_approved' => false, // Will be dynamic later
                    'auto_generated_summary' => $this->generateStaticSummary($encounter),
                ];
            }
        }

        // For now, add some static demo data alongside real data
        $staticDemoData = [
            [
                'id' => 999,
                'appointment_id' => 1001,
                'appointment_date' => now()->subDays(5)->toDateTimeString(),
                'patient_name' => 'Sarah Johnson',
                'service_name' => 'General Consultation',
                'encounter_date' => now()->subDays(5)->toDateTimeString(),
                'status' => 'completed',
                'summary_approved' => false,
                'auto_generated_summary' => 'Patient presented with chronic back pain and sleep disturbances. Clinical assessment revealed muscle tension and stress-related symptoms. Treatment plan includes physical therapy and stress management techniques. Prescribed Ibuprofen 400mg twice daily for 10 days and recommended ergonomic workplace assessment. Patient advised to maintain regular exercise routine and follow up in 2 weeks.',
            ],
            [
                'id' => 998,
                'appointment_id' => 1002,
                'appointment_date' => now()->subDays(12)->toDateTimeString(),
                'patient_name' => 'Michael Chen',
                'service_name' => 'Follow-up Consultation',
                'encounter_date' => now()->subDays(12)->toDateTimeString(),
                'status' => 'completed',
                'summary_approved' => true,
                'auto_generated_summary' => 'Follow-up appointment for diabetes management showing excellent progress. Patient reports improved energy levels and better glucose control. HbA1c levels decreased from 8.1% to 7.2% over past 3 months. Clinical assessment shows good medication adherence and lifestyle modifications. Treatment plan continues current Metformin regimen with dietary counseling. Scheduled next review in 3 months.',
            ],
            [
                'id' => 997,
                'appointment_id' => 1003,
                'appointment_date' => now()->subDays(18)->toDateTimeString(),
                'patient_name' => 'Emma Thompson',
                'service_name' => 'Mental Health Consultation',
                'encounter_date' => now()->subDays(18)->toDateTimeString(),
                'status' => 'completed',
                'summary_approved' => false,
                'auto_generated_summary' => 'Patient presented with anxiety and mood concerns following recent life changes. Clinical assessment revealed moderate anxiety symptoms with sleep disruption. Treatment plan includes cognitive behavioral therapy techniques and mindfulness practices. Prescribed Sertraline 50mg daily and referred to mental health specialist. Patient educated on anxiety management strategies and provided with resources.',
            ],
        ];

        // Merge static data with real data
        $summariesData = array_merge($staticDemoData, $summariesData);

        return Inertia::render('AppointmentSummaries/Index', [
            'summaries' => $summariesData,
        ]);
    }

    /**
     * Show individual summary for review and approval.
     */
    public function show($id)
    {
        // For static demo data, check if it's one of our demo IDs
        if (in_array($id, [999, 998, 997])) {
            $staticData = [
                '999' => [
                    'id' => 999,
                    'appointment_id' => 1001,
                    'appointment_date' => now()->subDays(5)->toDateTimeString(),
                    'patient_name' => 'Sarah Johnson',
                    'service_name' => 'General Consultation',
                    'encounter_date' => now()->subDays(5)->toDateTimeString(),
                    'status' => 'completed',
                    'summary_approved' => false,
                    'auto_generated_summary' => 'Patient presented with chronic back pain and sleep disturbances. Clinical assessment revealed muscle tension and stress-related symptoms. Treatment plan includes physical therapy and stress management techniques. Prescribed Ibuprofen 400mg twice daily for 10 days and recommended ergonomic workplace assessment. Patient advised to maintain regular exercise routine and follow up in 2 weeks.',
                ],
                '998' => [
                    'id' => 998,
                    'appointment_id' => 1002,
                    'appointment_date' => now()->subDays(12)->toDateTimeString(),
                    'patient_name' => 'Michael Chen',
                    'service_name' => 'Follow-up Consultation',
                    'encounter_date' => now()->subDays(12)->toDateTimeString(),
                    'status' => 'completed',
                    'summary_approved' => true,
                    'auto_generated_summary' => 'Follow-up appointment for diabetes management showing excellent progress. Patient reports improved energy levels and better glucose control. HbA1c levels decreased from 8.1% to 7.2% over past 3 months. Clinical assessment shows good medication adherence and lifestyle modifications. Treatment plan continues current Metformin regimen with dietary counseling. Scheduled next review in 3 months.',
                ],
                '997' => [
                    'id' => 997,
                    'appointment_id' => 1003,
                    'appointment_date' => now()->subDays(18)->toDateTimeString(),
                    'patient_name' => 'Emma Thompson',
                    'service_name' => 'Mental Health Consultation',
                    'encounter_date' => now()->subDays(18)->toDateTimeString(),
                    'status' => 'completed',
                    'summary_approved' => false,
                    'auto_generated_summary' => 'Patient presented with anxiety and mood concerns following recent life changes. Clinical assessment revealed moderate anxiety symptoms with sleep disruption. Treatment plan includes cognitive behavioral therapy techniques and mindfulness practices. Prescribed Sertraline 50mg daily and referred to mental health specialist. Patient educated on anxiety management strategies and provided with resources.',
                ],
            ];

            $summary = $staticData[$id] ?? null;
            if (! $summary) {
                abort(404, 'Summary not found');
            }
        } else {
            // Handle real encounter data
            $encounter = Encounter::with(['prescriptions'])->find($id);
            if (! $encounter) {
                abort(404, 'Summary not found');
            }

            $appointment = Appointment::with(['service'])->find($encounter->appointment_id);
            $patient = $appointment ? Patient::find($appointment->patient_id) : null;

            $summary = [
                'id' => $encounter->id,
                'appointment_id' => $appointment->id ?? 0,
                'appointment_date' => $appointment->appointment_datetime ?? '',
                'patient_name' => $patient ? ($patient->first_name.' '.$patient->last_name) : 'Unknown',
                'service_name' => $appointment->service->name ?? 'Unknown Service',
                'encounter_date' => $encounter->created_at,
                'status' => $encounter->status,
                'summary_approved' => false,
                'auto_generated_summary' => $this->generateStaticSummary($encounter),
            ];
        }

        return Inertia::render('AppointmentSummaries/Show', [
            'summary' => $summary,
        ]);
    }

    /**
     * Generate static summary for now (will be replaced with AI later).
     */
    private function generateStaticSummary($encounter)
    {
        $summaryParts = [];

        if ($encounter->chief_complaint) {
            $summaryParts[] = 'Patient presented with: '.$encounter->chief_complaint;
        }

        if ($encounter->clinical_assessment) {
            $summaryParts[] = 'Clinical assessment revealed: '.$encounter->clinical_assessment;
        }

        if ($encounter->treatment_plan) {
            $summaryParts[] = 'Treatment plan includes: '.$encounter->treatment_plan;
        }

        if ($encounter->prescriptions && $encounter->prescriptions->count() > 0) {
            $medications = $encounter->prescriptions->pluck('medicine_name')->join(', ');
            $summaryParts[] = 'Prescribed medications: '.$medications;
        }

        $summaryParts[] = 'Encounter completed successfully with comprehensive documentation.';

        return implode('. ', $summaryParts).'.';
    }

    /**
     * Approve a summary (placeholder for future email functionality).
     */
    public function approve(Request $request)
    {
        $validated = $request->validate([
            'encounter_id' => 'required|integer',
            'approved_summary' => 'required|string',
        ]);

        // For now, just return success
        // Later, this will save the approved summary and send email to patient

        return response()->json([
            'success' => true,
            'message' => 'Summary approved successfully. Email will be sent to patient.',
        ]);
    }
}
