@php
  $themeColor = $tenantTheme ?? '#0d6efd';
  $orgName = is_object($organization) ? ($organization->name ?? 'Organization') : ($organization['name'] ?? 'Organization');
  $service = data_get($appointment, 'service.name');
  $title = $service ?: ('Appointment #'.($appointment->id ?? ''));

  $hex = ltrim($themeColor, '#');
  $r = hexdec(substr($hex,0,2)); $g = hexdec(substr($hex,2,2)); $b = hexdec(substr($hex,4,2));
  $dark  = sprintf("#%02x%02x%02x", max(0,$r-50), max(0,$g-50), max(0,$b-50));
  $light = sprintf("#%02x%02x%02x", min(255,$r+90), min(255,$g+90), min(255,$b+90));

  $headerText = !empty($isReschedule) ? 'Appointment Rescheduled' : 'Appointment Updated';
  $introText  = !empty($isReschedule)
      ? 'Your appointment has been rescheduled. Here are the new details:'
      : 'Your appointment details have changed. Here’s what’s new:';
@endphp

<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>{{ $headerText }} - {{ $orgName }}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    body{font-family:Arial,Helvetica,sans-serif;background:#f6f8fb;margin:0;padding:24px;color:#222}
    .card{max-width:720px;margin:0 auto;background:#fff;border-radius:12px;box-shadow:0 4px 18px rgba(0,0,0,.06);overflow:hidden}
    .header{padding:22px 26px;border-bottom:4px solid {{ $themeColor }}}
    .title{margin:0;color:{{ $themeColor }}}
    .section{padding:20px 26px}
    .row{margin:8px 0}
    .label{color:#555}
    .value{font-weight:600}
    .changes{border-collapse:collapse;width:100%;margin-top:10px}
    .changes th,.changes td{border-bottom:1px solid #eee;padding:8px;text-align:left;font-size:14px}
    .changes th{background:{{ $light }}}
    .chip{display:inline-block;background:{{ $light }};padding:4px 10px;border-radius:999px}
    .btn{display:inline-block;text-decoration:none;background:{{ $themeColor }};color:#fff !important;padding:10px 14px;border-radius:8px;font-weight:700}
    .btn:hover{background:{{ $dark }}}
    .footer{padding:16px 26px;border-top:1px solid #eee;color:#777;font-size:13px;text-align:center}
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h2 class="title">📅 {{ $headerText }}</h2>
      <div class="row"><span class="label">Organization:</span> <span class="value">{{ $orgName }}</span></div>
      <div class="row"><span class="label">Title:</span> <span class="value">{{ $title }}</span></div>
    </div>

    <div class="section">
      <p style="margin-top:0">{{ $introText }}</p>

      @if(!empty($patient))
        <div class="row"><span class="label">Patient:</span>
          <span class="value">
            {{ trim(($patient->first_name ?? '') . ' ' . ($patient->last_name ?? '')) ?: ($patient['name'] ?? 'Patient') }}
          </span>
        </div>
      @endif

      @if($practitioners && count($practitioners))
        <div class="row"><span class="label">Practitioner(s):</span>
          <span class="value">
            @foreach($practitioners as $p)
              <span class="chip">{{ trim(($p->first_name ?? '') . ' ' . ($p->last_name ?? '')) ?: ($p['name'] ?? '—') }}</span>
            @endforeach
          </span>
        </div>
      @endif

      <div class="row"><span class="label">Timezone:</span> <span class="value">{{ $tenantTimezone }}</span></div>

      <div class="row"><span class="label">Previous:</span>
        <span class="value">
          @if($oldStart && $oldEnd) {{ $oldStart }} → {{ $oldEnd }} @else — @endif
        </span>
      </div>

      <div class="row"><span class="label">New:</span>
        <span class="value">{{ $newStart }} → {{ $newEnd }}</span>
      </div>

      @if(!empty($reason))
        <div class="row"><span class="label">Reason for change:</span> <span class="value">{{ $reason }}</span></div>
      @endif

      @if(!empty($changes))
        <h4 style="margin:18px 0 8px">Details changed</h4>
        <table class="changes">
          <thead><tr><th>Field</th><th>Old</th><th>New</th></tr></thead>
          <tbody>
          @foreach($changes as $label => $diff)
            <tr>
              <td><strong>{{ $label }}</strong></td>
              <td>{{ data_get($diff, 'old', '—') }}</td>
              <td>{{ data_get($diff, 'new', '—') }}</td>
            </tr>
          @endforeach
          </tbody>
        </table>
      @endif

      @if(!empty($viewUrl))
        <div class="row" style="margin-top:14px;">
          <a href="{{ $viewUrl }}" class="btn">View Appointment</a>
        </div>
      @endif
    </div>

    <div class="footer">
      <p>This is an automated message. Please do not reply.</p>
    </div>
  </div>
</body>
</html>
