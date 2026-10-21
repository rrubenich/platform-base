"""Every agent the service runs, checked as a whole when it's assembled.

A registry that would misbehave at runtime (a delegate that doesn't
exist, a delegation loop, a member agent reaching a platform agent) fails
here, at import time, so the tests and the service's startup catch it.
"""

from collections.abc import Iterable, Iterator

from .agent import Agent


class RegistryError(ValueError):
    pass


class Registry:
    def __init__(self, agents: Iterable[Agent]) -> None:
        self._agents: dict[str, Agent] = {}
        for agent in agents:
            if agent.name in self._agents:
                raise RegistryError(f"two agents are named {agent.name!r}")
            self._agents[agent.name] = agent
        for agent in self._agents.values():
            self._check_delegates(agent)
        self._check_acyclic()

    def get(self, name: str) -> Agent:
        try:
            return self._agents[name]
        except KeyError:
            raise KeyError(f"no agent named {name!r}") from None

    def __contains__(self, name: object) -> bool:
        return name in self._agents

    def __iter__(self) -> Iterator[Agent]:
        return iter(self._agents.values())

    def names(self) -> list[str]:
        return list(self._agents)

    def _check_delegates(self, agent: Agent) -> None:
        names = [*agent.sync_delegates, *agent.background_delegates]
        if len(names) != len(set(names)):
            raise RegistryError(f"{agent.name!r} lists a delegate twice")
        for name in names:
            if name == agent.name:
                raise RegistryError(f"{agent.name!r} delegates to itself")
            if name not in self._agents:
                raise RegistryError(f"{agent.name!r} delegates to unknown {name!r}")
            target = self._agents[name]
            # Delegating extends who can reach the target: a member agent
            # must never open a platform (superadmin) agent to members.
            if target.audience != agent.audience:
                raise RegistryError(
                    f"{agent.name!r} ({agent.audience}) can't delegate to "
                    f"{name!r} ({target.audience})"
                )
        for name in agent.background_delegates:
            if "job" not in self._agents[name].modes:
                raise RegistryError(
                    f"{agent.name!r} starts {name!r} in the background, "
                    f"but {name!r} doesn't run jobs"
                )

    def _check_acyclic(self) -> None:
        done: set[str] = set()

        def visit(name: str, path: list[str]) -> None:
            if name in path:
                loop = " -> ".join([*path[path.index(name) :], name])
                raise RegistryError(f"delegation loop: {loop}")
            if name in done:
                return
            agent = self._agents[name]
            for target in [*agent.sync_delegates, *agent.background_delegates]:
                visit(target, [*path, name])
            done.add(name)

        for name in self._agents:
            visit(name, [])
