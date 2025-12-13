<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Appointment {{ ucfirst($status) }}</title>
    
    @php
        $themeColor = $tenantTheme ?? '#007bff'; // Fallback to blue if no theme is set
        
        // Simple color adjustment using basic calculations
        // Convert hex to RGB
        $hex = ltrim($themeColor, '#');
        $r = hexdec(substr($hex, 0, 2));
        $g = hexdec(substr($hex, 2, 2));
        $b = hexdec(substr($hex, 4, 2));
        
        // Create darker version (reduce by 20%)
        $darkR = max(0, $r - 51);
        $darkG = max(0, $g - 51);
        $darkB = max(0, $b - 51);
        $themeDark = sprintf("#%02x%02x%02x", $darkR, $darkG, $darkB);
        
        // Create lighter version (increase by 40%)
        $lightR = min(255, $r + 102);
        $lightG = min(255, $g + 102);
        $lightB = min(255, $b + 102);
        $themeLight = sprintf("#%02x%02x%02x", $lightR, $lightG, $lightB);
        
        // Create much lighter version (increase by 70%)
        $lighterR = min(255, $r + 179);
        $lighterG = min(255, $g + 179);
        $lighterB = min(255, $b + 179);
        $themeLighter = sprintf("#%02x%02x%02x", $lighterR, $lighterG, $lighterB);
        
        $statusConfig = [
            'confirmed' => [
                'icon' => '✅',
                'label' => 'CONFIRMED',
                'title' => '🏥 Appointment Confirmation',
                'subtitle' => 'Your appointment has been successfully confirmed',
                'class' => 'status-confirmed'
            ],
            'completed' => [
                'icon' => '✓',
                'label' => 'COMPLETED',
                'title' => '🏥 Appointment Completed',
                'subtitle' => 'Your appointment has been completed',
                'class' => 'status-completed'
            ],
            'cancelled' => [
                'icon' => '✘',
                'label' => 'CANCELLED',
                'title' => '🏥 Appointment Cancelled',
                'subtitle' => 'Your appointment has been cancelled',
                'class' => 'status-cancelled'
            ],
            'declined' => [
                'icon' => '✘',
                'label' => 'DECLINED',
                'title' => '🏥 Appointment Declined',
                'subtitle' => 'Your appointment has been declined',
                'class' => 'status-declined'
            ]
        ];
        
        $currentStatus = $statusConfig[$status] ?? $statusConfig['confirmed'];
    @endphp

    <style>
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f4f4f4;
        }
        .email-container {
            background-color: white;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 0 10px rgba(0,0,0,0.1);
        }
        .header {
            text-align: center;
            border-bottom: 3px solid {{ $themeColor }};
            padding-bottom: 20px;
            margin-bottom: 30px;
        }
        .header h1 {
            color: {{ $themeColor }};
            margin: 0;
            font-size: 28px;
        }
        .appointment-details {
            background-color: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            border-left: 4px solid {{ $themeColor }};
            margin: 20px 0;
        }
        .appointment-details h3 {
            color: {{ $themeColor }} !important;
        }
        .detail-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 10px;
            padding: 8px 0;
            border-bottom: 1px solid #e0e0e0;
        }
        .detail-row:last-child {
            border-bottom: none;
        }
        .detail-label {
            font-weight: bold;
            color: #555;
            flex: 1;
        }
        .detail-value {
            flex: 2;
            text-align: right;
        }
        .status-badge {
            color: white;
            padding: 8px 16px;
            border-radius: 20px;
            display: inline-block;
            font-weight: bold;
            margin: 15px 0;
        }
        .status-confirmed {
            background-color: #28a745;
        }
        .status-completed {
            background-color: #17a2b8;
        }
        .status-cancelled {
            background-color: #dc3545;
        }
        .status-declined {
            background-color: #fd7e14;
        }
        .message-section {
            margin: 20px 0;
            padding: 15px;
            background-color: {{ $themeLighter }};
            border-radius: 6px;
            border-left: 3px solid {{ $themeColor }};
        }
        .footer {
            text-align: center;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #ddd;
            color: #666;
            font-size: 14px;
        }
        .contact-info {
            background-color: {{ $themeLighter }};
            padding: 15px;
            border-radius: 6px;
            margin: 20px 0;
            border-left: 4px solid {{ $themeLight }};
        }
        .btn {
            display: inline-block;
            padding: 12px 24px;
            background-color: {{ $themeColor }};
            color: white;
            text-decoration: none;
            border-radius: 6px;
            margin: 15px 5px;
            font-weight: bold;
        }
        .btn:hover {
            background-color: {{ $themeDark }};
        }
        .btn-secondary {
            background-color: #6c757d;
        }
        .btn-secondary:hover {
            background-color: #545b62;
        }
        .btn-success {
            background-color: #28a745;
        }
        .btn-success:hover {
            background-color: #218838;
        }
        .alert {
            padding: 15px;
            margin: 20px 0;
            border-radius: 6px;
        }
        .alert-danger {
            background-color: #f8d7da;
            border: 1px solid #f5c6cb;
            color: #721c24;
        }
        .alert-warning {
            background-color: #fff3cd;
            border: 1px solid #ffeaa7;
            color: #856404;
        }
        .alert-info {
            background-color: #d1ecf1;
            border: 1px solid #bee5eb;
            color: #0c5460;
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="header">
            <h1>{{ $currentStatus['title'] }}</h1>
            <p>{{ $currentStatus['subtitle'] }}</p>
        </div>

        <div class="status-badge {{ $currentStatus['class'] }}">
            {{ $currentStatus['icon'] }} {{ $currentStatus['label'] }}
        </div>

        {{-- Status-specific messages --}}
        @if($status === 'confirmed')
            <div class="message-section">
                @if($recipientType === 'patient')
                    <h3>Dear {{ $appointment->patient_name ?? 'Patient' }},</h3>
                    <p>We are pleased to confirm your upcoming appointment with <strong>Dr. {{ $appointment->practitioner_name ?? 'Doctor' }}</strong>.</p>
                @else
                    <h3>Dear Dr. {{ $appointment->practitioner_name ?? 'Doctor' }},</h3>
                    <p>This is to confirm your upcoming appointment with patient <strong>{{ $appointment->patient_name ?? 'Patient Name' }}</strong>.</p>
                @endif
            </div>
        @elseif($status === 'completed')
            <div class="message-section">
                @if($recipientType === 'patient')
                    <h3>Dear {{ $appointment->patient_name ?? 'Patient' }},</h3>
                    <p>Your appointment with <strong>Dr. {{ $appointment->practitioner_name ?? 'Doctor' }}</strong> has been completed successfully.</p>
                    <p>Thank you for choosing our healthcare services. We hope you had a positive experience.</p>
                @else
                    <h3>Dear Dr. {{ $appointment->practitioner_name ?? 'Doctor' }},</h3>
                    <p>Your appointment with patient <strong>{{ $appointment->patient_name ?? 'Patient Name' }}</strong> has been marked as completed.</p>
                @endif
            </div>
        @elseif($status === 'cancelled')
            <div class="alert alert-danger">
                @if($recipientType === 'patient')
                    <h3>Dear {{ $appointment->patient_name ?? 'Patient' }},</h3>
                    <p><strong>Your appointment has been cancelled.</strong></p>
                    <p>Your appointment with <strong>Dr. {{ $appointment->practitioner_name ?? 'Doctor' }}</strong> scheduled for {{ $appointment->formatted_date ?? ($appointment->getFormattedDate('l, F j, Y') ?? date('l, F j, Y', strtotime($appointment->appointment_datetime ?? now()))) }} at {{ $appointment->formatted_time ?? ($appointment->getFormattedTime('g:i A') ?? date('g:i A', strtotime($appointment->appointment_datetime ?? '09:00:00'))) }} has been cancelled.</p>
                    <p>If you would like to reschedule, please contact us at {{ $appointment->clinic_phone ?? '(555) 123-4567' }}.</p>
                @else
                    <h3>Dear Dr. {{ $appointment->practitioner_name ?? 'Doctor' }},</h3>
                    <p><strong>Appointment has been cancelled.</strong></p>
                    <p>The appointment with patient <strong>{{ $appointment->patient_name ?? 'Patient Name' }}</strong> has been cancelled.</p>
                @endif
            </div>
        @elseif($status === 'declined')
            <div class="alert alert-warning">
                @if($recipientType === 'patient')
                    <h3>Dear {{ $appointment->patient_name ?? 'Patient' }},</h3>
                    <p><strong>Your appointment request has been declined.</strong></p>
                    <p>Unfortunately, your appointment request with <strong>Dr. {{ $appointment->practitioner_name ?? 'Doctor' }}</strong> for {{ $appointment->formatted_date ?? ($appointment->getFormattedDate('l, F j, Y') ?? date('l, F j, Y', strtotime($appointment->appointment_datetime ?? now()))) }} at {{ $appointment->formatted_time ?? ($appointment->getFormattedTime('g:i A') ?? date('g:i A', strtotime($appointment->appointment_datetime ?? '09:00:00'))) }} has been declined.</p>
                    <p>Please contact us at {{ $appointment->clinic_phone ?? '(555) 123-4567' }} to discuss alternative appointment times.</p>
                @else
                    <h3>Dear Dr. {{ $appointment->practitioner_name ?? 'Doctor' }},</h3>
                    <p><strong>Appointment request has been declined.</strong></p>
                    <p>The appointment request from patient <strong>{{ $appointment->patient_name ?? 'Patient Name' }}</strong> has been declined.</p>
                @endif
            </div>
        @endif

        <div class="appointment-details">
            <h3 style="margin-top: 0; color: {{ $themeColor }};">📋 Appointment Details</h3>
            
            <div class="detail-row">
                <div class="detail-label">📅 Date:</div>
                <div class="detail-value">
                    {{ $appointment->formatted_date ?? ($appointment->getFormattedDate('l, F j, Y') ?? date('l, F j, Y', strtotime($appointment->appointment_datetime ?? now()))) }}
                </div>
            </div>

            <div class="detail-row">
                <div class="detail-label">⏰ Time:</div>
                <div class="detail-value">
                    {{ $appointment->formatted_time ?? ($appointment->getFormattedTime('g:i A') ?? date('g:i A', strtotime($appointment->appointment_datetime ?? '09:00:00'))) }}
                    @if($appointment->location_timezone_abbr ?? $appointment->getLocationTimezoneAbbreviation())
                        ({{ $appointment->location_timezone_abbr ?? $appointment->getLocationTimezoneAbbreviation() }})
                    @endif
                </div>
            </div>

            @if($recipientType === 'patient')
                <div class="detail-row">
                    <div class="detail-label">👨‍⚕️ Practitioner:</div>
                    <div class="detail-value">Dr. {{ $appointment->practitioner_name ?? 'Doctor Name' }}</div>
                </div>

                <div class="detail-row">
                    <div class="detail-label">🏢 Department:</div>
                    <div class="detail-value">{{ $appointment->department ?? 'General Medicine' }}</div>
                </div>
            @else
                <div class="detail-row">
                    <div class="detail-label">👤 Patient:</div>
                    <div class="detail-value">{{ $appointment->patient_name ?? 'Patient Name' }}</div>
                </div>

                <div class="detail-row">
                    <div class="detail-label">📱 Patient Contact:</div>
                    <div class="detail-value">{{ $appointment->patient_phone ?? 'N/A' }}</div>
                </div>
            @endif

            <div class="detail-row">
                <div class="detail-label">📍 Location:</div>
                <div class="detail-value">{{ $appointment->location ?? 'Clinic Address' }}</div>
            </div>

            @if(isset($appointment->appointment_type))
                <div class="detail-row">
                    <div class="detail-label">📝 Type:</div>
                    <div class="detail-value">{{ $appointment->appointment_type }}</div>
                </div>
            @endif

            @if(isset($appointment->notes) && !empty($appointment->notes))
                <div class="detail-row">
                    <div class="detail-label">📋 Notes:</div>
                    <div class="detail-value">{{ $appointment->notes }}</div>
                </div>
            @endif

            <div class="detail-row">
                <div class="detail-label">🆔 Appointment ID:</div>
                <div class="detail-value">#{{ $appointment->id ?? 'AP' . rand(1000, 9999) }}</div>
            </div>

            <div class="detail-row">
                <div class="detail-label">📊 Status:</div>
                <div class="detail-value"><strong>{{ ucfirst($status) }}</strong></div>
            </div>
        </div>

        {{-- Status-specific action buttons and information --}}
        @if($recipientType === 'patient')
            @if($status === 'confirmed')
                <div class="contact-info">
                    <h4 style="margin-top: 0; color: #856404;">📞 Important Information</h4>
                    <p><strong>Please arrive 15 minutes early</strong> for check-in and registration.</p>
                    <p>If you need to reschedule or cancel, please contact us at least 24 hours in advance.</p>
                    <p><strong>Contact:</strong> {{ $appointment->clinic_phone ?? '(555) 123-4567' }}</p>
                    <p><strong>Email:</strong> {{ $appointment->clinic_email ?? 'appointments@clinic.com' }}</p>
                </div>

                <div style="text-align: center;">
                    <a href="#" class="btn">Add to Calendar</a>
                    <a href="#" class="btn btn-secondary">Reschedule</a>
                </div>

                <div class="message-section">
                    <p><strong>What to Bring:</strong></p>
                    <ul>
                        <li>Valid ID and insurance card</li>
                        <li>List of current medications</li>
                        <li>Previous medical records (if applicable)</li>
                        <li>Payment method for copay</li>
                    </ul>
                </div>
            @elseif($status === 'completed')
                <div class="alert alert-info">
                    <h4 style="margin-top: 0;">📋 Follow-up Information</h4>
                    <p>If you have any questions about your visit or need follow-up care, please don't hesitate to contact us.</p>
                    <p><strong>Contact:</strong> {{ $appointment->clinic_phone ?? '(555) 123-4567' }}</p>
                </div>

                <div style="text-align: center;">
                    <a href="#" class="btn btn-success">Book Follow-up</a>
                    <a href="#" class="btn btn-secondary">View Medical Records</a>
                </div>
            @elseif(in_array($status, ['cancelled', 'declined']))
                <div class="contact-info">
                    <h4 style="margin-top: 0; color: #856404;">📞 Need to Reschedule?</h4>
                    <p>We apologize for any inconvenience. Our staff is ready to help you find an alternative appointment time.</p>
                    <p><strong>Contact:</strong> {{ $appointment->clinic_phone ?? '(555) 123-4567' }}</p>
                    <p><strong>Email:</strong> {{ $appointment->clinic_email ?? 'appointments@clinic.com' }}</p>
                </div>

                <div style="text-align: center;">
                    <a href="#" class="btn">Book New Appointment</a>
                    <a href="#" class="btn btn-secondary">Contact Support</a>
                </div>
            @endif
        @else
            {{-- Practitioner-specific content --}}
            @if($status === 'confirmed')
                <div class="contact-info">
                    <h4 style="margin-top: 0; color: #856404;">📋 Practitioner Notes</h4>
                    <p>Please review the patient's medical history before the appointment.</p>
                    <p>Patient contact: {{ $appointment->patient_phone ?? 'N/A' }}</p>
                    <p>Patient email: {{ $appointment->patient_email ?? 'N/A' }}</p>
                </div>

                <div style="text-align: center;">
                    <a href="#" class="btn">View Patient Records</a>
                    <a href="#" class="btn btn-secondary">Update Schedule</a>
                </div>
            @elseif($status === 'completed')
                <div style="text-align: center;">
                    <a href="#" class="btn">Add Notes</a>
                    <a href="#" class="btn btn-secondary">Schedule Follow-up</a>
                </div>
            @endif
        @endif

        <div class="footer">
            <p>This is an automated notification email. Please do not reply to this email.</p>
            <p>© {{ date('Y') }} Healthcare Clinic. All rights reserved.</p>
            <p>📍 123 Healthcare Ave, Medical City, MC 12345 | 📞 (555) 123-4567</p>
        </div>
    </div>
</body>
</html>