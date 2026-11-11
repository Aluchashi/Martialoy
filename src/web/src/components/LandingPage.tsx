import { motion, useReducedMotion } from 'motion/react'
import { HeroGallery } from './HeroGallery'

export function LandingPage() {
  const reduceMotion = useReducedMotion()
  const hiddenOnScroll = reduceMotion ? false : { opacity: 0, y: 24 }
  const shownOnScroll = reduceMotion ? undefined : { opacity: 1, y: 0 }

  return (
    <div className="landing-page">
      <section className="landing-hero">
        <div className="hero-body">
          <div className="hero-copy">
            <h1 className="hero-chrome">Every traverse<br />starts with a <span>line.</span></h1>
            <p className="hero-description">Draw a path across Martian terrain. Compare rover and suited explorer limits, then review distance, energy and survival checks.</p>
            <div className="hero-actions">
              <a className="hero-button hero-button-primary" href="#route">Plan a traverse <span>→</span></a>
              <a className="hero-button hero-button-secondary" href="#workflow">See how it works</a>
            </div>
            <p className="hero-data">Data: NASA Mars Trek, HiRISE, NASA PDS</p>
          </div>
          <div className="hero-visual">
            <HeroGallery />
          </div>
        </div>
      </section>

      <section id="workflow" className="workflow-section">
        <motion.div
          className="workflow-heading workflow-heading-centered"
          initial={hiddenOnScroll}
          whileInView={shownOnScroll}
          viewport={{ once: true, amount: 0.35 }}
          transition={{ duration: 0.55, ease: 'easeOut' }}
        >
          <p className="eyebrow">A SIMPLE THREE-STEP MISSION</p>
          <h2>MISSION&nbsp;CRITICAL</h2>
          <p className="workflow-sub">One route, three clear steps. Plan a traverse and see what the journey may demand.</p>
        </motion.div>
        <div className="workflow-grid">
          <motion.a
            className="workflow-card"
            href="#route"
            initial={hiddenOnScroll}
            whileInView={shownOnScroll}
            whileHover={reduceMotion ? undefined : { y: -3, transition: { duration: 0.18, delay: 0 } }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.5, delay: 0.05, ease: 'easeOut' }}
          ><span className="workflow-number">01</span><span className="workflow-icon">⌁</span><h3>Select a route</h3><p>Choose a human or rover profile and draw a path through Jezero Crater.</p><span className="workflow-link">Choose route <b>↗</b></span></motion.a>
          <motion.a
            className="workflow-card"
            href="#calculation"
            initial={hiddenOnScroll}
            whileInView={shownOnScroll}
            whileHover={reduceMotion ? undefined : { y: -3, transition: { duration: 0.18, delay: 0 } }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.5, delay: 0.16, ease: 'easeOut' }}
          ><span className="workflow-number">02</span><span className="workflow-icon">∑</span><h3>Review calculations</h3><p>See distance, slope, travel time and separate energy estimates.</p><span className="workflow-link">View calculations <b>↗</b></span></motion.a>
          <motion.a
            className="workflow-card"
            href="#survival"
            initial={hiddenOnScroll}
            whileInView={shownOnScroll}
            whileHover={reduceMotion ? undefined : { y: -3, transition: { duration: 0.18, delay: 0 } }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.5, delay: 0.27, ease: 'easeOut' }}
          ><span className="workflow-number">03</span><span className="workflow-icon">◇</span><h3>Check the journey</h3><p>Review route checks, failing segments and available contingency guidance.</p><span className="workflow-link">Open survival card <b>↗</b></span></motion.a>
        </div>
      </section>
    </div>
  )
}
