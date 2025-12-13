# Public Portal Feature

## Overview

This feature creates public-facing portal pages for each tenant in your EMR application. When a tenant registers, they automatically get a public website accessible at `{tenant-subdomain}.{domain}.com/public-portal` where visitors can view information about the clinic.

## Features Implemented

### 🌐 Public Portal Pages
- **Home Page** (`/public-portal`) - Overview with clinic stats and quick links
- **Services** (`/public-portal/services`) - All active services grouped by category
- **Locations** (`/public-portal/locations`) - Clinic locations with contact info and hours
- **Staff** (`/public-portal/staff`) - Healthcare professionals with bios and specialties

### 🎨 Tenant Branding
- Automatically applies tenant's appearance theme colors
- Shows tenant logo if uploaded, or fallback letter logo
- Uses tenant's custom fonts if configured
- Follows the same theming system as the authenticated portal

### 📱 Responsive Design
- Mobile-friendly navigation with collapsible menu
- Responsive card layouts
- Touch-friendly interface elements

## Technical Implementation

### Backend Components

#### 1. PublicPortalController (`app/Http/Controllers/PublicPortalController.php`)
- Handles all public portal routes
- Fetches data from tenant context without requiring authentication
- Applies appearance settings for theming
- Returns data for Inertia React pages

#### 2. PublicTenantAccess Middleware (`app/Http/Middleware/PublicTenantAccess.php`)
- Ensures tenant context is initialized
- Allows public access without authentication
- Registered as `public-tenant-access` middleware alias

#### 3. Routes (`routes/tenant.php`)
```php
// Public Portal Routes (no authentication required)
Route::middleware([
    'web',
    InitializeTenancyByDomain::class,
    'public-tenant-access',
])->prefix('public-portal')->name('public-portal.')->group(function () {
    Route::get('/', [PublicPortalController::class, 'index'])->name('index');
    Route::get('/services', [PublicPortalController::class, 'services'])->name('services');
    Route::get('/locations', [PublicPortalController::class, 'locations'])->name('locations');
    Route::get('/staff', [PublicPortalController::class, 'staff'])->name('staff');
});
```

### Frontend Components

#### 1. Public Portal Layout (`resources/js/layouts/public-portal-layout.tsx`)
- Shared layout for all public portal pages
- Handles tenant branding and theming
- Responsive navigation header and footer
- Integrates with the existing appearance system

#### 2. Page Components
- **Index** (`resources/js/pages/PublicPortal/Index.tsx`) - Home page with stats
- **Services** (`resources/js/pages/PublicPortal/Services.tsx`) - Services listing
- **Locations** (`resources/js/pages/PublicPortal/Locations.tsx`) - Location cards
- **Staff** (`resources/js/pages/PublicPortal/Staff.tsx`) - Staff profiles

## Data Sources

### Services
- Fetches from `services` table where `is_active = true`
- Groups by category for better organization
- Shows pricing, descriptions, and delivery modes

### Locations  
- Fetches from `locations` table where `is_active = true`
- Includes contact information and operating hours
- Formats addresses properly

### Staff/Practitioners
- Fetches from central `practitioners` table
- Only shows practitioners linked to current tenant with `ACCEPTED` status
- Shows profile pictures, bios, credentials, specialties, and languages

### Appearance Settings
- Fetches from `organization_settings` table with `appearance_` prefix
- Applies theme colors, logo, and fonts automatically
- Falls back to defaults if not configured

## Usage

### For Tenants
1. Register a new tenant through `/register`
2. Public portal is automatically available at `{tenant-subdomain}.{domain}.com/public-portal`
3. Configure appearance settings in admin panel to customize branding
4. Add services, locations, and invite practitioners to populate content

### URL Structure
- **Home**: `https://clinic-name.yourdomain.com/public-portal`
- **Services**: `https://clinic-name.yourdomain.com/public-portal/services`
- **Locations**: `https://clinic-name.yourdomain.com/public-portal/locations` 
- **Staff**: `https://clinic-name.yourdomain.com/public-portal/staff`

## Design Features

### Visual Elements
- Clean, professional healthcare-focused design
- Primary color theming throughout all elements
- Card-based layouts for easy scanning
- Clear call-to-action buttons
- Consistent iconography using Lucide React

### User Experience
- Breadcrumb navigation
- Hover effects on interactive elements
- Loading states and empty states
- Mobile-first responsive design
- Accessible markup and ARIA labels

## Security Considerations

### Access Control
- Public routes require no authentication
- Tenant context is properly isolated
- Only public-appropriate data is exposed
- No sensitive patient or internal data displayed

### Data Privacy
- Staff information is limited to professional details only
- No patient data or medical records exposed
- Contact information respects privacy settings
- Profile pictures use secure storage paths

## Future Enhancement Ideas

1. **SEO Optimization**
   - Meta tags for search engines
   - Structured data markup
   - XML sitemaps for each tenant

2. **Advanced Features**
   - Online appointment booking integration
   - Contact forms with spam protection
   - Patient portal login integration
   - Multi-language support

3. **Analytics**
   - Visit tracking per tenant
   - Popular services/staff metrics
   - Conversion tracking for appointments

4. **Customization**
   - Page builder for custom layouts
   - Additional page types (About, Blog)
   - Social media integration
   - Custom domain mapping

## Testing

The implementation includes:
- Route registration verification
- Middleware functionality testing
- Data fetching validation
- Theme application testing

All routes are properly registered and accessible:
```bash
php artisan route:list --name=public-portal
```

## Dependencies

Uses existing application infrastructure:
- Laravel's multi-tenancy system
- Inertia.js for SSR React pages
- Tailwind CSS for styling
- Existing UI component library
- Current appearance/theming system 