<?php

namespace App\Http\Controllers;

use App\Http\Resources\PractitionerResource;
use App\Models\Practitioner;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Redirect;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;

class PractitionerDetailsController extends Controller
{
    /**
     * Display the practitioner's edit details page.
     */
    public function index()
    {
        $user = Auth::user();

        $practitioner = Practitioner::where('user_id', $user->id)
            ->first();

        if (! $practitioner) {
            Log::warning('Practitioner record not found for user ID: '.$user->id);

            return redirect()->route('dashboard')
                ->with('error', 'Practitioner profile not found. Please contact your administrator.');
        }

        // Generate signed URL for profile picture if S3 key exists
        if ($practitioner->profile_picture_s3_key) {
            $signedUrlService = app(\App\Services\SignedUrlService::class);
            $practitioner->profile_picture_url = $signedUrlService->getProfilePictureUrl($practitioner->profile_picture_s3_key);
        }

        return Inertia::render('PractitionerDetails/Edit', [
            'practitioner' => new PractitionerResource($practitioner->load('user')),
        ]);
    }

    /**
     * Store basic practitioner information.
     */
    public function storeBasicInfo(Request $request)
    {
        $practitioner = Practitioner::where('user_id', Auth::id())->firstOrFail();

        try {
            $validatedData = $request->validate([
                'first_name' => 'required|string|max:255',
                'last_name' => 'required|string|max:255',
                'title' => 'required|string|max:255',
                'email' => 'required|email|max:255|unique:users,email,'.Auth::id(),
                'phone_number' => 'required|string|max:255',
                'extension' => 'required|string|max:255',
                'gender' => 'required|string|max:255',
                'pronoun' => 'required|string|max:255',
                'is_active' => 'required|boolean',
                'short_bio' => 'nullable|string|max:255',
                'full_bio' => 'nullable|string',
            ]);

            if ($request->email !== $practitioner->user->email) {
                $practitioner->user->update(['email' => $request->email]);
            }

            $practitioner->fill($validatedData);

            // Profile picture is handled via S3 on the frontend
            // No server-side file upload - S3 key is stored directly

            $practitioner->save();

            // Stay on the same page
            return Redirect::back()
                ->with('success', 'Basic information updated successfully.');

        } catch (ValidationException $e) {
            return Redirect::back()->withErrors($e->errors())->with('error', 'Validation failed. Please check your inputs.');
        } catch (\Exception $e) {
            Log::error('Error updating basic info: '.$e->getMessage());

            return Redirect::back()->with('error', 'An unexpected error occurred. Please try again.');
        }
    }

    /**
     * Validate email availability for practitioner.
     */
    public function validateEmail(Request $request)
    {
        $request->validate([
            'email' => 'required|email',
        ]);

        $email = $request->email;
        $currentUserId = Auth::id();

        // Check if email is taken by another user (excluding current user)
        $emailTaken = \App\Models\User::where('email', $email)
            ->where('id', '!=', $currentUserId)
            ->exists();

        if ($emailTaken) {
            return response()->json([
                'available' => false,
                'message' => 'Email is already taken by another user.',
            ]);
        }

        // Check if email is taken by another practitioner (excluding current practitioner)
        $practitioner = Practitioner::where('user_id', $currentUserId)->first();
        $emailTakenByPractitioner = Practitioner::whereBlind('email', 'email_index', $email)
            ->where('id', '!=', $practitioner ? $practitioner->id : null)
            ->exists();

        if ($emailTakenByPractitioner) {
            return response()->json([
                'available' => false,
                'message' => 'Email is already taken by another practitioner.',
            ]);
        }

        return response()->json([
            'available' => true,
            'message' => 'Email is available.',
        ]);
    }

    /**
     * Store professional practitioner details.
     */
    public function storeProfessionalDetails(Request $request)
    {
        $practitioner = Practitioner::where('user_id', Auth::id())->firstOrFail();

        try {
            $validatedData = $request->validate([
                'credentials' => 'required|array',
                'years_of_experience' => 'required|string|max:255',
                'license_number' => 'required|string|max:255',
                'professional_associations' => 'required|array',
                'primary_specialties' => 'required|array',
                'therapeutic_modalities' => 'required|array',
                'client_types_served' => 'required|array',
                'languages_spoken' => 'required|array',
                'resume_files' => 'nullable|array',
                'licensing_docs' => 'nullable|array',
                'certificates' => 'nullable|array',
            ]);

            $practitioner->update($validatedData);

            // Stay on the same page
            return Redirect::back()
                ->with('success', 'Professional details updated successfully.');
        } catch (ValidationException $e) {
            return Redirect::back()->withErrors($e->errors())->with('error', 'Validation failed. Please check your inputs.');
        } catch (\Exception $e) {
            Log::error('Error updating professional details: '.$e->getMessage());

            return Redirect::back()->with('error', 'An unexpected error occurred. Please try again.');
        }
    }

    /**
     * Store practitioner availability days.
     */
    public function storeAvailability(Request $request)
    {
        $practitioner = Practitioner::where('user_id', Auth::id())->firstOrFail();

        try {
            $validatedData = $request->validate([
                'available_days' => 'nullable|array',
                'available_days.*' => 'in:monday,tuesday,wednesday,thursday,friday,saturday,sunday',
            ]);

            $practitioner->update([
                'available_days' => $validatedData['available_days'] ?? null,
            ]);

            return Redirect::back()
                ->with('success', 'Availability updated successfully.');
        } catch (ValidationException $e) {
            return Redirect::back()->withErrors($e->errors())->with('error', 'Validation failed. Please check your inputs.');
        } catch (\Exception $e) {
            Log::error('Error updating availability: '.$e->getMessage());

            return Redirect::back()->with('error', 'An unexpected error occurred. Please try again.');
        }
    }

    /**
     * Display the Personal Information page in central context
     */
    public function personalInformation()
    {
        $user = Auth::user();

        $practitioner = Practitioner::where('user_id', $user->id)
            ->first();

        if (! $practitioner) {
            Log::warning('Practitioner record not found for personal information page', ['user_id' => $user->id]);

            return redirect()->route('dashboard')
                ->with('error', 'Practitioner profile not found. Please contact your administrator.');
        }

        // Generate signed URL for profile picture if S3 key exists
        if ($practitioner->profile_picture_s3_key) {
            $signedUrlService = app(\App\Services\SignedUrlService::class);
            $practitioner->profile_picture_url = $signedUrlService->getProfilePictureUrl($practitioner->profile_picture_s3_key);
        }

        return Inertia::render('PersonalInformation/Index', [
            'practitioner' => new PractitionerResource($practitioner->load('user')),
        ]);
    }

    /**
     * Update practitioner details (general method for profile edit form)
     */
    public function update(Request $request)
    {
        Log::info('🔥 PractitionerDetailsController::update() called - THIS IS THE CORRECT METHOD');

        $practitioner = Practitioner::where('user_id', Auth::id())->firstOrFail();

        // Debug logging
        Log::info('PractitionerDetailsController: Update request received', [
            'practitioner_id' => $practitioner->id,
            'has_s3_key' => $request->has('profile_picture_s3_key'),
            's3_key' => $request->input('profile_picture_s3_key'),
            's3_url' => $request->input('profile_picture_s3_url'),
            'request_keys' => array_keys($request->all()),
            'current_tab' => $request->input('current_tab'),
        ]);

        // Pre-validation data logging
        Log::info('PractitionerDetailsController: Pre-validation data', [
            'practitioner_id' => $practitioner->id,
            'request_data' => $request->except(['password', 'profile_picture']),
            'array_field_counts' => [
                'credentials' => is_array($request->credentials) ? count($request->credentials) : 'not-array',
                'professional_associations' => is_array($request->professional_associations) ? count($request->professional_associations) : 'not-array',
                'primary_specialties' => is_array($request->primary_specialties) ? count($request->primary_specialties) : 'not-array',
                'therapeutic_modalities' => is_array($request->therapeutic_modalities) ? count($request->therapeutic_modalities) : 'not-array',
                'client_types_served' => is_array($request->client_types_served) ? count($request->client_types_served) : 'not-array',
                'languages_spoken' => is_array($request->languages_spoken) ? count($request->languages_spoken) : 'not-array',
            ],
        ]);

        try {
            $validatedData = $request->validate([
                // Basic Info - Required fields
                'first_name' => 'required|string|max:255',
                'last_name' => 'required|string|max:255',
                'title' => 'required|string|max:255',
                'email' => 'required|email|max:255|unique:users,email,'.$practitioner->user_id,
                'phone_number' => 'required|string|max:255',
                'extension' => 'required|string|max:255',
                'gender' => 'required|string|max:255',
                'pronoun' => 'required|string|max:255',
                'is_active' => 'required|boolean',
                'short_bio' => 'nullable|string|max:255',
                'full_bio' => 'nullable|string',

                // Professional Details - Made nullable to allow multiple updates
                'credentials' => 'nullable|array',
                'years_of_experience' => 'required|string|max:255',
                'license_number' => 'required|string|max:255',
                'professional_associations' => 'nullable|array',
                'primary_specialties' => 'nullable|array',
                'therapeutic_modalities' => 'nullable|array',
                'client_types_served' => 'nullable|array',
                'languages_spoken' => 'nullable|array',

                // S3 file fields
                'profile_picture_s3_key' => 'nullable|string',

                // Document fields with S3 keys
                'resume_s3_key' => 'nullable|string',
                'licensing_documents_s3_key' => 'nullable|string',
                'certificates_s3_key' => 'nullable|string',

                // Tab tracking
                'current_tab' => 'nullable|string',
            ]);

            // Post-validation success logging
            Log::info('PractitionerDetailsController: Validation passed', [
                'practitioner_id' => $practitioner->id,
                'validated_keys' => array_keys($validatedData),
                'has_profile_picture_s3_key' => isset($validatedData['profile_picture_s3_key']),
            ]);

            // Update user email if changed
            if ($request->email !== $practitioner->user->email) {
                $practitioner->user->update(['email' => $request->email]);
            }

            // Handle profile picture
            if ($request->profile_picture_s3_key) {
                // S3 upload - store ONLY the S3 key (not the URL)
                $validatedData['profile_picture_s3_key'] = $request->profile_picture_s3_key;
                // DO NOT store signed URL - generate on demand instead
            }

            // Remove file object from validated data if present
            unset($validatedData['profile_picture']);

            // Update the practitioner with all validated data (S3 fields are now in fillable)
            $practitioner->update($validatedData);

            // Post-update success logging
            Log::info('PractitionerDetailsController: Update completed successfully', [
                'practitioner_id' => $practitioner->id,
                'updated_fields' => array_keys($validatedData),
                'profile_picture_updated' => isset($validatedData['profile_picture_s3_key']),
            ]);

            return redirect()->back()->with('success', 'Profile updated successfully!');

        } catch (ValidationException $e) {
            // Comprehensive validation error logging
            Log::error('PractitionerDetailsController: Validation failed', [
                'practitioner_id' => $practitioner->id,
                'errors' => $e->errors(),
                'failed_rules' => $e->validator->failed(),
                'input_data' => $request->except(['password', 'profile_picture']),
            ]);

            return redirect()->back()
                ->withErrors($e->errors())
                ->withInput()
                ->with('error', 'Validation failed. Please check your inputs.');
        } catch (\Exception $e) {
            // Enhanced exception logging
            Log::error('PractitionerDetailsController: Exception during update', [
                'practitioner_id' => $practitioner->id,
                'error_message' => $e->getMessage(),
                'error_file' => $e->getFile(),
                'error_line' => $e->getLine(),
                'trace' => $e->getTraceAsString(),
            ]);

            return redirect()->back()
                ->withInput()
                ->with('error', 'An error occurred while updating your profile. Please try again.');
        }
    }
}
