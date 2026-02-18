"""
Unified LangChain LLM Factory — Single interface for all providers.
Fallback chain: Bedrock → Gemini (free) → Claude → OpenAI → Mock

Usage:
    llm, name = get_llm()              # best available
    llm, name = get_llm("bedrock")     # force a specific provider
    providers  = get_available_providers()
"""
import os
from typing import Optional, Tuple, List, Dict

from langchain_core.language_models import BaseChatModel
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage


# ── Helpers ────────────────────────────────────────────────────

def _has_key(env_var: str) -> bool:
    val = os.getenv(env_var, "")
    return bool(val and not val.startswith("your-") and val.strip() != "")


# ── Provider Factories (lazy imports) ─────────────────────────

def _make_bedrock() -> Optional[BaseChatModel]:
    if not _has_key("AWS_ACCESS_KEY_ID"):
        return None
    try:
        import boto3
        from langchain_aws import ChatBedrockConverse

        session = boto3.Session(
            aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
            aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
            region_name=os.getenv("AWS_REGION", "us-east-1"),
        )
        bedrock_client = session.client("bedrock-runtime")

        return ChatBedrockConverse(
            model=os.getenv("BEDROCK_MODEL", "anthropic.claude-3-sonnet-20240229-v1:0"),
            client=bedrock_client,
            max_tokens=1024,
        )
    except Exception as e:
        print(f"[LLM] Bedrock init failed: {e}")
        return None


def _make_gemini() -> Optional[BaseChatModel]:
    if not _has_key("GOOGLE_API_KEY"):
        return None
    try:
        from langchain_google_genai import ChatGoogleGenerativeAI
        model = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")
        return ChatGoogleGenerativeAI(
            model=model,
            google_api_key=os.getenv("GOOGLE_API_KEY"),
            temperature=0.7,
            max_output_tokens=1000,
        )
    except Exception as e:
        print(f"[LLM] Gemini init failed: {e}")
        return None


def _make_claude() -> Optional[BaseChatModel]:
    if not _has_key("ANTHROPIC_API_KEY"):
        return None
    try:
        from langchain_anthropic import ChatAnthropic
        return ChatAnthropic(
            model="claude-haiku-4-5-20251001",
            anthropic_api_key=os.getenv("ANTHROPIC_API_KEY"),
            max_tokens=1024,
        )
    except Exception as e:
        print(f"[LLM] Claude init failed: {e}")
        return None


def _make_openai() -> Optional[BaseChatModel]:
    if not _has_key("OPENAI_API_KEY"):
        return None
    try:
        from langchain_openai import ChatOpenAI
        return ChatOpenAI(
            model="gpt-4o-mini",
            api_key=os.getenv("OPENAI_API_KEY"),
            temperature=0.7,
            max_tokens=800,
        )
    except Exception as e:
        print(f"[LLM] OpenAI init failed: {e}")
        return None


# Priority: Bedrock → Gemini → Claude → OpenAI
_PROVIDER_CHAIN = [
    ("bedrock", _make_bedrock),
    ("gemini",  _make_gemini),
    ("claude",  _make_claude),
    ("openai",  _make_openai),
]

_llm_cache: Dict[str, BaseChatModel] = {}


# ── Public API ────────────────────────────────────────────────

def get_llm(preferred: Optional[str] = None) -> Tuple[Optional[BaseChatModel], str]:
    """Return (model, provider_name).  Falls through the chain until one works."""
    preferred = preferred or os.getenv("PREFERRED_LLM_PROVIDER", "").strip()

    # Try preferred provider first
    if preferred:
        for name, factory in _PROVIDER_CHAIN:
            if name == preferred:
                if name not in _llm_cache:
                    instance = factory()
                    if instance:
                        _llm_cache[name] = instance
                if name in _llm_cache:
                    return _llm_cache[name], name

    # Fallback chain
    for name, factory in _PROVIDER_CHAIN:
        if name not in _llm_cache:
            instance = factory()
            if instance:
                _llm_cache[name] = instance
        if name in _llm_cache:
            return _llm_cache[name], name

    return None, "mock"


def get_all_available() -> List[Tuple[BaseChatModel, str]]:
    """Return every available LLM in priority order (for fallback in reason node)."""
    result = []
    for name, factory in _PROVIDER_CHAIN:
        if name not in _llm_cache:
            instance = factory()
            if instance:
                _llm_cache[name] = instance
        if name in _llm_cache:
            result.append((_llm_cache[name], name))
    return result


def get_available_providers() -> dict:
    """Status dict consumed by the /provider endpoint."""
    status: Dict[str, object] = {}
    for name, factory in _PROVIDER_CHAIN:
        try:
            instance = factory()
            status[f"{name}_active"] = instance is not None
        except Exception:
            status[f"{name}_active"] = False

    _, active = get_llm()
    status["active_provider"] = active
    status["vision_available"] = _has_key("GOOGLE_API_KEY") or _has_key("OPENAI_API_KEY")
    return status


# ── Message Building ──────────────────────────────────────────

def build_messages(
    system_prompt: str,
    message: str,
    history: list,
    data_context: str = "",
    guideline_context: str = "",
    knowledge_context: str = "",
) -> list:
    """Assemble a LangChain message list from raw inputs."""
    system = system_prompt
    if guideline_context:
        system += f"\n\nRELEVANT GUIDELINES:\n{guideline_context}"
    if knowledge_context:
        system += f"\n\nSIMILAR PAST CASES:\n{knowledge_context}"
    if data_context:
        system += f"\n\nDATABASE CONTEXT (use this real data in your response):\n{data_context}"

    messages = [SystemMessage(content=system)]
    for msg in history[-20:]:
        if msg["role"] == "user":
            messages.append(HumanMessage(content=msg["content"]))
        else:
            messages.append(AIMessage(content=msg["content"]))
    messages.append(HumanMessage(content=message))
    return messages


def build_mock_response(message: str, data_context: str, guideline_context: str) -> str:
    """Smart mock that surfaces real data without an LLM."""
    parts = []
    if data_context:
        parts.append(data_context.strip())
    if guideline_context:
        parts.append("\n**Relevant Guidelines:**")
        parts.append(guideline_context[:600])
    if parts:
        result = "\n".join(parts)
        result += "\n\n*For AI-powered insights, set a Google API key (free) or AWS Bedrock credentials in backend/.env*"
        return result
    return (
        "I'm **RiskMind**. Try asking:\n"
        "- \"Analyze COMM-2024-001\"\n"
        "- \"Show me the claims overview\"\n"
        "- \"Which policies are high risk?\"\n"
        "- \"What's the portfolio breakdown by industry?\"\n\n"
        "*Set `GOOGLE_API_KEY` or AWS Bedrock credentials in backend/.env for full AI capabilities*"
    )
