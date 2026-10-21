# Agents platform — design

Date: 2026-10-21 · Status: sections 1–3 approved in conversation; sections 4–5 decided under the instruction "take assumptions, quality first" · Branch: `feat/agents-platform`

## Goal

Give `apps/agents` a starting point for building many agents: one declaration per agent, agents that call each other, server-side conversation threads, a test harness that makes agent behavior checkable, and LangSmith tracing, evals and Studio. No channel and no domain integration is part of this: agents get domain capabilities through tools, added later.

## Decisions

| Topic | Decision |
|---|---|
| Agent definition | One declarative `Agent(...)` per agent; the platform derives routes, scope checks, jobs and delegation tools from it. Escape hatch: `graph=` factory for a custom `StateGraph`. |
| Agent-to-agent | In-process, through a registry. Declared `delegates` become `ask_<name>` tools (synchronous) or `start_<name>` tools (`background(...)`, enqueues a job). |
| Identity across calls | A delegate runs as the original caller (same user, organization). No new token. Access is extended in code by declaring a delegate. |
| Conversation memory | Server-side threads, LangGraph `AsyncPostgresSaver` on Neon, own `langgraph` schema, direct (unpooled) connection. |
| Thread ownership | Checkpoint key derived from the token: `{org or "platform"}:{user}:{agent}:{thread_id}`. No lookup table. |
| LangChain platform | Level (a): LangSmith tracing, evals and LangGraph Studio. Hosting stays on Railway; OTEL → Grafana stays. Prompts stay in git. |
| Channels, domain integrations | Out of scope. |

## 1. Defining an agent

```python
# agents/assistant/agent.py
agent = Agent(
    name="assistant",            # token scope, route segment, tool suffix: ^[a-z][a-z0-9_]*$
    description="...",           # shown to agents that delegate to it
    instructions=INSTRUCTIONS,   # or graph=<factory> for a custom StateGraph
    tools=[...],                 # @tool functions, or a callable (Settings) -> tools
    delegates=["other", background("reporter")],
    audience="member",           # "member": token must carry an org; "platform": none needed
    modes=frozenset({"chat", "job"}),
)
```

The `Agent` constructor validates itself: a valid name, a non-empty description, exactly one of `instructions`/`graph`, at least one mode.

Every graph is built with `context_schema=AgentContext` (`user_id`, `organization_id`, `agent`, `depth`). Tools read the caller from `ToolRuntime.context`, never from globals.

### Layout

```
src/agents_service/
  platform/
    agent.py        Agent, background(), AgentContext
    registry.py     Registry: unique names, delegates exist, same audience, background targets run jobs, no cycles
    runtime.py      Platform: definition → compiled graph (model, tools, delegate tools, checkpointer, run config)
    delegation.py   ask_<name> / start_<name> tools
    threads.py      thread keys, checkpointer factory, thread history
    chat.py         chat request + SSE events, stream_graph
    jobs.py         arq queue (generic run_agent job), per-organization visibility
    auth.py         JWT → Caller (unchanged behavior)
    routes.py       one generic router under /v1/agents/{agent}
  agents/
    __init__.py     REGISTRY = Registry([...])
    assistant/agent.py
    docs/agent.py, library.py
  testing.py        harness (section 4)
  studio.py         graphs for LangGraph Studio (section 5)
```

Adding an agent: write `agents/<name>/agent.py`, add it to `REGISTRY`, write its tests, and expose it from `apps/api` (a controller that decides who gets the scope and calls the generic `AgentsService` methods).

## 2. Agents calling agents

- For each synchronous delegate the runtime builds `ask_<name>(request: str) -> str`, with the delegate's `description` as the tool description. Calling it builds the delegate's graph (no checkpointer: a fresh, unsaved run) and returns its final text.
- `background("name")` builds `start_<name>(request: str) -> str`, which enqueues the delegate as a job for the same caller and returns the job id. The target must offer `"job"`.
- The delegate runs with the caller's context, `agent` set to itself and `depth + 1`. Beyond `MAX_DELEGATION_DEPTH = 3` the tool refuses. That's a backstop, since the registry already rejects cycles.
- Registry rules: delegates must exist, must not be the agent itself, must share its audience, and background targets must offer jobs. The delegation graph must be acyclic. Violations raise at import time, so a bad registry fails the test suite and the service won't boot.
- A delegate's failure becomes the tool result `"The <name> agent failed."`. The exception is logged, and the parent decides what to do next.
- Only the entry agent's text streams to the user. The delegation shows up as a `tool` event (`ask_<name>`). A regression test guards against delegate tokens leaking.
- LangSmith nests the delegate's run under the parent's tool call. The delegate run carries its own `agent` metadata.
- Structured (`input_schema`/`output_schema`) delegation is a follow-up. Text in, text out for now.

## 3. Threads, persistence, API

### Agents service (internal)

```
POST /v1/agents/{agent}/chat            { message, thread_id? } → SSE: thread{id}, delta*, tool*, done | error
GET  /v1/agents/{agent}/threads/{id}    → { id, messages: [{role, content}] }   404 if empty/unknown
POST /v1/agents/{agent}/jobs            { prompt } → 202 { id }
GET  /v1/agents/{agent}/jobs/{id}       → JobView   404 for other organizations
```

- `{agent}` is an enum of the registry's names in the OpenAPI schema, so `apps/api`'s generated types know every agent.
- Checks per request: token valid (401), scope equals `{agent}` (403), audience `member` requires `org` (403), and the mode is offered (404).
- `thread_id` matches `^[A-Za-z0-9_-]{1,64}$`, so it can't forge another key. If omitted, the service generates a UUID hex.
- Thread history returns user and assistant text only. Tool traffic and empty tool-call turns are left out.
- Jobs: one arq function `run_agent(agent, prompt, user_id, organization_id)`. `JobView.agent` is the agent name. Jobs are stateless (no thread). The member audience is required for jobs, because job visibility is per organization.

### Storage

- `AGENTS_DATABASE_URL`: Neon **direct** connection string. The service connects with `search_path=langgraph`. When it's unset, the service falls back to an in-memory saver and logs a warning at startup. That's for local dev and tests only. Production must set it, so the deploy docs say so.
- Tables come from the library's `setup()`, run by `bun run db:checkpoints` (idempotent, never at boot). This is the one documented exception to "Drizzle owns migrations"; Drizzle never touches the `langgraph` schema.
- Retention: kept indefinitely for now. **Follow-up:** a TTL/cleanup job before any channel carries sensitive or personal data.

### `apps/api` and `apps/web`

- `AgentsService` becomes generic: `chat(agent, subject, body, signal)`, `thread(agent, subject, id)`, `createJob(agent, ...)`, `getJob(agent, ...)`. The scope is the agent name.
- The controllers stay per agent (each one owns its access rule). New routes: `GET /api/agents/assistant/threads/:id` and `GET /api/admin/docs-assistant/threads/:id`.
- The web docs-assistant sends `{message, thread_id}` and keeps the id from the `thread` event.
- `docs/routes.md` is updated in the same commit.

## 4. Test harness (quality)

The test suite has four layers. The first three run on every `bun run test` and use no network.

1. **Platform unit tests** (`tests/platform/`): definition validation, every registry rule, delegation (context propagation, depth limit, failure isolation, no token leak, background enqueue), thread key isolation, stream events, job queue visibility, route checks (401/403/404/422).
2. **Registry contract tests** (`tests/test_registry_contract.py`): parametrized over every registered agent, so a new agent is covered without writing anything. Each agent has to build with a scripted model, complete a chat and a job (when offered) through the HTTP routes, reject other scopes, enforce its audience, and expose exactly its declared delegate tools. Its thread history must survive a second turn.
3. **Agent behavior tests** (`tests/agents/<name>/`), written with `agents_service.testing`:
   - `ScriptedModel(reply("text"), call("tool", **args), ...)`: a fake chat model that supports tools, replays a script and records every request it received (messages and bound tool names). It fails loudly if it's called more times than scripted.
   - `AgentHarness(registry, models={name: ScriptedModel})`: runs any agent through the real platform (in-memory checkpointer, fake queue, chosen caller) and returns a `Transcript` with `text`, `events`, `tool_calls`, `thread_id` and the enqueued jobs.
4. **Evals** (`evals/`, `bun run eval`): real model, LangSmith's pytest integration (`@pytest.mark.langsmith`). Results land in LangSmith as experiments when `LANGSMITH_API_KEY` is set. Cases are skipped without a provider key, and evals are never part of `bun run test`. The starting cases:
   - assistant: replies in the user's language, admits uncertainty.
   - docs: uses its tools before answering, ends with a Sources list naming real files, declines off-topic questions.

   Checks are deterministic where possible (tool calls made, cited paths exist). Otherwise an LLM judge returns a structured pass/fail with its reasoning.

**Integration** (`tests/integration/`, marked `integration`): the Postgres checkpointer against a real database, in a throwaway schema created and dropped by the test. It only runs when `AGENTS_TEST_DATABASE_URL` is set, so CI and local runs without it skip it.

## 5. LangSmith and Studio

- Tracing is configured by environment only (`LANGSMITH_TRACING`, `LANGSMITH_API_KEY`, `LANGSMITH_PROJECT`, `LANGSMITH_ENDPOINT`), read by the `langsmith` package. Application code never imports a tracing client.
- Every run carries `run_name=<agent>`, tags `agent:<name>` and `entrypoint:chat|job|delegation`, and metadata `agent`, `organization_id`, `user_id`, `thread_id` (the public id). Delegated runs carry their own agent's metadata.
- Sensitive or personal data may flow through these traces later. `LANGSMITH_HIDE_INPUTS`/`LANGSMITH_HIDE_OUTPUTS` are documented as the way to redact content per environment. The tests force tracing off.
- `langgraph.json` + `studio.py` expose every registered agent to LangGraph Studio (`bun run studio`, which wraps `langgraph dev`). The graphs are built with the configured model and no checkpointer, since Studio provides its own. A test checks that `langgraph.json` lists exactly the registry.

## Implementation order

1. Platform package (agent, registry, runtime, delegation, threads, chat, jobs, routes) with its unit tests; move existing code.
2. Port `assistant` and `docs` to declarations; contract tests; harness.
3. LangSmith config, Studio, evals.
4. OpenAPI regeneration; `apps/api` generic service + thread routes + specs; web docs-assistant thread handling.
5. Docs: AGENTS.md agents section, `docs/routes.md`, `.env.example`s.

## Follow-ups (not in this change)

- Thread retention/TTL and thread listing.
- Structured delegation schemas.
- Seamless JWT key rotation (multiple `kid`s).
- Shared organization threads (several staff in one conversation).
