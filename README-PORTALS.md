# Wellovis World - Multi-Portal Setup

This repository contains four separate portals that run independently:

## Portals

1. **app-portal** - Multi-tenancy portal (port 8000)
   - Central Domain: `app.localhost`
   - Login: Tenant-specific at `{tenant-domain}/login`
   - Purpose: Handles multi-tenancy for SaaS platform

2. **practitioner-portal** - Practitioner portal (port 8001)
   - Central Domain: `practitioner.localhost`
   - Login: `/practitioner/login`
   - Purpose: Central domain for practitioner-level data

3. **patient-portal** - Patient portal (port 8002)
   - Central Domain: `patient.localhost`
   - Login: `/patient/login`
   - Purpose: Central domain for patient-level data

4. **admin-portal** - Admin portal (port 8003)
   - Central Domain: `admin.localhost`
   - Login: `/admin/login`
   - Purpose: Super admin access to entire SaaS platform

## Setup

### 1. Install Dependencies

```bash
# Install Composer dependencies in all portals
cd app-portal && composer install
cd ../practitioner-portal && composer install
cd ../patient-portal && composer install
cd ../admin-portal && composer install

# Install npm dependencies in all portals
cd app-portal && npm install --legacy-peer-deps
cd ../practitioner-portal && npm install --legacy-peer-deps
cd ../patient-portal && npm install --legacy-peer-deps
cd ../admin-portal && npm install --legacy-peer-deps
```

### 2. Configure Hosts File

Add these entries to your `/etc/hosts` file:

```
127.0.0.1 app.localhost
127.0.0.1 practitioner.localhost
127.0.0.1 patient.localhost
127.0.0.1 admin.localhost
```

### 3. Run Portals

#### Option 1: Run All Portals Simultaneously

```bash
./run-all-portals.sh
```

#### Option 2: Run Individual Portals

```bash
# App Portal (port 8000)
./run-app-portal.sh

# Practitioner Portal (port 8001)
./run-practitioner-portal.sh

# Patient Portal (port 8002)
./run-patient-portal.sh

# Admin Portal (port 8003)
./run-admin-portal.sh
```

#### Option 3: Manual Run

For each portal, run:

```bash
cd app-portal
export APP_PORT=8000
export CENTRAL_DOMAIN=app.localhost
export APP_URL="http://app.localhost:8000"
php artisan serve --host=0.0.0.0 --port=8000
```

## Access URLs

- **App Portal**: http://app.localhost:8000
- **Practitioner Portal**: http://practitioner.localhost:8001
- **Patient Portal**: http://patient.localhost:8002
- **Admin Portal**: http://admin.localhost:8003

## Development

Each portal has its own:
- Database configuration
- Environment variables (.env)
- Tenancy configuration
- Frontend assets (Vite)

Make sure to configure each portal's `.env` file with appropriate database and service credentials.


