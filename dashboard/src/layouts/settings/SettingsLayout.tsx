import { ReactNode } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'

const SETTINGS_NAV = [
    { to: '/settings/organization', label: 'General', end: true },
    { to: '/settings/organization/billing', label: 'Billing' },
    { to: '/settings/organization/members', label: 'Team' },
    { to: '/settings/organization/api-keys', label: 'API Keys' },
    { to: '/settings/organization/webhooks', label: 'Webhooks' },
    { to: '/settings/organization/security', label: 'Security' },
]

export default function SettingsLayout() {
    const location = useLocation()
    
    const isOrganizationSettings = location.pathname.includes('/settings/organization')

    return (
        <div className="ch-settings-layout">
            <div className="ch-settings-nav">
                <div className="ch-settings-section">
                    <div className="ch-settings-section-title">Account</div>
                    <NavLink to="/settings" className={({ isActive }) => `ch-settings-link ${isActive ? 'active' : ''}`}>
                        Profile
                    </NavLink>
                </div>
                
                {isOrganizationSettings && (
                    <div className="ch-settings-section">
                        <div className="ch-settings-section-title">Organization</div>
                        {SETTINGS_NAV.map(n => (
                            <NavLink 
                                key={n.to} 
                                to={n.to} 
                                end={n.end}
                                className={({ isActive }) => `ch-settings-link ${isActive ? 'active' : ''}`}
                            >
                                {n.label}
                            </NavLink>
                        ))}
                    </div>
                )}
            </div>
            
            <div className="ch-settings-content">
                <Outlet />
            </div>
        </div>
    )
}
