import psycopg2

print("Connecting psycopg2...")
try:
    conn = psycopg2.connect(
        "postgresql://koyeb-adm:193JovlIfzBq@ep-delicate-meadow-a2j10a08.eu-central-1.pg.koyeb.app/koyebdb?sslmode=require",
        connect_timeout=5,
    )
    print("Connected!")
    cur = conn.cursor()
    cur.execute("SELECT data FROM executions LIMIT 1")
    row = cur.fetchone()
    print("Row len:", len(str(row)))
    conn.close()
except Exception as e:
    print("Error:", e)
