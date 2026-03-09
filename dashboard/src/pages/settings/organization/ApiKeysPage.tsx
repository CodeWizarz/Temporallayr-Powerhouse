import { useState } from 'react'

interface ApiKey {
    id: string
    name: string
    prefix: string
    lastUsed: string | null
    createdAt: string
    permissions: string[]
}

const MOCK_KEYS: ApiKey[] = [
    { 
        id: '1', 
        name: 'Production Key', 
        prefix: 'tl_live_****',
        lastUsed: '2024-03-15T10:30:00Z',
        createdAt: '2024-01-10',
        permissions: ['write:traces', 'read:traces', 'write:alerts']
    },
    { 
        id: '2', 
        name: 'Development Key', 
        prefix: 'tl_test_****',
        lastUsed: null,
        createdAt: '2024-02-20',
        permissions: ['write:traces', 'read:traces']
    },
]

export default function OrganizationApiKeysPage() {
    const [keys, setKeys] = useState<ApiKey[]>(MOCK_KEYS)
    const [showCreateModal, setShowCreateModal] = useState(false)
    const [newKeyName, setNewKeyName] = useState('')
    const [newKeyPermissions, setNewKeyPermissions] = useState<string[]>(['read:traces', 'write:traces'])
    const [createdKey, setCreatedKey] = useState<string | null>(null)

    const handleCreateKey = (e: React.FormEvent) => {
        e.preventDefault()
        // In real app, this would create the key and return the full key
        const mockKey = 'tl_live_' + Math.random().toString(36).substring(2, 15)
        setCreatedKey(mockKey)
    }

    const handleRevokeKey = (keyId: string) => {
        setKeys(keys.filter(k => k.id !== keyId))
    }

    const togglePermission = (permission: string) => {
        setNewKeyPermissions(prev => 
            prev.includes(permission)
                ? prev.filter(p => p !== permission)
                : [...prev, permission]
        )
    }

    const PERMISSIONS = [
        { value: 'read:traces', label: 'Read Traces', description: 'View trace data and analytics' },
        { value: 'write:traces', label: 'Write Traces', description: 'Ingest new traces' },
        { value: 'read:alerts', label: 'Read Alerts', description: 'View alert configurations' },
        { value: 'write:alerts', label: 'Write Alerts', description: 'Create and manage alerts' },
        { value: 'admin', label: 'Admin', description: 'Full administrative access' },
    ]

    return (
        <div className="ch-page-container">
            <div className="ch-page-header">
                <h1 className="ch-page-title">API Keys</h1>
                <p className="ch-page-subtitle">
                    Manage API keys for accessing TemporalLayr programmatically
                </p>
            </div>

            <div className="ch-api-keys-list">
                <table className="ch-table">
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Key</th>
                            <th>Permissions</th>
                            <th>Last Used</th>
                            <th>Created</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {keys.map((key) => (
                            <tr key={key.id}>
                                <td className="ch-font-medium">{key.name}</td>
                                <td>
                                    <code className="ch-code">{key.prefix}</code>
                                </td>
                                <td>
                                    <div className="ch-permissions-list">
                                        {key.permissions.map((perm) => (
                                            <span key={perm} className="ch-badge ch-badge-default">
                                                {perm}
                                            </span>
                                        ))}
                                    </div>
                                </td>
                                <td className="ch-text-muted">
                                    {key.lastUsed 
                                        ? new Date(key.lastUsed).toLocaleDateString() 
                                        : 'Never'}
                                </td>
                                <td className="ch-text-muted">
                                    {new Date(key.createdAt).toLocaleDateString()}
                                </td>
                                <td>
                                    <button
                                        className="ch-btn ch-btn-ghost ch-btn-sm ch-btn-ghost--danger"
                                        onClick={() => handleRevokeKey(key.id)}
                                    >
                                        Revoke
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="ch-page-actions">
                <button 
                    className="ch-btn ch-btn-primary"
                    onClick={() => {
                        setShowCreateModal(true)
                        setCreatedKey(null)
                    }}
                >
                    <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Create New Key
                </button>
            </div>

            <div className="ch-api-keys-info">
                <div className="ch-info-box">
                    <svg className="w-5 h-5 text-info" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                        <h4 className="ch-info-box-title">Keep your keys secure</h4>
                        <p className="ch-info-box-text">
                            Never share your API keys in public repositories or client-side code.
                            Use environment variables to store keys securely.
                        </p>
                    </div>
                </div>
            </div>

            {showCreateModal && (
                <div className="ch-modal-overlay" onClick={() => setShowCreateModal(false)}>
                    <div className="ch-modal ch-modal--lg" onClick={(e) => e.stopPropagation()}>
                        <div className="ch-modal-header">
                            <h3 className="ch-modal-title">Create API Key</h3>
                            <button 
                                className="ch-modal-close"
                                onClick={() => setShowCreateModal(false)}
                            >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        
                        {createdKey ? (
                            <div className="ch-modal-body">
                                <div className="ch-success-box">
                                    <svg className="w-6 h-6 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <div>
                                        <h4 className="ch-success-box-title">API Key Created</h4>
                                        <p className="ch-success-box-text">
                                            Make sure to copy your API key now. You won't be able to see it again!
                                        </p>
                                    </div>
                                </div>
                                <div className="ch-form-field">
                                    <label className="ch-form-label">Your API Key</label>
                                    <div className="ch-api-key-display">
                                        <code className="ch-api-key-value">{createdKey}</code>
                                        <button 
                                            className="ch-btn ch-btn-ghost"
                                            onClick={() => navigator.clipboard.writeText(createdKey)}
                                        >
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                                <div className="ch-modal-footer">
                                    <button 
                                        className="ch-btn ch-btn-primary w-full"
                                        onClick={() => setShowCreateModal(false)}
                                    >
                                        Done
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <form onSubmit={handleCreateKey}>
                                <div className="ch-modal-body">
                                    <div className="ch-form-field">
                                        <label className="ch-form-label">Key Name</label>
                                        <input
                                            type="text"
                                            value={newKeyName}
                                            onChange={(e) => setNewKeyName(e.target.value)}
                                            placeholder="e.g., Production API Key"
                                            className="ch-form-input"
                                            required
                                        />
                                    </div>
                                    <div className="ch-form-field">
                                        <label className="ch-form-label">Permissions</label>
                                        <div className="ch-permissions-grid">
                                            {PERMISSIONS.map((perm) => (
                                                <label 
                                                    key={perm.value} 
                                                    className={`ch-permission-option ${newKeyPermissions.includes(perm.value) ? 'ch-permission-option--selected' : ''}`}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={newKeyPermissions.includes(perm.value)}
                                                        onChange={() => togglePermission(perm.value)}
                                                        className="ch-checkbox"
                                                    />
                                                    <div>
                                                        <div className="ch-permission-label">{perm.label}</div>
                                                        <div className="ch-permission-description">{perm.description}</div>
                                                    </div>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                                <div className="ch-modal-footer">
                                    <button 
                                        type="button"
                                        className="ch-btn ch-btn-ghost"
                                        onClick={() => setShowCreateModal(false)}
                                    >
                                        Cancel
                                    </button>
                                    <button type="submit" className="ch-btn ch-btn-primary">
                                        Create Key
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
