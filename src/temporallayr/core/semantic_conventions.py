"""
OpenInference semantic conventions — inlined from:
  https://github.com/Arize-ai/openinference/tree/main/python/openinference-semantic-conventions

No external dependency. We own this. Update by diffing upstream and copying constants.
"""


# ── Span kinds ────────────────────────────────────────────────────────
class SpanKind:
    AGENT = "AGENT"
    CHAIN = "CHAIN"
    TOOL = "TOOL"
    LLM = "LLM"
    RETRIEVER = "RETRIEVER"
    RERANKER = "RERANKER"
    EMBEDDING = "EMBEDDING"
    GUARDRAIL = "GUARDRAIL"
    EVALUATOR = "EVALUATOR"


# ── Top-level span attributes ─────────────────────────────────────────
class SpanAttributes:
    # Core
    OPENINFERENCE_SPAN_KIND = "openinference.span.kind"
    INPUT_VALUE = "input.value"
    INPUT_MIME_TYPE = "input.mime_type"
    OUTPUT_VALUE = "output.value"
    OUTPUT_MIME_TYPE = "output.mime_type"
    METADATA = "metadata"
    TAG_TAGS = "tag.tags"

    # Session / user
    SESSION_ID = "session.id"
    USER_ID = "user.id"

    # LLM
    LLM_MODEL_NAME = "llm.model_name"
    LLM_TOKEN_COUNT_PROMPT = "llm.token_count.prompt"
    LLM_TOKEN_COUNT_COMPLETION = "llm.token_count.completion"
    LLM_TOKEN_COUNT_TOTAL = "llm.token_count.total"
    LLM_INVOCATION_PARAMETERS = "llm.invocation_parameters"
    LLM_PROVIDER = "llm.provider"
    LLM_SYSTEM = "llm.system"
    LLM_PROMPT_TEMPLATE_TEMPLATE = "llm.prompt_template.template"
    LLM_PROMPT_TEMPLATE_VARIABLES = "llm.prompt_template.variables"
    LLM_PROMPT_TEMPLATE_VERSION = "llm.prompt_template.version"

    # Messages (indexed: llm.input_messages.0.message.role etc.)
    LLM_INPUT_MESSAGES = "llm.input_messages"
    LLM_OUTPUT_MESSAGES = "llm.output_messages"

    # Tool
    TOOL_NAME = "tool.name"
    TOOL_DESCRIPTION = "tool.description"
    TOOL_PARAMETERS = "tool.parameters"

    # Retrieval
    RETRIEVAL_DOCUMENTS = "retrieval.documents"

    # Reranker
    RERANKER_INPUT_DOCUMENTS = "reranker.input_documents"
    RERANKER_OUTPUT_DOCUMENTS = "reranker.output_documents"
    RERANKER_QUERY = "reranker.query"
    RERANKER_MODEL_NAME = "reranker.model_name"
    RERANKER_TOP_K = "reranker.top_k"

    # Embedding
    EMBEDDING_MODEL_NAME = "embedding.model_name"
    EMBEDDING_EMBEDDINGS = "embedding.embeddings"

    # Document (nested)
    DOCUMENT_ID = "document.id"
    DOCUMENT_CONTENT = "document.content"
    DOCUMENT_SCORE = "document.score"
    DOCUMENT_METADATA = "document.metadata"

    # Message (nested)
    MESSAGE_ROLE = "message.role"
    MESSAGE_CONTENT = "message.content"
    MESSAGE_TOOL_CALLS = "message.tool_calls"
    MESSAGE_FUNCTION_CALL_NAME = "message.function_call_name"
    MESSAGE_FUNCTION_CALL_ARGS = "message.function_call_arguments_json"

    # Tool call (nested)
    TOOL_CALL_FUNCTION_NAME = "tool_call.function.name"
    TOOL_CALL_FUNCTION_ARGUMENTS = "tool_call.function.arguments"

    # Exception
    EXCEPTION_TYPE = "exception.type"
    EXCEPTION_MESSAGE = "exception.message"
    EXCEPTION_ESCAPED = "exception.escaped"
    EXCEPTION_STACKTRACE = "exception.stacktrace"


# ── MIME types ────────────────────────────────────────────────────────
class MimeType:
    TEXT = "text/plain"
    JSON = "application/json"


# ── Status codes (mirrors OTEL) ───────────────────────────────────────
class OpenInferenceStatusCode:
    OK = "OK"
    ERROR = "ERROR"
