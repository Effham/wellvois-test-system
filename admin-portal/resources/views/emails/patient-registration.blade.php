@php
    $themeColor = $tenantTheme ?? '#0d6efd';

    // hex helpers
    $hex = ltrim($themeColor, '#');
    $r = hexdec(substr($hex, 0, 2)); $g = hexdec(substr($hex, 2, 2)); $b = hexdec(substr($hex, 4, 2));
    $dark  = sprintf("#%02x%02x%02x", max(0, $r-50), max(0, $g-50), max(0, $b-50));
    $light = sprintf("#%02x%02x%02x", min(255, $r+90), min(255, $g+90), min(255, $b+90));
    $bg    = sprintf("#%02x%02x%02x", min(255, $r+170), min(255, $g+170), min(255, $b+170));

    $patientEmail = $patient->email ?? null;
    $patientPhone = $patient->phone_number ?? null;
    $patientDob = $patient->date_of_birth ?? null;
@endphp

<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>📋 Information Recorded - {{$clinicName}}</title>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<style>
  body{font-family:Arial,Helvetica,sans-serif;background:#f5f7fb;color:#2d2d2d;margin:0;padding:24px}
  .card{max-width:720px;margin:0 auto;background:#fff;border-radius:12px;box-shadow:0 4px 18px rgba(0,0,0,.06);overflow:hidden}
  .header{padding:24px 28px;border-bottom:4px solid {{$themeColor}}}
  .title{margin:0;color:{{$themeColor}};font-size:22px}
  .subtitle{margin:6px 0 0 0;color:#666}
  .badge{display:inline-block;background:{{$themeColor}};color:#fff;border-radius:999px;padding:6px 12px;font-weight:700;margin-top:12px;font-size:13px}
  .badge.success{background:#28a745}
  .section{padding:22px 28px}
  .greeting{font-size:24px;font-weight:700;color:#222;margin:0 0 20px 0;text-align:center}
  .info{background:{{$bg}};border-left:4px solid {{$themeColor}};border-radius:8px;padding:14px 16px;margin:14px 0}
  .info-title{font-weight:700;color:{{$dark}};font-size:15px;margin-bottom:8px}
  .info-text{color:#555;font-size:14px;line-height:1.6;margin:0}
  .patient-card{background:#f8f9fa;border-radius:8px;padding:18px;margin:16px 0;border:2px solid {{$light}}}
  .card-title{font-size:16px;font-weight:700;color:{{$themeColor}};margin:0 0 14px 0}
  .detail-row{margin:8px 0;font-size:14px}
  .detail-label{color:#555;font-weight:600;display:inline-block;min-width:120px}
  .detail-value{color:#222}
  .steps-card{background:#fff;border:1px solid {{$light}};border-radius:8px;padding:18px;margin:16px 0}
  .steps-title{font-size:16px;font-weight:700;color:{{$dark}};margin:0 0 12px 0}
  .steps-list{margin:8px 0;padding-left:20px}
  .steps-list li{margin:8px 0;color:#555;font-size:14px;line-height:1.6}
  .contact-card{background:{{$bg}};border-radius:8px;padding:18px;margin:16px 0;text-align:center}
  .contact-title{font-size:16px;font-weight:700;color:{{$dark}};margin:0 0 10px 0}
  .contact-text{color:#555;font-size:14px;line-height:1.6;margin:0}
  .closing{text-align:center;margin:24px 0;padding:20px;color:#666;line-height:1.6;font-size:14px}
  .footer{padding:18px 28px;border-top:1px solid #eee;color:#777;font-size:13px;text-align:center}
  .footer strong{color:{{$themeColor}}}
  .alert{background:#d4edda;border:1px solid #28a745;border-left:4px solid #28a745;border-radius:8px;padding:14px 16px;margin:16px 0;color:#155724}
  .alert strong{color:#155724}
  @media (max-width:600px){
    body{padding:12px}
    .card{border-radius:8px}
    .section{padding:18px 20px}
    .header{padding:20px 20px}
    .greeting{font-size:20px}
    .detail-row{display:block}
    .detail-label{display:block;margin-bottom:2px}
  }
</style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1 class="title">📋 Information Recorded</h1>
      <p class="subtitle">
        Your information has been successfully recorded at <strong>{{$clinicName}}</strong>
      </p>
      <span class="badge success">Registration Complete</span>
    </div>

    <div class="section">
      <h2 class="greeting">Hello {{$patientName}}! 👋</h2>

      {{-- Confirmation Message --}}
      <div class="alert">
        <strong>✅ Your information has been recorded</strong><br>
        We wanted to confirm that your information has been successfully recorded in our system at <strong>{{$clinicName}}</strong>. Our team has completed your intake process and your records are now on file with us.
      </div>

      {{-- Patient Information Summary --}}
      <h3 style="margin:20px 0 8px 0;color:#222">Information on File</h3>
      <div class="patient-card">
        <div class="card-title">👤 Patient Details</div>
        
        <div class="detail-row">
          <span class="detail-label">Name:</span>
          <span class="detail-value">{{$fullName}}</span>
        </div>
        
        @if($patientEmail)
          <div class="detail-row">
            <span class="detail-label">Email:</span>
            <span class="detail-value">{{$patientEmail}}</span>
          </div>
        @endif
        
        @if($patientPhone)
          <div class="detail-row">
            <span class="detail-label">Phone:</span>
            <span class="detail-value">{{$patientPhone}}</span>
          </div>
        @endif
        
        @if($patientDob)
          <div class="detail-row">
            <span class="detail-label">Date of Birth:</span>
            <span class="detail-value">{{\Illuminate\Support\Carbon::parse($patientDob)->format('M d, Y')}}</span>
          </div>
        @endif
      </div>

      {{-- Next Steps --}}
      <h3 style="margin:20px 0 8px 0;color:#222">What Happens Next</h3>
      <div class="steps-card">
        <div class="steps-title">📋 Next Steps</div>
        <ul class="steps-list">
          <li>Our team will review the information you provided</li>
          <li>We'll contact you to schedule your first appointment</li>
          <li>You may receive appointment reminders via email or phone</li>
          <li>Please bring a valid ID and insurance information to your visit</li>
          <li>If you need to update any information, please contact our office</li>
        </ul>
      </div>

      {{-- Contact Section --}}
      <h3 style="margin:20px 0 8px 0;color:#222">Need Help?</h3>
      <div class="contact-card">
        <div class="contact-title">Questions or Need to Update Information?</div>
        <p class="contact-text">
          If you need to update any of the information you provided or have questions about your intake, please contact our office. We're here to help make your care experience as smooth as possible.
        </p>
      </div>

      <div class="closing">
        <p>Thank you for choosing <strong>{{$clinicName}}</strong> for your healthcare needs. We look forward to providing you with excellent care.</p>
        <p><strong>{{$clinicName}} Team</strong> 💜</p>
      </div>
    </div>

    <div class="footer">
      <p><strong>{{$clinicName}}</strong></p>
      <p>Powered by Wellovis</p>
      <p>© {{ date('Y') }} All rights reserved.</p>
    </div>
  </div>
</body>
</html>