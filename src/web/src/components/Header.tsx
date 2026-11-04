import { PROFILES, PROFILE_IDS } from '../data/profiles'
import { REGION } from '../data/region'
import type { ProfileId } from '../types'

interface Props {
  profile: ProfileId
  onProfileChange: (profile: ProfileId) => void
  engine: 'api' | 'demo'
  page: 'route' | 'calculation' | 'survival'
}

export function Header({ profile, onProfileChange, engine, page }: Props) {
  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true">
          <svg viewBox="0 0 32 32" width="30" height="30">
            <circle cx="16" cy="16" r="8.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
            <path
              d="M16 2.5v5.5M16 24v5.5M2.5 16H8M24 16h5.5"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
            <circle cx="16" cy="16" r="2.3" fill="currentColor" />
          </svg>
        </span>
        <div className="brand-copy">
          <h1>Martialoy</h1>
          <p>Mars traverse &amp; survival planner</p>
        </div>
      </div>

      <div className="topbar-region">
        <span className="region-pill">
          <span className="dot" />
          {REGION.label}
        </span>
        <span className="region-coord">
          {REGION.center[1].toFixed(2)}°N · {REGION.center[0].toFixed(2)}°E
        </span>
      </div>

      <nav className="main-nav" aria-label="Main navigation">
        <a href="#home">Home</a>
        <a className={page === 'route' ? 'active' : ''} href="#route">1. Route</a>
        <a className={page === 'calculation' ? 'active' : ''} href="#calculation">2. Calculation</a>
        <a className={page === 'survival' ? 'active' : ''} href="#survival">3. Survival</a>
      </nav>

      <div className="topbar-actions">
        <div className="profile-toggle" role="group" aria-label="Explorer profile">
          {PROFILE_IDS.map((id) => {
            const active = id === profile
            return (
              <button
                key={id}
                type="button"
                className={`profile-btn ${active ? 'active' : ''}`}
                aria-pressed={active}
                onClick={() => onProfileChange(id)}
                title={PROFILES[id].tagline}
              >
                <span className="profile-glyph" aria-hidden="true">
                  {id === 'rover' ? (
                    <svg viewBox="0 0 20 20" width="14" height="14">
                      <rect x="4" y="6" width="12" height="7" rx="1.6" fill="none" stroke="currentColor" strokeWidth="1.4" />
                      <circle cx="6.5" cy="15" r="1.8" fill="none" stroke="currentColor" strokeWidth="1.4" />
                      <circle cx="13.5" cy="15" r="1.8" fill="none" stroke="currentColor" strokeWidth="1.4" />
                      <path d="M9 6V3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 20 20" width="14" height="14">
                      <circle cx="10" cy="5" r="2.6" fill="none" stroke="currentColor" strokeWidth="1.4" />
                      <path
                        d="M5 17v-3.6c0-1.7 2.2-3 5-3s5 1.3 5 3V17"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.4"
                        strokeLinecap="round"
                      />
                    </svg>
                  )}
                </span>
                {PROFILES[id].label}
              </button>
            )
          })}
        </div>

        <span
          className={`engine-chip ${engine}`}
          title={
            engine === 'api'
              ? 'Sampling the local COG through the Python engine'
              : 'Synthetic terrain — the cached DEM is not wired yet'
          }
        >
          {engine === 'api' ? 'Local DEM' : 'Demo terrain'}
        </span>
      </div>
    </header>
  )
}
