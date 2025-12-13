@php
  $themeColor = $tenantTheme ?? '#0d6efd';

  $orgName = is_object($organization) ? ($organization->name ?? 'Organization') : ($organization['name'] ?? 'Organization');
  $userName = is_object($user) ? ($user->name ?? 'Practitioner') : ($user['name'] ?? 'Practitioner');

  $hex = ltrim($themeColor, '#');
  $r = hexdec(substr($hex,0,2)); $g = hexdec(substr($hex,2,2)); $b = hexdec(substr($hex,4,2));
  $dark  = sprintf("#%02x%02x%02x", max(0,$r-50), max(0,$g-50), max(0,$b-50));
  $light = sprintf("#%02x%02x%02x", min(255,$r+90), min(255,$g+90), min(255,$b+90));

  $title = $eventType === 'clock_in' ? 'Clock In' : 'Clock Out';

  $hours = $totalMinutes !== null ? floor($totalMinutes/60) : null;
  $mins  = $totalMinutes !== null ? $totalMinutes % 60 : null;
@endphp

<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>{{ $title }} - {{ $orgName }}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    body{font-family:Arial,Helvetica,sans-serif;background:#f6f8fb;margin:0;padding:24px;color:#222}
    .card{max-width:680px;margin:0 auto;background:#fff;border-radius:12px;box-shadow:0 4px 18px rgba(0,0,0,.06);overflow:hidden}
    .header{padding:22px 26px;border-bottom:4px solid {{ $themeColor }}}
    .title{margin:0;color:{{ $themeColor }}}
    .section{padding:20px 26px}
    .row{margin:8px 0}
    .label{color:#555}
    .value{font-weight:600}
    .chip{display:inline-block;background:{{ $light }};padding:4px 10px;border-radius:999px}
    .btn{display:inline-block;text-decoration:none;background:{{ $themeColor }};color:#fff !important;padding:10px 14px;border-radius:8px;font-weight:700}
    .btn:hover{background:{{ $dark }}}
    .footer{padding:16px 26px;border-top:1px solid #eee;color:#777;font-size:13px;text-align:center}
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h2 class="title">🕒 {{ $title }} Notification</h2>
      <div class="row">
        <span class="label">Organization:</span>
        <span class="value">{{ $orgName }}</span>
      </div>
    </div>

    <div class="section">
      <div class="row"><span class="label">Practitioner:</span> <span class="value">{{ $userName }}</span></div>
      <div class="row"><span class="label">Date ({{ $tenantTimezone }}):</span> <span class="value">{{ $date }}</span></div>
      <div class="row"><span class="label">Clock In:</span> <span class="value">{{ $clockInTime }}</span></div>

      @if($eventType === 'clock_out')
        <div class="row"><span class="label">Clock Out:</span> <span class="value">{{ $clockOutTime }}</span></div>
        <div class="row">
          <span class="label">Total:</span>
          <span class="value">
            @if($totalMinutes !== null)
              {{ $hours }}h {{ $mins }}m <span class="chip"></span>
            @else
              —
            @endif
          </span>
        </div>
      @endif

      @if(!empty($timesheetUrl))
        <div class="row" style="margin-top:14px;">
          <a href="{{ $timesheetUrl }}" class="btn">Open Timesheet</a>
        </div>
      @endif
    </div>

    <div class="footer">
      <p>This is an automated message. Please do not reply.</p>
    </div>
  </div>
</body>
</html>
