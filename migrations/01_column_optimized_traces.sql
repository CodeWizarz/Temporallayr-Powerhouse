-- ClickHouse Column-Optimized Trace Schema
-- Optimized for high-throughput analytics queries

CREATE TABLE IF NOT EXISTS temporallayr_traces_columnar (
    tenant_id LowCardinality(String),
    trace_id String,
    node_name String,
    latency_ms Float64,
    tokens UInt32,
    cost Float64,
    timestamp DateTime64(3, 'UTC')
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (tenant_id, timestamp)
TTL timestamp + toIntervalDay(90)
SETTINGS index_granularity = 8192;
