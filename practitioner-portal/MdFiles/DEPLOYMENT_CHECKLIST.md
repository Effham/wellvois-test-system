# Deployment Checklist - Error Handling & 500 Fix

## Overview
This deployment includes two major fixes:
1. **Error handling in middleware** - Prevents crashes from database failures
2. **Beautiful error pages** - Shows proper error pages instead of blank browser 500 screens

---

## Files Changed

### Modified Files
- ✅ `app/Http/Middleware/HandleInertiaRequests.php` - Added comprehensive error handling
- ✅ `bootstrap/app.php` - Added global exception handler

### New Files Created
- ✅ `resources/views/errors/500.blade.php` - Regular 500 error page
- ✅ `resources/views/errors/500-inertia.blade.php` - Inertia 500 error page  
- ✅ `resources/views/errors/503.blade.php` - Maintenance mode page

### Documentation Files (Optional to deploy)
- 📄 `MdFiles/500_ERROR_FIX_EXPLANATION.md`
- 📄 `MdFiles/ERROR_HANDLING_IMPROVEMENTS.md`
- 📄 `MdFiles/DEPLOYMENT_CHECKLIST.md` (this file)

---

## Pre-Deployment Checklist

### 1. Code Review
- [ ] Review `HandleInertiaRequests.php` changes
- [ ] Review `bootstrap/app.php` changes
- [ ] Review error page designs

### 2. Local Testing
```bash
# Test error pages locally
php artisan serve

# Visit test routes (add temporarily to routes/web.php):
Route::get('/test-500', function() {
    throw new \Exception('Test error');
});

# Then visit http://localhost:8000/test-500
```

- [ ] Verify 500 error page displays correctly
- [ ] Verify error details show in debug mode
- [ ] Verify buttons work (Go Back, Go to Homepage)
- [ ] Test on mobile/responsive view

### 3. Git Commit
```bash
# Stage changes
git add app/Http/Middleware/HandleInertiaRequests.php
git add bootstrap/app.php
git add resources/views/errors/

# Optional: Add documentation
git add MdFiles/

# Commit with descriptive message
git commit -m "Fix: Add comprehensive error handling to prevent 500 browser errors

- Add try-catch blocks in HandleInertiaRequests middleware
- Extract complex queries into protected helper methods
- Add global exception handler with full logging
- Create beautiful error pages (500, 500-inertia, 503)
- Log all errors with complete context (user, tenant, URL, trace)

Fixes issue where production server showed blank browser 500 errors
on page reload after implementing persistent layouts."

# Push to repository
git push origin your-branch-name
```

---

## Deployment Steps

### Step 1: Deploy Code
```bash
# SSH into production server
ssh user@your-server.com

# Navigate to application directory
cd /path/to/emr-web

# Pull latest changes
git pull origin main  # or your branch name

# If using a deployment tool like Envoyer, deploy through the UI
```

### Step 2: Clear Caches (Important!)
```bash
# Clear all caches to ensure new error handling takes effect
php artisan cache:clear
php artisan config:clear
php artisan view:clear
php artisan route:clear

# Optimize for production
php artisan config:cache
php artisan route:cache
php artisan view:cache
```

### Step 3: Restart Services
```bash
# Restart PHP-FPM (adapt to your setup)
sudo systemctl restart php8.4-fpm

# Or if using PHP-FPM pool
sudo service php8.4-fpm restart

# Restart queue workers if using queues
php artisan queue:restart

# If using Laravel Octane
php artisan octane:reload
```

### Step 4: Test Production
- [ ] Navigate to your application
- [ ] Test pages that previously showed 500 errors
- [ ] Try refreshing/reloading pages
- [ ] Test on different pages (Dashboard, Patients, Calendar, Settings)
- [ ] Verify error pages show correctly (if you can trigger an error safely)

---

## Post-Deployment Monitoring

### Immediate (First 30 Minutes)
```bash
# Watch logs in real-time
tail -f storage/logs/laravel.log

# Look for any new errors
grep "ERROR" storage/logs/laravel.log | tail -20

# Check for specific middleware errors
grep "HandleInertiaRequests" storage/logs/laravel.log | tail -20
```

**What to watch for:**
- Any new errors that weren't happening before
- Errors related to the new error handler itself
- User reports of blank pages (should be gone now!)

### First 24 Hours
```bash
# Count errors in the last hour
grep "Application Exception" storage/logs/laravel.log | grep "$(date -u +'%Y-%m-%d %H')" | wc -l

# View recent application exceptions
grep "Application Exception" storage/logs/laravel.log | tail -50

# Check for middleware failures
grep "Failed to load user auth data" storage/logs/laravel.log
grep "Failed to load organization settings" storage/logs/laravel.log
```

**Success indicators:**
- ✅ No blank browser 500 errors reported by users
- ✅ Users see error pages when something goes wrong
- ✅ Errors are logged with full context
- ✅ Page reloads work without crashing

**Warning signs:**
- ⚠️ Increased number of errors (investigate root cause)
- ⚠️ New types of errors appearing
- ⚠️ Users still reporting blank pages (check error handler)

---

## Rollback Plan (If Needed)

If something goes wrong, you can quickly rollback:

### Option 1: Git Revert
```bash
# Find the commit hash
git log --oneline

# Revert to previous commit
git revert <commit-hash>
git push origin main

# Clear caches and restart services (same as Step 2 & 3 above)
```

### Option 2: Quick Fix
If only the exception handler is causing issues:

```php
// In bootstrap/app.php, comment out the global handler temporarily:
/*
$exceptions->render(function (\Throwable $e, $request) {
    // ... commented out
});
*/
```

Then:
```bash
php artisan config:clear
sudo systemctl restart php8.4-fpm
```

---

## Success Criteria

### User Experience ✅
- [ ] No blank browser 500 error screens
- [ ] Users see helpful error pages with actions
- [ ] Inertia navigation errors auto-recover
- [ ] Mobile users can view error pages properly

### Developer Experience ✅
- [ ] All errors logged with full context
- [ ] Easy to identify failing queries in logs
- [ ] Can diagnose production issues quickly
- [ ] Logs include user_id, tenant_id, URL, trace

### Production Stability ✅
- [ ] Page reloads don't cause 500 errors
- [ ] Database timeouts handled gracefully
- [ ] Failed queries return safe defaults
- [ ] Application stays functional during partial failures

---

## Troubleshooting

### Issue: Still seeing blank 500 errors

**Check:**
```bash
# Verify error views exist
ls -la resources/views/errors/

# Should see:
# 500.blade.php
# 500-inertia.blade.php
# 503.blade.php
# tenant-not-found.blade.php

# Clear view cache
php artisan view:clear
php artisan config:clear
```

### Issue: Error pages not showing in production

**Check:**
```bash
# Verify APP_ENV is set correctly
php artisan tinker
>>> config('app.env')
# Should return "production"

# Check APP_DEBUG setting
>>> config('app.debug')
# Should return false in production

# Check .env file
cat .env | grep APP_ENV
cat .env | grep APP_DEBUG
```

### Issue: Errors not being logged

**Check:**
```bash
# Verify log file permissions
ls -la storage/logs/

# Storage should be writable
# Fix permissions if needed:
chmod -R 775 storage
chown -R www-data:www-data storage  # Adjust user/group as needed

# Check logging configuration
php artisan tinker
>>> config('logging.default')
```

### Issue: Middleware errors still causing crashes

**Check:**
```bash
# Look for PHP fatal errors
tail -f /var/log/php8.4-fpm.log

# Check web server error logs
tail -f /var/log/nginx/error.log  # or apache error logs

# Verify middleware changes were deployed
cat app/Http/Middleware/HandleInertiaRequests.php | grep "getUserAuthData"
# Should show the new method
```

---

## Environment Variables to Verify

Make sure these are set correctly in `.env`:

```bash
# Production environment
APP_ENV=production
APP_DEBUG=false  # IMPORTANT: Should be false in production

# Logging
LOG_CHANNEL=stack
LOG_LEVEL=error

# Database (verify connection is stable)
DB_CONNECTION=mysql
DB_HOST=your-db-host
DB_PORT=3306
DB_DATABASE=your-database
DB_USERNAME=your-username
DB_PASSWORD=your-password
```

---

## Contact & Support

### If Deployment Issues Occur

1. **Check logs immediately:**
   ```bash
   tail -100 storage/logs/laravel.log
   ```

2. **Check PHP logs:**
   ```bash
   tail -100 /var/log/php8.4-fpm.log
   ```

3. **Check web server logs:**
   ```bash
   tail -100 /var/log/nginx/error.log
   ```

4. **Test a simple route:**
   ```bash
   curl -I https://yourdomain.com/
   ```

### Emergency Rollback
If production is broken:
```bash
git revert HEAD
git push origin main
php artisan config:clear
sudo systemctl restart php8.4-fpm
```

---

## Summary

This deployment will:
1. ✅ Fix blank 500 browser errors on production
2. ✅ Add comprehensive error handling to middleware
3. ✅ Show beautiful error pages instead of crashes
4. ✅ Log all errors with complete debugging context
5. ✅ Improve user experience during errors
6. ✅ Make production debugging much easier

**Estimated Deployment Time:** 10-15 minutes (including testing)

**Downtime Required:** None (zero-downtime deployment)

**Risk Level:** Low (all changes are additive, with fallbacks to existing behavior)

---

## Post-Deployment Tasks

### Immediate
- [ ] Monitor logs for 30 minutes
- [ ] Test key user flows
- [ ] Verify error pages display correctly

### Within 24 Hours
- [ ] Review error logs for patterns
- [ ] Check error frequency
- [ ] Gather user feedback

### Within 1 Week
- [ ] Identify and fix common errors found in logs
- [ ] Consider adding error monitoring service (Sentry, Bugsnag)
- [ ] Optimize slow queries identified in error logs

Good luck with your deployment! 🚀

