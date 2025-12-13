<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Appointment Slot Available</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
        }
        .header {
            background-color: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 20px;
            text-align: center;
        }
        .content {
            background-color: #fff;
            padding: 20px;
            border: 1px solid #e9ecef;
            border-radius: 8px;
            margin-bottom: 20px;
        }
        .appointment-details {
            background-color: #e3f2fd;
            padding: 15px;
            border-radius: 6px;
            margin: 15px 0;
        }
        .cta-button {
            display: inline-block;
            background-color: #28a745;
            color: white;
            padding: 12px 30px;
            text-decoration: none;
            border-radius: 6px;
            font-weight: bold;
            margin: 20px 0;
            text-align: center;
        }
        .cta-button:hover {
            background-color: #218838;
        }
        .urgency {
            background-color: #fff3cd;
            border: 1px solid #ffeaa7;
            padding: 10px;
            border-radius: 6px;
            margin: 15px 0;
        }
        .footer {
            background-color: #f8f9fa;
            padding: 15px;
            border-radius: 8px;
            text-align: center;
            font-size: 12px;
            color: #6c757d;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1 style="color: #28a745; margin: 0;">🎉 Great News!</h1>
        <h2 style="margin: 10px 0 0 0;">An Appointment Slot is Available</h2>
    </div>

    <div class="content">
        <p>Hello {{ $patient->first_name }},</p>

        <p>Good news! An appointment slot that matches your preferences has become available.</p>

        <div class="appointment-details">
            <h3 style="margin-top: 0;">📅 Appointment Details</h3>
            <ul style="margin: 0; padding-left: 20px;">
                @if($cancelledAppointment->service)
                    <li><strong>Service:</strong> {{ $cancelledAppointment->service->name }}</li>
                @endif
                <li><strong>Date & Time:</strong> {{ $appointmentDate->format('l, F j, Y \a\t g:i A') }}</li>
                @if($cancelledAppointment->mode)
                    <li><strong>Mode:</strong> {{ ucfirst($cancelledAppointment->mode) }}</li>
                @endif
                @if($cancelledAppointment->location)
                    <li><strong>Location:</strong> {{ $cancelledAppointment->location->name ?? 'TBD' }}</li>
                @endif
            </ul>
        </div>

        <div class="urgency">
            <p style="margin: 0; font-weight: bold; color: #856404;">
                ⏰ <strong>Time Sensitive:</strong> This offer expires in 24 hours ({{ $expiresAt->format('M j, Y \a\t g:i A') }}).
                The first person to accept gets the appointment!
            </p>
        </div>

        <div style="text-align: center;">
            <a href="{{ $acceptanceUrl }}" class="cta-button">
                ✅ Accept This Appointment
            </a>
        </div>

        <p style="text-align: center; margin-top: 20px;">
            <small>
                <strong>Important:</strong> Clicking the button above will immediately confirm your appointment.
                Make sure you can attend before accepting.
            </small>
        </p>

        <hr style="margin: 30px 0; border: none; border-top: 1px solid #e9ecef;">

        <h4>What happens next?</h4>
        <ul>
            <li>Click "Accept This Appointment" to confirm your slot</li>
            <li>You'll receive a confirmation email with all appointment details</li>
            <li>The appointment will be added to your schedule</li>
            <li>If you don't accept within 24 hours, the offer will expire</li>
        </ul>

        <p>If you cannot make this appointment, no action is needed - the offer will expire automatically and the slot will be offered to the next person on the waiting list.</p>
    </div>

    <div class="footer">
        <p>This email was sent because you joined our waiting list.</p>
        <p>Please do not reply to this email. If you need assistance, please contact our clinic directly.</p>
    </div>
</body>
</html>