interface Props {
  wide?: boolean
}

export function SiteFooter({ wide = false }: Props) {
  return (
    <footer className="app-footer">
      <div className={`app-footer-inner ${wide ? 'ui-container-wide' : 'ui-container'}`.trim()}>
        <div className="ft-top">
          <div className="ft-brand">
            <span className="ft-wordmark">MARTIALOY</span>
            <span className="ft-desc">Mars traverse and survival planner</span>
          </div>
          <a className="ft-cta" href="#route">
            Begin a traverse <span aria-hidden="true">→</span>
          </a>
        </div>
        <div className="ft-meta">
          <p className="ft-sources">
            Data sources:{' '}
            <a href="https://trek.nasa.gov/mars/" target="_blank" rel="noreferrer">
              NASA Mars Trek <span aria-hidden="true">↗</span>
            </a>{' '}
            ·{' '}
            <a href="https://pds.nasa.gov/" target="_blank" rel="noreferrer">
              NASA PDS <span aria-hidden="true">↗</span>
            </a>{' '}
            · HiRISE / CRISM
          </p>
        </div>
      </div>
    </footer>
  )
}
