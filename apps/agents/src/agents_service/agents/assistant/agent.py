"""General-purpose assistant for organization members, and the reference
agent: instructions and tools, offered as chat and as background jobs.
"""

from typing import Any

from ...platform import Agent

# Kept byte-for-byte stable so it stays a cacheable prompt prefix.
INSTRUCTIONS = (
    "You are Platform Base's assistant. You help members of an organization with their "
    "work. Answer in the language the user writes in. Be concise and say so "
    "when you are unsure instead of guessing."
)

# LangChain tools (`@tool` functions) the assistant may call. Tools read who
# they run for from `runtime.context` (an AgentContext), never from globals.
TOOLS: list[Any] = []

agent = Agent(
    name="assistant",
    description=(
        "Platform Base's general assistant for members of an organization: answers "
        "questions and helps with their work."
    ),
    instructions=INSTRUCTIONS,
    tools=TOOLS,
    audience="member",
    modes=frozenset({"chat", "job"}),
)
