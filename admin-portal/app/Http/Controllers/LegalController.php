<?php

namespace App\Http\Controllers;

use Inertia\Inertia;

class LegalController extends Controller
{
    /**
     * Display the Terms of Service page
     */
    public function termsOfService()
    {
        return Inertia::render('Legal/TermsOfService');
    }

    /**
     * Display the Privacy Policy page
     */
    public function privacyPolicy()
    {
        return Inertia::render('Legal/PrivacyPolicy');
    }
}
