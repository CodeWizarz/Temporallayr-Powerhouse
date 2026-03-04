import subprocess
import time
import urllib.request
import json
import os

env = os.environ.copy()
env["TEMPORALLAYR_API_KEYS"] = "dev-key-123=my-tenant"
env["TEMPORALLAYR_ADMIN_KEY"] = "admin-key-456"

print("Starting server...")
proc = subprocess.Popen(
    [
        "C:\\Users\\vickr\\AppData\\Local\\Python\\pythoncore-3.14-64\\python.exe",
        "-m",
        "uvicorn",
        "temporallayr.server.app:app",
        "--port",
        "8000",
    ],
    env=env,
    stdout=subprocess.PIPE,
    stderr=subprocess.PIPE,
)

time.sleep(4)

print("Testing Ingest...")
req = urllib.request.Request(
    "http://localhost:8000/v1/ingest",
    data=json.dumps({"events": [{"tenant_id": "my-tenant", "spans": []}]}).encode(),
    headers={
        "Authorization": "Bearer dev-key-123",
        "Content-Type": "application/json",
        "X-Tenant-Id": "my-tenant",
    },
    method="POST",
)
try:
    resp = urllib.request.urlopen(req)
    print("Ingest Success:", resp.read().decode())
except urllib.error.HTTPError as e:
    print("Ingest Error:", e.code, e.reason, e.read().decode())

proc.kill()
