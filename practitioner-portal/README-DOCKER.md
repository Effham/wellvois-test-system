# Docker Setup Guide - EMR Multi-Tenant Application

Complete step-by-step guide to run your Laravel multi-tenant EMR system using Docker.

## 📋 Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Detailed Setup Instructions](#detailed-setup-instructions)
- [Docker Services](#docker-services)
- [Common Commands](#common-commands)
- [Troubleshooting](#troubleshooting)
- [Development Workflow](#development-workflow)

---

## 🔧 Prerequisites

### Required Software

1. **Docker Desktop** (v4.0 or higher)
   - Download from: https://www.docker.com/products/docker-desktop
   - For Windows: Ensure WSL 2 is enabled
   - For Mac: Download for your chip (Intel or Apple Silicon)

2. **Git** (for cloning repository)

3. **System Requirements**
   - RAM: 4GB minimum, 8GB recommended
   - Disk Space: 20GB free space
   - CPU: 2 cores minimum, 4 cores recommended

### Before You Begin

1. **Stop XAMPP** (if running)
   ```
   - Stop Apache
   - Stop MySQL
   - Stop any other services using ports 80, 3306, or 6379
   ```

2. **Verify Docker Installation**
   ```bash
   docker --version
   docker-compose --version
   ```

---

## 🚀 Quick Start

For experienced users, follow these steps:

```bash
# 1. Create environment file
cp env.docker.example .env

# 2. Start Docker Desktop

# 3. Build and start containers
docker-compose up -d

# 4. Install dependencies and setup
make install

# 5. Access your application
# Open browser: http://localhost
```

---

## 📖 Detailed Setup Instructions

### Step 1: Open Docker Desktop

1. **Launch Docker Desktop**
   - Windows: Search for "Docker Desktop" in Start Menu
   - Mac: Open from Applications folder
   - Wait for Docker to start (whale icon should be solid, not animated)

2. **Verify Docker is Running**
   - Look for solid whale icon in system tray
   - Check Docker Desktop dashboard shows "Engine running"

### Step 2: Configure Docker Desktop (Optional but Recommended)

1. Open Docker Desktop Settings (gear icon)
2. Go to **Resources** → **Advanced**
3. Allocate resources:
   - **CPUs**: 4 (or half your available cores)
   - **Memory**: 4GB minimum, 6-8GB recommended
   - **Swap**: 1GB
   - **Disk Size**: 60GB
4. Click **Apply & Restart**

### Step 3: Prepare Your Project

1. **Navigate to your project directory**
   ```bash
   cd C:\Users\MC\Desktop\BuildMeApp\wellovis-2\emr-web
   ```

2. **Create environment file**
   ```bash
   # Windows PowerShell
   Copy-Item env.docker.example .env
   
   # Or use Git Bash / WSL
   cp env.docker.example .env
   ```

3. **Edit .env file** (optional)
   - Change database credentials if needed
   - Set your `APP_KEY` (will be generated later if empty)
   - Update `CENTRAL_DOMAIN` if using custom domain

### Step 4: Build Docker Images

```bash
docker-compose build
```

**Expected Output:**
- Building process starts (5-10 minutes first time)
- All services build successfully
- No error messages

**Common Issues:**
- If build fails, check internet connection
- Ensure Docker has enough disk space
- Try: `docker-compose build --no-cache` to rebuild from scratch

### Step 5: Start Docker Containers

```bash
docker-compose up -d
```

**What happens:**
- `-d` flag runs containers in background (detached mode)
- All services start: nginx, app, mysql, redis, node
- MySQL initializes (takes ~30 seconds on first run)

**Verify containers are running:**
```bash
docker-compose ps
```

You should see all services with "Up" status:
```
NAME         STATUS       PORTS
emr_app      Up          9000/tcp
emr_mysql    Up (healthy) 0.0.0.0:3306->3306/tcp
emr_nginx    Up          0.0.0.0:80->80/tcp
emr_node     Up          0.0.0.0:5173->5173/tcp
emr_redis    Up (healthy) 0.0.0.0:6379->6379/tcp
```

### Step 6: Initialize Application

#### Option A: Using Makefile (Recommended)

```bash
make install
```

This single command will:
- Wait for MySQL to be ready
- Install Composer dependencies
- Generate application key
- Create storage link
- Run migrations
- Install NPM dependencies

#### Option B: Manual Setup

```bash
# Wait for MySQL to be ready (check logs)
docker-compose logs -f mysql
# Wait until you see "ready for connections"

# Install Composer dependencies
docker-compose exec app composer install

# Generate application key
docker-compose exec app php artisan key:generate

# Create storage symlink
docker-compose exec app php artisan storage:link

# Run migrations
docker-compose exec app php artisan migrate

# Install NPM dependencies
docker-compose exec node npm install

# Fix permissions
docker-compose exec app chmod -R 775 storage bootstrap/cache
docker-compose exec app chown -R www-data:www-data storage bootstrap/cache
```

### Step 7: Setup Multi-Tenancy (If Applicable)

1. **Run tenant migrations**
   ```bash
   docker-compose exec app php artisan tenants:migrate
   ```

2. **Seed database** (optional)
   ```bash
   docker-compose exec app php artisan db:seed
   ```

3. **Create test tenant** (optional)
   ```bash
   docker-compose exec app php artisan tinker
   # Then in tinker:
   $tenant = App\Models\Tenant::create(['id' => 'tenant1']);
   $tenant->domains()->create(['domain' => 'tenant1.localhost']);
   ```

### Step 8: Configure Hosts File (For Multi-Tenancy)

#### Windows

1. Open Notepad as Administrator
2. Open file: `C:\Windows\System32\drivers\etc\hosts`
3. Add these lines:
   ```
   127.0.0.1 localhost
   127.0.0.1 tenant1.localhost
   127.0.0.1 tenant2.localhost
   ```
4. Save and close

#### Mac/Linux

```bash
sudo nano /etc/hosts
```

Add:
```
127.0.0.1 localhost
127.0.0.1 tenant1.localhost
127.0.0.1 tenant2.localhost
```

Save with `Ctrl+X`, then `Y`, then `Enter`

### Step 9: Start Vite Dev Server (For Frontend Hot Reload)

```bash
docker-compose exec node npm run dev
```

Or use Makefile:
```bash
make npm-dev
```

**Expected Output:**
```
VITE v6.0.0  ready in XXX ms
➜  Local:   http://localhost:5173/
➜  Network: http://0.0.0.0:5173/
```

Keep this running in a separate terminal window.

### Step 10: Access Your Application

1. **Open your browser**
2. **Navigate to:**
   - Central app: http://localhost
   - Tenant app: http://tenant1.localhost (if configured)

3. **You should see:**
   - Laravel welcome page, or
   - Your application's login page

---

## 🐳 Docker Services

### Service Overview

| Service | Container Name | Port | Purpose |
|---------|---------------|------|---------|
| **nginx** | emr_nginx | 80 → 80 | Web server (reverse proxy) |
| **app** | emr_app | 9000 | PHP-FPM application |
| **mysql** | emr_mysql | 3306 → 3306 | MySQL 8.0 database |
| **redis** | emr_redis | 6379 → 6379 | Cache & queue storage |
| **node** | emr_node | 5173 → 5173 | Vite dev server (HMR) |

### Service Details

#### nginx (Web Server)
- **Image**: nginx:alpine
- **Purpose**: Routes requests to PHP-FPM, serves static files
- **Config**: `docker/nginx/default.conf`
- **Features**: Gzip compression, HMR proxy, Laravel routing

#### app (PHP Application)
- **Image**: Custom (php:8.4-fpm + extensions)
- **Purpose**: Runs Laravel application
- **Extensions**: pdo_mysql, redis, gd, opcache, bcmath, etc.
- **Config**: `docker/php/php.ini`, `docker/php/www.conf`

#### mysql (Database)
- **Image**: mysql:8.0
- **Purpose**: Stores central and tenant databases
- **Config**: `docker/mysql/my.cnf`
- **Data Persistence**: `mysql-data` volume

#### redis (Cache & Queue)
- **Image**: redis:7-alpine
- **Purpose**: Session storage, cache, queue jobs
- **Data Persistence**: `redis-data` volume

#### node (Frontend Build)
- **Image**: node:20-alpine
- **Purpose**: Runs Vite dev server with HMR
- **Hot Reload**: Automatically refreshes on code changes

---

## 💻 Common Commands

### Using Makefile (Recommended)

```bash
# View all available commands
make help

# Container Management
make up                # Start all containers
make down              # Stop all containers
make restart           # Restart all containers
make status            # Show container status
make logs              # View all logs
make logs-app          # View app logs only

# Development
make shell             # Access app container bash
make shell-node        # Access node container
make composer-install  # Install PHP dependencies
make npm-install       # Install Node dependencies
make npm-dev           # Start Vite dev server

# Database
make migrate           # Run migrations
make migrate-fresh     # Fresh migration with seed
make seed              # Run seeders
make mysql             # Access MySQL shell

# Artisan Commands
make artisan ARGS="route:list"
make artisan ARGS="queue:work"
make artisan ARGS="tinker"

# Optimization
make cache-clear       # Clear all caches
make optimize          # Optimize Laravel
make pint              # Run code formatter

# Fresh Installation
make fresh             # Complete fresh setup
make install           # Initial setup after clone
make rebuild           # Clean rebuild

# Database Backup
make backup-db         # Backup MySQL database
make restore-db FILE=backup.sql  # Restore database
```

### Using Docker Commands Directly

```bash
# Container Management
docker-compose up -d              # Start containers
docker-compose down               # Stop containers
docker-compose restart            # Restart all
docker-compose ps                 # Show status
docker-compose logs -f            # Follow logs

# Execute Commands in Containers
docker-compose exec app bash      # App shell
docker-compose exec app php artisan migrate
docker-compose exec node npm run dev
docker-compose exec mysql mysql -u root -p

# View Logs
docker-compose logs -f app        # App logs
docker-compose logs -f nginx      # Nginx logs
docker-compose logs -f mysql      # MySQL logs

# Rebuild
docker-compose build              # Build all
docker-compose build --no-cache   # Fresh build
docker-compose up -d --build      # Build and start
```

---

## 🔥 Development Workflow

### Daily Workflow

1. **Start Your Day**
   ```bash
   # Open Docker Desktop
   make up
   make npm-dev
   ```

2. **Code in Your IDE**
   - Edit files in VS Code, PHPStorm, etc.
   - Changes auto-reflect in browser (HMR)
   - No need to restart containers

3. **Run Commands**
   ```bash
   make artisan ARGS="migrate"
   make composer ARGS="require package/name"
   make npm ARGS="install package-name"
   ```

4. **End Your Day**
   ```bash
   make down
   ```

### Hot Module Replacement (HMR)

- **Automatic**: Frontend changes refresh instantly
- **No build needed**: Vite compiles on-the-fly
- **Fast**: Sub-second updates

### Database Management

```bash
# Create migration
make artisan ARGS="make:migration create_table_name"

# Run migrations
make migrate

# Rollback
make artisan ARGS="migrate:rollback"

# Fresh start
make migrate-fresh

# Access database
make mysql
# Then: USE multi_tenancy_master;
```

### Testing

```bash
# Run all tests
make test

# Run specific test
make artisan ARGS="test --filter TestName"

# With coverage
make test-coverage
```

---

## 🐛 Troubleshooting

### Issue 1: Port Already in Use

**Error:** `Bind for 0.0.0.0:80 failed: port is already allocated`

**Solution:**
```bash
# Check what's using the port
# Windows:
netstat -ano | findstr :80

# Mac/Linux:
lsof -i :80

# Stop XAMPP or change port in docker-compose.yml
```

### Issue 2: MySQL Not Ready

**Error:** `SQLSTATE[HY000] [2002] Connection refused`

**Solution:**
```bash
# Wait for MySQL to initialize
docker-compose logs -f mysql
# Wait for "ready for connections"

# Or wait 30 seconds after starting
# Then retry migrations
make migrate
```

### Issue 3: Permission Denied Errors

**Error:** `Permission denied` in storage/logs

**Solution:**
```bash
make permissions

# Or manually:
docker-compose exec app chmod -R 775 storage bootstrap/cache
docker-compose exec app chown -R www-data:www-data storage bootstrap/cache
```

### Issue 4: Vite HMR Not Working

**Symptoms:** Changes don't reflect in browser

**Solution:**
1. Check Vite is running:
   ```bash
   docker-compose logs -f node
   ```

2. Restart node container:
   ```bash
   docker-compose restart node
   docker-compose exec node npm run dev
   ```

3. Clear browser cache (Ctrl+F5)

### Issue 5: Composer/NPM Slow

**Solution:**
```bash
# Use local cache volumes (already configured)
# Or run from local machine:
composer install
npm install
```

### Issue 6: Cannot Access Tenant Domains

**Symptoms:** `tenant1.localhost` doesn't work

**Solution:**
1. Check hosts file entries (Step 8)
2. Flush DNS:
   ```bash
   # Windows:
   ipconfig /flushdns
   
   # Mac:
   sudo dscacheutil -flushcache
   
   # Linux:
   sudo systemd-resolve --flush-caches
   ```
3. Use incognito/private browsing mode

### Issue 7: Docker Out of Memory

**Error:** Build fails or containers crash

**Solution:**
1. Open Docker Desktop Settings
2. Resources → Increase memory to 6-8GB
3. Restart Docker Desktop
4. Rebuild: `make rebuild`

### Issue 8: Fresh Start Needed

**When in doubt:**
```bash
# Nuclear option - complete clean restart
make clean
make build
make up
make install
```

---

## 📝 Additional Notes

### Environment Variables

- **Development**: Use `env.docker.example` as template
- **Production**: Create separate `.env.production` file
- **Never commit**: `.env` files are in `.gitignore`

### Data Persistence

- **MySQL data**: Stored in `mysql-data` volume (persists after `make down`)
- **Redis data**: Stored in `redis-data` volume
- **To delete data**: `docker-compose down -v` (⚠️ WARNING: Deletes all data)

### Performance Tips

1. **Increase Docker resources** (Settings → Resources)
2. **Use volumes for dependencies** (already configured)
3. **Disable OPcache in development** (already disabled in `php.ini`)
4. **Use SSD** for Docker data location

### Security Notes

- Default credentials are in `env.docker.example`
- **Change these in production!**
- Never expose database ports publicly
- Use environment-specific `.env` files

---

## 🎓 Learning Resources

- [Docker Documentation](https://docs.docker.com/)
- [Laravel Documentation](https://laravel.com/docs)
- [Docker Compose Reference](https://docs.docker.com/compose/)
- [Vite Documentation](https://vitejs.dev/)

---

## 🆘 Getting Help

If you encounter issues:

1. Check container logs: `make logs`
2. Verify all containers are running: `make status`
3. Try fresh start: `make fresh`
4. Check this troubleshooting guide
5. Search Docker Desktop logs

---

## ✅ Success Checklist

- [ ] Docker Desktop installed and running
- [ ] `.env` file created from template
- [ ] All containers showing "Up" status
- [ ] Migrations ran successfully
- [ ] Can access http://localhost
- [ ] Vite HMR working (changes reflect in browser)
- [ ] Multi-tenant domains configured (if applicable)
- [ ] Database accessible

**Congratulations! Your Docker environment is ready!** 🎉

---

*Last updated: November 2025*
*For issues or contributions, please open an issue or PR in the repository.*

