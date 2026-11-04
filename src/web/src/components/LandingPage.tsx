import { REGION } from '../data/region'

export function LandingPage() {
  return (
    <div className="landing-page">
      <section className="landing-hero">
        <div className="landing-orbit orbit-one" aria-hidden="true" />
        <div className="landing-orbit orbit-two" aria-hidden="true" />
        <header className="landing-header">
          <nav className="landing-nav" aria-label="Main navigation">
            <a className="landing-mark" href="#home" aria-label="Martialoy home">M</a>
            <a className="nav-current" href="#home">Home</a>
            <a href="#route">Route</a>
            <a href="#calculation">Calculation</a>
            <a href="#survival">Survival Card</a>
            <a className="nav-cta" href="#route">Start planning</a>
          </nav>
        </header>
        <div className="hero-copy">
          <div className="trust-pill"><span className="trust-spark">✦</span> A Mars traverse planning concept</div>
          <p className="hero-kicker">JEZERO CRATER · MARS</p>
          <h1>Plan your journey<br />into <span>the red frontier.</span></h1>
          <p className="hero-description">Draw a route across Martian terrain. Explore the journey for a rover or a human, then review the calculations and survival checks.</p>
          <div className="hero-actions">
            <a className="hero-button hero-button-primary" href="#route">Start planning <span>→</span></a>
            <a className="hero-button hero-button-secondary" href="#workflow">Explore the workflow</a>
          </div>
          <div className="hero-scroll"><span /> SCROLL TO EXPLORE</div>
        </div>
        <div className="hero-coordinate">{REGION.center[1].toFixed(2)}° N <i /> {REGION.center[0].toFixed(2)}° E</div>
      </section>

      <section id="workflow" className="workflow-section">
        <div className="workflow-heading">
          <div><p className="eyebrow">A SIMPLE THREE-STEP MISSION</p><h2>From route to readiness.</h2></div>
          <p>Choose your explorer, plan a traverse and see what the journey may demand.</p>
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
