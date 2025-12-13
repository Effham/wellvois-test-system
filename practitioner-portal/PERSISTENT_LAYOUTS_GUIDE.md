# Persistent Layouts Migration Guide

## Overview

Your application now supports **persistent layouts** using Inertia.js v2's layout system. This provides:

- ⚡ **Faster navigation** - Only page content reloads, not the entire layout
- 🎨 **No flash/flicker** - Sidebar and header stay mounted during navigation
- 💾 **State preservation** - Layout component state persists across pages
- 🚀 **Better UX** - Smoother transitions with subtle loading indicators

## How It Works

### Before (Old Pattern - Slow)
```tsx
// ❌ OLD: Layout wraps content inside the page component
export default function MyPage() {
    return (
        <AppLayout breadcrumbs={[...]}>
            <Head title="My Page" />
            <div>My content</div>
        </AppLayout>
    );
}
```

**Problem**: Every navigation re-mounts the entire `AppLayout`, including sidebar, header, etc.

### After (New Pattern - Fast)
```tsx
// ✅ NEW: Layout is assigned as a property
import { withAppLayout } from '@/utils/layout';

function MyPage() {
    return (
        <>
            <Head title="My Page" />
            <div>My content</div>
        </>
    );
}

export default withAppLayout(MyPage, {
    breadcrumbs: [
        { title: 'Dashboard', href: route('dashboard') },
        { title: 'My Page', href: route('my-page') }
    ]
});
```

**Benefit**: `AppLayout` stays mounted, only `MyPage` content is swapped on navigation!

## Migration Steps

### Option 1: Using Helper Functions (Recommended)

```tsx
import { withAppLayout } from '@/utils/layout';

function DashboardPage() {
    return <div>Dashboard content</div>;
}

export default withAppLayout(DashboardPage, {
    breadcrumbs: [
        { title: 'Dashboard', href: route('dashboard') }
    ]
});
```

### Option 2: Direct Assignment

```tsx
import AppLayout from '@/layouts/app-layout';

function DashboardPage() {
    return <div>Dashboard content</div>;
}

DashboardPage.layout = (page: React.ReactElement) => (
    <AppLayout breadcrumbs={[{ title: 'Dashboard', href: route('dashboard') }]}>
        {page}
    </AppLayout>
);

export default DashboardPage;
```

## Available Layout Helpers

### 1. `withAppLayout` - Main Application Layout

```tsx
import { withAppLayout } from '@/utils/layout';

export default withAppLayout(MyPage, {
    breadcrumbs: [
        { title: 'Dashboard', href: route('dashboard') },
        { title: 'My Page' }
    ]
});
```

### 2. `withSettingsLayout` - Settings Pages

```tsx
import { withSettingsLayout } from '@/utils/layout';

export default withSettingsLayout(ProfilePage, {
    activeSection: 'profile',
    title: 'Profile Settings'
});
```

### 3. `withAuthLayout` - Authentication Pages

```tsx
import { withAuthLayout } from '@/utils/layout';

export default withAuthLayout(LoginPage, {
    title: 'Sign in to your account',
    description: 'Enter your credentials below'
});
```

### 4. `withLayout` - Custom Layouts

```tsx
import { withLayout } from '@/utils/layout';
import CustomLayout from '@/layouts/custom-layout';

export default withLayout(MyPage, (page) => (
    <CustomLayout customProp="value">
        {page}
    </CustomLayout>
));
```

## Loading States

The layout now includes smart loading indicators:

- **Minimal mode** (default): Subtle top progress bar + content fade
- **Full mode**: Centered loading spinner

```tsx
// Minimal loading (good for persistent layouts)
<PageContentLoader delay={150} mode="minimal">
    {children}
</PageContentLoader>

// Full loading (good for initial page loads)
<PageContentLoader delay={300} mode="full">
    {children}
</PageContentLoader>
```

## Pages That Don't Need Layouts

Some pages (like auth pages or public pages) might not need layouts:

```tsx
// Just export the component without wrapping
export default function LoginPage() {
    return <div>Login form</div>;
}
```

## Migration Checklist

For each page in `resources/js/pages/`:

- [ ] Remove `<AppLayout>` wrapper from inside the component
- [ ] Move `breadcrumbs` to layout helper
- [ ] Use `withAppLayout()` or similar helper
- [ ] Keep `<Head title="..." />` inside the page component
- [ ] Test navigation to/from the page

## Example: Complete Migration

### Before

```tsx
import AppLayout from '@/layouts/app-layout';
import { Head } from '@inertiajs/react';

export default function UsersIndex() {
    return (
        <AppLayout breadcrumbs={[
            { title: 'Dashboard', href: route('dashboard') },
            { title: 'Users', href: route('users.index') }
        ]}>
            <Head title="Users" />
            <div className="p-6">
                <h1>Users</h1>
                {/* page content */}
            </div>
        </AppLayout>
    );
}
```

### After

```tsx
import { withAppLayout } from '@/utils/layout';
import { Head } from '@inertiajs/react';

function UsersIndex() {
    return (
        <>
            <Head title="Users" />
            <div className="p-6">
                <h1>Users</h1>
                {/* page content */}
            </div>
        </>
    );
}

export default withAppLayout(UsersIndex, {
    breadcrumbs: [
        { title: 'Dashboard', href: route('dashboard') },
        { title: 'Users', href: route('users.index') }
    ]
});
```

## Testing

After migration, test:

1. ✅ Page loads correctly
2. ✅ Navigation to/from page works
3. ✅ Breadcrumbs display correctly
4. ✅ No layout flicker on navigation
5. ✅ Loading indicator appears for slow requests

## Performance Impact

Expected improvements:
- **50-70% faster** page transitions
- **Reduced DOM manipulation** (layout stays mounted)
- **Smoother animations** (no layout re-mount flicker)
- **Better perceived performance** (instant sidebar/header)

## Need Help?

Check existing migrated pages:
- `resources/js/pages/PractitionerDashboard/Index.tsx`
- `resources/js/pages/PatientDashboard/Index.tsx`

These already use the `.layout` property pattern!

