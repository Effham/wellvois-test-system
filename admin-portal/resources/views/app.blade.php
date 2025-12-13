<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta name="csrf-token" content="{{ csrf_token() }}">

        @auth
            {{-- HIPAA Compliance: Prevent caching of authenticated pages --}}
            <meta http-equiv="Cache-Control" content="no-store, no-cache, must-revalidate, max-age=0">
            <meta http-equiv="Pragma" content="no-cache">
            <meta http-equiv="Expires" content="0">
        @endauth

        @php
            $metaInfo = getTenantMetaInformation();
        @endphp

        {{-- Dynamic Meta Information --}}
        <meta name="description" content="{{ $metaInfo['description'] }}">
        <meta name="keywords" content="{{ $metaInfo['company_name'] }}, healthcare, medical services, clinic, practice management, health, wellness">
        <meta name="author" content="{{ $metaInfo['company_name'] }}">
        
        {{-- Open Graph / Facebook --}}
        <meta property="og:type" content="website">
        <meta property="og:title" content="{{ $metaInfo['company_name'] }}">
        <meta property="og:description" content="{{ $metaInfo['description'] }}">
        @if($metaInfo['logo_url'])
            <meta property="og:image" content="{{ $metaInfo['logo_url'] }}">
        @endif
        <meta property="og:site_name" content="{{ $metaInfo['company_name'] }}">
        
        {{-- Twitter --}}
        <meta name="twitter:card" content="summary_large_image">
        <meta name="twitter:title" content="{{ $metaInfo['company_name'] }}">
        <meta name="twitter:description" content="{{ $metaInfo['description'] }}">
        @if($metaInfo['logo_url'])
            <meta name="twitter:image" content="{{ $metaInfo['logo_url'] }}">
        @endif
        
        {{-- Favicon and Theme --}}
        <link rel="icon" type="image/x-icon" href="{{ $metaInfo['favicon_url'] }}">
        @if($metaInfo['logo_url'])
            <link rel="apple-touch-icon" href="{{ $metaInfo['logo_url'] }}">
        @endif
        <meta name="theme-color" content="{{ $metaInfo['theme_color'] }}">
        <meta name="msapplication-TileColor" content="{{ $metaInfo['theme_color'] }}">

        {{-- Force light theme always --}}
        <script>
            (function() {
                // Always force light theme
                document.documentElement.classList.remove('dark');
                
                // Force light theme in localStorage and cookie
                localStorage.setItem('appearance', 'light');
                document.cookie = 'appearance=light;path=/;max-age=31536000;SameSite=Lax';
            })();
        </script>

        {{-- Inline style to set the HTML background color for light theme only --}}
        <style>
            html {
                background-color: oklch(1 0 0);
            }
        </style>

        <title inertia>{{ $metaInfo['title'] }}</title>

        <link rel="preconnect" href="https://fonts.bunny.net">
        <link href="https://fonts.bunny.net/css?family=instrument-sans:400,500,600" rel="stylesheet" />
        
        {{-- Additional fonts for organization appearance settings --}}
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Roboto:wght@300;400;500;700&family=Open+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet">

        @routes
        @viteReactRefresh
        @vite(['resources/js/app.tsx', "resources/js/pages/{$page['component']}.tsx"])
        @inertiaHead
    </head>
    <body class="font-sans antialiased">
        @inertia
    </body>
</html>
