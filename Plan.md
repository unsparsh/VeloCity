# ⚡ EV Ride-Hailing App — Full Implementation Plan
> For Claude Code execution. Add your design prompt in Section 12 before running.

---

## Table of Contents
1. [Project Overview](#1-project-overview)
2. [Final Tech Stack](#2-final-tech-stack)
3. [Additional Tech Stack Recommendations](#3-additional-tech-stack-recommendations)
4. [System Architecture](#4-system-architecture)
5. [Monorepo Structure](#5-monorepo-structure)
6. [Database Schema (Dev + Prod)](#6-database-schema-dev--prod)
7. [Environment Variables (.env.example)](#7-environment-variables-envexample)
8. [Phase-Wise Execution Plan](#8-phase-wise-execution-plan)
9. [App-by-App Feature Breakdown](#9-app-by-app-feature-breakdown)
10. [Procrastinate & Redis Streams Notes](#10-procrastinate--redis-streams-notes)
11. [PWA Setup Guide](#11-pwa-setup-guide)
12. [Design Prompt Placeholder](#12-design-prompt-placeholder)
13. [Claude Code Instructions](#13-claude-code-instructions)

---

## 1. Project Overview

An Uber/OLA-style ride-hailing platform exclusively for **electric and owner-operated vehicles**. Three separate apps:

| App | Users | Purpose |
|-----|-------|---------|
| **Rider App** | Drivers | Accept/manage rides, live navigation |
| **User App** | Passengers | Book rides, track driver, pay |
| **Admin App** | Operations Team | Analytics, fleet management, financials |

**Key Differentiators:**
- EV-only fleet
- Owner-operated (no third-party fleet needed initially)
- OTP-verified ride start
- Wallet + portal payment system
- PWA — installable on Android & iOS

---

## 2. Final Tech Stack

### Frontend
| Layer | Choice | Reason |
|-------|--------|--------|
| Framework | React.js (Vite) | Fast builds, ecosystem |
| UI Components | shadcn/ui | Matches your design system |
| Maps | mapcn.dev (MapLibre-based) | Free, React-native, shadcn-compatible |
| Routing (client) | React Router v6 | Standard |
| State Management | Zustand | Lightweight, no boilerplate |
| PWA | Vite PWA Plugin (Workbox) | Auto service worker, install prompt |
| HTTP Client | Axios + React Query | Caching, polling, retry logic |
| Forms | React Hook Form + Zod | Validation |
| Animations | Framer Motion | Smooth map/UI transitions |

### Backend
| Layer | Choice | Reason |
|-------|--------|--------|
| Framework | Django + Django REST Framework | Python, robust ORM |
| Auth | Firebase Auth (Email + Google OAuth + Phone OTP) | Free tier covers OTP well |
| Task Queue | **Procrastinate** (PostgreSQL-backed) | No extra broker; uses existing Postgres DB |
| Cache | Redis | Driver location cache, session data, nearby driver set |
| Location Streaming | **Redis Streams** | Persistent, replayable, consumer groups — driver location fan-out |
| Routing Engine | OSRM (self-hosted via Docker) | Free, fast, best-route calculation |
| Location Search | LocationIQ (free tier 5000 req/day) | Free location autocomplete |
| ML Model Bridge | Django REST endpoint wrapping team's Python file | Price calculation |

### Database
| Environment | Choice |
|-------------|--------|
| Dev | Supabase (PostgreSQL) |
| Prod | Supabase → migrate to VPS PostgreSQL (same schema) |

### Infrastructure
| Service | Choice |
|---------|--------|
| Auth | Firebase Authentication |
| Push Notifications | Firebase Cloud Messaging (FCM) |
| File Storage | Supabase Storage (profile pics, receipts) |
| Caching + Streams | Redis (self-hosted Docker or Upstash free tier) |
| Payments | Razorpay (UPI + cards + wallet) — India-first |
| Wallet | Custom wallet table in DB |
| Maps | mapcn.dev components + MapLibre tiles (free) |
| Routing | OSRM via Docker |
| Task Queue | Procrastinate (uses existing PostgreSQL — no new broker) |
| CI/CD | GitHub Actions |

---

## 3. Additional Tech Stack Recommendations

### 🔴 High Priority Additions

**1. Procrastinate (PostgreSQL Task Queue)**
- Drop-in Celery replacement using your existing Postgres DB
- No Redis dependency for tasks (Redis is still used for caching + streams only)
- Supports periodic jobs (cron-like), retries, priority queues, deferred tasks
- Django integration: `procrastinate.contrib.django`
- Worker command: `python manage.py procrastinate worker`
- Install: `pip install procrastinate[django]`

**2. Redis Streams for Driver Location**
- Persistent, replayable location event log (unlike Redis Pub/Sub which is fire-and-forget)
- Consumer groups: multiple consumers can read independently (future: analytics, ETA engine)
- Driver app → publishes to stream → location consumer updates cache + DB
- Stream key: `location:events` (global) or `location:driver:{id}` (per-driver)
- Backpressure-safe: if consumer is slow, events queue up rather than drop

**3. LocationIQ for Autocomplete (Free Tier)**
- 5,000 requests/day free
- Supports forward geocoding, autocomplete, reverse geocode
- URL: https://locationiq.com

**4. Firebase Phone Auth for OTP**
- Free tier: 10,000 SMS verifications/month (India numbers included)
- `signInWithPhoneNumber()` → sends OTP → `confirmationResult.confirm(otp)`

**5. OSRM for Route Calculation (Docker)**
- Self-hosted, completely free
- Returns turn-by-turn route as GeoJSON → render as blue line on mapcn

### 🟡 Medium Priority Additions

**6. Sentry for Error Tracking** — Free tier, catches frontend + backend errors

**7. PostHog for Analytics (self-hostable)** — Track funnel: Search → Driver Found → Ride Started → Payment

**8. django-silk for API Performance Profiling** — Use during dev to spot slow queries

**9. Upstash Redis (Serverless Redis — Free Tier)** — 10,000 commands/day free, ideal for dev

---

## 4. System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     THREE FRONTENDS                      │
│  User App (React PWA)  Rider App (React PWA)  Admin App │
└────────────┬──────────────────┬───────────────────┬──────┘
             │                  │                   │
             └──────────────────┼───────────────────┘
                                │  REST API (HTTPS)
                    ┌───────────▼────────────┐
                    │   Django REST Framework │
                    │   (Python Backend)      │
                    │                         │
                    │  ┌─────────────────┐   │
                    │  │ Firebase Auth   │   │
                    │  │ Middleware       │   │
                    │  └─────────────────┘   │
                    │                         │
                    │  ┌─────────────────┐   │
                    │  │  Procrastinate  │   │
                    │  │  Worker (async) │   │
                    │  └─────────────────┘   │
                    │                         │
                    │  ┌─────────────────┐   │
                    │  │ Location Stream │   │
                    │  │ Consumer        │   │
                    │  └─────────────────┘   │
                    └────┬──────────┬─────────┘
                         │          │
              ┌──────────▼─┐   ┌────▼────────────────┐
              │ PostgreSQL  │   │   Redis              │
              │ (Supabase)  │   │   - Cache            │
              │             │   │   - Streams          │
              │ Also hosts  │   │   - Online driver set│
              │ Procrastin- │   └─────────────────────┘
              │ ate jobs    │
              └─────────────┘
                         │
              ┌──────────▼──────────────┐
              │  External Services       │
              │  - Firebase FCM (push)   │
              │  - LocationIQ (search)   │
              │  - OSRM (routing)        │
              │  - Razorpay (payments)   │
              │  - ML Model API          │
              └─────────────────────────┘
```

### Live Location Flow (Redis Streams)
```
Rider App
  → POST /api/location/update/  (every 3 seconds)
  → Django view: XADD location:events * driver_id={id} lat={lat} lng={lng} heading={h}
  → Returns 200 immediately (non-blocking)

Location Stream Consumer (management command, runs as separate Docker service)
  → XREADGROUP GROUP location-consumers consumer-1 BLOCK 0 STREAMS location:events >
  → On each event:
      1. Update Redis key: driver:{id}:location  (TTL 10s)
      2. Update Redis set: online_drivers
      3. Periodically flush to DB: drivers.current_lat/lng (every 30s, not every event)
  → XACK location:events location-consumers {message_id}

User App
  → GET /api/ride/{id}/driver-location/  (every 3 seconds)
  → Django reads from Redis key: driver:{id}:location
  → Returns lat/lng to frontend → mapcn updates marker
```

---

## 5. Monorepo Structure

```
VeloCity/
├── Velo Rider/                 # Passenger PWA (React + Vite)
│   ├── public/
│   │   ├── manifest.json
│   │   └── icons/
│   ├── src/
│   │   ├── components/
│   │   │   ├── map/
│   │   │   │   ├── BookingMap.jsx
│   │   │   │   ├── DriverMarker.jsx
│   │   │   │   └── RouteLayer.jsx
│   │   │   ├── booking/
│   │   │   │   ├── LocationSearch.jsx
│   │   │   │   ├── RideOptions.jsx
│   │   │   │   └── OTPDisplay.jsx
│   │   │   └── payment/
│   │   │       ├── PaymentModal.jsx
│   │   │       └── WalletBalance.jsx
│   │   ├── pages/
│   │   │   ├── Landing.jsx
│   │   │   ├── Login.jsx
│   │   │   ├── Home.jsx
│   │   │   ├── Booking.jsx
│   │   │   ├── RideActive.jsx
│   │   │   └── Payment.jsx
│   │   ├── hooks/
│   │   │   ├── useDriverPolling.js
│   │   │   ├── useGeolocation.js
│   │   │   └── useLocationSearch.js
│   │   ├── store/
│   │   │   ├── useRideStore.js
│   │   │   └── useAuthStore.js
│   │   ├── services/
│   │   │   ├── api.js
│   │   │   ├── firebase.js
│   │   │   └── locationiq.js
│   │   └── App.jsx
│   ├── .claude/
│   ├── vite.config.js
│   └── package.json
│
├── Velo Driver/                # Driver PWA (React + Vite)
│   └── src/
│       ├── pages/
│       │   ├── Login.jsx
│       │   ├── Dashboard.jsx
│       │   ├── RideRequest.jsx
│       │   ├── ActiveRide.jsx
│       │   └── Earnings.jsx
│       ├── hooks/
│       │   ├── useLocationBroadcast.js
│       │   └── useRideRequests.js
│       └── ...
│
├── Velo Admin/                 # Admin Dashboard (React + Vite)
│   └── src/
│       ├── pages/
│       │   ├── Dashboard.jsx
│       │   ├── Rides.jsx
│       │   ├── Drivers.jsx
│       │   ├── Users.jsx
│       │   ├── Payments.jsx
│       │   └── Analytics.jsx
│       └── ...
│
├── backend/                    # Django Project
│   ├── config/
│   │   ├── settings/
│   │   │   ├── base.py
│   │   │   ├── dev.py
│   │   │   └── prod.py
│   │   ├── urls.py
│   │   └── wsgi.py
│   ├── apps/
│   │   ├── users/
│   │   │   ├── tasks/          # Procrastinate tasks (e.g. send welcome notification)
│   │   │   └── ...
│   │   ├── rides/
│   │   │   ├── tasks/          # Procrastinate tasks (e.g. driver request timeout)
│   │   │   └── ...
│   │   ├── location/
│   │   │   ├── management/
│   │   │   │   └── commands/
│   │   │   │       └── run_location_consumer.py  # Redis Streams consumer
│   │   │   └── ...
│   │   ├── payments/
│   │   │   ├── tasks/          # Procrastinate tasks (e.g. process refund)
│   │   │   └── ...
│   │   ├── notifications/      # FCM push via Procrastinate tasks
│   │   ├── pricing/            # ML model bridge
│   │   └── analytics/
│   ├── requirements/
│   │   ├── base.txt
│   │   ├── dev.txt
│   │   └── prod.txt
│   └── manage.py               # No celery.py — Procrastinate uses Django management commands
│
├── infrastructure/
│   ├── docker/
│   │   ├── docker-compose.dev.yml
│   │   ├── docker-compose.prod.yml
│   │   └── osrm/
│   │       └── Dockerfile
│   └── nginx/
│       └── nginx.conf
│
├── .env.example
├── .env.dev
├── .gitignore
└── README.md
```

---

## 6. Database Schema (Dev + Prod)

> Both environments use the same schema. Dev uses Supabase free tier. Prod uses Supabase initially, migrated to self-hosted PostgreSQL on VPS later. Procrastinate also creates its own tables in the same database via `python manage.py migrate`.

### 6.1 Users Table
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firebase_uid VARCHAR(128) UNIQUE NOT NULL,
    phone VARCHAR(15) UNIQUE,
    email VARCHAR(254) UNIQUE,
    full_name VARCHAR(100) NOT NULL,
    profile_picture_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 6.2 Drivers Table
```sql
CREATE TABLE drivers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firebase_uid VARCHAR(128) UNIQUE NOT NULL,
    phone VARCHAR(15) UNIQUE NOT NULL,
    email VARCHAR(254),
    full_name VARCHAR(100) NOT NULL,
    profile_picture_url TEXT,
    license_number VARCHAR(50) UNIQUE NOT NULL,
    is_verified BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    is_online BOOLEAN DEFAULT FALSE,
    current_lat DECIMAL(10, 8),
    current_lng DECIMAL(11, 8),
    location_updated_at TIMESTAMPTZ,
    rating DECIMAL(3, 2) DEFAULT 5.00,
    total_rides INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 6.3 Vehicles Table
```sql
CREATE TABLE vehicles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
    make VARCHAR(50) NOT NULL,
    model VARCHAR(50) NOT NULL,
    year INTEGER NOT NULL,
    color VARCHAR(30) NOT NULL,
    license_plate VARCHAR(20) UNIQUE NOT NULL,
    vehicle_type VARCHAR(20) NOT NULL,           -- 'two_wheeler', 'three_wheeler', 'four_wheeler'
    battery_capacity_kwh DECIMAL(5, 2),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 6.4 Rides Table
```sql
CREATE TABLE rides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    driver_id UUID REFERENCES drivers(id),
    vehicle_id UUID REFERENCES vehicles(id),

    pickup_lat DECIMAL(10, 8) NOT NULL,
    pickup_lng DECIMAL(11, 8) NOT NULL,
    pickup_address TEXT NOT NULL,
    destination_lat DECIMAL(10, 8) NOT NULL,
    destination_lng DECIMAL(11, 8) NOT NULL,
    destination_address TEXT NOT NULL,
    route_polyline TEXT,

    status VARCHAR(20) NOT NULL DEFAULT 'searching',
    -- searching → driver_assigned → driver_arriving → otp_verified → in_progress → completed → cancelled

    otp_code VARCHAR(60),                         -- hashed (bcrypt) for security
    otp_verified BOOLEAN DEFAULT FALSE,
    otp_verified_at TIMESTAMPTZ,
    otp_expires_at TIMESTAMPTZ,

    estimated_price DECIMAL(10, 2),
    final_price DECIMAL(10, 2),
    distance_km DECIMAL(8, 3),
    duration_minutes INTEGER,
    pricing_breakdown JSONB,

    requested_at TIMESTAMPTZ DEFAULT NOW(),
    driver_assigned_at TIMESTAMPTZ,
    driver_arrived_at TIMESTAMPTZ,
    ride_started_at TIMESTAMPTZ,
    ride_completed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    cancel_reason TEXT,
    cancelled_by VARCHAR(10),                    -- 'user', 'driver', 'admin'

    user_rating INTEGER CHECK (user_rating BETWEEN 1 AND 5),
    driver_rating INTEGER CHECK (driver_rating BETWEEN 1 AND 5),
    user_feedback TEXT,
    driver_feedback TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_rides_user_id ON rides(user_id);
CREATE INDEX idx_rides_driver_id ON rides(driver_id);
CREATE INDEX idx_rides_status ON rides(status);
CREATE INDEX idx_rides_requested_at ON rides(requested_at DESC);
```

### 6.5 Payments Table
```sql
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ride_id UUID UNIQUE NOT NULL REFERENCES rides(id),
    user_id UUID NOT NULL REFERENCES users(id),
    amount DECIMAL(10, 2) NOT NULL,
    method VARCHAR(20) NOT NULL,                 -- 'razorpay', 'wallet', 'cash'
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    razorpay_order_id VARCHAR(100),
    razorpay_payment_id VARCHAR(100),
    razorpay_signature VARCHAR(255),
    cash_collected BOOLEAN DEFAULT FALSE,
    cash_amount_due DECIMAL(10, 2),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 6.6 Wallets Table
```sql
CREATE TABLE wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_type VARCHAR(10) NOT NULL,             -- 'user', 'driver'
    owner_id UUID NOT NULL,
    balance DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    currency VARCHAR(3) DEFAULT 'INR',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(owner_type, owner_id)
);
```

### 6.7 Wallet Transactions Table
```sql
CREATE TABLE wallet_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id UUID NOT NULL REFERENCES wallets(id),
    ride_id UUID REFERENCES rides(id),
    type VARCHAR(20) NOT NULL,                   -- 'credit', 'debit', 'refund', 'penalty'
    amount DECIMAL(10, 2) NOT NULL,
    balance_after DECIMAL(12, 2) NOT NULL,
    description TEXT,
    reference_id VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_wallet_tx_wallet_id ON wallet_transactions(wallet_id);
```

### 6.8 Driver Ride Requests Table
```sql
CREATE TABLE ride_driver_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ride_id UUID NOT NULL REFERENCES rides(id),
    driver_id UUID NOT NULL REFERENCES drivers(id),
    status VARCHAR(20) DEFAULT 'pending',        -- pending, accepted, rejected, expired
    notified_at TIMESTAMPTZ DEFAULT NOW(),
    responded_at TIMESTAMPTZ,
    UNIQUE(ride_id, driver_id)
);
```

### 6.9 Notifications Table
```sql
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_type VARCHAR(10) NOT NULL,         -- 'user', 'driver'
    recipient_id UUID NOT NULL,
    title VARCHAR(100) NOT NULL,
    body TEXT NOT NULL,
    type VARCHAR(30) NOT NULL,
    data JSONB,
    is_read BOOLEAN DEFAULT FALSE,
    sent_via_fcm BOOLEAN DEFAULT FALSE,
    fcm_message_id VARCHAR(200),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 6.10 Admin Users Table
```sql
CREATE TABLE admin_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firebase_uid VARCHAR(128) UNIQUE NOT NULL,
    email VARCHAR(254) UNIQUE NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    role VARCHAR(20) DEFAULT 'staff',            -- 'superadmin', 'staff', 'finance'
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 6.11 App Config Table
```sql
CREATE TABLE app_config (
    key VARCHAR(100) PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO app_config VALUES
    ('search_radius_km', '10', 'Radius in KM to search for nearby drivers'),
    ('driver_request_timeout_sec', '30', 'Seconds before request expires to a driver'),
    ('max_driver_requests_per_ride', '5', 'Max drivers to notify before declaring no drivers found'),
    ('otp_expiry_minutes', '10', 'OTP validity duration'),
    ('platform_commission_pct', '15', 'Percentage commission on each ride'),
    ('location_stream_maxlen', '10000', 'Max entries in Redis Streams location:events before trimming');
```

> **Note:** Procrastinate will auto-create its own tables (`procrastinate_jobs`, `procrastinate_events`, `procrastinate_periodic_defers`) when you run `python manage.py migrate`. No manual SQL needed.

---

## 7. Environment Variables (.env.example)

```bash
# ============================================================
# EV RIDES APP — Environment Variables
# Copy this file to .env.dev and .env.prod and fill in values
# NEVER commit .env files to git
# ============================================================

# --- Django Core ---
DJANGO_SECRET_KEY=your-secret-key-here-minimum-50-chars
DJANGO_DEBUG=True
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1
DJANGO_SETTINGS_MODULE=config.settings.dev
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://localhost:5174,http://localhost:5175

# --- Database (Supabase / PostgreSQL) ---
# Also used by Procrastinate as its job store
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres
DB_NAME=ev_rides
DB_USER=postgres
DB_PASSWORD=your-db-password
DB_HOST=db.yourproject.supabase.co
DB_PORT=5432

# --- Redis (Cache + Streams) ---
REDIS_URL=redis://localhost:6379/0
# For Upstash (cloud Redis free tier):
# REDIS_URL=rediss://:[PASSWORD]@[HOST].upstash.io:6379

# --- Redis Streams Config ---
LOCATION_STREAM_KEY=location:events
LOCATION_STREAM_GROUP=location-consumers
LOCATION_STREAM_CONSUMER=consumer-1
LOCATION_STREAM_MAXLEN=10000              # Trim stream to last 10k entries
LOCATION_DB_FLUSH_INTERVAL_SEC=30        # How often stream consumer flushes lat/lng to DB

# --- Firebase ---
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_PRIVATE_KEY_ID=your-private-key-id
FIREBASE_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxx@your-project.iam.gserviceaccount.com
FIREBASE_CLIENT_ID=your-client-id
FIREBASE_AUTH_URI=https://accounts.google.com/o/oauth2/auth
FIREBASE_TOKEN_URI=https://oauth2.googleapis.com/token
FIREBASE_WEB_API_KEY=your-firebase-web-api-key

# --- Firebase Cloud Messaging (FCM) ---
FCM_SERVER_KEY=your-fcm-server-key

# --- Razorpay (Payments) ---
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxx
RAZORPAY_KEY_SECRET=your-razorpay-secret
RAZORPAY_WEBHOOK_SECRET=your-webhook-secret

# --- Location Services ---
LOCATIONIQ_API_KEY=pk.your-locationiq-api-key
NOMINATIM_URL=http://localhost:8080

# --- OSRM Routing Engine ---
OSRM_URL=http://localhost:5000

# --- ML Pricing Model ---
ML_PRICING_MODEL_PATH=/app/ml_models/pricing_model.py
ML_PRICING_ENDPOINT=http://localhost:8001/predict

# --- Supabase Storage ---
SUPABASE_URL=https://yourproject.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# --- Procrastinate (uses DATABASE_URL above — no separate broker needed) ---
PROCRASTINATE_MAX_WORKERS=4               # Concurrent async task workers
PROCRASTINATE_POLL_INTERVAL_SEC=1         # How often worker polls Postgres for new jobs

# --- Frontend (Vite env vars — prefix with VITE_) ---
VITE_API_BASE_URL=http://localhost:8000/api/v1
VITE_FIREBASE_API_KEY=your-firebase-web-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-firebase-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abcdef
VITE_LOCATIONIQ_KEY=pk.your-locationiq-api-key
VITE_MAPCN_STYLE_URL=https://demotiles.maplibre.org/style.json

# --- Optional: Sentry Error Tracking ---
SENTRY_DSN_BACKEND=https://xxx@sentry.io/xxx
VITE_SENTRY_DSN_FRONTEND=https://xxx@sentry.io/xxx

# --- Optional: PostHog Analytics ---
VITE_POSTHOG_API_KEY=phc_your-posthog-key
VITE_POSTHOG_HOST=https://app.posthog.com
```

---

## 8. Phase-Wise Execution Plan

### Phase 0 — Repository & Infrastructure Setup (Week 1)

```
Tasks:
[ ] 1. Initialize monorepo structure
[ ] 2. Create three Vite React apps: user-app, rider-app, admin-app
[ ] 3. Install shadcn/ui in all three apps
[ ] 4. Install mapcn.dev: npx shadcn@latest add https://mapcn.dev/maps/map.json
[ ] 5. Set up Django project with DRF
[ ] 6. Set up Django split settings (base/dev/prod)
[ ] 7. Connect to Supabase PostgreSQL
[ ] 8. Install and configure Procrastinate:
       pip install procrastinate[django]
       Add 'procrastinate.contrib.django' to INSTALLED_APPS
       Run: python manage.py migrate  (creates Procrastinate tables automatically)
[ ] 9. Set up Redis locally via Docker (for cache + streams)
[ ] 10. Set up OSRM via Docker with India OSM data
[ ] 11. Create .env.dev from .env.example
[ ] 12. Set up Firebase project
[ ] 13. Create GitHub repo with branch protection
[ ] 14. Set up GitHub Actions CI
```

**Docker Compose for dev:**
```yaml
# docker-compose.dev.yml
services:
  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]

  osrm:
    image: osrm/osrm-backend
    ports: ["5000:5000"]
    volumes: ["./infrastructure/osrm/data:/data"]
    command: osrm-routed --algorithm mld /data/india-latest.osrm

  backend:
    build: ./backend
    ports: ["8000:8000"]
    env_file: .env.dev
    depends_on: [redis]
    volumes: ["./backend:/app"]
    command: python manage.py runserver 0.0.0.0:8000

  procrastinate-worker:
    build: ./backend
    env_file: .env.dev
    depends_on: [backend]
    # Uses same PostgreSQL as Django — no extra broker needed
    command: python manage.py procrastinate worker --concurrency=4

  location-consumer:
    build: ./backend
    env_file: .env.dev
    depends_on: [redis, backend]
    # Long-running Redis Streams consumer
    command: python manage.py run_location_consumer
```

> **Note:** No `celery` or `celery-beat` services. Procrastinate replaces both. The `location-consumer` is a separate lightweight process that reads only from Redis Streams.

---

### Phase 1 — Authentication (Week 1-2)

```
Tasks:

Backend:
[ ] 1. Create Firebase Admin SDK middleware
[ ] 2. Create /api/v1/auth/register/ endpoint
[ ] 3. Create /api/v1/auth/me/ endpoint
[ ] 4. Create custom DRF authentication class using Firebase tokens

Frontend (User App + Rider App):
[ ] 5. Build Login page with Phone Number input
[ ] 6. Firebase Phone Auth flow (OTP)
[ ] 7. Email Login as secondary tab
[ ] 8. Google OAuth login button
[ ] 9. Store auth token in Zustand + localStorage
[ ] 10. Build protected route wrapper
[ ] 11. Registration completion screen

Frontend (Admin App):
[ ] 12. Email + password login only
[ ] 13. Role-based access
```

---

### Phase 2 — User App: Booking Flow (Week 2-3)

```
Tasks:

Backend:
[ ] 1. GET /api/v1/location/search/?q=        (proxies LocationIQ)
[ ] 2. POST /api/v1/rides/estimate-price/     (calls ML model)
[ ] 3. POST /api/v1/rides/request/            (creates ride, queues driver search via Procrastinate)
[ ] 4. GET /api/v1/rides/{id}/
[ ] 5. GET /api/v1/drivers/nearby/
[ ] 6. GET /api/v1/location/reverse/?lat=&lng=

Frontend (User App):
[ ] 7. Home/Booking screen with auto location
[ ] 8. Destination search with LocationIQ autocomplete
[ ] 9. mapcn BasicMap with current location pin
[ ] 10. Estimated price card
[ ] 11. "Searching for drivers..." state
[ ] 12. Polling loop: GET /rides/{id}/ every 3s
```

---

### Phase 3 — Rider App + Redis Streams Location (Week 3)

```
Tasks:

Backend — Location Streaming:
[ ] 1. POST /api/v1/location/driver-update/
       → Django view does: XADD location:events MAXLEN ~ 10000 * driver_id {id} lat {lat} lng {lng} heading {h}
       → Returns 200 immediately (fire and forget from view's perspective)

[ ] 2. Implement run_location_consumer management command:
       → Create consumer group: XGROUP CREATE location:events location-consumers $ MKSTREAM
       → Loop: XREADGROUP GROUP location-consumers consumer-1 BLOCK 2000 COUNT 50 STREAMS location:events >
       → For each message batch:
           a. Update Redis key: SET driver:{id}:location {lat,lng,heading} EX 10
           b. Add to Redis set: SADD online_drivers {driver_id}
           c. Buffer lat/lng in memory dict
       → Every 30 seconds: flush buffered positions to DB (bulk UPDATE drivers SET current_lat=...)
       → XACK location:events location-consumers {message_ids}

[ ] 3. GET /api/v1/rides/{id}/driver-location/
       → Reads from Redis key: driver:{id}:location
       → Returns lat/lng to User App

Backend — Ride Management:
[ ] 4. POST /api/v1/drivers/go-online/        → SET online in Redis + DB
[ ] 5. POST /api/v1/drivers/go-offline/       → DEL from Redis, set offline in DB
[ ] 6. GET  /api/v1/rides/incoming/
[ ] 7. POST /api/v1/rides/{id}/accept/
[ ] 8. POST /api/v1/rides/{id}/reject/
[ ] 9. POST /api/v1/rides/{id}/verify-otp/
[ ] 10. POST /api/v1/rides/{id}/start/
[ ] 11. POST /api/v1/rides/{id}/complete/

Backend — Procrastinate Tasks (replaces Celery tasks):
[ ] 12. Create Procrastinate task: notify_driver_of_ride_request
        → Sends FCM push to driver
        → Schedules a timeout task (30s deferred) to auto-expire if no response
[ ] 13. Create Procrastinate periodic task: cleanup_expired_ride_requests
        → Runs every 5 minutes via Procrastinate's cron syntax
[ ] 14. Create Procrastinate task: send_ride_summary_email

Frontend (Rider App):
[ ] 15. Online/Offline toggle
[ ] 16. useLocationBroadcast: POSTs location every 3s when online
[ ] 17. Incoming ride request card (30s countdown)
[ ] 18. Route to pickup on mapcn (blue line from OSRM)
[ ] 19. OTP entry screen
[ ] 20. Active ride screen
[ ] 21. Complete ride button
[ ] 22. Earnings summary
```

**Procrastinate Task Examples:**
```python
# backend/apps/rides/tasks/notify_driver.py
import procrastinate
from procrastinate.contrib.django import app

@app.task(name="notify_driver_of_ride_request", retry=procrastinate.RetryStrategy(max_attempts=3))
def notify_driver_of_ride_request(ride_id: str, driver_id: str):
    from apps.notifications.services import send_fcm_push
    send_fcm_push(driver_id=driver_id, title="New Ride Request", body="Tap to accept")

@app.periodic(cron="*/5 * * * *")  # Every 5 minutes — replaces Celery Beat
@app.task(name="cleanup_expired_ride_requests")
def cleanup_expired_ride_requests():
    from apps.rides.models import RideDriverRequest
    RideDriverRequest.objects.filter(status='pending', notified_at__lt=now()-timedelta(minutes=5)).update(status='expired')

# Defer a task (replaces .delay() in Celery):
notify_driver_of_ride_request.defer(ride_id=str(ride.id), driver_id=str(driver.id))

# Defer with countdown (replaces Celery's countdown=):
notify_driver_of_ride_request.defer(ride_id=..., schedule_in={"seconds": 30})
```

---

### Phase 4 — Live Location & Route (Week 4)

```
Tasks:

Backend:
[ ] 1. GET /api/v1/rides/{id}/driver-location/  → reads driver:{id}:location from Redis
[ ] 2. GET /api/v1/rides/{id}/route/            → calls OSRM, returns GeoJSON polyline
[ ] 3. OSRM integration service (same as before)

Frontend (User App):
[ ] 4. useDriverPolling: GET /rides/{id}/driver-location/ every 3s
[ ] 5. Animate driver marker on mapcn
[ ] 6. Blue route line: driver → pickup (arriving phase)
[ ] 7. Blue route line: pickup → destination (active ride phase)
[ ] 8. ETA display

Frontend (Rider App):
[ ] 9. Show pickup pin on map
[ ] 10. OSRM route to pickup
[ ] 11. After ride start: route to destination
```

---

### Phase 5 — OTP Verification & Ride Lifecycle (Week 4)

```
Tasks:
[ ] 1. On driver_assigned: generate 4-digit OTP, save hashed to rides.otp_code
[ ] 2. Defer Procrastinate task: send_otp_notification (FCM to user)
[ ] 3. POST /api/v1/rides/{id}/verify-otp/ validates OTP, sets otp_verified=true
[ ] 4. OTP expires after 10 minutes
[ ] 5. User App: show large OTP on screen
[ ] 6. Rider App: numeric keypad, max 3 attempts
```

---

### Phase 6 — Payments & Wallet (Week 5)

```
Tasks:

Backend:
[ ] 1. POST /api/v1/payments/create-order/
[ ] 2. POST /api/v1/payments/verify/
[ ] 3. POST /api/v1/payments/cash/
[ ] 4. GET  /api/v1/wallet/balance/
[ ] 5. GET  /api/v1/wallet/transactions/
[ ] 6. Razorpay webhook endpoint
[ ] 7. Procrastinate task: process_wallet_credit (async wallet update after payment)
[ ] 8. Procrastinate task: process_refund

Frontend:
[ ] 9. Post-ride payment screen
[ ] 10. Wallet balance widget
[ ] 11. Transaction history page
```

---

### Phase 7 — Admin App (Week 5-6)

```
Tasks:

Backend:
[ ] 1. GET /api/v1/admin/dashboard/stats/
[ ] 2. GET /api/v1/admin/rides/
[ ] 3. GET /api/v1/admin/drivers/
[ ] 4. GET /api/v1/admin/users/
[ ] 5. GET /api/v1/admin/payments/
[ ] 6. POST /api/v1/admin/drivers/{id}/verify/
[ ] 7. POST /api/v1/admin/drivers/{id}/suspend/
[ ] 8. GET /api/v1/admin/analytics/revenue/?period=week|month|year
[ ] 9. Procrastinate periodic task: generate_daily_analytics_report (cron: 0 1 * * *)

Frontend:
[ ] 10. Dashboard KPI cards
[ ] 11. Real-time rides map (mapcn)
[ ] 12. Rides, Drivers, Users, Payments tables
[ ] 13. Revenue analytics charts
[ ] 14. App config editor
```

---

### Phase 8 — PWA & Responsiveness (Week 6)

```
Tasks:
[ ] 1. Install vite-plugin-pwa in all three apps
[ ] 2. Configure VitePWA plugin (manifest, icons, theme)
[ ] 3. Implement install prompt
[ ] 4. Offline fallback page
[ ] 5. Cache strategies via Workbox
[ ] 6. Test on Android Chrome + iOS Safari
[ ] 7. Mobile-first responsive design (375px baseline)
[ ] 8. Bottom navigation bar on mobile
```

**vite.config.js PWA snippet:**
```javascript
import { VitePWA } from 'vite-plugin-pwa'

VitePWA({
  registerType: 'autoUpdate',
  manifest: {
    name: 'EV Rides',
    short_name: 'EVRides',
    theme_color: '#10b981',
    background_color: '#ffffff',
    display: 'standalone',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' }
    ]
  },
  workbox: {
    runtimeCaching: [{
      urlPattern: /^https:\/\/api\./,
      handler: 'NetworkFirst',
      options: { cacheName: 'api-cache', expiration: { maxAgeSeconds: 60 } }
    }]
  }
})
```

---

### Phase 9 — Testing & Hardening (Week 7)

```
Tasks:
[ ] 1. pytest + pytest-django for all API endpoints
[ ] 2. Vitest + React Testing Library for key components
[ ] 3. Load test polling endpoints (k6 or locust)
[ ] 4. Load test Redis Streams consumer under 100 concurrent drivers
[ ] 5. Security audit: CSRF, rate limiting (django-ratelimit), SQL injection
[ ] 6. django-ratelimit on auth + location update endpoints
[ ] 7. Verify Procrastinate job retry behaviour on task failures
[ ] 8. Review Redis Stream MAXLEN trimming under load
[ ] 9. OSRM stress test
[ ] 10. Payment flow E2E test (Razorpay test mode)
```

---

### Phase 10 — Production Deployment (Week 8)

```
Tasks:
[ ] 1. Set up VPS (DigitalOcean, Hetzner, or AWS EC2)
[ ] 2. Dockerize all services (docker-compose.prod.yml)
[ ] 3. Nginx reverse proxy + SSL (Let's Encrypt)
[ ] 4. Set DJANGO_DEBUG=False, ALLOWED_HOSTS to domain
[ ] 5. Migrate from Supabase to self-hosted PostgreSQL
[ ] 6. Set up Redis on VPS (or keep Upstash)
[ ] 7. OSRM Docker container
[ ] 8. Procrastinate worker as systemd service or Docker container
[ ] 9. Location consumer as separate Docker container (auto-restart on failure)
[ ] 10. GitHub Actions deploy on push to main
[ ] 11. Daily DB backups (pg_dump to S3 or Supabase Storage)
[ ] 12. Monitor with UptimeRobot
```

---

## 9. App-by-App Feature Breakdown

### User App Screens
| Screen | Features |
|--------|----------|
| Login | Phone OTP (primary), Email, Google OAuth |
| Home/Booking | Current location (auto + editable), Destination search, Price estimate |
| Searching | Map with nearby driver pins, "Searching..." animation |
| Driver Assigned | Driver info, ETA, live driver location on map |
| OTP Screen | Large 4-digit OTP display |
| Active Ride | Blue route to destination, live updates |
| Payment | Final price, Razorpay or Cash options |
| Ride History | Past rides list |
| Wallet | Balance, top-up, transactions |
| Profile | Edit name, photo |

### Rider App Screens
| Screen | Features |
|--------|----------|
| Login | Phone OTP, Email |
| Dashboard | Online/Offline toggle, Earnings today, Rating |
| Ride Request | Incoming card (30s timer), Accept/Reject |
| Navigating to User | Map with blue route to pickup |
| OTP Entry | Numeric pad |
| Active Ride | Map with route to destination, Complete button |
| Earnings | Daily/weekly/monthly, Ride history |
| Profile | Vehicle info, Documents |

### Admin App Screens
| Screen | Features |
|--------|----------|
| Dashboard | KPI cards, Active rides map, Activity feed |
| Rides | Full table, filters, detail modal |
| Drivers | List, verify, suspend, earnings |
| Users | List, history, wallet, suspend |
| Payments | Transaction table, refund |
| Analytics | Revenue charts, ride volume, heatmaps |
| Settings | App config editor |

---

## 10. Procrastinate & Redis Streams Notes

### Procrastinate vs Celery — Key Differences

| Feature | Celery | Procrastinate |
|---------|--------|---------------|
| Broker | Redis or RabbitMQ (extra infra) | PostgreSQL (already in stack) |
| Periodic tasks | Celery Beat (separate process) | Built-in `@app.periodic` decorator |
| Job visibility | Redis CLI (opaque) | SQL query on `procrastinate_jobs` table |
| Retry logic | `max_retries`, `retry_backoff` | `RetryStrategy(max_attempts, wait_minimum, wait_multiplier)` |
| Worker command | `celery -A config worker` | `python manage.py procrastinate worker` |
| Admin UI | Flower (extra install) | Any PostgreSQL GUI (pgAdmin, Supabase dashboard) |

### Redis Streams — Location Consumer Implementation

```python
# backend/apps/location/management/commands/run_location_consumer.py
import time
import redis
from django.core.management.base import BaseCommand
from django.core.cache import cache
from django.conf import settings
from apps.drivers.models import Driver

class Command(BaseCommand):
    help = 'Consume driver location events from Redis Streams'

    def handle(self, *args, **options):
        r = redis.from_url(settings.REDIS_URL)
        stream = settings.LOCATION_STREAM_KEY          # 'location:events'
        group = settings.LOCATION_STREAM_GROUP         # 'location-consumers'
        consumer = settings.LOCATION_STREAM_CONSUMER   # 'consumer-1'
        flush_interval = int(settings.LOCATION_DB_FLUSH_INTERVAL_SEC)  # 30

        # Create consumer group if not exists
        try:
            r.xgroup_create(stream, group, id='$', mkstream=True)
        except redis.exceptions.ResponseError:
            pass  # Group already exists

        pending_db_updates = {}  # {driver_id: {lat, lng}} — buffered for DB flush
        last_flush = time.time()

        self.stdout.write('Location consumer started.')

        while True:
            # Read up to 50 messages, block for 2s if stream is empty
            messages = r.xreadgroup(group, consumer, {stream: '>'}, count=50, block=2000)

            if messages:
                ack_ids = []
                for _, entries in messages:
                    for msg_id, data in entries:
                        driver_id = data[b'driver_id'].decode()
                        lat = float(data[b'lat'])
                        lng = float(data[b'lng'])
                        heading = data.get(b'heading', b'0').decode()

                        # 1. Update Redis cache (hot path — O(1))
                        cache.set(
                            f'driver:{driver_id}:location',
                            {'lat': lat, 'lng': lng, 'heading': heading},
                            timeout=10  # Auto-expire if driver goes silent
                        )

                        # 2. Keep driver in online set
                        r.sadd('online_drivers', driver_id)
                        r.expire('online_drivers', 60)

                        # 3. Buffer for DB flush
                        pending_db_updates[driver_id] = {'lat': lat, 'lng': lng}
                        ack_ids.append(msg_id)

                # Acknowledge processed messages
                if ack_ids:
                    r.xack(stream, group, *ack_ids)

            # Flush buffered positions to DB every 30 seconds (not every event)
            if time.time() - last_flush >= flush_interval and pending_db_updates:
                self._flush_to_db(pending_db_updates)
                pending_db_updates.clear()
                last_flush = time.time()

    def _flush_to_db(self, updates: dict):
        from django.db import connection
        # Bulk update using parameterized query for safety and efficiency
        from psycopg2.extras import execute_values
        with connection.cursor() as cursor:
            # Build a VALUES list: (driver_id, lat, lng)
            values = [(did, v['lat'], v['lng']) for did, v in updates.items()]
            execute_values(
                cursor,
                """
                UPDATE drivers SET current_lat = v.lat, current_lng = v.lng, location_updated_at = NOW()
                FROM (VALUES %s) AS v(id, lat, lng)
                WHERE drivers.id = v.id::UUID
                """,
                values
            )
        self.stdout.write(f'Flushed {len(updates)} driver positions to DB.')
```

### Redis Streams — Driver Location Publish (Django View)

```python
# backend/apps/location/views.py
import redis
from django.conf import settings
from rest_framework.decorators import api_view
from rest_framework.response import Response

r = redis.from_url(settings.REDIS_URL)

@api_view(['POST'])
def update_driver_location(request):
    driver_id = str(request.user.driver.id)
    lat = request.data.get('lat')
    lng = request.data.get('lng')
    heading = request.data.get('heading', 0)

    # Publish to Redis Stream (non-blocking, returns immediately)
    r.xadd(
        settings.LOCATION_STREAM_KEY,
        {'driver_id': driver_id, 'lat': lat, 'lng': lng, 'heading': heading},
        maxlen=int(settings.LOCATION_STREAM_MAXLEN),
        approximate=True  # MAXLEN ~ (approximate trim, much faster)
    )
    return Response({'status': 'ok'})
```

### Nearby Driver Search (unchanged — still uses Redis)

```python
# backend/apps/rides/services.py
import math
from django.core.cache import cache
import redis
from django.conf import settings

r = redis.from_url(settings.REDIS_URL)

def get_nearby_drivers(pickup_lat, pickup_lng, radius_km=10):
    online_driver_ids = r.smembers('online_drivers')
    nearby = []
    for driver_id in online_driver_ids:
        loc = cache.get(f'driver:{driver_id.decode()}:location')
        if loc:
            dist = haversine(pickup_lat, pickup_lng, loc['lat'], loc['lng'])
            if dist <= radius_km:
                nearby.append({'driver_id': driver_id.decode(), 'distance_km': dist, **loc})
    return sorted(nearby, key=lambda x: x['distance_km'])

def haversine(lat1, lng1, lat2, lng2):
    R = 6371
    dlat, dlng = math.radians(lat2-lat1), math.radians(lng2-lng1)
    a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1))*math.cos(math.radians(lat2))*math.sin(dlng/2)**2
    return R * 2 * math.asin(math.sqrt(a))
```

### Location Search (LocationIQ)

```javascript
// apps/user-app/src/services/locationiq.js
const searchLocations = async (query) => {
  const res = await fetch(
    `https://api.locationiq.com/v1/autocomplete?key=${import.meta.env.VITE_LOCATIONIQ_KEY}&q=${query}&limit=5&countrycodes=in`
  );
  return res.json();
};
```

### Frontend Polling (unchanged)

```javascript
// apps/user-app/src/hooks/useDriverPolling.js
import { useState, useEffect } from 'react';
import api from '../services/api';

const useDriverPolling = (rideId, isActive) => {
  const [driverLocation, setDriverLocation] = useState(null);
  useEffect(() => {
    if (!isActive) return;
    const interval = setInterval(async () => {
      try {
        const { data } = await api.get(`/rides/${rideId}/driver-location/`);
        setDriverLocation(data);
      } catch (e) { /* handle gracefully */ }
    }, 3000);
    return () => clearInterval(interval);
  }, [rideId, isActive]);
  return driverLocation;
};

export default useDriverPolling;
```

---

## 11. PWA Setup Guide

### Android (Chrome)
- Browser auto-shows "Add to Home Screen" banner if manifest.json is valid
- Push notifications via FCM work natively

### iOS (Safari)
- User must manually tap Share → "Add to Home Screen"
- No push notification support on iOS PWA (WebKit limitation)
- Workaround: in-app notification banner instead of push on iOS
- Detect iOS: `const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)`

### Service Worker Caching Strategy
```
Cache-first:              Static assets (JS, CSS, icons)
Network-first:            API calls (ride status, location)
Stale-while-revalidate:   User profile, ride history
No cache:                 Payment endpoints (always fresh)
```

---

## 12. Design System & UI Reference

**Velocity Ride Design Language** (isometric line-art style):

- **Type:** Geist (display/body) + Geist Mono (labels)
- **Colors:** Off-white bg `#FAF7F4`, ink `#121212`, accent `#18A558` (electric green), stroke `#D9D4CE`
- **Illustration:** SVG isometric line art (1.5px strokes), accent highlights "active" elements
- **Layout:** Dashed-frame hero, 60/40 split (copy/scene), metrics strip, bottom status cards
- **Animation:** Loops through ride lifecycle: tap → pin drop → vehicle arrival → boarding → en route → destination pulse

**Key design constraints to preserve across all pages:**
- Mobile-first (375px minimum width)
- Bottom navigation on mobile
- Map must take 60%+ of viewport on booking/active ride screens
- Consistent accent color (green `#18A558` as primary, coral `#FF5A4E` for secondary highlights)
- shadcn/ui component library for reusable elements
- mapcn.dev for all map components
- Isometric illustration system for onboarding and status visualization

---

## 13. Claude Code Instructions

### Setup Prompt for Claude Code:
```
You are building an EV ride-hailing app with three React PWAs (user-app, rider-app, admin-app)
and a Django REST Framework backend.

Tech stack:
- Frontend: React + Vite + shadcn/ui + mapcn.dev + Zustand + React Query
- Backend: Django + DRF + Firebase Auth + Redis + Procrastinate
- Task queue: Procrastinate (PostgreSQL-backed — NO Celery, NO RabbitMQ)
- Location streaming: Redis Streams (driver publishes → stream consumer → Redis cache → user polls)
- Database: PostgreSQL (Supabase)
- Payments: Razorpay | Location: LocationIQ | Maps: mapcn.dev | Routing: OSRM

Reference IMPLEMENTATION.md for:
1. Folder structure (Section 5)
2. Database schema (Section 6) — create Django models from this
3. Environment variables (Section 7)
4. Phase-by-phase tasks (Section 8) — execute one phase at a time
5. Procrastinate task examples and Redis Streams consumer (Section 10)

Important:
- Use Procrastinate's @app.task and @app.periodic decorators (NOT Celery)
- Worker command: python manage.py procrastinate worker
- Location consumer: python manage.py run_location_consumer (separate Docker service)
- Redis is used ONLY for cache + streams. Procrastinate jobs live in PostgreSQL.

Start with Phase 0. Ask before making assumptions not in this document.
```

### Phase Execution Prompts:
```
Phase 0: "Set up the monorepo structure from Section 5. Create Vite apps, install
         dependencies, create docker-compose.dev.yml with procrastinate-worker and
         location-consumer services, connect to Supabase."

Phase 1: "Implement authentication from Phase 1. Start with Django Firebase
         middleware, then build the login screens."

Phase 3: "Implement the Redis Streams location pipeline from Phase 3.
         Create the run_location_consumer management command using the
         implementation in Section 10."
```

---

*Document version: 2.0 | Task queue: Procrastinate (PostgreSQL) | Location: Redis Streams | Created for Claude Code execution*
