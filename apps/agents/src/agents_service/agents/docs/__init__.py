"""Docs assistant for the platform's administrators (token scope `docs`),
answering from the repository's Markdown docs. See `agent.py`.
"""

from .agent import agent

__all__ = ["agent"]
