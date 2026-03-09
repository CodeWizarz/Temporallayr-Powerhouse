import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import AuthGuard from './components/AuthGuard';
import { LoadingState } from './components/shared/LoadingState';

const Layout = lazy(() => import('./components/Layout'));
const Login = lazy(() => import('./pages/auth/Login'));
const Signup = lazy(() => import('./pages/auth/Signup'));
const Overview = lazy(() => import('./pages/Overview'));
const Traces = lazy(() => import('./pages/Traces'));
const TraceDetail = lazy(() => import('./pages/TraceDetail'));
const Incidents = lazy(() => import('./pages/Incidents'));
const Analytics = lazy(() => import('./pages/Analytics'));
const Replay = lazy(() => import('./pages/Replay'));
const Alerts = lazy(() => import('./pages/Alerts'));
const Datasets = lazy(() => import('./pages/Datasets'));
const CostTracking = lazy(() => import('./pages/CostTracking'));
const EventStream = lazy(() => import('./pages/EventStream'));
const Status = lazy(() => import('./pages/Status'));
const Settings = lazy(() => import('./pages/Settings'));
const NewService = lazy(() => import('./pages/NewService'));

function AppRoutes() {
  return (
    <Suspense fallback={<LoadingState message="Loading..." />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route element={<AuthGuard><Layout /></AuthGuard>}>
          <Route path="/overview" element={<Overview />} />
          <Route path="/new" element={<NewService />} />
          <Route path="/traces" element={<Traces />} />
          <Route path="/traces/:traceId" element={<TraceDetail />} />
          <Route path="/incidents" element={<Incidents />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/replay" element={<Replay />} />
          <Route path="/alerts" element={<Alerts />} />
          <Route path="/datasets" element={<Datasets />} />
          <Route path="/cost" element={<CostTracking />} />
          <Route path="/stream" element={<EventStream />} />
          <Route path="/status" element={<Status />} />
          <Route path="/settings/*" element={<Settings />} />
        </Route>
        <Route path="/" element={<Navigate to="/overview" replace />} />
        <Route path="*" element={<Navigate to="/overview" replace />} />
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return <AppRoutes />;
}
