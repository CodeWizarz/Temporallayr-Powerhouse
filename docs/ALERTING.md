# Alerting & Incident Notification

TemporalLayr can notify your team when incidents are detected via webhooks. This document covers configuring alerting integrations.

## Supported Providers

| Provider | Support | Configuration |
|----------|---------|----------------|
| Slack | Native blocks | Webhook URL |
| PagerDuty | Events API v2 | Routing Key |
| Generic | JSON + HMAC | Webhook URL + Secret |

## Configuration

Alerting is configured via environment variables:

```bash
# Slack webhook (recommended for most teams)
TEMPORALLAYR_SLACK_WEBHOOK_URL=https://hooks.slack.com/services/XXX/YYY/ZZZ

# PagerDuty (for on-call escalation)
TEMPORALLAYR_PAGERDUTY_ROUTING_KEY=your-routing-key

# Generic webhook (custom integrations)
TEMPORALLAYR_WEBHOOK_URL=https://your-endpoint.com/alerts
TEMPORALLAYR_WEBHOOK_SECRET=your-hmac-secret
```

### Slack Webhook Setup

1. Create a Slack App or use an existing incoming webhook:
   - Go to https://api.slack.com/messaging/webhooks
   - Create a new webhook for your channel
   - Copy the webhook URL

2. Set the environment variable:
   ```bash
   TEMPORALLAYR_SLACK_WEBHOOK_URL=https://hooks.slack.com/services/XXX/YYY/ZZZ
   ```

3. Restart the server. Incidents will now post to your Slack channel.

### PagerDuty Setup

1. Create a PagerDuty Integration Key:
   - Go to your PagerDuty Service
   - Add an "Events API v2" integration
   - Copy the Integration Key (routing key)

2. Set the environment variable:
   ```bash
   TEMPORALLAYR_PAGERDUTY_ROUTING_KEY=your-integration-key
   ```

3. Incidents will trigger PagerDuty events with severity mapping:
   - `critical` → PagerDuty `critical`
   - `high` → PagerDuty `error`
   - `normal` → PagerDuty `warning`

### Generic Webhook Setup

For custom integrations, you can use the generic webhook with optional HMAC signing:

```bash
TEMPORALLAYR_WEBHOOK_URL=https://your-endpoint.com/alerts
TEMPORALLAYR_WEBHOOK_SECRET=your-shared-secret
```

The payload includes:
```json
{
  "event": "incident.created",
  "timestamp": 1699999999.123,
  "incident": {
    "incident_id": "inc_abc123",
    "tenant_id": "acme-corp",
    "severity": "high",
    "failing_node": "tool:fetch",
    "count": 15,
    "first_seen": "2024-01-01T12:00:00Z"
  },
  "source": "temporallayr"
}
```

If a secret is configured, requests include `X-TemporalLayr-Signature` header with SHA256 HMAC.

## Incident Lifecycle

Understanding how incidents are created and resolved:

```
┌─────────────┐     ┌────────────────┐     ┌─────────────┐
│  Detected   │ ──> │  Acknowledged  │ ──> │  Resolved   │
│  (open)     │     │   (ack)        │     │  (resolved) │
└─────────────┘     └────────────────┘     └─────────────┘
      │                   │                     │
      v                   v                     v
 webhook:          webhook:              webhook:
 incident.created incident.acknowledged  incident.resolved
```

### States

1. **Open** - New incident detected, failure threshold exceeded
2. **Acknowledged** - Team member has seen and acknowledged the incident
3. **Resolved** - Failure cluster no longer active, incident closed

### Actions

- **Auto-created**: When failure cluster count exceeds threshold
- **Acknowledged**: Via dashboard or API `POST /incidents/{id}/ack`
- **Resolved**: Automatically when failure cluster drops below threshold, or manually via API

## Prometheus Metrics

Incidents are also exposed via Prometheus metrics:

```
tl_incidents_total{severity="critical"} 5
tl_incidents_open 2
```

Scrape at `GET /metrics`.

## Dashboard

View and manage incidents at `/incidents` in the dashboard.

## Troubleshooting

### Webhooks not firing

1. Check server logs for webhook delivery errors
2. Verify webhook URL is reachable from server
3. Test with `TEMPORALLAYR_LOG_LEVEL=DEBUG` for verbose output

### PagerDuty not receiving events

- Verify Routing Key is correct (not the API key)
- Check PagerDuty Service has Events API v2 enabled

### Slack notifications not appearing

- Verify webhook URL is valid
- Check Slack channel permissions for the webhook bot
