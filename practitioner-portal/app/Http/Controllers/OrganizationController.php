<?php

namespace App\Http\Controllers;

use App\Models\OrganizationSetting;
use App\Services\S3BucketService;
use Illuminate\Http\Request;

class OrganizationController extends Controller
{
    public function __construct()
    {

        if (! config('app.is_developer', false)) {
            $this->middleware('permission:view-organization')->only(['index', 'show']);
            $this->middleware('permission:add-organization')->only(['create', 'store']);
            $this->middleware('permission:update-organization')->only(['edit', 'update', 'updatePracticeDetails', 'updateBillingInformation', 'uploadLogo']);
            $this->middleware('permission:delete-organization')->only('destroy');
        }
    }

    /**
     * Update practice details settings
     */
    public function updatePracticeDetails(Request $request)
    {
        $validated = $request->validate([
            'practice_details_name' => ['required', 'string', 'max:255'],
            'practice_details_legal_name' => ['required', 'string', 'max:255'],
            'practice_details_industry_type' => ['required', 'string', 'max:255'],
            'practice_details_contact_email' => ['required', 'email', 'max:255'],
            'practice_details_phone_number' => ['required', 'string', 'max:20'],
            'practice_details_website_url' => ['nullable', 'url', 'max:255'],
        ]);
        OrganizationSetting::setMultiple($validated, 'practice-details');

        return back()->with('success', 'Practice details updated successfully.');
    }

    /**
     * Update appearance settings
     */
    public function updateAppearance(Request $request)
    {
        $validated = $request->validate([
            'appearance_logo_path' => ['nullable', 'string'],
            'appearance_theme_color' => ['nullable', 'string', 'max:7'],
            'appearance_font_family' => ['nullable', 'string', 'max:100'],
        ]);

        \Log::info('OrganizationController: updateAppearance called', [
            'validated_data' => $validated,
            'preserving_logo' => 'YES - only updating theme/font settings',
        ]);

        // Only update the theme and font settings that were sent
        // This preserves existing logo S3 key and other appearance settings
        $updateData = [];

        if (isset($validated['appearance_theme_color'])) {
            $updateData['appearance_theme_color'] = $validated['appearance_theme_color'];
        }

        if (isset($validated['appearance_font_family'])) {
            $updateData['appearance_font_family'] = $validated['appearance_font_family'];
        }

        if (isset($validated['appearance_logo_path'])) {
            $updateData['appearance_logo_path'] = $validated['appearance_logo_path'];
        }

        \Log::info('OrganizationController: Updating only specific appearance settings', [
            'update_data' => $updateData,
            'preserved_settings' => 'logo S3 key and other settings remain unchanged',
        ]);

        if (! empty($updateData)) {
            OrganizationSetting::setMultiple($updateData, 'appearance');
        }

        return back()->with('success', 'Appearance settings updated successfully.');
    }

    /**
     * Update time & locale settings
     */
    public function updateTimeLocale(Request $request)
    {
        // Validate only timezone, date_format, and time_format
        // Exclude week_start_day and language as per requirements
        $validated = $request->validate([
            'time_locale_timezone' => ['required', 'string', 'max:50'],
            'time_locale_date_format' => ['required', 'string', 'max:50'],
            'time_locale_time_format' => ['required', 'string', 'max:50'],
        ]);

        // Additional validation for timezone
        $validTimezones = [
            'America/Toronto', 'America/Vancouver', 'America/Chicago', 'America/Denver',
            'America/Halifax', 'America/New_York', 'America/Los_Angeles', 'UTC',
            'Europe/London', 'Europe/Paris', 'Asia/Tokyo', 'Australia/Sydney',
            'Pacific/Auckland', 'America/St_Johns',
        ];

        if (! in_array($validated['time_locale_timezone'], $validTimezones)) {
            return back()->withErrors(['time_locale_timezone' => 'Invalid timezone selected.']);
        }

        // Additional validation for date format
        $validDateFormats = ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'];
        if (! in_array($validated['time_locale_date_format'], $validDateFormats)) {
            return back()->withErrors(['time_locale_date_format' => 'Invalid date format selected.']);
        }

        // Additional validation for time format
        $validTimeFormats = ['12-hour', '24-hour'];
        if (! in_array($validated['time_locale_time_format'], $validTimeFormats)) {
            return back()->withErrors(['time_locale_time_format' => 'Invalid time format selected.']);
        }

        // Check if timezone is changing to trigger appointment migration
        $currentTimezone = OrganizationSetting::getValue('time_locale_timezone', 'America/Toronto');
        $newTimezone = $validated['time_locale_timezone'];
        $timezoneChanged = $currentTimezone !== $newTimezone;
        OrganizationSetting::setMultiple($validated, 'time-locale');

        if ($timezoneChanged) {
            \Log::info('Timezone change detected - will migrate appointments', [
                'from_timezone' => $currentTimezone,
                'to_timezone' => $newTimezone,
                'tenant_id' => tenant('id'),
            ]);

            // Save the new timezone setting first
            OrganizationSetting::setMultiple($validated);

            // Run the appointment migration command automatically
            try {
                \Illuminate\Support\Facades\Artisan::call('appointments:migrate-timezones', [
                    '--from-timezone' => $currentTimezone,
                    '--to-timezone' => $newTimezone,
                    '--force' => true,
                ]);

                $migrationOutput = \Illuminate\Support\Facades\Artisan::output();
                \Log::info('Appointment timezone migration completed', [
                    'output' => $migrationOutput,
                ]);

                return back()->with('success', 'Time & locale settings updated successfully. Existing appointments have been migrated to the new timezone.');
            } catch (\Exception $e) {
                \Log::error('Appointment timezone migration failed', [
                    'error' => $e->getMessage(),
                    'trace' => $e->getTraceAsString(),
                ]);

                return back()->with('warning', 'Time & locale settings updated, but appointment migration encountered issues. Please check the logs.');
            }
        } else {
            // No timezone change, just update settings normally
            OrganizationSetting::setMultiple($validated);

            return back()->with('success', 'Time & locale settings updated successfully.');
        }
    }

    /**
     * Update business & compliance settings
     */
    public function updateBusinessCompliance(Request $request)
    {
        $validated = $request->validate([
            'business_compliance_registration_number' => ['required', 'string', 'max:100'],
            'business_compliance_tax_number' => ['required', 'string', 'max:100'],
            'business_compliance_regulatory_body' => ['required', 'string', 'max:255'],
            'business_compliance_license_expiry_notification' => ['required', 'date'],
            'business_compliance_address_lookup' => ['required', 'string', 'max:255'],
            'business_compliance_street_address' => ['required', 'string', 'max:255'],
            'business_compliance_apt_suite_unit' => ['nullable', 'string', 'max:100'],
            'business_compliance_city' => ['required', 'string', 'max:100'],
            'business_compliance_postal_code' => ['required', 'string', 'max:20'],
            'business_compliance_province' => ['required', 'string', 'max:100'],
        ]);

        OrganizationSetting::setMultiple($validated, 'business-compliance-details');

        return back()->with('success', 'Business & compliance settings updated successfully.');
    }

    /**
     * Update appointment settings
     */
    public function updateAppointmentSettings(Request $request)
    {
        $validated = $request->validate([
            'sessionDuration' => ['required', 'integer', 'min:15', 'max:480'], // 15 minutes to 8 hours
            'advanceBookingHours' => ['required', 'integer', 'min:1', 'max:168'], // 1 hour to 1 week
            'allowSameDayBooking' => ['required', 'boolean'],
            'maxAdvanceBookingDays' => ['required', 'integer', 'min:1', 'max:365'], // 1 day to 1 year
            'bufferTimeBetweenAppointments' => ['required', 'integer', 'min:0', 'max:120'], // 0 to 2 hours
            'allowBackToBackAppointments' => ['required', 'boolean'],
            'autoConfirmAppointments' => ['required', 'boolean'],
            'defaultAppointmentStatus' => ['required', 'string', 'in:pending,confirmed,tentative'],
        ]);

        // Convert the form data to the proper database format with appointment_ prefix
        $settingsData = [
            'appointment_session_duration' => $validated['sessionDuration'],
            'appointment_advance_booking_hours' => $validated['advanceBookingHours'],
            'appointment_allow_same_day_booking' => $validated['allowSameDayBooking'] ? '1' : '0',
            'appointment_max_advance_booking_days' => $validated['maxAdvanceBookingDays'],
            'appointment_buffer_time_between_appointments' => $validated['bufferTimeBetweenAppointments'],
            'appointment_allow_back_to_back_appointments' => $validated['allowBackToBackAppointments'] ? '1' : '0',
            'appointment_auto_confirm_appointments' => $validated['autoConfirmAppointments'] ? '1' : '0',
            'appointment_default_appointment_status' => $validated['defaultAppointmentStatus'],
        ];

        OrganizationSetting::setMultiple($settingsData, 'appointment-settings');

        return redirect()->route('settings.organization')->with('success', 'Appointment settings updated successfully.');
    }

    /**
     * Upload and update logo using S3
     */
    public function uploadLogo(Request $request, S3BucketService $s3)
    {
        \Log::info('OrganizationController: S3 Logo upload request received', [
            'user_id' => auth()->id(),
            'tenant_id' => tenant('id'),
            'file_name' => $request->file('logo')?->getClientOriginalName(),
            'file_size' => $request->file('logo')?->getSize(),
            'mime_type' => $request->file('logo')?->getClientMimeType(),
        ]);

        $request->validate([
            'logo' => ['required', 'image', 'mimes:jpeg,png,jpg,gif,svg', 'max:2048'], // 2MB max
        ]);

        \Log::info('OrganizationController: S3 Logo validation passed');

        $tenantId = tenant('id');
        $file = $request->file('logo');

        // Delete old logo from S3 if exists
        $oldLogoS3Key = OrganizationSetting::getValue('appearance_logo_s3_key');
        if ($oldLogoS3Key) {
            \Log::info('OrganizationController: Removing old S3 logo', ['old_s3_key' => $oldLogoS3Key]);
            try {
                $s3->delete($oldLogoS3Key);
                \Log::info('OrganizationController: Old S3 logo deleted successfully', ['s3_key' => $oldLogoS3Key]);
            } catch (\Exception $e) {
                \Log::warning('OrganizationController: Failed to delete old S3 logo', [
                    's3_key' => $oldLogoS3Key,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        try {
            // Upload to S3 with organized path and timestamp to prevent caching issues
            $timestamp = now()->format('YmdHis');
            $s3Key = "tenants/{$tenantId}/logos/logo-{$timestamp}.{$file->getClientOriginalExtension()}";

            \Log::info('OrganizationController: Starting S3 upload', [
                'tenant_id' => $tenantId,
                's3_key' => $s3Key,
                'file_original_name' => $file->getClientOriginalName(),
            ]);

            $uploadedS3Key = $s3->upload(
                $file,
                key: $s3Key
                // Removed visibility parameter to fix S3 upload failures
            );

            \Log::info('OrganizationController: S3 upload successful', [
                'uploaded_s3_key' => $uploadedS3Key,
                'bucket' => config('filesystems.disks.s3.bucket'),
                'region' => config('filesystems.disks.s3.region'),
            ]);

            // Store ONLY the S3 key - do not store signed URLs
            \Log::info('OrganizationController: Storing S3 key only (not signed URL)', [
                's3_key' => $uploadedS3Key,
                'note' => 'Signed URLs will be generated on demand',
            ]);

            // Update database with S3 key and metadata (following S3 best practices)
            OrganizationSetting::setFileSetting(
                'appearance_logo_s3_key',
                $uploadedS3Key,
                $file->getClientOriginalName(),
                $file->getClientMimeType(),
                $file->getSize()
            );

            \Log::info('OrganizationController: Logo settings updated in database with S3 metadata', [
                'appearance_logo_s3_key' => $uploadedS3Key,
                'original_filename' => $file->getClientOriginalName(),
                'mime_type' => $file->getClientMimeType(),
                'file_size' => $file->getSize(),
            ]);

            return redirect()->route('settings.organization')->with([
                'success' => 'Logo uploaded to S3 successfully.',
                // Do not return signed URL - frontend will generate on demand
            ]);
        } catch (\Exception $e) {
            \Log::error('OrganizationController: S3 Logo upload failed', [
                'error' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
                'trace' => $e->getTraceAsString(),
            ]);

            return redirect()->route('settings.organization')->with('error', 'Failed to upload logo to S3: '.$e->getMessage());
        }
    }

    /**
     * Update accounting settings
     */
    public function updateAccountingSettings(Request $request)
    {
        $validated = $request->validate([
            'accounting_invoice_prefix' => ['required', 'string', 'max:10'],
            'accounting_currency' => ['required', 'string', 'max:3'],
            'accounting_tax_enabled' => ['required', 'string', 'in:0,1'],
            'accounting_tax_rate' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'accounting_tax_name' => ['nullable', 'string', 'max:50'],
        ]);

        // Set tax fields to null/empty if tax is disabled
        if ($validated['accounting_tax_enabled'] === '0') {
            $validated['accounting_tax_rate'] = '0.00';
            $validated['accounting_tax_name'] = '';
        }

        OrganizationSetting::setMultiple($validated, 'accounting-settings');

        return redirect()->route('settings.organization')->with('success', 'Accounting settings updated successfully.');
    }
}
