@php
    $themeColor = $tenantTheme ?? '#0d6efd';

    // hex helpers
    $hex = ltrim($themeColor, '#');
    $r = hexdec(substr($hex, 0, 2)); $g = hexdec(substr($hex, 2, 2)); $b = hexdec(substr($hex, 4, 2));
    $dark  = sprintf("#%02x%02x%02x", max(0, $r-50), max(0, $g-50), max(0, $b-50));
    $light = sprintf("#%02x%02x%02x", min(255, $r+90), min(255, $g+90), min(255, $b+90));
    $bg    = sprintf("#%02x%02x%02x", min(255, $r+170), min(255, $g+170), min(255, $b+170));

    $orgName = is_object($organization) ? ($organization->name ?? 'Organization') : ($organization['name'] ?? 'Organization');
    $sectionLabel = $section['label'] ?? ucfirst(str_replace('-', ' ', $sectionKey ?? 'settings'));
    $sectionIcon  = $section['icon'] ?? '⚙️';

    $updatedByName = is_object($updatedBy) ? ($updatedBy->name ?? null) : ($updatedBy['name'] ?? null);
    $updatedByEmail = is_object($updatedBy) ? ($updatedBy->email ?? null) : ($updatedBy['email'] ?? null);

    $timestamp = \Illuminate\Support\Carbon::parse($changedAt ?? now())->timezone(config('app.timezone', 'UTC'))->format('M d, Y g:i A');
@endphp

<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>{{$sectionIcon}} {{$sectionLabel}} Updated</title>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<style>
  body{font-family:Arial,Helvetica,sans-serif;background:#f5f7fb;color:#2d2d2d;margin:0;padding:24px}
  .card{max-width:680px;margin:0 auto;background:#fff;border-radius:12px;box-shadow:0 4px 18px rgba(0,0,0,.06);overflow:hidden}
  .header{padding:24px 28px;border-bottom:4px solid {{$themeColor}}}
  .title{margin:0;color:{{$themeColor}};font-size:22px}
  .subtitle{margin:6px 0 0 0;color:#666}
  .badge{display:inline-block;background:{{$themeColor}};color:#fff;border-radius:999px;padding:6px 12px;font-weight:700;margin-top:12px}
  .section{padding:22px 28px}
  .info{background:{{$bg}};border-left:4px solid {{$themeColor}};border-radius:8px;padding:14px 16px;margin:14px 0}
  .label{color:#555}
  .value{font-weight:600}
  .changes{margin-top:8px;border-collapse:collapse;width:100%}
  .changes th,.changes td{border-bottom:1px solid #eee;padding:10px 8px;text-align:left;font-size:14px}
  .changes th{background:{{$light}};color:#222}
  .chip{display:inline-block;padding:4px 10px;border-radius:999px;background:#eef2f7;color:#333;font-size:12px}
  .footer{padding:18px 28px;border-top:1px solid #eee;color:#777;font-size:13px;text-align:center}
  .btn{display:inline-block;text-decoration:none;background:{{$themeColor}};color:#fff !important;padding:12px 18px;border-radius:8px;font-weight:700}
  .btn:hover{background:{{$dark}}}
</style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1 class="title">{{$sectionIcon}} {{$sectionLabel}} Updated</h1>
      <p class="subtitle">
        <strong>{{$orgName}}</strong> settings were updated on <strong>{{$timestamp}}</strong>.
      </p>
      <span class="badge">Settings Change</span>
    </div>

    <div class="section">
      <div class="info">
        <div><span class="label">Organization:</span> <span class="value">{{$orgName}}</span></div>
        <div><span class="label">Section:</span> <span class="value">{{$sectionIcon}} {{$sectionLabel}}</span></div>
        @if($updatedByName || $updatedByEmail)
          <div><span class="label">Updated By:</span>
            <span class="value">
              {{$updatedByName ?? '—'}}
              @if($updatedByEmail) <span class="chip">{{$updatedByEmail}}</span> @endif
            </span>
          </div>
        @endif
      </div>

      {{-- Optional changes table --}}
      @if(!empty($changes))
        <h3 style="margin:18px 0 8px 0;">Change Summary</h3>
        <table class="changes" role="table">
          <thead>
            <tr>
              <th style="width:28%">Field</th>
              <th style="width:36%">Old</th>
              <th style="width:36%">New</th>
            </tr>
          </thead>
          <tbody>
            @foreach($changes as $field => $diff)
              <tr>
                <td><strong>{{ ucwords(str_replace(['_', '-'], ' ', $field)) }}</strong></td>
                <td>{{ data_get($diff, 'old', '—') }}</td>
                <td>{{ data_get($diff, 'new', '—') }}</td>
              </tr>
            @endforeach
          </tbody>
        </table>
      @else
        <p style="margin:12px 0 0 0;color:#555;">No field-level diff was provided.</p>
      @endif

      {{-- CTA --}}
      @if(!empty($settingsUrl))
        <div style="margin-top:20px;">
          <a href="{{$settingsUrl}}" class="btn">Review {{$sectionLabel}}</a>
        </div>
      @endif
    </div>

    <div class="footer">
      <p>This is an automated notification from your admin system. Please do not reply.</p>
      <p>© {{ date('Y') }} {{$orgName}}</p>
    </div>
  </div>
</body>
</html>
