CREATE TABLE IF NOT EXISTS temporallayr_traces (
    tenant_id LowCardinality(String),
    trace_id String,
    start_time DateTime64(3, 'UTC'),
    end_time Nullable(DateTime64(3, 'UTC')),
    span_count UInt32,
    error_count UInt32,
    fingerprint Nullable(String),
    ingested_at DateTime64(3, 'UTC') DEFAULT now64(3)
) ENGINE = MergeTree()
PARTITION BY (tenant_id, toYYYYMM(start_time))
ORDER BY (tenant_id, trace_id, start_time)
TTL start_time + toIntervalDay(90)
SETTINGS index_granularity = 8192;

CREATE TABLE IF NOT EXISTS temporallayr_spans (
    tenant_id LowCardinality(String),
    trace_id String,
    span_id String,
    parent_span_id Nullable(String),
    name String,
    start_time DateTime64(3, 'UTC'),
    end_time Nullable(DateTime64(3, 'UTC')),
    duration_ms Nullable(Float64),
    status LowCardinality(String),
    error Nullable(String),
    fingerprint Nullable(String),
    input_keys Array(String),
    output_type LowCardinality(String),
    attributes String
) ENGINE = MergeTree()
PARTITION BY (tenant_id, toYYYYMM(start_time))
ORDER BY (tenant_id, trace_id, span_id, start_time)
TTL start_time + toIntervalDay(90)
SETTINGS index_granularity = 8192;

CREATE TABLE IF NOT EXISTS temporallayr_events (
    tenant_id LowCardinality(String),
    event_id String,
    trace_id String,
    span_id String,
    event_type LowCardinality(String),
    occurred_at DateTime64(3, 'UTC'),
    payload String
) ENGINE = MergeTree()
PARTITION BY (tenant_id, toYYYYMM(occurred_at))
ORDER BY (tenant_id, event_id, occurred_at)
TTL occurred_at + toIntervalDay(30)
SETTINGS index_granularity = 8192;

CREATE TABLE IF NOT EXISTS temporallayr_usage (
    tenant_id LowCardinality(String),
    usage_id String,
    trace_id String,
    usage_date Date,
    spans_ingested UInt32,
    error_spans UInt32,
    ingested_at DateTime64(3, 'UTC') DEFAULT now64(3)
) ENGINE = MergeTree()
PARTITION BY (tenant_id, toYYYYMM(usage_date))
ORDER BY (tenant_id, usage_date, usage_id)
TTL usage_date + toIntervalDay(365)
SETTINGS index_granularity = 8192;
