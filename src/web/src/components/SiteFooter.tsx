export function SiteFooter() {
  return (
    <footer className="site-footer" id="sources">
      <div className="footer-left">
        <span>Data</span>
        <a href="https://trek.nasa.gov/mars/" target="_blank" rel="noreferrer">
          NASA Mars Trek ↗
        </a>
        <span>·</span>
        <a href="https://pds.nasa.gov/" target="_blank" rel="noreferrer">
          NASA PDS ↗
        </a>
        <span>·</span>
        <span>HiRISE / CRISM</span>
        <span className="footer-sep">|</span>
        <span>Rendering and sampling stay local</span>
      </div>
      <div className="footer-right">
        <span>Apache-2.0</span>
        <span>·</span>
        <span>Not mission-grade</span>
      </div>
    </footer>
  )
}
