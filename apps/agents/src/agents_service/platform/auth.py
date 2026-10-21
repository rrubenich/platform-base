"""Who is calling, from the JWT apps/api signs for every request.

apps/api checks the user's session and what they may do, then signs a
short-lived EdDSA token naming them and the agent it is calling (`scope`).
This service only holds the public key, so it can verify tokens but never
mint one.
"""

from collections.abc import Callable
from dataclasses import dataclass
from typing import Annotated

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from ..config import Settings, get_settings

ISSUER = "platform-base-api"
AUDIENCE = "platform-base-agents"
# Tolerated clock drift between the two services, in seconds.
LEEWAY = 10

_bearer = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class Caller:
    user_id: str
    # The user's active organization; absent for platform-level agents
    # (superadmins have none).
    organization_id: str | None
    # Agents apps/api allowed this call to reach, e.g. {"assistant"}.
    scopes: frozenset[str]


@dataclass(frozen=True)
class MemberCaller:
    """A caller acting inside an organization they belong to."""

    user_id: str
    organization_id: str


def _unauthorized(detail: str) -> HTTPException:
    return HTTPException(
        status.HTTP_401_UNAUTHORIZED, detail, headers={"WWW-Authenticate": "Bearer"}
    )


def verify_token(token: str, settings: Settings) -> Caller:
    """The caller the token names; raises `jwt.InvalidTokenError` otherwise."""
    claims = jwt.decode(
        token,
        settings.agents_jwt_public_key,
        algorithms=["EdDSA"],
        audience=AUDIENCE,
        issuer=ISSUER,
        leeway=LEEWAY,
        options={"require": ["exp", "iat", "sub", "scope"]},
    )
    user_id, organization_id, scope = claims["sub"], claims.get("org"), claims["scope"]
    if not user_id or not isinstance(scope, str):
        raise jwt.InvalidTokenError("sub and scope must be non-empty strings")
    if organization_id is not None and (
        not isinstance(organization_id, str) or not organization_id
    ):
        raise jwt.InvalidTokenError("org must be a non-empty string when present")
    return Caller(
        user_id=user_id,
        organization_id=organization_id,
        scopes=frozenset(scope.split()),
    )


def get_caller(
    settings: Annotated[Settings, Depends(get_settings)],
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> Caller:
    if credentials is None:
        raise _unauthorized("Missing bearer token")
    try:
        return verify_token(credentials.credentials, settings)
    except jwt.InvalidTokenError as error:
        raise _unauthorized("Invalid token") from error


CallerDep = Annotated[Caller, Depends(get_caller)]


def require_scope(scope: str) -> Callable[[Caller], Caller]:
    """A dependency letting through only tokens issued for `scope`."""

    def dependency(caller: CallerDep) -> Caller:
        if scope not in caller.scopes:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN, f"Token is not valid for {scope}"
            )
        return caller

    return dependency


def as_member(caller: Caller) -> MemberCaller:
    if caller.organization_id is None:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "No organization in token")
    return MemberCaller(user_id=caller.user_id, organization_id=caller.organization_id)
