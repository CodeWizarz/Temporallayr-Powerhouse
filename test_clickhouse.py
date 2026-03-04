import clickhouse_connect

if __name__ == "__main__":
    client = clickhouse_connect.get_client(
        host="e5jkxaakfn.asia-northeast1.gcp.clickhouse.cloud",
        user="default",
        password="<password>",
        secure=True,
    )
    print("Result:", client.query("SELECT 1").result_set[0][0])

    result = client.command("SELECT version()")
    print("ClickHouse connected:", result)
