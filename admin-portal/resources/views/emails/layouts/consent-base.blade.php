@php
    // Get tenant theme settings with defaults
    $themeColor = $tenantTheme ?? '#2563eb';
    $fontFamily = $tenantFont ?? 'Arial, sans-serif';

    // Generate color variations from theme color
    $hex = ltrim($themeColor, '#');
    $r = hexdec(substr($hex, 0, 2));
    $g = hexdec(substr($hex, 2, 2));
    $b = hexdec(substr($hex, 4, 2));

    $dark  = sprintf("#%02x%02x%02x", max(0, $r-50), max(0, $g-50), max(0, $b-50));
    $light = sprintf("#%02x%02x%02x", min(255, $r+90), min(255, $g+90), min(255, $b+90));
    $bg    = sprintf("#%02x%02x%02x", min(255, $r+170), min(255, $g+170), min(255, $b+170));
@endphp

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{ $subject ?? 'Consent Required' }}</title>
    <style>
        body {
            font-family: {{ $fontFamily }};
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f4f4f4;
        }
        .container {
            background-color: white;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        .header {
            background-color: #ffffff;
            padding: 30px 30px 20px;
            text-align: center;
            border-bottom: 2px solid #e0e0e0;
        }
        .logo {
            max-width: 150px;
            height: auto;
            margin: 0 auto 15px;
            display: block;
        }
        .header h1 {
            margin: 0;
            color: {{ $themeColor }};
            font-size: 24px;
        }
        .content {
            padding: 30px;
        }
        .content h2 {
            color: #1f2937;
            margin-top: 0;
        }
        .info-box {
            background-color: {{ $bg }};
            border-left: 4px solid {{ $themeColor }};
            padding: 15px;
            margin: 20px 0;
            border-radius: 4px;
        }
        .info-box ul {
            margin: 10px 0;
            padding-left: 20px;
        }
        .info-box li {
            margin: 8px 0;
        }
        .highlight {
            background-color: #fef3c7;
            border-left: 4px solid #f59e0b;
            padding: 15px;
            margin: 20px 0;
            border-radius: 4px;
        }
        .btn {
            display: inline-block;
            background-color: {{ $themeColor }};
            color: white;
            padding: 12px 30px;
            text-decoration: none;
            border-radius: 6px;
            font-weight: bold;
            margin: 20px 0;
            transition: background-color 0.3s;
        }
        .btn:hover {
            background-color: {{ $dark }};
        }
        .footer {
            text-align: center;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 2px solid #e0e0e0;
            color: #666;
            font-size: 14px;
        }
        .footer p {
            margin: 5px 0;
        }
        .footer .footer-small {
            color: #999;
            font-size: 12px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            @if(!empty($tenantLogo))
                <img src="{{ $tenantLogo }}" alt="{{ $tenant->company_name ?? 'Logo' }}" class="logo" />
            @else
                <img src="{{ asset('logo.svg') }}" alt="Wellovis" class="logo" />
            @endif
            @if(isset($title))
                <h1>{{ $title }}</h1>
            @endif
        </div>
        
        <div class="content">
            @yield('content')
        </div>
        
        <div class="footer">
            <p>© {{ date('Y') }} Wellovis. All rights reserved.</p>
            <p class="footer-small">This is an automated message. Please do not reply to this email.</p>
        </div>
    </div>
</body>
</html>

