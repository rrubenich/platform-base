"""Every agent, one package each: its definition (`agent.py`) and whatever
else only it uses live in its folder.

Registering an agent here is all it takes to serve it: the platform mounts
its routes (`/v1/agents/<name>/...`), runs its jobs on the worker, builds
its delegation tools and lists it in LangGraph Studio.
"""

from ..platform import Registry
from . import assistant, docs

REGISTRY = Registry([assistant.agent, docs.agent])
