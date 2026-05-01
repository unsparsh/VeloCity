# Phase 0 — Repository & Infrastructure Setup ✓

This document outlines the completed Phase 0 setup for the Velocity EV Ride-Hailing Platform.

## Completed Tasks

### 1. Monorepo Structure ✓
```
VeloCity/
├── Velo Rider/          # Passenger PWA (React + Vite)
├── Velo Driver/         # Driver PWA (React + Vite) [To be initialized]
├── Velo Admin/          # Admin Dashboard (React + Vite) [To be initialized]
├── backend/             # Django REST Framework backend
├── docker-compose.dev.yml
├── .env.dev
├── .gitignore
└── Plan.md
```

### 2. Frontend Setup (Velo Rider) ✓

**Tech Stack:**
- Vite 5.x (latest)
- React 19.2.5
- React Router v7
- Zustand (state management)
- TanStack Query v5 (data fetching)
- Axios (HTTP client)
- Firebase SDK (authentication)
- Geist font family (via Google Fonts)

**Project Structure:**
```
Velo Rider/
├── src/
│   ├── pages/
│   │   ├── Landing.jsx       # Hero + animated isometric scene
│   │   ├── Landing.module.css
│   │   └── [Phase 1+: Login, Booking, etc.]
│   ├── components/
│   │   ├── map/              # Map-related components [Phase 2+]
│   │   ├── booking/          # Booking flow components [Phase 2+]
│   │   └── payment/          # Payment components [Phase 6+]
│   ├── hooks/
│   │   ├── useGeolocation.js          [Phase 2]
│   │   ├── useLocationSearch.js       [Phase 2]
│   │   ├── useDriverPolling.js        [Phase 4]
│   │   └── useLocationBroadcast.js    [Phase 3 - Rider app only]
│   ├── services/
│   │   ├── api.js            # Axios instance + endpoints
│   │   ├── firebase.js       # Firebase auth config
│   │   └── locationiq.js     # LocationIQ integration
│   ├── store/
│   │   ├── useRideStore.js   # Ride booking state
│   │   └── useAuthStore.js   # Authentication state
│   ├── App.jsx               # Router setup
│   ├── main.jsx              # Entry point
│   └── index.css             # Global styles + design tokens
├── public/
│   ├── index.html            # HTML template
│   └── icons/                # PWA app icons [To add]
├── vite.config.js            # Vite config with PWA plugin
└── package.json
```

**Scripts:**
```bash
npm run dev      # Start dev server on http://localhost:5173
npm run build    # Production build
npm run preview  # Preview prod build locally
```

**Installed Dependencies:**
- React ecosystem: react, react-dom, react-router-dom
- State: zustand
- Data fetching: @tanstack/react-query, axios
- Auth: firebase
- Build: vite, @vitejs/plugin-react, vite-plugin-pwa

### 3. Backend Setup (Django) ✓

**Tech Stack:**
- Django 4.2 (LTS)
- Django REST Framework 3.14
- Procrastinate 3.1 (PostgreSQL task queue)
- Firebase Admin SDK
- PostgreSQL 16 (via Docker)
- Redis 7 (via Docker)
- Gunicorn (production WSGI)

**Project Structure:**
```
backend/
├── config/
│   ├── settings/
│   │   ├── base.py          # Shared settings
│   │   ├── dev.py           # Dev overrides
│   │   └── prod.py          # Prod overrides
│   ├── procrastinate_app.py # Task queue config
│   ├── urls.py              # API routing
│   ├── wsgi.py              # Production entry point
│   └── __init__.py
├── apps/
│   ├── users/               # User management [Phase 1]
│   ├── rides/               # Ride lifecycle [Phase 2-5]
│   ├── location/            # Location streaming [Phase 3]
│   │   └── management/commands/
│   │       └── run_location_consumer.py  # Redis Streams consumer
│   ├── payments/            # Payment processing [Phase 6]
│   ├── notifications/       # FCM push notifications [Phase 3+]
│   ├── pricing/             # ML pricing model [Phase 2]
│   └── analytics/           # Analytics aggregation [Phase 7]
├── manage.py                # Django CLI
├── requirements.txt         # Python dependencies
├── Dockerfile               # Container image
└── .gitignore
```

**Installed Dependencies:**
- Django: django, djangorestframework, django-cors-headers, django-environ
- Database: psycopg2-binary, django-redis
- Task queue: procrastinate[django]
- Auth: firebase-admin
- API: requests, gunicorn
- Utilities: pillow (image processing)

### 4. Docker Compose (Dev) ✓

**Services:**
```yaml
db:                    PostgreSQL 16 (port 5432)
redis:                 Redis 7 (port 6379)
osrm:                  OSRM routing engine (port 5000)
backend:               Django runserver (port 8000)
procrastinate-worker:  Async task processor
location-consumer:     Redis Streams consumer
```

**Key Features:**
- Health checks on db and redis
- Shared network: `velocity_dev`
- Persistent volumes: postgres_data, redis_data
- Environment variables from `.env.dev`

**To Start:**
```bash
# Ensure .env.dev is populated, then:
docker-compose -f docker-compose.dev.yml up --build

# In another terminal, run Django migrations:
docker-compose -f docker-compose.dev.yml exec backend python manage.py migrate
```

### 5. Configuration Files ✓

**`.env.dev`**
- All environment variables documented and templated
- Firebase, Razorpay, LocationIQ placeholders (fill in your keys)
- CORS, database, Redis, Procrastinate settings pre-configured

**`.gitignore`**
- Standard Python + Node.js + IDE exclusions
- `.env*` files excluded (secret safety)

**`vite.config.js`**
- PWA plugin configured (manifest, icons, workbox caching)
- API proxy to Django (`/api` → `http://localhost:8000/api/v1`)
- Optimized build output

### 6. Design System Implemented ✓

**Landing Page (`Velo Rider/src/pages/Landing.jsx`)**
- Isometric line-art SVG animation (booking flow: tap → pin drop → vehicle arrives → boards → drives → destination)
- Design tokens: colors (#18A558 accent, #FAF7F4 bg, #121212 ink)
- Typography: Geist + Geist Mono via Google Fonts
- Responsive: desktop (1280px) → mobile (375px+)
- 4-metric strip + trust row
- Animated status card (bottom-right of scene)
- Keyboard shortcuts (B = book ride)

**CSS Modules**
- Component-scoped styles (no global class pollution)
- CSS variables for theming
- Mobile-first responsive grid

---

## Next Steps (Phase 1)

### Phase 1: Authentication (Week 1-2)

**Backend:**
1. Create `User` and `Driver` models in `apps/users/models.py`
2. Firebase Admin SDK middleware for token verification
3. DRF authentication class using Firebase tokens
4. Endpoints: `POST /auth/register/`, `GET /auth/me/`

**Frontend (Velo Rider):**
1. Create `pages/Login.jsx` with phone + email tabs
2. Firebase Phone Auth flow (OTP)
3. `store/useAuthStore.js` (Zustand) for token persistence
4. Protected route wrapper (`<PrivateRoute>`)

---

## Development Workflow

### Local Development

1. **Install dependencies:**
   ```bash
   cd "Velo Rider"
   npm install
   cd ../backend
   python -m venv venv
   source venv/bin/activate  # Windows: venv\Scripts\activate
   pip install -r requirements.txt
   ```

2. **Set up environment:**
   ```bash
   cp .env.dev .env.dev.local
   # Edit .env.dev.local with your Firebase, Razorpay, LocationIQ keys
   ```

3. **Start dev servers:**
   ```bash
   # Terminal 1: Frontend
   cd "Velo Rider"
   npm run dev

   # Terminal 2: Backend (Docker optional, or local Django)
   cd backend
   python manage.py runserver

   # Terminal 3: Docker services (if using)
   docker-compose -f docker-compose.dev.yml up
   ```

4. **Access:**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:8000/api/v1
   - Admin panel: http://localhost:8000/admin

### Git Workflow

- Branch: `feature/phase-1-auth`
- Commit: `feat: implement phone OTP authentication` (conventional commits)
- PR: Include design screenshots, test plan, schema changes

---

## Troubleshooting

### Port Already in Use
```bash
# Find process on port 5173:
lsof -i :5173
kill -9 <PID>
```

### Database Connection Error
```bash
# Check PostgreSQL is running in Docker:
docker-compose -f docker-compose.dev.yml logs db
# Or verify DB_* env vars in .env.dev
```

### Node Module Issues
```bash
rm -rf node_modules package-lock.json
npm install
```

---

## Summary

✓ Monorepo initialized with three React PWA apps (1 fully scaffolded)
✓ Django backend with modular app structure
✓ Docker Compose dev environment (db, redis, osrm, backend, workers)
✓ Vite PWA setup with responsive design tokens
✓ Landing page with isometric animation (design system reference)
✓ Environment config templated

**Ready for Phase 1 (Authentication).** Proceed to `Plan.md` Section 8 for detailed Phase 1 tasks.
