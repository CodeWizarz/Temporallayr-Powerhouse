#!/usr/bin/env bash
set -euo pipefail

mkdir -p reports

{
  echo "PYTHONUNBUFFERED=1"
  echo "JUNIT_XML=reports/junit.xml"
  echo "COVERAGE_XML=reports/coverage.xml"
  echo "COVERAGE_RCFILE=coveragerc"
} >> "$GITHUB_ENV"
