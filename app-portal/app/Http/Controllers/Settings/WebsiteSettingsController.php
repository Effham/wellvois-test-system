<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Models\OrganizationSetting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class WebsiteSettingsController extends Controller
{
    public function __construct()
    {
        $this->middleware('permission:view-website')->only(['getNavigationSettings', 'getLayoutSettings', 'getAppearanceSettings']);
        $this->middleware('permission:update-website')->only(['saveNavigationSettings', 'saveLayoutSettings', 'saveAppearanceSettings']);
    }

    /**
     * Get website navigation settings
     */
    public function getNavigationSettings(): JsonResponse
    {
        $settings = OrganizationSetting::getByPrefix('website_navigation_');

        // Default navigation items if none exist
        $defaultItems = [
            ['id' => 'services', 'label' => 'Services', 'enabled' => true, 'order' => 1],
            ['id' => 'locations', 'label' => 'Locations', 'enabled' => true, 'order' => 2],
            ['id' => 'staff', 'label' => 'Staff', 'enabled' => true, 'order' => 3],
            ['id' => 'assess-yourself', 'label' => 'Assess Yourself', 'enabled' => true, 'order' => 4],
            ['id' => 'book-appointment', 'label' => 'Book Appointment', 'enabled' => true, 'order' => 5],
        ];

        $navigationItems = $settings['website_navigation_items'] ?? json_encode($defaultItems);

        return response()->json([
            'navigation_items' => json_decode($navigationItems, true),
        ]);
    }

    /**
     * Save website navigation settings
     */
    public function saveNavigationSettings(Request $request): JsonResponse
    {
        $request->validate([
            'navigation_items' => 'required|array',
            'navigation_items.*.id' => 'required|string',
            'navigation_items.*.label' => 'required|string',
            'navigation_items.*.enabled' => 'required|boolean',
            'navigation_items.*.order' => 'required|integer',
        ]);

        OrganizationSetting::updateOrCreate(
            ['key' => 'website_navigation_items'],
            ['value' => json_encode($request->navigation_items)]
        );

        return response()->json(['message' => 'Navigation settings saved successfully']);
    }

    /**
     * Get website layout settings
     */
    public function getLayoutSettings(): JsonResponse
    {
        $settings = OrganizationSetting::getByPrefix('website_layout_');

        return response()->json([
            'selected_layout' => $settings['website_layout_selected'] ?? 'sidebar',
            'layout_options' => [
                'classic' => $settings['website_layout_classic_enabled'] ?? true,
                'sidebar' => $settings['website_layout_sidebar_enabled'] ?? true,
                'compact' => $settings['website_layout_compact_enabled'] ?? true,
            ],
        ]);
    }

    /**
     * Save website layout settings
     */
    public function saveLayoutSettings(Request $request): JsonResponse
    {
        $request->validate([
            'selected_layout' => 'required|string|in:classic,sidebar,compact',
        ]);

        OrganizationSetting::updateOrCreate(
            ['key' => 'website_layout_selected'],
            ['value' => $request->selected_layout]
        );

        return response()->json(['message' => 'Layout settings saved successfully']);
    }

    /**
     * Get website appearance settings
     */
    public function getAppearanceSettings(): JsonResponse
    {
        $settings = OrganizationSetting::getByPrefix('website_appearance_');

        return response()->json([
            'hero_section' => [
                'enabled' => (bool) ($settings['website_appearance_hero_enabled'] ?? true),
                'title' => $settings['website_appearance_hero_title'] ?? 'Welcome to Our Healthcare Practice',
                'subtitle' => $settings['website_appearance_hero_subtitle'] ?? 'Providing comprehensive care with a focus on your health and wellbeing',
                'background_image' => $settings['website_appearance_hero_bg_image'] ?? null,
            ],
            'colors' => [
                'use_custom' => (bool) ($settings['website_appearance_colors_custom'] ?? false),
                'primary_color' => $settings['website_appearance_colors_primary'] ?? '#7c3aed',
                'accent_color' => $settings['website_appearance_colors_accent'] ?? '#10b981',
            ],
            'typography' => [
                'use_custom' => (bool) ($settings['website_appearance_typography_custom'] ?? false),
                'heading_font' => $settings['website_appearance_typography_heading'] ?? 'Inter',
                'body_font' => $settings['website_appearance_typography_body'] ?? 'Inter',
            ],
            'footer' => [
                'enabled' => (bool) ($settings['website_appearance_footer_enabled'] ?? true),
                'copyright_text' => $settings['website_appearance_footer_copyright'] ?? 'All rights reserved.',
                'additional_links' => json_decode($settings['website_appearance_footer_links'] ?? '[]', true),
            ],
        ]);
    }

    /**
     * Save website appearance settings
     */
    public function saveAppearanceSettings(Request $request): JsonResponse
    {
        $request->validate([
            'hero_section.enabled' => 'required|boolean',
            'hero_section.title' => 'required|string|max:255',
            'hero_section.subtitle' => 'required|string|max:500',
            'colors.use_custom' => 'required|boolean',
            'colors.primary_color' => 'required|string|regex:/^#[a-fA-F0-9]{6}$/',
            'colors.accent_color' => 'required|string|regex:/^#[a-fA-F0-9]{6}$/',
            'typography.use_custom' => 'required|boolean',
            'typography.heading_font' => 'required|string|max:100',
            'typography.body_font' => 'required|string|max:100',
            'footer.enabled' => 'required|boolean',
            'footer.copyright_text' => 'required|string|max:255',
            'footer.additional_links' => 'sometimes|array',
        ]);

        $settings = [
            'website_appearance_hero_enabled' => $request->input('hero_section.enabled'),
            'website_appearance_hero_title' => $request->input('hero_section.title'),
            'website_appearance_hero_subtitle' => $request->input('hero_section.subtitle'),
            'website_appearance_colors_custom' => $request->input('colors.use_custom'),
            'website_appearance_colors_primary' => $request->input('colors.primary_color'),
            'website_appearance_colors_accent' => $request->input('colors.accent_color'),
            'website_appearance_typography_custom' => $request->input('typography.use_custom'),
            'website_appearance_typography_heading' => $request->input('typography.heading_font'),
            'website_appearance_typography_body' => $request->input('typography.body_font'),
            'website_appearance_footer_enabled' => $request->input('footer.enabled'),
            'website_appearance_footer_copyright' => $request->input('footer.copyright_text'),
            'website_appearance_footer_links' => json_encode($request->input('footer.additional_links', [])),
        ];

        foreach ($settings as $key => $value) {
            OrganizationSetting::updateOrCreate(
                ['key' => $key],
                ['value' => $value]
            );
        }

        return response()->json(['message' => 'Appearance settings saved successfully']);
    }
}
