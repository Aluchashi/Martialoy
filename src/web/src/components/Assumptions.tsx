import type { Assumption, ProfileSpec } from '../types'

interface Props {
  profile: ProfileSpec
  assumptionOverride?: Assumption[]
}

export function Assumptions({ profile, assumptionOverride }: Props) {
  const rows = assumptionOverride ?? profile.assumptions

  return (
    <details className="card assumptions" open>
      <summary>
        <span className="eyebrow">Model &amp; assumptions</span>
        <span className="assumption-count">{rows.length} parameters</span>
      </summary>

      <p className="assumption-intro">{profile.description}</p>

      <ul className="assumption-list">
        {rows.map((row) => (
          <li key={row.key}>
            <div className="a-main">
              <span className="a-label">{row.label}</span>
              {row.source_url ? (
                <a className="a-source" href={row.source_url} target="_blank" rel="noreferrer">
                  {row.source} <span aria-hidden="true">↗</span>
                </a>
              ) : (
                <span className="a-source">{row.source}</span>
              )}
            </div>
            <span className="a-value">
              {row.value}
              {row.unit && <span className="a-unit">{row.unit}</span>}
            </span>
          </li>
        ))}
      </ul>

      <div className="formula">
        <span className="eyebrow">Energy model</span>
        <code>{profile.formula}</code>
      </div>

    </details>
  )
}
