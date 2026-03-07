import asyncio
import temporallayr as tl


# 2. Simulate Data Fetch (Tool 1)
@tl.track_tool(name="fetch_customer_data")
async def fetch_customer_data(customer_id: str) -> dict:
    """Simulates fetching customer details from a database."""
    await asyncio.sleep(0.1)  # Simulate network latency
    return {"customer_id": customer_id, "tier": "enterprise", "query_limit": 5000}


# 3. Simulate RAG Search (Tool 2)
@tl.track_tool(name="search_knowledge_base")
async def search_knowledge_base(query: str) -> str:
    """Simulates vector search against enterprise documentation."""
    await asyncio.sleep(0.2)
    return "Enterprise tier includes advanced analytics, custom RBAC, and 99.99% uptime SLA."


# 4. Simulate LLM Reasoning
@tl.track_llm
async def generate_response(customer_data: dict, vector_context: str, user_query: str) -> dict:
    """Simulates an LLM chain blending context with a system prompt."""
    await asyncio.sleep(0.8)  # Simulate AI inference time

    # In a real app, you would call OpenAI/Anthropic/Cohere SDKs here.
    return {
        "output": f"Based on your {customer_data['tier']} plan limits, your SLA is 99.99%.",
        "model": "gpt-4o",
        "prompt_tokens": 142,
        "completion_tokens": 38,
        "total_tokens": 180,
    }


# 5. Main Agent Pipeline
@tl.track_pipeline
async def support_agent(customer_id: str, query: str) -> str:
    """The main entry point for the agent."""
    customer = await fetch_customer_data(customer_id)
    context = await search_knowledge_base(query)

    result = await generate_response(customer, context, query)
    return result["output"]


async def main():
    print("Running Autonomous Support Agent...")

    # 1. Initialize the SDK with your Koyeb backend (Must be inside an active async event loop)
    tl.init(
        server_url="https://cognitive-natalie-temporall-2ff73e17.koyeb.app",
        api_key="YOUR_API_KEY",
        tenant_id="temporallayr-prod",
    )

    # 2. Start the trace to isolate this execution graph context
    trace_id = tl.start_trace(trace_name="SupportAgentExecution")
    print(f"Tracking run under trace_id: {trace_id}")

    try:
        reply = await support_agent(customer_id="cust_892jxl", query="What is my uptime guarantee?")
        print(f"\nAgent Final Output:\n> {reply}\n")
    finally:
        # Ensure all telemetry is bundled and sent to Koyeb securely before exiting
        await tl.flush()
        await tl.shutdown()
        print("Trace successfully exported to TemporalLayr!")


if __name__ == "__main__":
    asyncio.run(main())
