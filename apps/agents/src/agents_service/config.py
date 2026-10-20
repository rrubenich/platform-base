from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Read from the environment (and `.env` in dev). See `.env.example`."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # PEM public key matching apps/api's AGENTS_JWT_PRIVATE_KEY; verifies the
    # token apps/api signs for each call (see auth.py).
    agents_jwt_public_key: str

    redis_url: str
    # Own arq queue name so jobs never collide with other keys in Redis Cloud.
    agents_queue_name: str = "agents:queue"
    # How long a finished job's result stays readable, in seconds.
    agents_job_result_ttl: int = 86_400

    # LangChain "<provider>:<model>" id, see llm.py. Provider API keys
    # (OPENAI_API_KEY, ANTHROPIC_API_KEY, ...) are read by the integrations.
    llm_model: str = "openai:gpt-5.5"


@lru_cache
def get_settings() -> Settings:
    return Settings()  # pyright: ignore[reportCallIssue]
