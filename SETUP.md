# TemporalLayr — Environment Variables

## Core (required)
| Variable | Description | Default |
|---|---|---|
| `TEMPORALLAYR_API_KEY` | Bootstrap API key (seed first tenant) | — |
| `TEMPORALLAYR_ADMIN_KEY` | Admin endpoints key (`X-Admin-Key` header) | — |
| `TEMPORALLAYR_TENANT_ID` | Default tenant namespace | `default` |
| `TEMPORALLAYR_DATA_DIR` | SQLite data directory | `.temporallayr` |
| `TEMPORALLAYR_LOG_LEVEL` | Log level: DEBUG/INFO/WARNING/ERROR | `INFO` |

## Database (SQLite or Postgres)
| Variable | Description | Default |
|---|---|---|
| `DATABASE_URL` | Preferred DB connection string (Neon-friendly) | — |
| `TEMPORALLAYR_POSTGRES_DSN` | Legacy Postgres DSN fallback | — |

When either `DATABASE_URL` or `TEMPORALLAYR_POSTGRES_DSN` is set, TemporalLayr uses the asyncpg-backed `PostgresStore`. If both are set, `DATABASE_URL` wins.

## SDK Transport
| Variable | Description | Default |
|---|---|---|
| `TEMPORALLAYR_SERVER_URL` | Server URL for SDK | `http://localhost:8000` |
| `TEMPORALLAYR_BATCH_SIZE` | Events per HTTP flush | `100` |
| `TEMPORALLAYR_FLUSH_INTERVAL` | Flush interval seconds | `2.0` |
| `TEMPORALLAYR_MAX_QUEUE_SIZE` | In-memory queue depth | `10000` |
| `TEMPORALLAYR_MAX_RETRIES` | HTTP retry count | `3` |
| `TEMPORALLAYR_TIMEOUT_SECONDS` | HTTP timeout | `10.0` |

## ClickHouse Analytics (optional — enables /analytics/* endpoints)
| Variable | Description | Default |
|---|---|---|
| `TEMPORALLAYR_CLICKHOUSE_HOST` | Host (e.g. `xyz.clickhouse.cloud`) | — |
| `TEMPORALLAYR_CLICKHOUSE_PORT` | Port — **8443 for Cloud, 8123 for self-hosted** | `8443` |
| `TEMPORALLAYR_CLICKHOUSE_SECURE` | TLS — **true for Cloud, false for self-hosted HTTP** | `true` |
| `TEMPORALLAYR_CLICKHOUSE_DB` | Database | `default` |
| `TEMPORALLAYR_CLICKHOUSE_USER` | Username | `default` |
| `TEMPORALLAYR_CLICKHOUSE_PASSWORD` | Password | `""` |

## OTLP Trace Export (optional — Phoenix, Jaeger, Grafana Tempo)
| Variable | Description | Default |
|---|---|---|
| `TEMPORALLAYR_OTLP_ENDPOINT` | Collector URL (e.g. `http://localhost:6006`) | — |
| `TEMPORALLAYR_OTLP_API_KEY` | Bearer token for collector | — |

## Phoenix (local trace viewer)
```bash
docker-compose --profile phoenix up -d
# UI: http://localhost:6006
# Set TEMPORALLAYR_OTLP_ENDPOINT=http://localhost:6006
```

## ClickHouse Cloud Setup
1. Wake your service in the ClickHouse Cloud console
2. Click Connect → Python → clickhouse-connect
3. Copy: host, port (8443), username, password
4. Set env vars above — `TEMPORALLAYR_CLICKHOUSE_SECURE=true`
5. Schema auto-creates on first server start

## Koyeb + Neon (free-tier production deployment)
```
API Server  → Koyeb free tier (deploy from GitHub, auto-SSL)
Database    → Neon free tier Postgres (set DATABASE_URL, include ?sslmode=require)
Analytics   → ClickHouse Cloud trial → paid Dev tier
```

## Alembic Migrations
```bash
# Run all migrations
alembic upgrade head

# Roll back one revision
alembic downgrade -1
```

By default Alembic reads `DATABASE_URL`, then `TEMPORALLAYR_POSTGRES_DSN`, then `alembic.ini`.

## Quick Start (local)
```powershell
# 1. Install
pip install -e ".[clickhouse]"

# 2. Seed first API key
python -c "
from temporallayr.server.auth.api_keys import map_api_key_to_tenant
map_api_key_to_tenant('my-dev-key', 'my-tenant')
print('Key seeded.')
"

# 3. Start server
$env:TEMPORALLAYR_API_KEY = "my-dev-key"
$env:TEMPORALLAYR_ADMIN_KEY = "my-admin-key"
$env:TEMPORALLAYR_TENANT_ID = "my-tenant"
uvicorn temporallayr.server.app:app --reload --port 8000

# 4. Register tenant via admin API
curl -X POST http://localhost:8000/admin/tenants/register \
  -H "X-Admin-Key: my-admin-key" \
  -H "Content-Type: application/json" \
  -d '{"tenant_id": "acme-corp"}'
```
