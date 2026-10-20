"""Who is calling, from the JWT apps/api signs for every request.

apps/api checks the user's session and organization membership, then signs
a short-lived EdDSA token naming them. This service only holds the public
key, so it can verify tokens but never mint one.
"""

from typing import Annotated

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .config import Settings, get_settings
from .jobs import Caller

ISSUER = "platform-base-api"
AUDIENCE = "platform-base-agents"
# Tolerated clock drift between the two services, in seconds.
LEEWAY = 10

_bearer = HTTPBearer(auto_error=False)


def verify_token(token: str, settings: Settings) -> Caller:
    """The caller the token names; raises `jwt.InvalidTokenError` otherwise."""
    claims = jwt.decode(
        token,
        settings.agents_jwt_public_key,
        algorithms=["EdDSA"],
        audience=AUDIENCE,
        issuer=ISSUER,
        leeway=LEEWAY,
        options={"require": ["exp", "iat", "sub", "org"]},
    )
    user_id, organization_id = claims["sub"], claims["org"]
    if not isinstance(organization_id, str) or not user_id or not organization_id:
        raise jwt.InvalidTokenError("sub and org must be non-empty strings")
    return Caller(user_id=user_id, organization_id=organization_id)


def get_caller(
    settings: Annotated[Settings, Depends(get_settings)],
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> Caller:
    if credentials is None:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            "Missing bearer token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        return verify_token(credentials.credentials, settings)
    except jwt.InvalidTokenError as error:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            "Invalid token",
            headers={"WWW-Authenticate": "Bearer"},
        ) from error


CallerDep = Annotated[Caller, Depends(get_caller)]
