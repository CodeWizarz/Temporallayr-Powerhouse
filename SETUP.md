# TemporalLayr — Environment Variables

## Core
| Variable | Description | Default |
|---|---|---|
| `TEMPORALLAYR_API_KEY` | Server auth key | — |
| `TEMPORALLAYR_TENANT_ID` | Tenant namespace | `default` |
| `TEMPORALLAYR_SERVER_URL` | SDK → server URL | `http://localhost:8000` |
| `TEMPORALLAYR_RETENTION_DAYS` | Execution retention | `30` |

## ClickHouse (optional — enables analytics endpoints)
| Variable | Description | Default |
|---|---|---|
| `TEMPORALLAYR_CLICKHOUSE_HOST` | ClickHouse host | — |
| `TEMPORALLAYR_CLICKHOUSE_PORT` | HTTP port | `8123` |
| `TEMPORALLAYR_CLICKHOUSE_DB` | Database | `default` |
| `TEMPORALLAYR_CLICKHOUSE_USER` | Username | `default` |
| `TEMPORALLAYR_CLICKHOUSE_PASSWORD` | Password | `""` |
| `TEMPORALLAYR_CLICKHOUSE_SECURE` | TLS | `false` |

## OTLP Export (optional — sends to Phoenix/Jaeger/Tempo)
| Variable | Description | Default |
|---|---|---|
| `TEMPORALLAYR_OTLP_ENDPOINT` | Collector URL | — |
| `TEMPORALLAYR_OTLP_API_KEY` | Bearer token for collector | — |

## Phoenix (self-hosted)
Phoenix UI: http://localhost:6006
OTLP endpoint: http://localhost:6006/v1/traces

Set `TEMPORALLAYR_OTLP_ENDPOINT=http://localhost:6006` to pipe all traces into Phoenix.

## SDK Transport
| Variable | Description | Default |
|---|---|---|
| `TEMPORALLAYR_BATCH_SIZE` | Events per flush | `100` |
| `TEMPORALLAYR_FLUSH_INTERVAL` | Flush interval (s) | `2.0` |
| `TEMPORALLAYR_MAX_QUEUE_SIZE` | SDK queue depth | `10000` |
| `TEMPORALLAYR_MAX_RETRIES` | HTTP retry count | `3` |
