import { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { Text, Title, Separator } from '@clickhouse/click-ui'
import styled from 'styled-components'

const Shell = styled.div`display:flex;height:100vh;background:#0d0d0d;`
const Sidebar = styled.nav`
  width:220px;background:#111;border-right:1px solid #1a1a1a;
  display:flex;flex-direction:column;padding:20px 0;flex-shrink:0;
`
const LogoArea = styled.div`padding:0 20px 20px;border-bottom:1px solid #1a1a1a;margin-bottom:16px;`
const NavItem = styled(NavLink)`
  display:flex;align-items:center;gap:10px;padding:9px 20px;
  text-decoration:none;font-size:13px;color:#666;border-left:2px solid transparent;transition:all .15s;
  &:hover{color:#e0e0e0;background:#161616;}
  &.active{color:#facc15;border-left-color:#facc15;background:#1a1700;}
`
const Main = styled.main`flex:1;overflow-y:auto;padding:28px 32px;`

const NAV = [
    { to: '/traces', label: 'Traces', icon: '⬡' },
    { to: '/incidents', label: 'Incidents', icon: '●' },
    { to: '/analytics', label: 'Analytics', icon: '▦' },
    { to: '/replay', label: 'Replay', icon: '▶' },
    { to: '/status', label: 'Status', icon: '⚡' },
    { to: '/settings', label: 'Settings', icon: '⚙' },
]

export default function Layout({ children }: { children: ReactNode }) {
    return (
        <Shell>
            <Sidebar>
                <LogoArea>
                    <Title type="h4" style={{ color: '#facc15', margin: 0 }}>TemporalLayr</Title>
                    <Text size="xs" style={{ color: '#444' }}>Agent Observability</Text>
                </LogoArea>
                {NAV.map(n => (
                    <NavItem key={n.to} to={n.to}>
                        <span style={{ fontSize: 13, width: 16, textAlign: 'center' }}>{n.icon}</span>
                        {n.label}
                    </NavItem>
                ))}
                <div style={{ flex: 1 }} />
                <Separator size="xs" />
                <div style={{ padding: '12px 20px' }}>
                    <Text size="xs" style={{ color: '#333' }}>v0.2.1 · TemporalLayr</Text>
                </div>
            </Sidebar>
            <Main>{children}</Main>
        </Shell>
    )
}
