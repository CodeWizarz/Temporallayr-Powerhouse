import { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'

const Shell = { display:'flex', height:'100vh', background:'#0d0d0d' } as const
const sidebarStyle = {
  width:220, background:'#111', borderRight:'1px solid #1a1a1a',
  display:'flex', flexDirection:'column' as const, padding:'20px 0', flexShrink:0
}
const logoArea = { padding:'0 20px 20px', borderBottom:'1px solid #1a1a1a', marginBottom:16 }
const mainStyle = { flex:1, overflowY:'auto' as const, padding:'28px 32px' }

const NAV = [
    { to: '/traces',    label: 'Traces',    icon: '⬡' },
    { to: '/incidents', label: 'Incidents', icon: '●' },
    { to: '/analytics', label: 'Analytics', icon: '▦' },
    { to: '/replay',    label: 'Replay',    icon: '▶' },
    { to: '/status',    label: 'Status',    icon: '⚡' },
    { to: '/settings',  label: 'Settings',  icon: '⚙' },
]

export default function Layout({ children }: { children: ReactNode }) {
    return (
        <div style={Shell}>
            <nav style={sidebarStyle}>
                <div style={logoArea}>
                    <div style={{ color:'#facc15', fontWeight:700, fontSize:18 }}>TemporalLayr</div>
                    <div style={{ color:'#444', fontSize:11, marginTop:2 }}>Agent Observability</div>
                </div>
                {NAV.map(n => (
                    <NavLink key={n.to} to={n.to} style={({ isActive }) => ({
                        display:'flex', alignItems:'center', gap:10, padding:'9px 20px',
                        textDecoration:'none', fontSize:13,
                        color: isActive ? '#facc15' : '#666',
                        borderLeft: isActive ? '2px solid #facc15' : '2px solid transparent',
                        background: isActive ? '#1a1700' : 'transparent',
                    })}>
                        <span style={{ fontSize:13, width:16, textAlign:'center' }}>{n.icon}</span>
                        {n.label}
                    </NavLink>
                ))}
                <div style={{ flex:1 }} />
                <div style={{ padding:'12px 20px', borderTop:'1px solid #1a1a1a' }}>
                    <div style={{ color:'#333', fontSize:11 }}>v0.2.1 · TemporalLayr</div>
                </div>
            </nav>
            <main style={mainStyle}>{children}</main>
        </div>
    )
}