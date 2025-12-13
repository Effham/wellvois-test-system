<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Consent Error</title>
    

    <style>
        :root {
            --primary-color: {{ $branding['appearance_primary_color'] ?? $branding['appearance_theme_color'] ?? '#7c3aed' }};
            --font-family: {{ $branding['appearance_font_family'] ?? "'Inter', sans-serif" }};
        }

        body {
            font-family: var(--font-family);
            background-color: var(--primary-color);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 2rem 1rem;
        }

        .error-card {
            background: white;
            border-radius: 1rem;
            box-shadow: 0 10px 25px rgba(0,0,0,0.1);
            max-width: 500px;
            margin: 0 auto;
            padding: 2rem;
            text-align: center;
        }

        .error-icon {
            font-size: 4rem;
            margin-bottom: 1rem;
        }

        .btn-primary {
            background-color: var(--primary-color);
            color: white;
            padding: 0.75rem 2rem;
            border-radius: 0.5rem;
            border: none;
            font-weight: 600;
            cursor: pointer;
            text-decoration: none;
            display: inline-block;
            margin-top: 1rem;
        }
    </style>
</head>
<body>
    <div class="error-card">
        @if(!empty($branding['appearance_logo_path']))
        <div class="mb-6">
            <img src="{{ $branding['appearance_logo_path'] }}" alt="Logo" style="max-height: 80px; max-width: 250px; object-fit: contain; margin: 0 auto;">
        </div>
        @endif
        <div class="error-icon">⚠️</div>
        <h1 class="text-2xl font-bold text-gray-900 mb-4">Consent Link Error</h1>
        <p class="text-gray-600 mb-6">{{ $error }}</p>
        <a href="mailto:support@wellovis.com" class="btn-primary">Contact Support</a>
    </div>
</body>
</html>

