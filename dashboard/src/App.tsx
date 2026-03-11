import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Overview from './pages/Overview';
import EventStream from './pages/EventStream';
import Traces from './pages/Traces';
import Alerts from './pages/Alerts';
import Incidents from './pages/Incidents';
import Analytics from './pages/Analytics';
import Datasets from './pages/Datasets';
import CostTracking from './pages/CostTracking';
import Settings from './pages/Settings';
import TraceDetail from './pages/TraceDetail';
import Status from './pages/Status';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 30000,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<Overview />} />
              <Route path="/overview" element={<Overview />} />
              <Route path="/stream" element={<EventStream />} />
              <Route path="/traces" element={<Traces />} />
              <Route path="/trace/:traceId" element={<TraceDetail />} />
              <Route path="/alerts" element={<Alerts />} />
              <Route path="/incidents" element={<Incidents />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/datasets" element={<Datasets />} />
              <Route path="/cost" element={<CostTracking />} />
              <Route path="/status" element={<Status />} />
              <Route path="/settings" element={<Settings />} />
            </Route>
          </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
