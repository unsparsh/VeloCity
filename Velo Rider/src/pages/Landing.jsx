import { useEffect, useRef, useState } from 'react'
import styles from './Landing.module.css'

const Landing = () => {
  const [playing, setPlaying] = useState(false)
  const [statusText, setStatusText] = useState('Tap to book your ride')
  const [statusEta, setStatusEta] = useState('— —')
  const rafRef = useRef(null)

  const PICKUP = { x: 140, y: 450 }
  const DROPOFF = { x: 580, y: 450 }
  const MID = { x: 360, y: 340 }
  const GARAGE = { x: 640, y: 260 }

  const lerp = (a, b, t) => a + (b - a) * t
  const pt = (p1, p2, t) => ({ x: lerp(p1.x, p2.x, t), y: lerp(p1.y, p2.y, t) })
  const easeInOut = (t) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2

  const animate = (duration, onUpdate) =>
    new Promise((resolve) => {
      const start = performance.now()
      const tick = (now) => {
        const t = Math.min(1, (now - start) / duration)
        onUpdate(easeInOut(t), t)
        if (t < 1) {
          rafRef.current = requestAnimationFrame(tick)
        } else {
          resolve()
        }
      }
      rafRef.current = requestAnimationFrame(tick)
    })

  const wait = (ms) => new Promise((r) => setTimeout(r, ms))

  const resetScene = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    setStatusText('Tap to book your ride')
    setStatusEta('— —')
  }

  const bookRide = async () => {
    if (playing) return
    setPlaying(true)
    resetScene()

    // 1. TAP animation
    setStatusText('Confirming pickup…')
    setStatusEta('LOC · 37.7749')
    await animate(700, () => {})

    // 2. PIN DROP
    setStatusText('Finding your driver…')
    await animate(500, () => {})
    await animate(260, () => {})
    await wait(300)

    // 3. CAR ARRIVES
    setStatusText('EV-2240 en route · 98% battery')
    setStatusEta('ETA 3 MIN')
    await animate(1400, () => {})
    await animate(1400, () => {})

    // 4. PICKUP
    setStatusText('Driver arrived · Welcome aboard')
    setStatusEta('BOARDING')
    await animate(600, () => {})
    await animate(700, () => {})
    await wait(250)

    // 5. ROUTE DRAW & DRIVE
    setStatusText('On the way · 0 CO₂ emissions')
    await animate(2400, () => {})
    await animate(1200, (t) => {
      const eta = Math.max(1, Math.round(4 - t * 2))
      setStatusEta(`ETA ${eta} MIN`)
    })
    await animate(1200, (t) => {
      const eta = Math.max(1, Math.round(2 - t))
      setStatusEta(`ETA ${eta} MIN`)
    })

    // 6. ARRIVAL
    setStatusText('Arrived · Thanks for riding Velocity')
    setStatusEta('0.00 KM')
    await animate(900, () => {})
    await wait(1400)

    setPlaying(false)
    // Auto-loop
    setTimeout(() => bookRide(), 500)
  }

  useEffect(() => {
    const timer = setTimeout(() => bookRide(), 600)
    return () => {
      clearTimeout(timer)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  return (
    <div className={styles.landingContainer}>
      <div className={styles.frame}>
        {/* Navigation */}
        <nav className={styles.topNav}>
          <div className={styles.brand}>
            <svg className={styles.brandMark} viewBox="0 0 22 22" xmlns="http://www.w3.org/2000/svg">
              <g stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round">
                <line x1="2" y1="4" x2="2" y2="18" />
                <line x1="6" y1="2" x2="6" y2="20" />
                <line x1="10" y1="5" x2="10" y2="17" />
                <line x1="14" y1="3" x2="14" y2="19" />
                <line x1="18" y1="6" x2="18" y2="16" />
              </g>
            </svg>
            <span>Velocity</span>
          </div>

          <div className={styles.navLinks}>
            <a href="#">How it works ▾</a>
            <a href="#">Fleet ▾</a>
            <a href="#">Cities ▾</a>
            <a href="#">For business ▾</a>
            <a href="#">Pricing</a>
          </div>

          <button className={`${styles.ctaPill} ${styles.ghost}`} onClick={() => bookRide()}>
            <span className={styles.kbd}>B</span> Book a ride
          </button>
        </nav>

        {/* Hero Section */}
        <section className={styles.hero}>
          <div className={styles.copy}>
            <div className={styles.pillBadge}>
              <svg className={styles.star} viewBox="0 0 14 14" fill="currentColor">
                <path d="M7 0l1.8 4.6L13.5 5l-3.6 3 1.1 4.8L7 10.3l-4 2.5L4.1 8 .5 5l4.7-.4z" />
              </svg>
              Trusted in 42 cities · 100% electric fleet
            </div>

            <h1>
              One Tap. Every Mile.<br />
              Every Trip. <span className={styles.accent}>Electric.</span>
            </h1>

            <p className={styles.lede}>
              A ride-hailing network built on EVs from the first mile. Autonomous dispatch, SLO-backed pickup times, and the lowest cost per kilometer in class.
            </p>

            <div className={styles.ctaRow}>
              <button className={styles.ctaPill} onClick={() => bookRide()}>
                <span className={styles.kbd}>B</span> Book a ride
              </button>
              <a href="#" className={styles.secondaryLink}>See how dispatch works →</a>
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

          {/* Scene */}
          <div className={styles.sceneWrap}>
            <svg className={styles.scene} viewBox="0 0 720 720" xmlns="http://www.w3.org/2000/svg" aria-label="Booking a ride animation">
              <defs>
                <pattern id="isoGrid" patternUnits="userSpaceOnUse" width="60" height="34.64" patternTransform="translate(0,0)">
                  <path d="M0 17.32 L30 0 L60 17.32 L30 34.64 Z" fill="none" stroke="var(--stroke)" strokeWidth="0.5" opacity="0.5" />
                </pattern>
              </defs>

              {/* Ground grid */}
              <g id="gridG">
                <rect x="0" y="0" width="720" height="720" fill="url(#isoGrid)" />
              </g>

              {/* Shadow */}
              <ellipse cx="360" cy="560" rx="250" ry="50" fill="#000" opacity="0.04" />

              {/* Road */}
              <g id="road" stroke="var(--stroke-2)" strokeWidth="1.4" fill="#F3EEE7">
                <path d="M 120 440 L 360 320 L 600 440 L 570 456 L 360 350 L 150 456 Z" />
                <path d="M 120 440 L 180 470 L 168 478 L 108 448 Z" fill="#EDE7DE" />
                <path d="M 600 440 L 660 410 L 648 402 L 588 432 Z" fill="#EDE7DE" />
                <path id="roadCenter" d="M 140 450 L 360 340 L 580 450" fill="none" stroke="var(--stroke-2)" strokeWidth="1" strokeDasharray="4 6" opacity="0.9" />
              </g>

              {/* Route path */}
              <path id="routePath" d="M 140 450 L 360 340 L 580 450" fill="none" stroke="var(--accent)" strokeWidth="2.2" strokeLinecap="round" pathLength="100" strokeDasharray="100" strokeDashoffset="100" />

              {/* Buildings left */}
              <g id="bldgLeft" stroke="var(--stroke-2)" strokeWidth="1.2" fill="#FFFFFF" strokeLinejoin="round">
                <g transform="translate(60,340)">
                  <path d="M0 40 L40 16 L80 40 L40 64 Z" fill="#FFFFFF" />
                  <path d="M0 40 L0 110 L40 134 L40 64 Z" fill="#F6F1EA" />
                  <path d="M80 40 L80 110 L40 134 L40 64 Z" fill="#EDE7DE" />
                  <g stroke="var(--stroke-2)" strokeWidth="0.8" fill="none" opacity="0.9">
                    <path d="M8 60 L8 98 M20 54 L20 92 M32 48 L32 86" />
                    <path d="M48 92 L72 78 M48 102 L72 88 M48 112 L72 98" />
                  </g>
                </g>
                <g transform="translate(140,380)">
                  <path d="M0 30 L30 12 L60 30 L30 48 Z" fill="#FFFFFF" />
                  <path d="M0 30 L0 70 L30 88 L30 48 Z" fill="#F6F1EA" />
                  <path d="M60 30 L60 70 L30 88 L30 48 Z" fill="#EDE7DE" />
                  <g stroke="var(--stroke-2)" strokeWidth="0.8" fill="none">
                    <path d="M6 42 L6 66 M16 37 L16 61" />
                    <path d="M36 60 L54 52 M36 68 L54 60" />
                  </g>
                </g>
              </g>

              {/* Buildings right - highlighted */}
              <g id="bldgRight" stroke="var(--accent)" strokeWidth="1.3" fill="#FFFFFF" strokeLinejoin="round">
                <g transform="translate(560,300)">
                  <path d="M0 50 L40 28 L80 50 L40 72 Z" fill="#FFFFFF" />
                  <path d="M0 50 L0 150 L40 172 L40 72 Z" fill="#FFF2F0" />
                  <path d="M80 50 L80 150 L40 172 L40 72 Z" fill="#FFE7E3" />
                  <g stroke="var(--accent)" strokeWidth="0.9" fill="none" opacity="0.9">
                    <path d="M10 72 L10 142 M22 66 L22 136 M34 60 L34 130" />
                    <path d="M48 128 L72 116 M48 138 L72 126 M48 148 L72 136" />
                  </g>
                  <line x1="40" y1="28" x2="40" y2="8" stroke="var(--accent)" strokeWidth="1.2" />
                  <circle cx="40" cy="6" r="2" fill="var(--accent)" />
                </g>
              </g>

              {/* Pickup pin */}
              <g id="pickupPin" transform="translate(140,450)">
                <ellipse id="pickupRing" cx="0" cy="4" rx="18" ry="6" fill="var(--accent)" opacity="0" />
                <g id="pickupPinInner" transform="translate(0,-44)">
                  <path d="M0 0 C-14 0 -14 -18 0 -30 C14 -18 14 0 0 0 Z" fill="#fff" stroke="var(--accent)" strokeWidth="1.6" />
                  <circle cx="0" cy="-18" r="4" fill="var(--accent)" />
                </g>
                <line x1="0" y1="0" x2="0" y2="-6" stroke="var(--accent)" strokeWidth="1.2" strokeDasharray="2 2" />
              </g>

              {/* Destination pin */}
              <g id="dropPin" transform="translate(580,450)" opacity="0.55">
                <g transform="translate(0,-44)">
                  <path d="M0 0 C-14 0 -14 -18 0 -30 C14 -18 14 0 0 0 Z" fill="#fff" stroke="var(--ink)" strokeWidth="1.4" />
                  <rect x="-3" y="-24" width="6" height="6" fill="var(--ink)" />
                </g>
              </g>

              {/* User figure */}
              <g id="user" transform="translate(110,460)">
                <circle cx="0" cy="-34" r="5" fill="#fff" stroke="var(--ink)" strokeWidth="1.2" />
                <path d="M-6 -28 L6 -28 L4 -10 L-4 -10 Z" fill="#fff" stroke="var(--ink)" strokeWidth="1.2" />
                <path d="M-4 -10 L-5 2 M4 -10 L5 2" stroke="var(--ink)" strokeWidth="1.2" fill="none" />
                <rect id="userPhone" x="6" y="-24" width="5" height="8" rx="1" fill="var(--accent)" stroke="var(--accent)" strokeWidth="0.6" />
              </g>

              {/* Car */}
              <g id="car" transform="translate(620,410)">
                <g id="carBody">
                  <ellipse cx="0" cy="14" rx="38" ry="6" fill="#000" opacity="0.08" />
                  <path d="M-30 -8 L6 -26 L34 -12 L-2 6 Z" fill="#FFFFFF" stroke="var(--accent)" strokeWidth="1.5" strokeLinejoin="round" />
                  <path d="M-30 -8 L-30 6 L-2 20 L-2 6 Z" fill="#FFF2F0" stroke="var(--accent)" strokeWidth="1.5" strokeLinejoin="round" />
                  <path d="M34 -12 L34 2 L-2 20 L-2 6 Z" fill="#FFE7E3" stroke="var(--accent)" strokeWidth="1.5" strokeLinejoin="round" />
                  <path d="M12 -18 L28 -11 L22 -8 L8 -14 Z" fill="#FFFFFF" stroke="var(--accent)" strokeWidth="1" />
                  <path d="M-20 -3 L-4 4 L12 -4 L-2 -11 Z" fill="#FFFFFF" stroke="var(--accent)" strokeWidth="1" />
                  <g fill="#1A1A1A" stroke="var(--accent)" strokeWidth="0.8">
                    <path d="M-22 4 l6 -3 l6 3 l-6 3 z" />
                    <path d="M10 16 l6 -3 l6 3 l-6 3 z" />
                    <path d="M18 -6 l5 -2 l5 2 l-5 2 z" opacity="0.9" />
                  </g>
                  <path id="carBolt" d="M2 -20 l-3 6 l3 0 l-2 6 l5 -8 l-3 0 l2 -4 z" fill="var(--accent)" />
                  <path id="headlight" d="M34 -10 l22 -6 l0 10 l-22 4 z" fill="var(--accent)" opacity="0" />
                </g>
              </g>

              {/* Arrival pulse */}
              <g id="arrivalPulse" transform="translate(580,450)" opacity="0">
                <circle r="10" fill="none" stroke="var(--accent)" strokeWidth="2" />
              </g>
            </svg>

            {/* Status Card */}
            <div className={styles.statusCard}>
              <span className={styles.statusDot}></span>
              <span className={styles.statusText}>{statusText}</span>
              <span className={styles.statusEta}>{statusEta}</span>
            </div>
          </div>
        </section>

        {/* Metrics */}
        <div className={styles.metrics}>
          <div className={styles.metric}>
            <div className={styles.k}>Median pickup</div>
            <div className={styles.v}>3.2<span className={styles.u}>m</span></div>
            <div className={styles.d}>Across 42 cities, all hours</div>
          </div>
          <div className={styles.metric}>
            <div className={styles.k}>Fleet</div>
            <div className={styles.v}>100<span className={styles.u}>%</span></div>
            <div className={styles.d}>Battery-electric vehicles</div>
          </div>
          <div className={styles.metric}>
            <div className={styles.k}>CO₂ / km</div>
            <div className={styles.v}>0<span className={styles.u}>g</span></div>
            <div className={styles.d}>Verified by Climate Neutral</div>
          </div>
          <div className={styles.metric}>
            <div className={styles.k}>Rider rating</div>
            <div className={styles.v}>4.93<span className={styles.u}>★</span></div>
            <div className={styles.d}>Rolling 90-day average</div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Landing
