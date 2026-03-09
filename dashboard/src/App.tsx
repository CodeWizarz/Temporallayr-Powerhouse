import { Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import Layout from './components/Layout'
import AuthGuard from './components/AuthGuard'
import SettingsLayout from './layouts/settings/SettingsLayout'
import TracesPage from './pages/Traces'
import TraceDetailPage from './pages/TraceDetail'
import IncidentsPage from './pages/Incidents'
import AnalyticsPage from './pages/Analytics'
import ReplayPage from './pages/Replay'
import SettingsPage from './pages/Settings'
import StatusPage from './pages/Status'
import NewService from './pages/NewService'
import OverviewPage from './pages/Overview'
import AlertsPage from './pages/Alerts'
import DatasetsPage from './pages/Datasets'
import CostTrackingPage from './pages/CostTracking'
import EventStreamPage from './pages/EventStream'
import OrganizationGeneralPage from './pages/settings/organization/GeneralPage'
import OrganizationBillingPage from './pages/settings/organization/BillingPage'
import OrganizationMembersPage from './pages/settings/organization/MembersPage'
import OrganizationApiKeysPage from './pages/settings/organization/ApiKeysPage'

import SignupPage from './pages/auth/Signup'
import LoginPage from './pages/auth/Login'

export default function App() {
    return (
        <>
            <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/signup" element={<SignupPage />} />
                <Route path="/" element={<Navigate to="/overview" replace />} />

                <Route element={<AuthGuard><Layout><Outlet /></Layout></AuthGuard>}>
                    <Route path="/new" element={<NewService />} />
                    <Route path="/overview" element={<OverviewPage />} />
                    <Route path="/traces" element={<TracesPage />} />
                    <Route path="/traces/:traceId" element={<TraceDetailPage />} />
                    <Route path="/incidents" element={<IncidentsPage />} />
                    <Route path="/analytics" element={<AnalyticsPage />} />
                    <Route path="/replay" element={<ReplayPage />} />
                    <Route path="/alerts" element={<AlertsPage />} />
                    <Route path="/datasets" element={<DatasetsPage />} />
                    <Route path="/cost" element={<CostTrackingPage />} />
                    <Route path="/stream" element={<EventStreamPage />} />
                    <Route path="/status" element={<StatusPage />} />

                    <Route path="/settings" element={<SettingsLayout />}>
                        <Route index element={<SettingsPage />} />
                        <Route path="organization" element={<OrganizationGeneralPage />} />
                        <Route path="organization/billing" element={<OrganizationBillingPage />} />
                        <Route path="organization/members" element={<OrganizationMembersPage />} />
                        <Route path="organization/api-keys" element={<OrganizationApiKeysPage />} />
                        <Route path="organization/webhooks" element={<div className="ch-page-container"><h1 className="ch-page-title">Webhooks</h1><p className="ch-page-subtitle">Coming soon...</p></div>} />
                        <Route path="organization/security" element={<div className="ch-page-container"><h1 className="ch-page-title">Security</h1><p className="ch-page-subtitle">Coming soon...</p></div>} />
                    </Route>
                </Route>
            </Routes>
            <Toaster position="bottom-right" toastOptions={{ style: { background: 'var(--ch-surface)', color: 'var(--ch-text-primary)', border: '1px solid var(--ch-border)' } }} />
        </>
    )
}
