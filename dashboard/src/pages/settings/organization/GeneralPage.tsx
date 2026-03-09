import { useState } from 'react'

export default function OrganizationGeneralPage() {
    const [orgName, setOrgName] = useState('My Organization')
    const [website, setWebsite] = useState('')

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        // Save organization settings
    }

    return (
        <div className="ch-page-container">
            <div className="ch-page-header">
                <h1 className="ch-page-title">General</h1>
                <p className="ch-page-subtitle">
                    Manage your organization settings
                </p>
            </div>

            <form onSubmit={handleSubmit} className="ch-form">
                <div className="ch-form-section">
                    <div className="ch-form-field">
                        <label className="ch-form-label">Organization Name</label>
                        <input
                            type="text"
                            value={orgName}
                            onChange={(e) => setOrgName(e.target.value)}
                            className="ch-form-input"
                        />
                        <p className="ch-form-hint">
                            This is the name that will be displayed to team members
                        </p>
                    </div>

                    <div className="ch-form-field">
                        <label className="ch-form-label">Website</label>
                        <input
                            type="url"
                            value={website}
                            onChange={(e) => setWebsite(e.target.value)}
                            placeholder="https://example.com"
                            className="ch-form-input"
                        />
                    </div>
                </div>

                <div className="ch-form-actions">
                    <button type="submit" className="ch-btn ch-btn-primary">
                        Save Changes
                    </button>
                </div>
            </form>

            <div className="ch-form-section ch-form-section--danger">
                <h3 className="ch-form-section-title">Danger Zone</h3>
                <div className="ch-danger-zone">
                    <div className="ch-danger-zone-item">
                        <div>
                            <div className="ch-danger-zone-title">Delete Organization</div>
                            <div className="ch-danger-zone-description">
                                Once you delete an organization, there is no going back. Please be certain.
                            </div>
                        </div>
                        <button className="ch-btn ch-btn-danger">Delete Organization</button>
                    </div>
                </div>
            </div>
        </div>
    )
}
