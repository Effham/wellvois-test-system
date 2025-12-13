@extends('emails.layouts.consent-base')

@section('content')
    @php
        $subject = 'Staff Permissions Consent Required';
        $title = 'Staff Permissions Consent Required';
    @endphp

    <h2>Hello {{ $practitioner->first_name }} {{ $practitioner->last_name }},</h2>
    
    <p>Thank you for completing your professional information setup with {{ $tenant->company_name }}. To complete your account setup and gain access to the Wellovis EMR platform, you must accept our Staff Permissions Consent.</p>
    
    <div class="info-box">
        <strong>Staff Permissions Overview</strong>
        <p>The following permissions allow {{ $tenant->company_name }} staff to manage your practitioner account:</p>
        <ul>
            <li><strong>✓ Invitation Management:</strong> The staff of {{ $tenant->company_name }} can invite you to join {{ $tenant->company_name }} as a practitioner</li>
            <li><strong>✓ Location Assignment:</strong> The staff of {{ $tenant->company_name }} can assign you the locations and the slots for that location</li>
            <li><strong>✓ Location Modification:</strong> The staff of {{ $tenant->company_name }} can change the locations and the slots for that location for you</li>
        </ul>
    </div>
    
    <div class="highlight">
        <strong>⏰ Important:</strong> These permissions are required for your use of the Wellovis EMR platform. Please review all consents and use the single "Accept All" checkbox to acknowledge your agreement.
    </div>
    
    <div style="text-align: center;">
        <a href="{{ $consentUrl }}" class="btn">Review & Accept All Consents</a>
    </div>
    
    <p><strong>Note:</strong> This link will expire in 7 days for security reasons. If you need a new link, please contact your administrator.</p>
    
    <p>If you have any questions about these permissions or the Wellovis EMR platform, please contact your administrator at {{ $tenant->company_name }}.</p>
@endsection
