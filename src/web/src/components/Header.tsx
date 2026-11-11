import { useEffect, useState } from 'react'
import { Icon } from './ui'
import martialoyLogo from './MARTIALOY.svg'

const NAV = [
  { page: 'home', label: 'Home', href: '#home' },
  { page: 'route', label: 'Route', href: '#route' },
  { page: 'calculation', label: 'Calculation', href: '#calculation' },
  { page: 'survival', label: 'Survival Card', href: '#survival' },
] as const

interface Props {
  page: (typeof NAV)[number]['page']
  wide?: boolean
}

export function Header({ page, wide = false }: Props) {
  const [open, setOpen] = useState(false)

  // Close the mobile menu whenever the page changes.
  useEffect(() => {
    setOpen(false)
  }, [page])

  // Escape closes the open menu.
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <header className="app-header">
      <div className={`app-header-inner ${wide ? 'ui-container-wide' : 'ui-container'}`.trim()}>
        <a className="hd-brand" href="#home">
          <img className="hd-logo" src={martialoyLogo} alt="Martialoy" />
        </a>

        <nav className="hd-nav" aria-label="Main">
          {NAV.map((item) => (
            <a
              key={item.page}
              href={item.href}
              aria-current={page === item.page ? 'page' : undefined}
              className={page === item.page ? 'is-active' : undefined}
            >
              {item.label}
            </a>
          ))}
        </nav>

        <button
          type="button"
          className="hd-toggle"
          aria-expanded={open}
          aria-label={open ? 'Close menu' : 'Open menu'}
          onClick={() => setOpen((value) => !value)}
        >
          <Icon name={open ? 'close' : 'menu'} size={20} />
        </button>
      </div>

      {open && (
        <nav className="hd-menu" aria-label="Main">
          {NAV.map((item) => (
            <a
              key={item.page}
              href={item.href}
              aria-current={page === item.page ? 'page' : undefined}
              className={page === item.page ? 'is-active' : undefined}
              onClick={() => setOpen(false)}
            >
              {item.label}
            </a>
          ))}
        </nav>
      )}
    </header>
  )
}
