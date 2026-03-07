import { Routes, Route, Navigate, Outlet } from 'react-router-dom'
import Layout from './components/Layout'
import AuthGuard from './components/AuthGuard'
import TracesPage from './pages/Traces'
import TraceDetailPage from './pages/TraceDetail'
import IncidentsPage from './pages/Incidents'
import AnalyticsPage from './pages/Analytics'
import ReplayPage from './pages/Replay'
import SettingsPage from './pages/Settings'
import StatusPage from './pages/Status'

import SignupPage from './pages/auth/Signup'
import LoginPage from './pages/auth/Login'

export default function App() {
    return (
        <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/" element={<Navigate to="/traces" replace />} />

            <Route element={<AuthGuard><Layout><Outlet /></Layout></AuthGuard>}>
                <Route path="/traces" element={<TracesPage />} />
                <Route path="/traces/:traceId" element={<TraceDetailPage />} />
                <Route path="/incidents" element={<IncidentsPage />} />
                <Route path="/analytics" element={<AnalyticsPage />} />
                <Route path="/replay" element={<ReplayPage />} />
                <Route path="/status" element={<StatusPage />} />
                <Route path="/settings" element={<SettingsPage />} />
            </Route>
        </Routes>
    )
}