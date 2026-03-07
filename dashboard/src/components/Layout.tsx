import { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'

const NAV = [
    { to: '/traces', label: 'Traces', icon: '◈' },
    { to: '/analytics', label: 'Analytics', icon: '▦' },
    { to: '/incidents', label: 'Incidents', icon: '◉' },
    { to: '/replay', label: 'Replay', icon: '▷' },
    { to: '/status', label: 'Status', icon: '◎' },
    { to: '/settings', label: 'Settings', icon: '⎈' },
]

export default function Layout({ children }: { children: ReactNode }) {
    return (
        <div className="layout-container">
            {/* Sidebar */}
            <aside className="layout-sidebar">
                {/* Logo */}
                <div className="layout-logo-container">
                    <div className="layout-logo">
                        <div className="layout-logo-icon">T</div>
                        <div>
                            <div className="layout-logo-text">TemporalLayr</div>
                        </div>
                    </div>
                </div>

                {/* Nav */}
                <nav className="layout-nav">
                    {NAV.map(n => (
                        <NavLink
                            key={n.to}
                            to={n.to}
                            className={({ isActive }) => `layout-nav-item ${isActive ? 'active' : ''}`}
                        >
                            <span className="layout-nav-icon">{n.icon}</span>
                            {n.label}
                        </NavLink>
                    ))}
                </nav>
            </aside>

            {/* Main Area with Topbar */}
            <main className="layout-main">
                <header className="layout-topbar">
                    <div className="layout-env-selector">
                        <span className="text-text-muted">Env:</span> Default Project
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6" /></svg>
                    </div>

                    <div className="layout-topbar-actions">
                        <a href="https://github.com/CodeWizarz/Temporallayr-Powerhouse" target="_blank" rel="noreferrer" className="text-text-muted hover:text-text-primary transition-colors text-sm">
                            Docs
                        </a>
                        <button
                            className="bg-bg-surface border border-border px-3 py-1.5 rounded-sm text-xs font-semibold hover:border-text-muted transition-colors flex items-center gap-2"
                            onClick={() => {
                                localStorage.removeItem('tl_api_key')
                                window.location.href = '/login'
                            }}
                        >
                            Sign out
                        </button>
                    </div>
                </header>

                <div className="layout-content-scroll">
                    <div className="layout-content">
                        {children}
                    </div>
                </div>
            </main>
        </div>
    )
}