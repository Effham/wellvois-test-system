<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Server Error - {{ config('app.name') }}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        
        .error-container {
            background: white;
            border-radius: 20px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            max-width: 600px;
            width: 100%;
            padding: 60px 40px;
            text-align: center;
        }
        
        .error-code {
            font-size: 120px;
            font-weight: 800;
            color: #667eea;
            line-height: 1;
            margin-bottom: 20px;
            text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.1);
        }
        
        .error-title {
            font-size: 32px;
            font-weight: 700;
            color: #2d3748;
            margin-bottom: 15px;
        }
        
        .error-message {
            font-size: 18px;
            color: #718096;
            line-height: 1.6;
            margin-bottom: 30px;
        }
        
        .error-details {
            background: #f7fafc;
            border-left: 4px solid #667eea;
            padding: 20px;
            margin: 30px 0;
            text-align: left;
            border-radius: 8px;
        }
        
        .error-details-title {
            font-weight: 600;
            color: #2d3748;
            margin-bottom: 10px;
            font-size: 16px;
        }
        
        .error-details-content {
            font-family: 'Courier New', monospace;
            font-size: 14px;
            color: #e53e3e;
            word-break: break-all;
            line-height: 1.5;
        }
        
        .action-buttons {
            display: flex;
            gap: 15px;
            justify-content: center;
            flex-wrap: wrap;
        }
        
        .btn {
            display: inline-block;
            padding: 12px 30px;
            border-radius: 10px;
            text-decoration: none;
            font-weight: 600;
            font-size: 16px;
            transition: all 0.3s ease;
            cursor: pointer;
            border: none;
        }
        
        .btn-primary {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
        }
        
        .btn-primary:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(102, 126, 234, 0.6);
        }
        
        .btn-secondary {
            background: #e2e8f0;
            color: #4a5568;
        }
        
        .btn-secondary:hover {
            background: #cbd5e0;
            transform: translateY(-2px);
        }
        
        .support-text {
            margin-top: 30px;
            font-size: 14px;
            color: #a0aec0;
        }
        
        .support-text a {
            color: #667eea;
            text-decoration: none;
            font-weight: 600;
        }
        
        .support-text a:hover {
            text-decoration: underline;
        }
        
        @media (max-width: 600px) {
            .error-container {
                padding: 40px 20px;
            }
            
            .error-code {
                font-size: 80px;
            }
            
            .error-title {
                font-size: 24px;
            }
            
            .error-message {
                font-size: 16px;
            }
        }
    </style>
</head>
<body>
    <div class="error-container">
        <div class="error-code">500</div>
        <h1 class="error-title">Internal Server Error</h1>
        <p class="error-message">
            Oops! Something went wrong on our end. We're sorry for the inconvenience.
        </p>

        @if(config('app.debug') && isset($exception))
            <div class="error-details">
                <div class="error-details-title">Error Details (Debug Mode):</div>
                <div class="error-details-content">
                    {{ $exception->getMessage() }}
                </div>
                @if($exception->getFile())
                    <div style="margin-top: 10px; font-size: 12px; color: #718096;">
                        File: {{ basename($exception->getFile()) }} (Line {{ $exception->getLine() }})
                    </div>
                @endif
            </div>
        @else
            <p class="error-message" style="font-size: 16px; color: #a0aec0;">
                This error has been logged and our team has been notified.
            </p>
        @endif

        <div class="action-buttons">
            <a href="{{ url()->previous() }}" class="btn btn-secondary" onclick="event.preventDefault(); window.history.back();">
                Go Back
            </a>
            <a href="{{ url('/') }}" class="btn btn-primary">
                Go to Homepage
            </a>
        </div>

        <p class="support-text">
            If this problem persists, please <a href="mailto:{{ config('mail.from.address') }}">contact support</a>
        </p>
    </div>
</body>
</html>

