import { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'

const NAV = [
    { to: '/traces', label: 'Traces', icon: '◈' },
    { to: '/analytics', label: 'Analytics', icon: '▦' },
    { to: '/incidents', label: 'Incidents', icon: '◉' },
    { to: '/replay', label: 'Replay', icon: '▷' },
    { to: '/settings', label: 'Settings', icon: '◎' },
]

export default function Layout({ children }: { children: ReactNode }) {
    return (
        <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
            {/* Sidebar */}
            <aside style={{
                width: 'var(--sidebar-width)', background: 'var(--bg-surface)',
                borderRight: '1px solid var(--border-subtle)',
                display: 'flex', flexDirection: 'column', flexShrink: 0,
            }}>
                {/* Logo */}
                <div style={{
                    padding: '0 20px', height: 'var(--header-height)',
                    display: 'flex', alignItems: 'center',
                    borderBottom: '1px solid var(--border-subtle)',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                            width: 28, height: 28, background: 'var(--accent)',
                            borderRadius: 6, display: 'flex', alignItems: 'center',
                            justifyContent: 'center', fontSize: 14, fontWeight: 800, color: '#000',
                        }}>T</div>
                        <div>
                            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>
                                TemporalLayr
                            </div>
                            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>AI Observability</div>
                        </div>
                    </div>
                </div>

                {/* Nav */}
                <nav style={{ padding: '12px 8px', flex: 1 }}>
                    {NAV.map(n => (
                        <NavLink key={n.to} to={n.to} style={({ isActive }) => ({
                            display: 'flex', alignItems: 'center', gap: 10,
                            padding: '8px 12px', borderRadius: 'var(--radius-sm)',
                            textDecoration: 'none', fontSize: 13, fontWeight: 500,
                            marginBottom: 2,
                            color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                            background: isActive ? 'var(--accent-dim)' : 'transparent',
                            transition: 'all 0.1s',
                        })}>
                            <span style={{ fontSize: 12, opacity: 0.8 }}>{n.icon}</span>
                            {n.label}
                        </NavLink>
                    ))}
                </nav>

                {/* Footer */}
                <div style={{
                    padding: '12px 20px', borderTop: '1px solid var(--border-subtle)',
                    fontSize: 11, color: 'var(--text-muted)',
                }}>
                    v0.2.1 · MIT License
                </div>
            </aside>

            {/* Main */}
            <main style={{ flex: 1, overflowY: 'auto', background: 'var(--bg-base)' }}>
                <div style={{ padding: '28px 32px', maxWidth: 1200, margin: '0 auto' }}>
                    {children}
                </div>
            </main>
        </div>
    )
}