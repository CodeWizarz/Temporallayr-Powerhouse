FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY src/ src/
COPY workers/ workers/
ENV PYTHONPATH=/app/src
CMD ["python", "workers/ingest_worker.py"]
