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
                            <div className="layout-logo-sub">AI Observability</div>
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

                {/* Footer */}
                <div className="layout-footer">
                    <span>v0.2.1 · MIT</span>
                    <button
                        className="layout-signout"
                        onClick={() => {
                            localStorage.removeItem('tl_api_key')
                            window.location.href = '/login'
                        }}
                    >
                        Sign out
                    </button>
                </div>
            </aside>

            {/* Main */}
            <main className="layout-main">
                <div className="layout-content">
                    {children}
                </div>
            </main>
        </div>
    )
}