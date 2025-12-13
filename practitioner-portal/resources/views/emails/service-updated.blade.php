@php
    $themeColor = $tenantTheme ?? '#0d6efd';

    // hex helpers
    $hex = ltrim($themeColor, '#');
    $r = hexdec(substr($hex, 0, 2)); $g = hexdec(substr($hex, 2, 2)); $b = hexdec(substr($hex, 4, 2));
    $dark  = sprintf("#%02x%02x%02x", max(0, $r-50), max(0, $g-50), max(0, $b-50));
    $light = sprintf("#%02x%02x%02x", min(255, $r+90), min(255, $g+90), min(255, $b+90));
    $bg    = sprintf("#%02x%02x%02x", min(255, $r+170), min(255, $g+170), min(255, $b+170));

    $orgName = is_object($organization) ? ($organization->name ?? 'Organization') : ($organization['name'] ?? 'Organization');
    
    $serviceName = is_object($service) ? $service->name : ($service['name'] ?? 'Service');
    $serviceCategory = is_object($service) ? $service->category : ($service['category'] ?? '');
    $serviceDescription = is_object($service) ? ($service->description ?? '') : ($service['description'] ?? '');
    $servicePrice = is_object($service) ? $service->default_price : ($service['default_price'] ?? 0);
    $serviceCurrency = is_object($service) ? ($service->currency ?? 'CAD') : ($service['currency'] ?? 'CAD');
    $serviceDeliveryModes = is_object($service) ? $service->delivery_modes : ($service['delivery_modes'] ?? []);
    $serviceIsActive = is_object($service) ? ($service->is_active ?? true) : ($service['is_active'] ?? true);

    $actionLabel = $actionConfig['label'] ?? ucfirst($action);
    $actionIcon  = $actionConfig['icon'] ?? '📋';
    $actionVerb = $actionConfig['verb'] ?? $action;

    // Get category icon
    $categoryIcons = [
        'Individual' => '👤',
        'Couple' => '👥',
        'Group' => '👨‍👩‍👧‍👦',
        'Assessment' => '📋',
        'Family' => '👨‍👩‍👧',
        'Specialty' => '⭐',
        'Follow-Up' => '🔁',
    ];
    $categoryIcon = $categoryIcons[$serviceCategory] ?? '📌';

    $updatedByName = is_object($updatedBy) ? ($updatedBy->name ?? null) : ($updatedBy['name'] ?? null);
    $updatedByEmail = is_object($updatedBy) ? ($updatedBy->email ?? null) : ($updatedBy['email'] ?? null);

    $timestamp = \Illuminate\Support\Carbon::parse($changedAt ?? now())->timezone(config('app.timezone', 'UTC'))->format('M d, Y g:i A');
@endphp

<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>{{$actionIcon}} Service {{$actionLabel}}</title>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<style>
  body{font-family:Arial,Helvetica,sans-serif;background:#f5f7fb;color:#2d2d2d;margin:0;padding:24px}
  .card{max-width:680px;margin:0 auto;background:#fff;border-radius:12px;box-shadow:0 4px 18px rgba(0,0,0,.06);overflow:hidden}
  .header{padding:24px 28px;border-bottom:4px solid {{$themeColor}}}
  .title{margin:0;color:{{$themeColor}};font-size:22px}
  .subtitle{margin:6px 0 0 0;color:#666}
  .badge{display:inline-block;background:{{$themeColor}};color:#fff;border-radius:999px;padding:6px 12px;font-weight:700;margin-top:12px;font-size:13px}
  .badge.success{background:#28a745}
  .badge.inactive{background:#6c757d}
  .section{padding:22px 28px}
  .info{background:{{$bg}};border-left:4px solid {{$themeColor}};border-radius:8px;padding:14px 16px;margin:14px 0}
  .label{color:#555;font-size:14px}
  .value{font-weight:600;font-size:14px}
  .service-card{background:#f8f9fa;border-radius:8px;padding:18px;margin:16px 0;border:2px solid {{$light}}}
  .service-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}
  .service-name{font-size:20px;font-weight:700;color:#222;margin:0}
  .service-meta{margin:8px 0}
  .meta-item{display:inline-block;margin-right:16px;color:#555;font-size:14px}
  .chip{display:inline-block;padding:4px 10px;border-radius:999px;background:#eef2f7;color:#333;font-size:12px;margin:2px}
  .price{font-size:24px;font-weight:700;color:{{$themeColor}}}
  .changes{margin-top:8px;border-collapse:collapse;width:100%}
  .changes th,.changes td{border-bottom:1px solid #eee;padding:10px 8px;text-align:left;font-size:14px}
  .changes th{background:{{$light}};color:#222;font-weight:600}
  .footer{padding:18px 28px;border-top:1px solid #eee;color:#777;font-size:13px;text-align:center}
  .btn{display:inline-block;text-decoration:none;background:{{$themeColor}};color:#fff !important;padding:12px 18px;border-radius:8px;font-weight:700;font-size:14px}
  .btn:hover{background:{{$dark}}}
</style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1 class="title">{{$actionIcon}} Service {{$actionLabel}}</h1>
      <p class="subtitle">
        A service was <strong>{{$actionVerb}}</strong> in <strong>{{$orgName}}</strong> on <strong>{{$timestamp}}</strong>.
      </p>
      <span class="badge">Service {{$actionLabel}}</span>
    </div>

    <div class="section">
      <div class="info">
        <div style="margin-bottom:8px"><span class="label">Organization:</span> <span class="value">{{$orgName}}</span></div>
        <div style="margin-bottom:8px"><span class="label">Action:</span> <span class="value">{{$actionIcon}} {{$actionLabel}}</span></div>
        @if($updatedByName || $updatedByEmail)
          <div><span class="label">{{$action === 'created' ? 'Created' : 'Updated'}} By:</span>
            <span class="value">
              {{$updatedByName ?? '—'}}
              @if($updatedByEmail) <span class="chip">{{$updatedByEmail}}</span> @endif
            </span>
          </div>
        @endif
      </div>

      {{-- Service Details Card --}}
      <h3 style="margin:20px 0 8px 0;color:#222">Service Details</h3>
      <div class="service-card">
        <div class="service-header">
          <h2 class="service-name">{{$categoryIcon}} {{$serviceName}}</h2>
          @if($serviceIsActive)
            <span class="badge success">Active</span>
          @else
            <span class="badge inactive">Inactive</span>
          @endif
        </div>

        <div class="service-meta">
          <div class="meta-item">
            <strong>Category:</strong> {{$categoryIcon}} {{$serviceCategory}}
          </div>
        </div>

        @if($serviceDescription)
          <p style="color:#555;margin:12px 0;line-height:1.6">{{$serviceDescription}}</p>
        @endif

        <div style="margin-top:16px;padding-top:16px;border-top:1px solid #dee2e6">
          <div style="margin-bottom:12px">
            <span class="label">Price:</span>
            <span class="price">{{$serviceCurrency}} ${{number_format($servicePrice, 2)}}</span>
          </div>

          <div>
            <span class="label">Delivery Modes:</span>
            @foreach($serviceDeliveryModes as $mode)
              <span class="chip">
                @if($mode === 'in-person') 🏢 In-Person
                @elseif($mode === 'virtual') 💻 Virtual
                @else {{ucfirst($mode)}}
                @endif
              </span>
            @endforeach
          </div>
        </div>
      </div>

      {{-- Changes table (only for updates) --}}
      @if($action === 'updated' && !empty($changes))
        <h3 style="margin:18px 0 8px 0;color:#222">Change Summary</h3>
        <table class="changes" role="table">
          <thead>
            <tr>
              <th style="width:28%">Field</th>
              <th style="width:36%">Old Value</th>
              <th style="width:36%">New Value</th>
            </tr>
          </thead>
          <tbody>
            @foreach($changes as $field => $diff)
              <tr>
                <td><strong>{{ ucwords(str_replace(['_', '-'], ' ', $field)) }}</strong></td>
                <td>
                  @if(is_array(data_get($diff, 'old')))
                    @foreach(data_get($diff, 'old', []) as $item)
                      <span class="chip">{{$item}}</span>
                    @endforeach
                  @else
                    {{ data_get($diff, 'old', '—') }}
                  @endif
                </td>
                <td>
                  @if(is_array(data_get($diff, 'new')))
                    @foreach(data_get($diff, 'new', []) as $item)
                      <span class="chip">{{$item}}</span>
                    @endforeach
                  @else
                    {{ data_get($diff, 'new', '—') }}
                  @endif
                </td>
              </tr>
            @endforeach
          </tbody>
        </table>
      @endif

      {{-- CTA --}}
      @if(!empty($serviceUrl))
        <div style="margin-top:24px;text-align:center">
          <a href="{{$serviceUrl}}" class="btn">View Service Details</a>
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