@php use Illuminate\Support\Str; @endphp

<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>{{ ucfirst($activityType) }} Notification</title>
</head>
<body style="font-family: Arial, sans-serif; background-color: #f4f0fa; padding: 20px;">
    <div style="max-width: 600px; margin: auto; background: #ffffff; border-radius: 12px; padding: 30px; box-shadow: 0 4px 15px rgba(0,0,0,0.08); border: 1px solid #e2d9f3;">
        
        <h2 style="text-align: center; color: #6a0dad; margin-bottom: 20px;">
            {{ $activityType === 'login' ? '🔐 Successful Login' : '🚪 Successful Logout' }}
        </h2>

        <p style="color: #444; font-size: 16px;">
            Hello <strong style="color: #6a0dad;">{{ $user->name ?? Str::title($user->email) }}</strong>,
        </p>

        <p style="color: #555; font-size: 15px; line-height: 1.6;">
            This is to inform you that your account was successfully 
            <strong style="color: #6a0dad;">{{ $activityType === 'login' ? 'logged in' : 'logged out' }}</strong> 
            on:
        </p>

        <p style="background-color: #f4ecfc; padding: 14px 20px; border-radius: 6px; font-size: 16px; color: #4a2a75; text-align: center; font-weight: bold; border: 1px solid #e0d3f5;">
            {{ \Carbon\Carbon::parse($activityTime)->format('F j, Y g:i A') }}
        </p>

        @if($activityType === 'login')
            <p style="color: #555; font-size: 15px;">
                If this wasn't you, please 
                <a href="{{ url('/password/reset') }}" 
                   style="color: #6a0dad; font-weight: bold; text-decoration: none;">
                   reset your password
                </a> immediately or contact support.
            </p>
        @else
            <p style="color: #555; font-size: 15px;">
                If this logout was unexpected, we recommend reviewing your recent account activity.
            </p>
        @endif

        <br>
        <p style="color: #444;">Thank you,</p>
        <p style="color: #6a0dad; font-weight: bold;">The {{ config('app.name') }} Team</p>
    </div>
</body>
</html>
