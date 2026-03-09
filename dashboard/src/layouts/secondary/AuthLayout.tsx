import { ReactNode } from 'react'
import { Link } from 'react-router-dom'

interface AuthLayoutProps {
    children: ReactNode
    title: string
    subtitle?: string
}

export default function AuthLayout({ children, title, subtitle }: AuthLayoutProps) {
    return (
        <div className="ch-auth-layout">
            <div className="ch-auth-sidebar">
                <div className="ch-auth-content">
                    <Link to="/" className="ch-auth-logo">
                        <div className="w-8 h-8 bg-accent rounded flex items-center justify-center text-black font-bold text-sm" style={{ background: 'var(--accent)' }}>T</div>
                    </Link>
                    <h1 className="ch-auth-title">TemporalLayr</h1>
                    <p className="ch-auth-subtitle">
                        Full-stack tracing for AI agents and LLM applications
                    </p>
                    <div className="ch-auth-features">
                        <div className="ch-auth-feature">
                            <svg className="w-5 h-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            <span>Distributed Tracing</span>
                        </div>
                        <div className="ch-auth-feature">
                            <svg className="w-5 h-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            <span>Failure Clustering</span>
                        </div>
                        <div className="ch-auth-feature">
                            <svg className="w-5 h-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            <span>Replay Testing</span>
                        </div>
                        <div className="ch-auth-feature">
                            <svg className="w-5 h-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            <span>Real-time Alerts</span>
                        </div>
                    </div>
                </div>
                <div className="ch-auth-footer">
                    <a href="https://temporallayr.com" className="text-text-muted text-sm hover:text-text-primary transition-colors">
                        Website
                    </a>
                    <span className="text-text-muted">·</span>
                    <a href="https://docs.temporallayr.com" className="text-text-muted text-sm hover:text-text-primary transition-colors">
                        Docs
                    </a>
                    <span className="text-text-muted">·</span>
                    <a href="https://discord.gg/temporallayr" className="text-text-muted text-sm hover:text-text-primary transition-colors">
                        Support
                    </a>
                </div>
            </div>
            <div className="ch-auth-main">
                <div className="ch-auth-form-container">
                    <div className="ch-auth-form-header">
                        <h2 className="ch-auth-form-title">{title}</h2>
                        {subtitle && <p className="ch-auth-form-subtitle">{subtitle}</p>}
                    </div>
                    {children}
                </div>
            </div>
        </div>
    )
}
