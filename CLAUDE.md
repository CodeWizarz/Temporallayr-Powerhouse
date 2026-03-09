# TemporalLayr Development Instructions

## General Guidelines

- When working on a branch, do not use rebase or amend - add new commits instead.
- Do not commit to the main branch. Create a new branch for every task.
- When writing text such as documentation, comments, or commit messages, wrap literal names from SQL language, classes and functions, or literal excerpts from log messages inside inline code blocks, such as: `ExecutionGraph`.
- When mentioning errors, say "exception" instead of "crash" when referring to non-critical failures.

## Code Style

- Use Black for Python formatting (line-length: 100)
- Use Ruff for linting
- Use MyPy for type checking
- Run before every commit:
  ```bash
  ruff --fix .
  black .
  mypy src
  pytest
  ```

## Testing

- Run tests with: `pytest`
- Integration tests require external services (Redis, ClickHouse, Postgres) - set `TEMPORALLAYR_RUN_EXTERNAL_TESTS=1`
- E2E tests require Docker - set `TEMPORALLAYR_RUN_E2E_DOCKER=1`
- Dashboard tests: `cd dashboard && npm run test`

## Building

- Build the project: Standard Python package installation
- Build dashboard: `cd dashboard && npm run build`
- TypeScript: `cd dashboard && npm run typecheck`

## ClickHouse Analytics

When working with analytics queries in `store_clickhouse.py`:

- Use `quantile()` for percentile calculations
- Use `toStartOfHour()`, `toStartOfDay()` for time bucketing
- Use fingerprint grouping for trace clustering
- Always include tenant_id filter for multi-tenant safety
- Use TTL policies for data retention (90 days for traces, 30 days for uptime)

## Key Files

- `src/temporallayr/core/store_clickhouse.py` - ClickHouse analytics store
- `src/temporallayr/core/fingerprint.py` - Trace fingerprinting
- `src/temporallayr/core/failure_cluster.py` - Failure clustering
- `workers/ingest_worker.py` - Redis queue worker
- `tests/integration/` - Integration tests
- `dashboard/` - React dashboard

## Database Connections

- ClickHouse: Uses `clickhouse-connect` library
- Redis: For queue-based ingestion
- PostgreSQL: For persistent storage (optional)

## Development Workflow

1. Create a new branch for each feature/fix
2. Make changes with clear commit messages
3. Run linting and tests before committing
4. Push and create pull request
5. Use the PR template for changelog entries

## Useful Commands

```bash
# Run all tests
pytest

# Run specific test file
pytest tests/integration/test_clickhouse_ingest.py

# Run dashboard tests
cd dashboard && npm run test

# Type check
mypy src

# Format code
ruff --fix .
black .
```

## Performance Considerations

- Use bulk inserts for ClickHouse (via `bulk_insert_traces`)
- Batch processing in workers (QUEUE_BATCH_SIZE, FLUSH_INTERVAL)
- Index design: partition by tenant_id + month, order by tenant_id + trace_id

## Monitoring

- Health checks at `/status/services`
- Prometheus metrics at `/metrics`
- Uptime events stored in ClickHouse

## Important Environment Variables

- `TEMPORALLAYR_REDIS_URL` - Redis connection
- `TEMPORALLAYR_CLICKHOUSE_HOST` - ClickHouse host
- `TEMPORALLAYR_API_KEYS` - API key authentication
- `TEMPORALLAYR_POSTGRES_DSN` - PostgreSQL connection (optional)
