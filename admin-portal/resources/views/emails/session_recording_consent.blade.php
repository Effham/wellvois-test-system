@extends('emails.layouts.consent-base')

@section('content')
    @php
        $subject = 'Session Recording Consent Required';
        $title = '🎙️ Session Recording Consent Required';
    @endphp

    <h2>Hello {{ $patient->first_name }} {{ $patient->last_name }},</h2>
    
    <p>Your healthcare provider at <strong>{{ $tenant->company_name }}</strong> is requesting your consent to record audio during your upcoming session.</p>
    
    <div class="highlight">
        <strong>⏰ Important:</strong> Your practitioner is waiting to start recording your session. Please review and accept the consent to proceed.
    </div>
    
    <div class="info-box">
        <strong>What you need to do:</strong>
        <ul>
            <li>Click the button below to review and accept the recording consent</li>
            <li>Read the consent carefully</li>
            <li>Use the single "Accept All" checkbox to acknowledge your agreement</li>
            <li>Once completed, your practitioner can proceed with recording</li>
        </ul>
    </div>
    
    <div style="text-align: center;">
        <a href="{{ $consentUrl }}" class="btn">Review & Accept Recording Consent</a>
    </div>
    
    <p><strong>Why is this consent required?</strong></p>
    <p>Audio recordings help maintain accurate medical documentation and improve the quality of your healthcare. Your recording will be stored securely and only accessible to authorized healthcare providers.</p>
    
    <p>If you have any questions about the recording consent, please contact {{ $tenant->company_name }} directly.</p>
@endsection

