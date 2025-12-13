<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Appointment Confirmed</title>
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
            background-color: #d4edda;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 20px;
            text-align: center;
            border: 1px solid #c3e6cb;
        }
        .content {
            background-color: #fff;
            padding: 20px;
            border: 1px solid #e9ecef;
            border-radius: 8px;
            margin-bottom: 20px;
        }
        .appointment-details {
            background-color: #e8f5e8;
            padding: 15px;
            border-radius: 6px;
            margin: 15px 0;
            border: 1px solid #c3e6cb;
        }
        .success-badge {
            background-color: #28a745;
            color: white;
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 14px;
            display: inline-block;
            margin-bottom: 10px;
        }
        .next-steps {
            background-color: #f8f9fa;
            padding: 15px;
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
        <div class="success-badge">✅ CONFIRMED</div>
        <h1 style="color: #155724; margin: 10px 0 0 0;">Congratulations!</h1>
        <h2 style="margin: 5px 0 0 0; color: #155724;">Your Appointment is Confirmed</h2>
    </div>

    <div class="content">
        <p>Hello {{ $patient->first_name }},</p>

        <p><strong>Excellent news!</strong> You successfully secured the appointment slot from our waiting list. Your appointment has been confirmed and added to your schedule.</p>

        <div class="appointment-details">
            <h3 style="margin-top: 0; color: #155724;">📅 Your Confirmed Appointment</h3>
            <ul style="margin: 0; padding-left: 20px;">
                <li><strong>Appointment ID:</strong> #{{ $appointment->id }}</li>
                <li><strong>Service:</strong> {{ $waitingListEntry->service_name }}</li>
                <li><strong>Date & Time:</strong> {{ \Carbon\Carbon::parse($appointment->appointment_datetime)->format('l, F j, Y \a\t g:i A') }}</li>
                <li><strong>Mode:</strong> {{ ucfirst($appointment->mode) }}</li>
                @if($appointment->location)
                    <li><strong>Location:</strong> {{ $appointment->location->name ?? 'TBD' }}</li>
                @endif
                <li><strong>Status:</strong> <span style="color: #28a745; font-weight: bold;">Confirmed</span></li>
            </ul>
        </div>

        <div class="next-steps">
            <h4 style="margin-top: 0;">📋 What's Next?</h4>
            <ul style="margin-bottom: 0;">
                <li><strong>Add to Calendar:</strong> Save this date and time in your personal calendar</li>
                <li><strong>Prepare for Your Visit:</strong> Gather any relevant documents or information</li>
                <li><strong>Arrive on Time:</strong> Please arrive 15 minutes early for check-in</li>
                @if($appointment->mode === 'virtual')
                    <li><strong>Virtual Meeting:</strong> You'll receive connection details closer to your appointment date</li>
                @endif
            </ul>
        </div>

        <div style="background-color: #e3f2fd; padding: 15px; border-radius: 6px; margin: 15px 0;">
            <p style="margin: 0; font-weight: bold; color: #1565c0;">
                💡 <strong>Reminder:</strong> If you need to reschedule or cancel, please contact us as soon as possible
                so we can offer the slot to another patient on our waiting list.
            </p>
        </div>

        <hr style="margin: 30px 0; border: none; border-top: 1px solid #e9ecef;">

        <h4>Need to Make Changes?</h4>
        <p>If you need to reschedule or cancel this appointment, please contact our clinic directly. Changes made with sufficient notice help us serve other patients on our waiting list.</p>

        <p>We look forward to seeing you soon!</p>
    </div>

    <div class="footer">
        <p><strong>Appointment Confirmation #{{ $appointment->id }}</strong></p>
        <p>Please save this email for your records.</p>
        <p>If you have any questions, please contact our clinic directly.</p>
    </div>
</body>
</html>