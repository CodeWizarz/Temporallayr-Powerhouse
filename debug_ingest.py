import asyncio

import httpx


async def test_ingest():
    # Set a large timeout to see if Koyeb ever responds
    async with httpx.AsyncClient(verify=False, timeout=30.0) as client:
        print("Sending 500 JSON...")
        try:
            res2 = await client.post(
                "https://cognitive-natalie-temporall-2ff73e17.koyeb.app/v1/ingest",
                headers={"Authorization": "Bearer cuCTX6LiGtBmqP36BOenkvw_9Zot0W80henP2i0zmdw"},
                json={"events": []},
            )
            print(f"Empty events list: {res2.status_code} {res2.text}")
        except Exception as e:
            print(f"Exception: {e}")

        print("Sending actual graph JSON...")
        try:
            res3 = await client.post(
                "https://cognitive-natalie-temporall-2ff73e17.koyeb.app/v1/ingest",
                headers={"Authorization": "Bearer cuCTX6LiGtBmqP36BOenkvw_9Zot0W80henP2i0zmdw"},
                json={
                    "events": [
                        {
                            "type": "execution_graph",
                            "graph": {
                                "id": "test_id",
                                "trace_id": "test",
                                "tenant_id": "temporallayr-prod",
                                "nodes": [],
                            },
                        }
                    ]
                },
            )
            print(f"Actual graph events list: {res3.status_code} {res3.text}")
        except Exception as e:
            print(f"Exception: {e}")


asyncio.run(test_ingest())
