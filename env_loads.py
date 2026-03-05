import os

import clickhouse_connect
from dotenv import load_dotenv

# Load variables from the .env file into the environment
load_dotenv()

if __name__ == "__main__":
    client = clickhouse_connect.get_client(
        host=os.getenv("TEMPORALLAYR_CLICKHOUSE_HOST"),
        user=os.getenv("CLICKHOUSE_USER", "default"),
        password=os.getenv("CLICKHOUSE_PASSWORD"),
        # Convert the string "True" from .env into a boolean
        secure=os.getenv("CLICKHOUSE_SECURE", "True").lower() == "true",
    )

    print("Result:", client.query("SELECT 1").result_set[0][0])
