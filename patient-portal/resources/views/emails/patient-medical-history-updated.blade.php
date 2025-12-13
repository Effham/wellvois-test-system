@php
    $themeColor = $tenantTheme ?? '#0d6efd';

    // hex helpers
    $hex = ltrim($themeColor, '#');
    $r = hexdec(substr($hex, 0, 2)); $g = hexdec(substr($hex, 2, 2)); $b = hexdec(substr($hex, 4, 2));
    $dark  = sprintf("#%02x%02x%02x", max(0, $r-50), max(0, $g-50), max(0, $b-50));
    $light = sprintf("#%02x%02x%02x", min(255, $r+90), min(255, $g+90), min(255, $b+90));
    $bg    = sprintf("#%02x%02x%02x", min(255, $r+170), min(255, $g+170), min(255, $b+170));

    $orgName = is_object($organization) ? ($organization->name ?? 'Organization') : ($organization['name'] ?? 'Organization');
    
    $patientName = is_object($patient) ? ($patient->name ?? 'Patient') : ($patient['name'] ?? 'Patient');
    $patientEmail = is_object($patient) ? ($patient->email ?? null) : ($patient['email'] ?? null);
    $patientPhone = is_object($patient) ? ($patient->phone ?? null) : ($patient['phone'] ?? null);
    $patientDob = is_object($patient) ? ($patient->date_of_birth ?? null) : ($patient['date_of_birth'] ?? null);

    $typeLabel = $typeConfig['label'] ?? 'Medical Information';
    $typeIcon  = $typeConfig['icon'] ?? '📋';
    $typeVerb = $typeConfig['verb'] ?? 'updated';
    $typeDescription = $typeConfig['description'] ?? 'Medical records';

    $updatedByName = is_object($updatedBy) ? ($updatedBy->name ?? null) : ($updatedBy['name'] ?? null);
    $updatedByEmail = is_object($updatedBy) ? ($updatedBy->email ?? null) : ($updatedBy['email'] ?? null);

    $timestamp = \Illuminate\Support\Carbon::parse($changedAt ?? now())->timezone(config('app.timezone', 'UTC'))->format('M d, Y g:i A');

    // Severity colors for allergies
    function getSeverityColor($severity, $themeColor) {
        $colors = [
            'mild' => '#28a745',
            'moderate' => '#ffc107',
            'severe' => '#dc3545',
        ];
        return $colors[strtolower($severity)] ?? '#6c757d';
    }

    // Allergy type icons
    function getAllergyTypeIcon($type) {
        $icons = [
            'food' => '🍽️',
            'medication' => '💊',
            'environmental' => '🌿',
            'contact' => '🤚',
            'other' => '📌',
        ];
        return $icons[strtolower($type)] ?? '📌';
    }
@endphp

<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>{{$typeIcon}} Patient {{$typeLabel}} Updated</title>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<style>
  body{font-family:Arial,Helvetica,sans-serif;background:#f5f7fb;color:#2d2d2d;margin:0;padding:24px}
  .card{max-width:720px;margin:0 auto;background:#fff;border-radius:12px;box-shadow:0 4px 18px rgba(0,0,0,.06);overflow:hidden}
  .header{padding:24px 28px;border-bottom:4px solid {{$themeColor}}}
  .title{margin:0;color:{{$themeColor}};font-size:22px}
  .subtitle{margin:6px 0 0 0;color:#666}
  .badge{display:inline-block;background:{{$themeColor}};color:#fff;border-radius:999px;padding:6px 12px;font-weight:700;margin-top:12px;font-size:13px}
  .badge.success{background:#28a745}
  .badge.warning{background:#ffc107;color:#000}
  .badge.danger{background:#dc3545}
  .badge.secondary{background:#6c757d}
  .section{padding:22px 28px}
  .info{background:{{$bg}};border-left:4px solid {{$themeColor}};border-radius:8px;padding:14px 16px;margin:14px 0}
  .label{color:#555;font-size:14px}
  .value{font-weight:600;font-size:14px}
  .patient-card{background:#f8f9fa;border-radius:8px;padding:18px;margin:16px 0;border:2px solid {{$light}}}
  .patient-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}
  .patient-name{font-size:20px;font-weight:700;color:#222;margin:0}
  .patient-meta{margin:8px 0}
  .meta-item{display:inline-block;margin-right:16px;color:#555;font-size:14px}
  .chip{display:inline-block;padding:4px 10px;border-radius:999px;background:#eef2f7;color:#333;font-size:12px;margin:2px}
  .record-card{background:#fff;border:1px solid #dee2e6;border-radius:8px;padding:16px;margin:12px 0}
  .record-header{font-size:16px;font-weight:700;color:#222;margin-bottom:10px}
  .record-detail{margin:6px 0;font-size:14px;line-height:1.6}
  .record-detail strong{color:#555}
  .allergy-card{border-left:4px solid;margin:12px 0}
  .allergy-card.mild{border-left-color:#28a745}
  .allergy-card.moderate{border-left-color:#ffc107}
  .allergy-card.severe{border-left-color:#dc3545}
  .footer{padding:18px 28px;border-top:1px solid #eee;color:#777;font-size:13px;text-align:center}
  .btn{display:inline-block;text-decoration:none;background:{{$themeColor}};color:#fff !important;padding:12px 18px;border-radius:8px;font-weight:700;font-size:14px}
  .btn:hover{background:{{$dark}}}
  .alert{background:#fff3cd;border:1px solid #ffc107;border-radius:8px;padding:12px 16px;margin:16px 0;color:#856404}
  .alert strong{color:#856404}
</style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1 class="title">{{$typeIcon}} Patient {{$typeLabel}} Updated</h1>
      <p class="subtitle">
        {{$typeDescription}} was <strong>{{$typeVerb}}</strong> for a patient in <strong>{{$orgName}}</strong> on <strong>{{$timestamp}}</strong>.
      </p>
      <span class="badge">{{$typeLabel}} Updated</span>
    </div>

    <div class="section">
      <div class="info">
        <div style="margin-bottom:8px"><span class="label">Organization:</span> <span class="value">{{$orgName}}</span></div>
        <div style="margin-bottom:8px"><span class="label">Update Type:</span> <span class="value">{{$typeIcon}} {{$typeLabel}}</span></div>
        @if($updatedByName || $updatedByEmail)
          <div><span class="label">Updated By:</span>
            <span class="value">
              {{$updatedByName ?? '—'}}
              @if($updatedByEmail) <span class="chip">{{$updatedByEmail}}</span> @endif
            </span>
          </div>
        @endif
      </div>

      {{-- Patient Details Card --}}
      <h3 style="margin:20px 0 8px 0;color:#222">Patient Information</h3>
      <div class="patient-card">
        <div class="patient-header">
          <h2 class="patient-name">👤 {{$patientName}}</h2>
          <span class="badge success">Active Patient</span>
        </div>

        <div class="patient-meta">
          @if($patientEmail)
            <div class="meta-item">
              <strong>Email:</strong> {{$patientEmail}}
            </div>
          @endif
          @if($patientPhone)
            <div class="meta-item">
              <strong>Phone:</strong> {{$patientPhone}}
            </div>
          @endif
          @if($patientDob)
            <div class="meta-item">
              <strong>DOB:</strong> {{\Illuminate\Support\Carbon::parse($patientDob)->format('M d, Y')}}
            </div>
          @endif
        </div>
      </div>

      {{-- Medical History Records --}}
      @if($historyType === 'medical_history' && !empty($records))
        <h3 style="margin:20px 0 8px 0;color:#222">Medical History Records ({{count($records)}})</h3>
        
        @foreach($records as $index => $record)
          <div class="record-card">
            <div class="record-header">🏥 {{$record['disease'] ?? 'Medical Condition'}}</div>
            
            @if(!empty($record['recent_tests']))
              <div class="record-detail">
                <strong>Recent Tests:</strong><br>
                <span style="color:#666">{{$record['recent_tests']}}</span>
              </div>
            @endif
          </div>
        @endforeach
      @endif

      {{-- Known Allergies Records --}}
      @if($historyType === 'known_allergies' && !empty($records))
        <h3 style="margin:20px 0 8px 0;color:#222">Known Allergies ({{count($records)}})</h3>
        
        <div class="alert">
          <strong>⚠️ Important:</strong> Please review all allergy information carefully. Pay special attention to severe allergies.
        </div>

        @foreach($records as $index => $record)
          @php
            $severity = strtolower($record['severity'] ?? 'mild');
            $type = strtolower($record['type'] ?? 'other');
            $allergen = $record['allergens'] ?? 'Unknown Allergen';
            $reaction = $record['reaction'] ?? null;
            $notes = $record['notes'] ?? null;
          @endphp
          
          <div class="record-card allergy-card {{$severity}}">
            <div class="record-header">
              {{getAllergyTypeIcon($type)}} {{$allergen}}
              <span class="badge @if($severity === 'severe') danger @elseif($severity === 'moderate') warning @else success @endif" style="margin-left:8px;font-size:11px">
                {{strtoupper($severity)}}
              </span>
            </div>
            
            <div class="record-detail">
              <strong>Allergy Type:</strong> {{ucfirst($type)}}
            </div>
            
            @if($reaction)
              <div class="record-detail">
                <strong>Reaction:</strong> {{$reaction}}
              </div>
            @endif
            
            @if($notes)
              <div class="record-detail">
                <strong>Additional Notes:</strong><br>
                <span style="color:#666">{{$notes}}</span>
              </div>
            @endif
          </div>
        @endforeach
      @endif

      {{-- Family Medical History Records --}}
      @if($historyType === 'family_medical_history' && !empty($records))
        <h3 style="margin:20px 0 8px 0;color:#222">Family Medical History ({{count($records)}})</h3>
        
        @foreach($records as $index => $record)
          @php
            $relationship = $record['relationship_to_patient'] ?? 'Family Member';
            $summary = $record['summary'] ?? 'Medical Condition';
            $details = $record['details'] ?? null;
            $diagnosisDate = $record['diagnosis_date'] ?? null;
          @endphp
          
          <div class="record-card">
            <div class="record-header">
              👨‍👩‍👧 {{$relationship}}
              <span class="chip" style="margin-left:8px">{{$summary}}</span>
            </div>
            
            @if($diagnosisDate)
              <div class="record-detail">
                <strong>Diagnosis Date:</strong> {{\Illuminate\Support\Carbon::parse($diagnosisDate)->format('M d, Y')}}
              </div>
            @endif
            
            @if($details)
              <div class="record-detail">
                <strong>Details:</strong><br>
                <span style="color:#666">{{$details}}</span>
              </div>
            @endif
          </div>
        @endforeach
      @endif

      {{-- CTA --}}
      @if(!empty($patientUrl))
        <div style="margin-top:24px;text-align:center">
          <a href="{{$patientUrl}}" class="btn">View Patient Profile</a>
        </div>
      @endif
    </div>

    <div class="footer">
      <p><strong>🔒 Confidential Medical Information</strong></p>
      <p>This email contains protected health information. Please handle with appropriate care and confidentiality.</p>
      <p>This is an automated notification from your admin system. Please do not reply.</p>
      <p>© {{ date('Y') }} {{$orgName}}</p>
    </div>
  </div>
</body>
</html>