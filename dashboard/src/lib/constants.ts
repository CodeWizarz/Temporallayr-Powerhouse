export const ROUTES = {
  LOGIN: '/login',
  SIGNUP: '/signup',
  OVERVIEW: '/overview',
  NEW_SERVICE: '/new',
  TRACES: '/traces',
  TRACE_DETAIL: '/traces/:traceId',
  INCIDENTS: '/incidents',
  ANALYTICS: '/analytics',
  REPLAY: '/replay',
  ALERTS: '/alerts',
  DATASETS: '/datasets',
  COST_TRACKING: '/cost',
  EVENT_STREAM: '/stream',
  STATUS: '/status',
  SETTINGS: '/settings',
  SETTINGS_ORG: '/settings/organization',
  SETTINGS_BILLING: '/settings/organization/billing',
  SETTINGS_MEMBERS: '/settings/organization/members',
  SETTINGS_API_KEYS: '/settings/organization/api-keys',
} as const;

export const AUTH_KEY = 'tl_api_key';

export const API_BASE_URL = import.meta.env.VITE_API_URL || '';

export const SIDEBAR_NAV = [
  { section: 'Observe', items: [
    { label: 'Overview', path: ROUTES.OVERVIEW, icon: 'LayoutDashboard' },
    { label: 'Traces', path: ROUTES.TRACES, icon: 'GitBranch' },
    { label: 'Incidents', path: ROUTES.INCIDENTS, icon: 'AlertTriangle' },
    { label: 'Analytics', path: ROUTES.ANALYTICS, icon: 'BarChart3' },
  ]},
  { section: 'Tools', items: [
    { label: 'Replay', path: ROUTES.REPLAY, icon: 'Play' },
    { label: 'Alerts', path: ROUTES.ALERTS, icon: 'Bell' },
    { label: 'Datasets', path: ROUTES.DATASETS, icon: 'Database' },
    { label: 'Cost', path: ROUTES.COST_TRACKING, icon: 'DollarSign' },
    { label: 'Event Stream', path: ROUTES.EVENT_STREAM, icon: 'Activity' },
  ]},
  { section: 'System', items: [
    { label: 'Status', path: ROUTES.STATUS, icon: 'Heart' },
    { label: 'Settings', path: ROUTES.SETTINGS, icon: 'Settings' },
  ]},
] as const;

export const TIME_FILTERS = [
  { label: '1h', value: '1h' },
  { label: '6h', value: '6h' },
  { label: '24h', value: '24h' },
  { label: '7d', value: '7d' },
  { label: '30d', value: '30d' },
] as const;

export const PAGE_SIZES = [10, 25, 50, 100] as const;
