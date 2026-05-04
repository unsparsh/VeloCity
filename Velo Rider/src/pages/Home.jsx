import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import useAuthStore from '../store/useAuthStore'
import styles from './Home.module.css'

const PICKUP  = { x: 140, y: 450 }
const DROPOFF = { x: 580, y: 450 }
const MID     = { x: 360, y: 340 }
const GARAGE  = { x: 640, y: 260 }

function lerp(a, b, t) { return a + (b - a) * t }
function ptLerp(p1, p2, t) { return { x: lerp(p1.x, p2.x, t), y: lerp(p1.y, p2.y, t) } }
function ease(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2 }
function dirFromDx(dx) { return dx >= 0 ? 'right' : 'left' }

export default function Home() {
  const navigate    = useNavigate()
  const { user, logout } = useAuthStore()

  // Animated SVG element refs
  const carRef          = useRef(null)
  const carBodyRef      = useRef(null)
  const routePathRef    = useRef(null)
  const tapRingRef      = useRef(null)
  const pickupRingRef   = useRef(null)
  const pickupPinRef    = useRef(null)
  const userFigRef      = useRef(null)
  const userPhoneRef    = useRef(null)
  const headlightRef    = useRef(null)
  const arrivalRef      = useRef(null)
  const labelCarRef     = useRef(null)
  const dropPinRef      = useRef(null)
  const statusTextRef   = useRef(null)
  const statusEtaRef    = useRef(null)

  useEffect(() => {
    let raf = null
    let cancelled = false
    let playing = false
    let carDir = 'left'
    const speed = 1

    function animFrame(ms, onTick) {
      return new Promise(resolve => {
        if (cancelled) { resolve(); return }
        const t0 = performance.now()
        const d  = ms / speed
        function tick(now) {
          if (cancelled) { resolve(); return }
          const raw = Math.min(1, (now - t0) / d)
          onTick(ease(raw))
          if (raw < 1) raf = requestAnimationFrame(tick)
          else resolve()
        }
        raf = requestAnimationFrame(tick)
      })
    }

    function wait(ms) {
      return new Promise(r => setTimeout(() => { if (!cancelled) r() }, ms / speed))
    }

    function setCar(x, y, dir) {
      if (dir) carDir = dir
      carRef.current?.setAttribute('transform', `translate(${x},${y})`)
      carBodyRef.current?.setAttribute('transform', `scale(${carDir === 'right' ? -1 : 1},1)`)
      labelCarRef.current?.setAttribute('transform', `translate(${x - 36},${y - 60})`)
    }

    function resetScene() {
      if (raf) cancelAnimationFrame(raf)
      carDir = 'left'
      setCar(GARAGE.x, GARAGE.y)
      routePathRef.current?.setAttribute('stroke-dashoffset', '100')
      tapRingRef.current?.setAttribute('opacity', '0')
      pickupRingRef.current?.setAttribute('opacity', '0')
      pickupPinRef.current?.setAttribute('transform', 'translate(0,-44)')
      if (arrivalRef.current) {
        arrivalRef.current.setAttribute('opacity', '0')
        arrivalRef.current.setAttribute('transform', 'translate(580,450)')
      }
      labelCarRef.current?.setAttribute('opacity', '0')
      headlightRef.current?.setAttribute('opacity', '0')
      dropPinRef.current?.setAttribute('opacity', '0.55')
      if (userFigRef.current) {
        userFigRef.current.setAttribute('transform', 'translate(110,460)')
        userFigRef.current.setAttribute('opacity', '1')
      }
      userPhoneRef.current?.setAttribute('fill', 'var(--accent)')
      if (statusTextRef.current) statusTextRef.current.textContent = 'Tap to book your ride'
      if (statusEtaRef.current)  statusEtaRef.current.textContent  = '— —'
    }
    resetScene()

    async function run() {
      if (playing || cancelled) return
      playing = true
      resetScene()

      // 1 — Tap: ring expands at pickup, phone flashes
      if (statusTextRef.current) statusTextRef.current.textContent = 'Confirming pickup…'
      if (statusEtaRef.current)  statusEtaRef.current.textContent  = 'LOC · CURRENT'
      await animFrame(700, t => {
        tapRingRef.current?.setAttribute('opacity', String((1 - t) * 0.9))
        tapRingRef.current?.setAttribute('transform', `translate(140,450) scale(${0.4 + t * 1.2})`)
        userPhoneRef.current?.setAttribute('fill', t < 0.5 ? 'var(--accent)' : '#fff')
      })
      tapRingRef.current?.setAttribute('opacity', '0')

      // 2 — Pin drop with bounce
      if (statusTextRef.current) statusTextRef.current.textContent = 'Finding your driver…'
      await animFrame(500, t => {
        pickupPinRef.current?.setAttribute('transform', `translate(0,${-80 + t * 36})`)
      })
      await animFrame(260, t => {
        pickupPinRef.current?.setAttribute('transform', `translate(0,${-44 - Math.sin(t * Math.PI) * 6})`)
      })
      pickupRingRef.current?.setAttribute('opacity', '0.25')
      await wait(300)

      // 3 — Car drives: GARAGE → MID → PICKUP
      if (statusTextRef.current) statusTextRef.current.textContent = 'EV en route · 98% battery'
      if (statusEtaRef.current)  statusEtaRef.current.textContent  = 'ETA 3 MIN'
      labelCarRef.current?.setAttribute('opacity', '1')
      headlightRef.current?.setAttribute('opacity', '0.8')

      setCar(GARAGE.x, GARAGE.y, dirFromDx(MID.x - GARAGE.x))
      await animFrame(1400, t => { const p = ptLerp(GARAGE, MID, t);    setCar(p.x, p.y) })
      setCar(MID.x, MID.y, dirFromDx(PICKUP.x - MID.x))
      await animFrame(1400, t => { const p = ptLerp(MID,    PICKUP, t); setCar(p.x, p.y) })

      // 4 — Pickup: user figure slides into car
      if (statusTextRef.current) statusTextRef.current.textContent = 'Driver arrived · Welcome aboard'
      if (statusEtaRef.current)  statusEtaRef.current.textContent  = 'BOARDING'
      await animFrame(600, t => {
        pickupRingRef.current?.setAttribute('opacity', String(0.4 + Math.sin(t * Math.PI * 2) * 0.2))
      })
      await animFrame(700, t => {
        userFigRef.current?.setAttribute('transform', `translate(${110 + t * 20},${460 - t * 4})`)
        userFigRef.current?.setAttribute('opacity', String(1 - t * 0.9))
      })
      userFigRef.current?.setAttribute('opacity', '0')
      await wait(250)

      // 5 — Route draws + car drives PICKUP → MID → DROPOFF simultaneously
      if (statusTextRef.current) statusTextRef.current.textContent = 'On the way · 0 CO₂ emissions'
      const routeDraw = animFrame(2400, t => {
        routePathRef.current?.setAttribute('stroke-dashoffset', String(100 - t * 100))
      })
      setCar(PICKUP.x, PICKUP.y, dirFromDx(MID.x - PICKUP.x))
      await animFrame(1200, t => {
        const p = ptLerp(PICKUP, MID, t); setCar(p.x, p.y)
        if (statusEtaRef.current) statusEtaRef.current.textContent = `ETA ${Math.max(1, Math.round(4 - t * 2))} MIN`
      })
      setCar(MID.x, MID.y, dirFromDx(DROPOFF.x - MID.x))
      await animFrame(1200, t => {
        const p = ptLerp(MID, DROPOFF, t); setCar(p.x, p.y)
        if (statusEtaRef.current) statusEtaRef.current.textContent = `ETA ${Math.max(1, Math.round(2 - t))} MIN`
      })
      await routeDraw

      // 6 — Arrival pulse
      if (statusTextRef.current) statusTextRef.current.textContent = 'Arrived · Thanks for riding Velocity'
      if (statusEtaRef.current)  statusEtaRef.current.textContent  = '0.00 KM'
      dropPinRef.current?.setAttribute('opacity', '1')
      await animFrame(900, t => {
        arrivalRef.current?.setAttribute('opacity',    String((1 - t) * 0.9))
        arrivalRef.current?.setAttribute('transform',  `translate(580,450) scale(${1 + t * 3})`)
      })
      headlightRef.current?.setAttribute('opacity', '0')
      await wait(1400)

      playing = false
      if (!cancelled) run()
    }

    const tid = setTimeout(() => run(), 700)
    return () => {
      cancelled = true
      if (raf) cancelAnimationFrame(raf)
      clearTimeout(tid)
    }
  }, [])

  const goWip     = () => navigate('/working-on')
  const handleLogout = () => logout().then(() => navigate('/login'))

  return (
    <div className={styles.frame}>

      {/* ── NAV ── */}
      <nav className={styles.topNav}>
        <div className={styles.brand}>
          <span className={styles.brandMark}>
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <g stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round">
                <line x1="2"  y1="4"  x2="2"  y2="18" />
                <line x1="6"  y1="2"  x2="6"  y2="20" />
                <line x1="10" y1="5"  x2="10" y2="17" />
                <line x1="14" y1="3"  x2="14" y2="19" />
                <line x1="18" y1="6"  x2="18" y2="16" />
              </g>
            </svg>
          </span>
          <span>Velocity</span>
        </div>

        <div className={styles.navLinks}>
          {['How it works', 'Fleet', 'Cities', 'For business', 'Pricing'].map(l => (
            <button key={l} onClick={goWip}>{l}</button>
          ))}
        </div>

        <div className={styles.navActions}>
          <button className={styles.ctaGhost} onClick={() => navigate('/choose-location')}>
            <span className={styles.kbd}>B</span> Book a ride
          </button>
          <button className={styles.walletBtn} onClick={() => navigate('/wallet')} aria-label="Wallet">₹</button>
          <button className={styles.avatarBtn} onClick={handleLogout} aria-label="Sign out">
            {user?.full_name?.[0]?.toUpperCase() || 'U'}
          </button>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className={styles.hero}>

        {/* Left: copy */}
        <div className={styles.copy}>
          <div className={styles.pillBadge}>
            <svg width="13" height="13" viewBox="0 0 14 14" fill="currentColor">
              <path d="M7 0l1.8 4.6L13.5 5l-3.6 3 1.1 4.8L7 10.3l-4 2.5L4.1 8 .5 5l4.7-.4z" />
            </svg>
            Trusted in 42 cities · 100% electric fleet
          </div>

          <h1>
            One Tap. Every Mile.<br />
            Every Trip.{' '}
            <span className={styles.accentWord}>Electric.</span>
          </h1>

          <p className={styles.lede}>
            A ride-hailing network built on EVs from the first mile. Autonomous dispatch,
            SLO-backed pickup times, and the lowest cost per kilometer in class.
          </p>

          <div className={styles.ctaRow}>
            <button className={styles.ctaPill} onClick={() => navigate('/choose-location')}>
              <span className={styles.kbdLight}>B</span> Book a ride
            </button>
            <button className={styles.linkBtn} onClick={goWip}>
              See how dispatch works →
            </button>
          </div>

          <div className={styles.trust}>
            <span className={styles.chip}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2">
                <path d="M6 1l4 2v3c0 3-2 4.5-4 5-2-.5-4-2-4-5V3z" />
              </svg>
            </span>
            SOC 2 · ISO 27001 · Carbon-neutral since 2024
          </div>
        </div>

        {/* Right: animated isometric scene */}
        <div className={styles.sceneWrap}>
          <svg
            className={styles.scene}
            viewBox="0 0 720 720"
            xmlns="http://www.w3.org/2000/svg"
            aria-label="EV booking animation"
          >
            <defs>
              <pattern id="isoGrid" patternUnits="userSpaceOnUse" width="60" height="34.64">
                <path d="M0 17.32 L30 0 L60 17.32 L30 34.64 Z"
                  fill="none" stroke="var(--stroke)" strokeWidth="0.5" opacity="0.5" />
              </pattern>
              <filter id="dropShadow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="6" />
              </filter>
            </defs>

            {/* Ground grid */}
            <rect x="0" y="0" width="720" height="720" fill="url(#isoGrid)" opacity="0.9" />
            <ellipse cx="360" cy="560" rx="250" ry="50" fill="#000" opacity="0.04" />

            {/* Isometric road */}
            <g stroke="var(--stroke-2)" strokeWidth="1.4" fill="#F3EEE7">
              <path d="M 120 440 L 360 320 L 600 440 L 570 456 L 360 350 L 150 456 Z" />
              <path d="M 120 440 L 180 470 L 168 478 L 108 448 Z" fill="#EDE7DE" />
              <path d="M 600 440 L 660 410 L 648 402 L 588 432 Z" fill="#EDE7DE" />
              <path d="M 140 450 L 360 340 L 580 450"
                fill="none" stroke="var(--stroke-2)" strokeWidth="1"
                strokeDasharray="4 6" opacity="0.9" />
            </g>

            {/* Accent route (draws in during animation) */}
            <path
              ref={routePathRef}
              d="M 140 450 L 360 340 L 580 450"
              fill="none" stroke="var(--accent)" strokeWidth="2.2"
              strokeLinecap="round" pathLength="100"
              strokeDasharray="100" strokeDashoffset="100"
            />

            {/* Left buildings (pickup side) */}
            <g stroke="var(--stroke-2)" strokeWidth="1.2" fill="#FFFFFF" strokeLinejoin="round">
              <g transform="translate(60,340)">
                <path d="M0 40 L40 16 L80 40 L40 64 Z" />
                <path d="M0 40 L0 110 L40 134 L40 64 Z" fill="#F6F1EA" />
                <path d="M80 40 L80 110 L40 134 L40 64 Z" fill="#EDE7DE" />
                <g fill="none" strokeWidth="0.8" opacity="0.9">
                  <path d="M8 60 L8 98 M20 54 L20 92 M32 48 L32 86" />
                  <path d="M48 92 L72 78 M48 102 L72 88 M48 112 L72 98" />
                </g>
              </g>
              <g transform="translate(140,380)">
                <path d="M0 30 L30 12 L60 30 L30 48 Z" />
                <path d="M0 30 L0 70 L30 88 L30 48 Z" fill="#F6F1EA" />
                <path d="M60 30 L60 70 L30 88 L30 48 Z" fill="#EDE7DE" />
                <g fill="none" strokeWidth="0.8">
                  <path d="M6 42 L6 66 M16 37 L16 61" />
                  <path d="M36 60 L54 52 M36 68 L54 60" />
                </g>
              </g>
            </g>

            {/* Right buildings (destination, accent-tinted) */}
            <g stroke="var(--accent)" strokeWidth="1.3" fill="#FFFFFF" strokeLinejoin="round">
              <g transform="translate(560,300)">
                <path d="M0 50 L40 28 L80 50 L40 72 Z" />
                <path d="M0 50 L0 150 L40 172 L40 72 Z" fill="var(--accent-soft)" />
                <path d="M80 50 L80 150 L40 172 L40 72 Z" fill="var(--accent-soft)" />
                <g fill="none" strokeWidth="0.9" opacity="0.85">
                  <path d="M10 72 L10 142 M22 66 L22 136 M34 60 L34 130" />
                  <path d="M48 128 L72 116 M48 138 L72 126 M48 148 L72 136" />
                </g>
                <line x1="40" y1="28" x2="40" y2="8" strokeWidth="1.2" />
                <circle cx="40" cy="6" r="2" fill="var(--accent)" />
              </g>
            </g>

            {/* Trees */}
            <g stroke="var(--stroke-2)" strokeWidth="1" fill="#FFFFFF">
              <g transform="translate(250,470)">
                <path d="M0 12 L14 4 L28 12 L14 20 Z" />
                <path d="M14 4 L14 -4" strokeWidth="0.8" />
              </g>
              <g transform="translate(480,470)">
                <path d="M0 12 L14 4 L28 12 L14 20 Z" />
                <path d="M14 4 L14 -4" strokeWidth="0.8" />
              </g>
            </g>

            {/* Pickup pin (animated drop) */}
            <g transform="translate(140,450)">
              <ellipse ref={pickupRingRef} cx="0" cy="4" rx="18" ry="6" fill="var(--accent)" opacity="0" />
              <g ref={pickupPinRef} transform="translate(0,-44)">
                <path d="M0 0 C-14 0 -14 -18 0 -30 C14 -18 14 0 0 0 Z"
                  fill="#fff" stroke="var(--accent)" strokeWidth="1.6" />
                <circle cx="0" cy="-18" r="4" fill="var(--accent)" />
              </g>
              <line x1="0" y1="0" x2="0" y2="-6"
                stroke="var(--accent)" strokeWidth="1.2" strokeDasharray="2 2" />
            </g>

            {/* Destination pin */}
            <g ref={dropPinRef} transform="translate(580,450)" opacity="0.55">
              <g transform="translate(0,-44)">
                <path d="M0 0 C-14 0 -14 -18 0 -30 C14 -18 14 0 0 0 Z"
                  fill="#fff" stroke="var(--ink)" strokeWidth="1.4" />
                <rect x="-3" y="-24" width="6" height="6" fill="var(--ink)" />
              </g>
            </g>

            {/* User figure */}
            <g ref={userFigRef} transform="translate(110,460)">
              <circle cx="0" cy="-34" r="5" fill="#fff" stroke="var(--ink)" strokeWidth="1.2" />
              <path d="M-6 -28 L6 -28 L4 -10 L-4 -10 Z"
                fill="#fff" stroke="var(--ink)" strokeWidth="1.2" />
              <path d="M-4 -10 L-5 2 M4 -10 L5 2"
                stroke="var(--ink)" strokeWidth="1.2" fill="none" />
              <rect ref={userPhoneRef} x="6" y="-24" width="5" height="8" rx="1"
                fill="var(--accent)" stroke="var(--accent)" strokeWidth="0.6" />
            </g>

            {/* Car (car.png from /public) */}
            <g ref={carRef} transform={`translate(${GARAGE.x},${GARAGE.y})`}>
              <g ref={carBodyRef}>
                <ellipse cx="2" cy="22" rx="64" ry="10"
                  fill="#000" opacity="0.18" filter="url(#dropShadow)" />
                <image
                  href="/car.png"
                  x="-75" y="-52"
                  width="150" height="71"
                  preserveAspectRatio="xMidYMid meet"
                  style={{ mixBlendMode: 'multiply' }}
                />
                <ellipse ref={headlightRef} cx="-58" cy="32" rx="36" ry="6"
                  fill="var(--accent)" opacity="0" />
              </g>
            </g>

            {/* Floating label (moves with car) */}
            <g ref={labelCarRef} opacity="0"
              fontFamily="Geist Mono, monospace" fontSize="10" fill="var(--ink-2)">
              <rect x="0" y="0" width="68" height="18" fill="var(--bg)" stroke="var(--accent)" />
              <text x="6" y="13" fill="var(--accent)" letterSpacing="1">EV · 98%</text>
            </g>

            {/* Static scene labels */}
            <g fontFamily="Geist Mono, monospace" fontSize="10" fill="var(--ink-2)">
              <g transform="translate(60,520)">
                <rect x="-4" y="-12" width="92" height="18" fill="var(--bg)" stroke="var(--stroke)" />
                <text x="2" y="1" letterSpacing="1">PICKUP · NOW</text>
              </g>
              <g transform="translate(528,378)">
                <rect x="-4" y="-12" width="120" height="18" fill="var(--bg)" stroke="var(--accent)" />
                <text x="2" y="1" fill="var(--accent)" letterSpacing="1">DESTINATION · 4.2 KM</text>
              </g>
            </g>

            {/* Tap ring (booking moment) */}
            <g ref={tapRingRef} transform="translate(140,450)" opacity="0">
              <circle r="6"  fill="none" stroke="var(--accent)" strokeWidth="1.5" />
              <circle r="16" fill="none" stroke="var(--accent)" strokeWidth="1"   opacity="0.6" />
              <circle r="26" fill="none" stroke="var(--accent)" strokeWidth="0.8" opacity="0.35" />
            </g>

            {/* Arrival pulse */}
            <g ref={arrivalRef} transform="translate(580,450)" opacity="0">
              <circle r="10" fill="none" stroke="var(--accent)" strokeWidth="2" />
            </g>

            {/* Cloud / signal decoration */}
            <g transform="translate(80,120)" stroke="var(--stroke-2)" strokeWidth="1.2" fill="#FFFFFF">
              <path d="M0 20 C-6 20 -6 10 2 10 C0 2 12 2 14 8 C22 4 28 14 22 20 Z" />
              <line x1="10" y1="20" x2="30" y2="220"
                stroke="var(--stroke)" strokeWidth="1" strokeDasharray="3 4" />
            </g>
          </svg>

          {/* Status card */}
          <div className={styles.statusCard}>
            <span className={styles.statusDot} />
            <span ref={statusTextRef}>Tap to book your ride</span>
            <span className={styles.statusEta} ref={statusEtaRef}>— —</span>
          </div>
        </div>
      </section>

      {/* ── METRICS STRIP ── */}
      <div className={styles.metrics}>
        {[
          { k: 'Median pickup', v: '3.2', u: 'm',  d: 'Across 42 cities, all hours'  },
          { k: 'Fleet',         v: '100', u: '%',  d: 'Battery-electric vehicles'    },
          { k: 'CO₂ / km',     v: '0',   u: 'g',  d: 'Verified by Climate Neutral'  },
          { k: 'Rider rating',  v: '4.93',u: '★', d: 'Rolling 90-day average'        },
        ].map(({ k, v, u, d }) => (
          <div key={k} className={styles.metric}>
            <div className={styles.metricK}>{k}</div>
            <div className={styles.metricV}>{v}<span className={styles.metricU}>{u}</span></div>
            <div className={styles.metricD}>{d}</div>
          </div>
        ))}
      </div>

    </div>
  )
}
