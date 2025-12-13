<!DOCTYPE html>
<html>
<head>
    <title>Redirecting to Tenant...</title>
    <meta http-equiv="refresh" content="0; url={{ $url }}">
</head>
<body>
    <p>Redirecting to your tenant application...</p>
    <script>
        // Immediate redirect
        window.location.replace("{{ $url }}");
    </script>
    <noscript>
        <a href="{{ $url }}">Click here if you are not redirected automatically</a>
    </noscript>
</body>
</html>