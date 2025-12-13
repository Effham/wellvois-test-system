<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Workspace Not Found - McDowall</title>
    <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;600;700&family=Fredoka+One&display=swap" rel="stylesheet">
    <style>
        :root {
            --primary: #FF4D80;
            --secondary: #00E0FF;
            --accent: #FFE066;
            --dark: #1A1A2E;
            --light: #F5F5FF;
        }
        
        body {
            margin: 0;
            padding: 0;
            height: 100vh;
            background: var(--dark);
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: 'Space Grotesk', sans-serif;
            color: var(--light);
            overflow: hidden;
            position: relative;
        }
        
        .container {
            text-align: center;
            max-width: 600px;
            padding: 40px;
            position: relative;
            z-index: 2;
            background: rgba(26, 26, 46, 0.8);
            backdrop-filter: blur(10px);
            border-radius: 24px;
            border: 2px solid rgba(255, 255, 255, 0.1);
            box-shadow: 0 20px 50px rgba(0, 0, 0, 0.3);
            animation: float 6s ease-in-out infinite;
        }
        
        @keyframes float {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-20px); }
        }
        
        h1 {
            font-size: 3.5rem;
            color: var(--primary);
            margin-bottom: 20px;
            font-weight: 700;
            text-shadow: 0 0 10px rgba(255, 77, 128, 0.4);
            font-family: 'Fredoka One', cursive;
            letter-spacing: 1px;
        }
        
        p {
            font-size: 1.2rem;
            margin-bottom: 30px;
            color: var(--light);
            line-height: 1.6;
            max-width: 80%;
            margin-left: auto;
            margin-right: auto;
        }
        
        a {
            background: linear-gradient(45deg, var(--primary), var(--secondary));
            color: var(--dark);
            padding: 16px 32px;
            border-radius: 50px;
            font-weight: 700;
            text-decoration: none;
            transition: all 0.3s ease;
            display: inline-block;
            border: none;
            font-size: 1.1rem;
            box-shadow: 0 5px 15px rgba(0, 224, 255, 0.3);
            position: relative;
            overflow: hidden;
        }
        
        a:hover {
            transform: translateY(-3px);
            box-shadow: 0 8px 25px rgba(255, 77, 128, 0.4);
        }
        
        a::before {
            content: '';
            position: absolute;
            top: 0;
            left: -100%;
            width: 100%;
            height: 100%;
            background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
            transition: 0.5s;
        }
        
        a:hover::before {
            left: 100%;
        }
        
        .footer {
            margin-top: 40px;
            font-size: 0.9rem;
            color: rgba(255, 255, 255, 0.6);
        }
        
        /* Abstract background elements */
        .bg-element {
            position: absolute;
            border-radius: 50%;
            filter: blur(60px);
            opacity: 0.6;
            z-index: 1;
        }
        
        .bg-1 {
            width: 300px;
            height: 300px;
            background: var(--primary);
            top: -100px;
            left: -100px;
            animation: move1 15s infinite alternate;
        }
        
        .bg-2 {
            width: 400px;
            height: 400px;
            background: var(--secondary);
            bottom: -150px;
            right: -100px;
            animation: move2 18s infinite alternate;
        }
        
        .bg-3 {
            width: 200px;
            height: 200px;
            background: var(--accent);
            top: 50%;
            left: 20%;
            animation: move3 12s infinite alternate;
        }
        
        @keyframes move1 {
            0% { transform: translate(0, 0); }
            100% { transform: translate(50px, 100px); }
        }
        
        @keyframes move2 {
            0% { transform: translate(0, 0); }
            100% { transform: translate(-100px, -50px); }
        }
        
        @keyframes move3 {
            0% { transform: translate(0, 0); }
            100% { transform: translate(70px, -70px); }
        }
        
        /* Glitch effect on hover */
        .glitch {
            position: relative;
        }
        
        .glitch:hover::before, .glitch:hover::after {
            content: attr(data-text);
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: var(--dark);
        }
        
        .glitch:hover::before {
            color: var(--secondary);
            animation: glitch-effect 3s infinite linear alternate-reverse;
            z-index: -1;
        }
        
        .glitch:hover::after {
            color: var(--primary);
            animation: glitch-effect 2s infinite linear alternate;
            z-index: -2;
        }
        
        @keyframes glitch-effect {
            0% { transform: translate(0); }
            20% { transform: translate(-5px, 5px); }
            40% { transform: translate(-5px, -5px); }
            60% { transform: translate(5px, 5px); }
            80% { transform: translate(5px, -5px); }
            100% { transform: translate(0); }
        }
        
        /* Floating shapes */
        .shape {
            position: absolute;
            opacity: 0.3;
            animation: float 8s ease-in-out infinite;
        }
        
        .triangle {
            width: 0;
            height: 0;
            border-left: 30px solid transparent;
            border-right: 30px solid transparent;
            border-bottom: 50px solid var(--accent);
            top: 20%;
            right: 10%;
            animation-delay: 0.5s;
        }
        
        .circle {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background: var(--secondary);
            bottom: 30%;
            left: 15%;
            animation-delay: 1s;
        }
        
        .square {
            width: 40px;
            height: 40px;
            background: var(--primary);
            top: 70%;
            right: 20%;
            transform: rotate(45deg);
            animation-delay: 1.5s;
        }
    </style>
</head>
<body>
    <!-- Abstract background elements -->
    <div class="bg-element bg-1"></div>
    <div class="bg-element bg-2"></div>
    <div class="bg-element bg-3"></div>
    
    <!-- Floating shapes -->
    <div class="shape triangle"></div>
    <div class="shape circle"></div>
    <div class="shape square"></div>
    
    <div class="container">
        <h1 class="glitch" data-text="404 Lost in Space">404 Lost in Space</h1>
        <p>Whoops! Our cosmic scanners can't locate this workspace. It might have drifted into another dimension or maybe it was never here to begin with.</p>
        <div class="footer">
            &copy; {{ date('Y') }} Practice Management System by Build Me App Inc.
        </div>
    </div>
    
    <!-- Confetti animation on click -->
    <script src="https://cdn.jsdelivr.net/npm/canvas-confetti@1.4.0/dist/confetti.browser.min.js"></script>
    <script>
        document.querySelector('a').addEventListener('click', function(e) {
            e.preventDefault();
            confetti({
                particleCount: 100,
                spread: 70,
                origin: { y: 0.6 },
                colors: ['#FF4D80', '#00E0FF', '#FFE066']
            });
            setTimeout(() => {
                window.location.href = "{{ url('/') }}";
            }, 800);
        });
    </script>
</body>
</html>