import { useState } from 'react'

const PLANS = [
    {
        id: 'starter',
        name: 'Starter',
        price: 0,
        period: 'month',
        description: 'For personal projects and prototyping',
        features: [
            '10,000 traces per month',
            '7-day retention',
            '1 team member',
            'Email support',
        ],
        current: false,
    },
    {
        id: 'pro',
        name: 'Pro',
        price: 49,
        period: 'month',
        description: 'For growing teams and production apps',
        features: [
            '100,000 traces per month',
            '30-day retention',
            '5 team members',
            'Priority support',
            'Replay testing',
            'Custom alerts',
        ],
        current: true,
    },
    {
        id: 'enterprise',
        name: 'Enterprise',
        price: null,
        period: 'custom',
        description: 'For large organizations with custom needs',
        features: [
            'Unlimited traces',
            '1-year retention',
            'Unlimited team members',
            '24/7 dedicated support',
            'SSO / SAML',
            'Custom integrations',
            'SLA guarantee',
        ],
        current: false,
    },
]

export default function OrganizationBillingPage() {
    const [selectedPlan, setSelectedPlan] = useState('pro')

    return (
        <div className="ch-page-container">
            <div className="ch-page-header">
                <h1 className="ch-page-title">Billing</h1>
                <p className="ch-page-subtitle">
                    Manage your subscription and billing information
                </p>
            </div>

            <div className="ch-billing-current">
                <div className="ch-billing-plan-card ch-billing-plan-card--current">
                    <div className="ch-billing-plan-header">
                        <div>
                            <span className="ch-billing-plan-label">Current Plan</span>
                            <h3 className="ch-billing-plan-name">Pro</h3>
                        </div>
                        <span className="ch-billing-plan-price">$49/mo</span>
                    </div>
                    <div className="ch-billing-plan-usage">
                        <div className="ch-billing-usage-item">
                            <span className="ch-billing-usage-label">Traces this month</span>
                            <span className="ch-billing-usage-value">45,230 / 100,000</span>
                        </div>
                        <div className="ch-billing-usage-bar">
                            <div className="ch-billing-usage-bar-fill" style={{ width: '45%' }}></div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="ch-billing-section">
                <h2 className="ch-billing-section-title">Available Plans</h2>
                <div className="ch-billing-plans">
                    {PLANS.map((plan) => (
                        <div 
                            key={plan.id} 
                            className={`ch-billing-plan-card ${selectedPlan === plan.id ? 'ch-billing-plan-card--selected' : ''} ${plan.current ? 'ch-billing-plan-card--current' : ''}`}
                            onClick={() => setSelectedPlan(plan.id)}
                        >
                            {plan.current && <span className="ch-billing-plan-badge">Current</span>}
                            {plan.id === 'enterprise' && <span className="ch-billing-plan-badge ch-billing-plan-badge--secondary">Popular</span>}
                            <h3 className="ch-billing-plan-name">{plan.name}</h3>
                            <div className="ch-billing-plan-price">
                                {plan.price === null ? (
                                    <span>Custom</span>
                                ) : (
                                    <>
                                        <span className="ch-billing-price-amount">${plan.price}</span>
                                        <span className="ch-billing-price-period">/{plan.period}</span>
                                    </>
                                )}
                            </div>
                            <p className="ch-billing-plan-description">{plan.description}</p>
                            <ul className="ch-billing-plan-features">
                                {plan.features.map((feature, idx) => (
                                    <li key={idx}>
                                        <svg className="w-4 h-4 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                        {feature}
                                    </li>
                                ))}
                            </ul>
                            {!plan.current && (
                                <button className={`ch-btn ${plan.id === 'enterprise' ? 'ch-btn-secondary' : 'ch-btn-primary'} w-full`}>
                                    {plan.price === null ? 'Contact Sales' : 'Upgrade'}
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            <div className="ch-billing-section">
                <h2 className="ch-billing-section-title">Payment Method</h2>
                <div className="ch-billing-payment">
                    <div className="ch-billing-payment-card">
                        <div className="ch-billing-payment-icon">
                            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                            </svg>
                        </div>
                        <div className="ch-billing-payment-details">
                            <div className="ch-billing-payment-type">Visa ending in 4242</div>
                            <div className="ch-billing-payment-expiry">Expires 12/2025</div>
                        </div>
                        <button className="ch-btn ch-btn-ghost">Edit</button>
                    </div>
                    <button className="ch-btn ch-btn-secondary">Add Payment Method</button>
                </div>
            </div>

            <div className="ch-billing-section">
                <h2 className="ch-billing-section-title">Billing History</h2>
                <div className="ch-billing-history">
                    <table className="ch-table">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Description</th>
                                <th>Amount</th>
                                <th>Status</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>Mar 1, 2024</td>
                                <td>Pro Plan - Monthly</td>
                                <td>$49.00</td>
                                <td><span className="ch-badge ch-badge-success">Paid</span></td>
                                <td><button className="ch-btn ch-btn-ghost ch-btn-sm">Download</button></td>
                            </tr>
                            <tr>
                                <td>Feb 1, 2024</td>
                                <td>Pro Plan - Monthly</td>
                                <td>$49.00</td>
                                <td><span className="ch-badge ch-badge-success">Paid</span></td>
                                <td><button className="ch-btn ch-btn-ghost ch-btn-sm">Download</button></td>
                            </tr>
                            <tr>
                                <td>Jan 1, 2024</td>
                                <td>Pro Plan - Monthly</td>
                                <td>$49.00</td>
                                <td><span className="ch-badge ch-badge-success">Paid</span></td>
                                <td><button className="ch-btn ch-btn-ghost ch-btn-sm">Download</button></td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
