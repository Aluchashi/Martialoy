interface Props {
  page: 'route' | 'calculation' | 'survival'
}

export function Header({ page }: Props) {
  return (
    <header className="topbar topbar-minimal">
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

      <nav className="main-nav" aria-label="Main navigation">
        <a href="#home">Home</a>
        <a className={page === 'route' ? 'active' : ''} href="#route">Route</a>
        <a className={page === 'calculation' ? 'active' : ''} href="#calculation">Calculation</a>
        <a className={page === 'survival' ? 'active' : ''} href="#survival">Survival Card</a>
      </nav>
    </header>
  )
}
