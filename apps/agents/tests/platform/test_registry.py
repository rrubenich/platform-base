import pytest

from agents_service.platform import Agent, Registry, RegistryError, background


def agent(name: str, **kwargs: object) -> Agent:
    return Agent(name=name, description=name, instructions=name, **kwargs)  # type: ignore[arg-type]


@pytest.mark.parametrize(
    ("agents", "message"),
    [
        ([agent("a"), agent("a")], "two agents are named 'a'"),
        ([agent("a", delegates=["ghost"])], "unknown 'ghost'"),
        ([agent("a", delegates=["a"])], "delegates to itself"),
        ([agent("a", delegates=["b", "b"]), agent("b")], "lists a delegate twice"),
        (
            [agent("a", delegates=["b"]), agent("b", audience="platform")],
            "can't delegate to 'b' \\(platform\\)",
        ),
        (
            [agent("a", audience="platform", delegates=["b"]), agent("b")],
            "can't delegate to 'b' \\(member\\)",
        ),
        (
            [agent("a", delegates=[background("b")]), agent("b")],
            "doesn't run jobs",
        ),
        (
            [
                agent("a", delegates=["b"]),
                agent("b", delegates=["c"]),
                agent("c", delegates=["a"]),
            ],
            "delegation loop: a -> b -> c -> a",
        ),
        (
            [
                agent("a", delegates=[background("b")]),
                agent("b", modes=frozenset({"job"}), delegates=["a"]),
            ],
            "delegation loop",
        ),
    ],
    ids=[
        "duplicate name",
        "unknown delegate",
        "self delegation",
        "duplicate delegate",
        "member to platform",
        "platform to member",
        "background without jobs",
        "loop",
        "loop through a background delegate",
    ],
)
def test_rejects_a_registry_that_would_misbehave(
    agents: list[Agent], message: str
) -> None:
    with pytest.raises(RegistryError, match=message):
        Registry(agents)


def test_accepts_shared_delegates_without_a_loop() -> None:
    registry = Registry(
        [
            agent("a", delegates=["b", "c"]),
            agent("b", delegates=["c"]),
            agent("c"),
        ]
    )

    assert registry.names() == ["a", "b", "c"]
    assert "b" in registry
    with pytest.raises(KeyError, match="no agent named 'z'"):
        registry.get("z")
