"""The chat model every agent runs on, chosen by configuration alone.

`LLM_MODEL` is a LangChain `"<provider>:<model>"` id, e.g. `openai:gpt-5.5`
or `anthropic:claude-opus-5-5`. Switching providers means changing that
variable and installing the provider's integration (`uv add
langchain-anthropic`); agents never import a provider SDK themselves.
"""

from functools import lru_cache

from langchain.chat_models import init_chat_model
from langchain_core.language_models import BaseChatModel


@lru_cache
def chat_model(model_id: str) -> BaseChatModel:
    # Built on first use rather than at startup, so the service (and its
    # health check) still comes up when the provider's API key is missing.
    # Each integration reads its own key from the env (OPENAI_API_KEY, ...).
    return init_chat_model(model_id)
