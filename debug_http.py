import urllib.request, json
import time

print("Starting connection...")
try:
    req = urllib.request.Request(
        "https://cognitive-natalie-temporall-2ff73e17.koyeb.app/executions/sdk_test_trace_5",
        headers={
            "Authorization": "Bearer cuCTX6LiGtBmqP36BOenkvw_9Zot0W80henP2i0zmdw",
            "Accept": "application/json",
        },
    )
    with urllib.request.urlopen(req, timeout=10) as response:
        print("HTTP:", response.status)
        text = response.read().decode("utf-8")
        print("BODY SIZE:", len(text))
        print("BODY START:", text[:200])
except urllib.error.HTTPError as e:
    print("HTTP Error:", e.code)
    print("BODY:", e.read().decode("utf-8"))
except Exception as e:
    print("Error:", e)
