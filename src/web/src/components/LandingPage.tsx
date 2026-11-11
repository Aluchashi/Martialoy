import { REGION } from '../data/region'

export function LandingPage() {
  return (
    <div className="landing-page">
      <section className="landing-hero">
        <header className="landing-header">
          <a className="landing-brand" href="#home" aria-label="Martialoy home">
            <span className="landing-mark" aria-hidden="true">M</span>
            <span><strong>Martialoy</strong><small>Mars traverse planner</small></span>
          </a>
          <div className="landing-region"><span className="dot" />{REGION.label}<small>{REGION.center[1].toFixed(2)}°N · {REGION.center[0].toFixed(2)}°E</small></div>
          <nav className="landing-nav" aria-label="Main navigation">
            <a className="nav-current" href="#home">Home</a>
            <a href="#workflow">How it works</a>
            <a className="nav-cta" href="#route">Start planning <span aria-hidden="true">→</span></a>
          </nav>
        </header>
        <div className="hero-body">
          <div className="hero-copy">
            <div className="trust-pill"><span className="trust-spark">✦</span> MARS MISSION PLANNER</div>
            <p className="hero-kicker">JEZERO CRATER <span> / </span> 18.44° N, 77.58° E</p>
            <h1>Every traverse<br />starts with <span>a line.</span></h1>
            <p className="hero-description">Draw a path across Martian terrain. Compare rover and suited explorer limits, then review distance, energy and survival checks.</p>
            <div className="hero-actions">
              <a className="hero-button hero-button-primary" href="#route">Plan a traverse <span>→</span></a>
              <a className="hero-button hero-button-secondary" href="#workflow">See how it works</a>
            </div>
            <div className="hero-facts"><span><b>01</b> Choose a route</span><i /><span><b>02</b> Check the terrain</span><i /><span><b>03</b> Review the mission</span></div>
          </div>
          <div className="hero-visual" aria-hidden="true">
            <div className="hero-orbit orbit-one" /><div className="hero-orbit orbit-two" />
            <div className="hero-planet"><div className="planet-ridge ridge-one" /><div className="planet-ridge ridge-two" /><span className="planet-crater crater-one" /><span className="planet-crater crater-two" /><span className="planet-crater crater-three" /></div>
            <div className="planet-label"><span className="dot" /><span>JEZERO CRATER<small>18.44° N · 77.58° E</small></span></div>
          </div>
        </div>
        <div className="hero-bottom"><span>INTERPLANETARY SURVIVAL GUIDE</span><span>EXPLORE THE MISSION <b>↓</b></span></div>
      </section>

      <section id="workflow" className="workflow-section">
        <div className="workflow-heading">
          <div><p className="eyebrow">A SIMPLE THREE-STEP MISSION</p><h2>From route to readiness.</h2></div>
          <p>One route, three clear steps. Plan a traverse and see what the journey may demand.</p>
        </div>
        <div className="workflow-grid">
          <a className="workflow-card" href="#route"><span className="workflow-number">01</span><span className="workflow-icon">⌁</span><h3>Select a route</h3><p>Choose a human or rover profile and draw a path through Jezero Crater.</p><span className="workflow-link">Choose route <b>↗</b></span></a>
          <a className="workflow-card" href="#calculation"><span className="workflow-number">02</span><span className="workflow-icon">∑</span><h3>Review calculations</h3><p>See distance, slope, travel time and separate energy estimates.</p><span className="workflow-link">View calculations <b>↗</b></span></a>
          <a className="workflow-card" href="#survival"><span className="workflow-number">03</span><span className="workflow-icon">◇</span><h3>Check the journey</h3><p>Review route checks, failing segments and available contingency guidance.</p><span className="workflow-link">Open survival card <b>↗</b></span></a>
        </div>
      </section>
      <footer className="landing-footer"><a href="#home">MARTIALOY</a><span>Interplanetary Survival Guide · Jezero Crater, Mars</span><a href="#route">Begin a traverse →</a></footer>
    </div>
  )
}
