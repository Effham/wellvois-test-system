# 🚀 Deployment Requirements for Auto Sync

## ❌ **Auto Sync Won't Work Without These:**

### 1. **Queue Worker Must Be Running**
```bash
# This MUST be running on your server
php artisan queue:work --queue=calendar-sync --daemon
```

### 2. **Cron Job Must Be Active**
Add to your server's crontab:
```bash
* * * * * cd /path/to/your/project && php artisan schedule:run >> /dev/null 2>&1
```

### 3. **Production Setup Options**

#### Option A: Supervisor (Recommended)
Create `/etc/supervisor/conf.d/emr-queue.conf`:
```ini
[program:emr-queue-worker]
process_name=%(program_name)s_%(process_num)02d
command=php /path/to/your/project/artisan queue:work --queue=calendar-sync --sleep=3 --tries=3 --max-time=3600
directory=/path/to/your/project
autostart=true
autorestart=true
user=www-data
numprocs=1
redirect_stderr=true
stdout_logfile=/path/to/your/project/storage/logs/queue-worker.log
```

#### Option B: systemd Service
Create `/etc/systemd/system/emr-queue.service`:
```ini
[Unit]
Description=EMR Queue Worker
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/path/to/your/project
ExecStart=/usr/bin/php artisan queue:work --queue=calendar-sync --sleep=3 --tries=3
Restart=always

[Install]
WantedBy=multi-user.target
```

## ✅ **What Happens Without Queue Workers:**
- ❌ Auto sync jobs pile up in database but never execute
- ❌ No automatic calendar syncing occurs
- ❌ Token refresh fails silently
- ❌ Manual sync buttons won't work

## 🔍 **Check if Auto Sync is Working:**
```bash
# Check if jobs are being processed
php artisan queue:work --queue=calendar-sync --once

# Test auto sync
php artisan test:auto-sync

# Check job status
php artisan queue:failed
```
