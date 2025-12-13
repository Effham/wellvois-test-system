<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Appointment Slot No Longer Available</title>
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
            background-color: #fff3cd;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 20px;
            text-align: center;
            border: 1px solid #ffeaa7;
        }
        .content {
            background-color: #fff;
            padding: 20px;
            border: 1px solid #e9ecef;
            border-radius: 8px;
            margin-bottom: 20px;
        }
        .info-box {
            background-color: #e3f2fd;
            padding: 15px;
            border-radius: 6px;
            margin: 15px 0;
            border: 1px solid #b3e5fc;
        }
        .encouragement {
            background-color: #e8f5e8;
            padding: 15px;
            border-radius: 6px;
            margin: 15px 0;
            border: 1px solid #c3e6cb;
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
        <h1 style="color: #856404; margin: 0;">📅 Appointment Update</h1>
        <h2 style="margin: 10px 0 0 0; color: #856404;">Slot No Longer Available</h2>
    </div>

    <div class="content">
        <p>Hello {{ $patient->first_name }},</p>

        <p>We wanted to let you know that the appointment slot we recently offered you for <strong>{{ $waitingListEntry->service_name }}</strong> has been taken by another patient.</p>

        <div class="info-box">
            <h4 style="margin-top: 0; color: #1565c0;">🔄 You're Still on Our Waiting List</h4>
            <p style="margin-bottom: 0;">
                <strong>Good news:</strong> You remain on our waiting list and will be notified when the next available slot opens up.
                We operate on a first-come, first-served basis for slot offers.
            </p>
        </div>

        <div class="encouragement">
            <h4 style="margin-top: 0; color: #155724;">✨ Stay Hopeful!</h4>
            <ul style="margin-bottom: 0;">
                <li>Slots become available regularly as schedules change</li>
                <li>You'll automatically receive an email when new slots match your preferences</li>
                <li>Your position on the waiting list is based on when you joined</li>
                <li>No action is needed from you - just wait for our next notification</li>
            </ul>
        </div>

        <hr style="margin: 30px 0; border: none; border-top: 1px solid #e9ecef;">

        <h4>Your Current Waiting List Preferences:</h4>
        <ul>
            <li><strong>Service:</strong> {{ $waitingListEntry->service_name }}</li>
            <li><strong>Preferred Day:</strong> {{ ucfirst($waitingListEntry->preferred_day) }}</li>
            <li><strong>Preferred Time:</strong> {{ ucfirst($waitingListEntry->preferred_time) }}</li>
            <li><strong>Mode:</strong> {{ ucfirst($waitingListEntry->mode) }}</li>
        </ul>

        <p><strong>Want to update your preferences?</strong> Please contact our clinic directly if you'd like to modify your waiting list preferences or if your availability has changed.</p>

        <div style="background-color: #f8f9fa; padding: 15px; border-radius: 6px; margin: 15px 0;">
            <p style="margin: 0; font-style: italic; color: #6c757d;">
                💭 <strong>Pro Tip:</strong> Setting your preferences to "Any day" and "Any time" increases your chances
                of getting the next available slot!
            </p>
        </div>

        <p>Thank you for your patience. We appreciate your understanding and look forward to serving you soon.</p>
    </div>

    <div class="footer">
        <p>You're receiving this email because you're on our waiting list for {{ $waitingListEntry->service_name }}.</p>
        <p>If you'd like to remove yourself from the waiting list, please contact our clinic directly.</p>
    </div>
</body>
</html>