---
name: Performance issue
description: Report a performance problem or regression
labels: performance
body:
  - type: markdown
    attributes:
      value: |
        Thanks for reporting a performance issue! Please provide as much detail as possible.
  - type: textarea
    attributes:
      label: Performance issue description
      description: A clear description of the performance problem.
    validations:
      required: true
  - type: input
    attributes:
      label: Version
      description: Which version of TemporalLayr are you using?
      placeholder: e.g., 0.2.0
  - type: textarea
    attributes:
      label: Expected performance
      description: What performance did you expect?
  - type: textarea
    attributes:
      label: Actual performance
      description: |
        What is the actual performance? Include any metrics:
        - Requests per second
        - Latency (p50, p95, p99)
        - Memory usage
        - CPU usage
  - type: textarea
    attributes:
      label: Steps to reproduce
      description: How can we reproduce this?
  - type: textarea
    attributes:
      label: Environment
      description: |
        - Deployment method (Docker, Kubernetes, etc.)
        - Resources (CPU, RAM)
        - Database (PostgreSQL, ClickHouse, etc.)
        - Load pattern
