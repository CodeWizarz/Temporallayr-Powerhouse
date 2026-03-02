import certifi
import httpx

print(certifi.where())

r = httpx.get(
    "https://temporallayr-server-production.up.railway.app/health", verify=certifi.where()
)

print(r.status_code)
