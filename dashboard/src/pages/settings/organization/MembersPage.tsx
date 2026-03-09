import { useState } from 'react'

interface TeamMember {
    id: string
    name: string
    email: string
    role: 'owner' | 'admin' | 'member' | 'viewer'
    avatar?: string
    joinedAt: string
}

const MOCK_MEMBERS: TeamMember[] = [
    { id: '1', name: 'John Doe', email: 'john@example.com', role: 'owner', joinedAt: '2024-01-15' },
    { id: '2', name: 'Jane Smith', email: 'jane@example.com', role: 'admin', joinedAt: '2024-02-20' },
    { id: '3', name: 'Bob Wilson', email: 'bob@example.com', role: 'member', joinedAt: '2024-03-10' },
    { id: '4', name: 'Alice Brown', email: 'alice@example.com', role: 'viewer', joinedAt: '2024-03-15' },
]

const ROLES = [
    { value: 'admin', label: 'Admin', description: 'Can manage team, billing, and all settings' },
    { value: 'member', label: 'Member', description: 'Can create and manage traces and services' },
    { value: 'viewer', label: 'Viewer', description: 'Can only view traces and analytics' },
]

export default function OrganizationMembersPage() {
    const [members, setMembers] = useState<TeamMember[]>(MOCK_MEMBERS)
    const [showInviteModal, setShowInviteModal] = useState(false)
    const [inviteEmail, setInviteEmail] = useState('')
    const [inviteRole, setInviteRole] = useState('member')

    const handleInvite = (e: React.FormEvent) => {
        e.preventDefault()
        // Send invitation
        setShowInviteModal(false)
        setInviteEmail('')
    }

    const handleRoleChange = (memberId: string, newRole: string) => {
        setMembers(members.map(m => 
            m.id === memberId ? { ...m, role: newRole as TeamMember['role'] } : m
        ))
    }

    const handleRemoveMember = (memberId: string) => {
        setMembers(members.filter(m => m.id !== memberId))
    }

    return (
        <div className="ch-page-container">
            <div className="ch-page-header ch-page-header--flex">
                <div>
                    <h1 className="ch-page-title">Team</h1>
                    <p className="ch-page-subtitle">
                        Manage team members and their access to your organization
                    </p>
                </div>
                <button 
                    className="ch-btn ch-btn-primary"
                    onClick={() => setShowInviteModal(true)}
                >
                    <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Invite Member
                </button>
            </div>

            <div className="ch-team-stats">
                <div className="ch-team-stat">
                    <div className="ch-team-stat-value">{members.length}</div>
                    <div className="ch-team-stat-label">Members</div>
                </div>
                <div className="ch-team-stat">
                    <div className="ch-team-stat-value">1</div>
                    <div className="ch-team-stat-label">Pending Invites</div>
                </div>
            </div>

            <div className="ch-team-list">
                <table className="ch-table">
                    <thead>
                        <tr>
                            <th>Member</th>
                            <th>Role</th>
                            <th>Joined</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {members.map((member) => (
                            <tr key={member.id}>
                                <td>
                                    <div className="ch-team-member">
                                        <div className="ch-team-member-avatar">
                                            {member.name.charAt(0)}
                                        </div>
                                        <div className="ch-team-member-info">
                                            <div className="ch-team-member-name">{member.name}</div>
                                            <div className="ch-team-member-email">{member.email}</div>
                                        </div>
                                    </div>
                                </td>
                                <td>
                                    <select
                                        value={member.role}
                                        onChange={(e) => handleRoleChange(member.id, e.target.value)}
                                        className="ch-form-select ch-form-select--sm"
                                        disabled={member.role === 'owner'}
                                    >
                                        {ROLES.map((role) => (
                                            <option key={role.value} value={role.value}>
                                                {role.label}
                                            </option>
                                        ))}
                                    </select>
                                </td>
                                <td className="ch-text-muted">
                                    {new Date(member.joinedAt).toLocaleDateString('en-US', {
                                        year: 'numeric',
                                        month: 'short',
                                        day: 'numeric'
                                    })}
                                </td>
                                <td>
                                    {member.role !== 'owner' && (
                                        <button
                                            className="ch-btn ch-btn-ghost ch-btn-sm ch-btn-ghost--danger"
                                            onClick={() => handleRemoveMember(member.id)}
                                        >
                                            Remove
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {showInviteModal && (
                <div className="ch-modal-overlay" onClick={() => setShowInviteModal(false)}>
                    <div className="ch-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="ch-modal-header">
                            <h3 className="ch-modal-title">Invite Team Member</h3>
                            <button 
                                className="ch-modal-close"
                                onClick={() => setShowInviteModal(false)}
                            >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        <form onSubmit={handleInvite}>
                            <div className="ch-modal-body">
                                <div className="ch-form-field">
                                    <label className="ch-form-label">Email Address</label>
                                    <input
                                        type="email"
                                        value={inviteEmail}
                                        onChange={(e) => setInviteEmail(e.target.value)}
                                        placeholder="colleague@company.com"
                                        className="ch-form-input"
                                        required
                                    />
                                </div>
                                <div className="ch-form-field">
                                    <label className="ch-form-label">Role</label>
                                    <select
                                        value={inviteRole}
                                        onChange={(e) => setInviteRole(e.target.value)}
                                        className="ch-form-select"
                                    >
                                        {ROLES.map((role) => (
                                            <option key={role.value} value={role.value}>
                                                {role.label} - {role.description}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div className="ch-modal-footer">
                                <button 
                                    type="button"
                                    className="ch-btn ch-btn-ghost"
                                    onClick={() => setShowInviteModal(false)}
                                >
                                    Cancel
                                </button>
                                <button type="submit" className="ch-btn ch-btn-primary">
                                    Send Invitation
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
