import { ReactNode } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'

const NAV = [
    { to: '/traces', label: 'Traces', icon: <svg className="ch-global-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg> },
    { to: '/analytics', label: 'Dashboards', icon: <svg className="ch-global-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg> },
    { to: '/replay', label: 'Replay Tests', icon: <svg className="ch-global-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
    { to: '/status', label: 'Monitoring', icon: <svg className="ch-global-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
    { to: '/settings', label: 'Settings', icon: <svg className="ch-global-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg> }
]

export default function Layout({ children }: { children: ReactNode }) {
    const navigate = useNavigate()

    return (
        <div className="ch-layout">
            <aside className="ch-sidebar-global">
                <div className="ch-global-logo">
                    <div className="w-5 h-5 bg-accent rounded flex items-center justify-center text-black font-bold text-xs" style={{ background: 'var(--accent)' }}>T</div>
                    <div className="ch-global-title">TemporalLayr</div>
                </div>

                <div className="ch-org-selector hover:bg-white/5 transition-colors">
                    <div className="w-5 h-5 bg-[#4285F4] rounded flex items-center justify-center text-[10px] font-bold text-white">
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" /></svg>
                    </div>
                    <div className="flex-1 truncate font-medium">My first service...</div>
                    <svg className="w-3.5 h-3.5 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" /></svg>
                </div>

                <nav className="ch-global-nav">
                    {NAV.map(n => (
                        <NavLink key={n.to} to={n.to} className={({ isActive }) => `ch-nav-item ${isActive ? 'active' : ''}`}>
                            {n.icon}
                            {n.label}
                        </NavLink>
                    ))}

                    <div className="my-2 border-t border-border-subtle opacity-50"></div>
                    <NavLink to="/status" className="ch-nav-item">
                        <svg className="ch-global-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                        Connect
                    </NavLink>
                    <NavLink to="#" onClick={(e) => e.preventDefault()} className="ch-nav-item">
                        <svg className="ch-global-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>
                        Ask AI
                    </NavLink>
                </nav>

                <div className="px-4 mb-2">
                    <div className="border border-yellow-700/50 bg-[#1A1A00] rounded p-3 text-xs text-text-secondary relative overflow-hidden">
                        <svg className="w-3 h-3 text-accent absolute top-3 left-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>
                        <div className="pl-5 leading-relaxed">
                            Your trial ends in 25 days — enter payment info to keep going
                        </div>
                    </div>
                </div>

                <div className="px-4 mb-4">
                    <div className="text-[10px] text-text-muted mb-2 tracking-wide uppercase px-1">Organization</div>
                    <div className="flex items-center gap-2 text-[13px] text-text-primary px-1 hover:bg-white/5 py-1.5 rounded cursor-pointer">
                        <svg className="w-3.5 h-3.5 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                        <span className="flex-1 truncate">MM's Organization</span>
                        <svg className="w-3.5 h-3.5 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    </div>
                </div>

                <div className="ch-org-selector border-t border-border-subtle border-b-none py-3" onClick={() => navigate('/settings')}>
                    <svg className="w-4 h-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /></svg>
                    <div className="flex-1">Integrations</div>
                </div>

                <NavLink to="/incidents" className="ch-incident-nav hover:bg-red-800 transition-colors mt-0 mx-4 mb-4 cursor-pointer">
                    <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse ml-0.5 mr-1"></div>
                    Incident ongoing
                </NavLink>

                <div className="p-3 bg-bg-sidebar flex items-center justify-center gap-3 cursor-pointer hover:bg-white/5" onClick={() => {
                    localStorage.removeItem('tl_api_key')
                    window.location.href = '/login'
                }}>
                    <svg className="w-4 h-4 text-text-muted transition-transform rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                </div>
            </aside>
            {children}
        </div>
    )
}