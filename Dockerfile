FROM python:3.11-slim

WORKDIR /app

# Install deps first (cache layer)
COPY pyproject.toml ./
COPY src/ ./src/
RUN pip install --no-cache-dir -e ".[clickhouse]"

COPY . .

# Non-root user
RUN useradd -m -u 1000 temporallayr && chown -R temporallayr:temporallayr /app
USER temporallayr

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')"

CMD ["uvicorn", "temporallayr.server.app:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
