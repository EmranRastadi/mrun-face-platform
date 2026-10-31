from enum import Enum
from typing import Callable, Optional

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel

from .config import settings


class Role(str, Enum):
    ADMIN = "admin"
    OPERATOR = "operator"
    VIEWER = "viewer"


class CurrentUser(BaseModel):
    sub: int
    username: str
    role: Role


bearer_scheme = HTTPBearer(auto_error=False)


def _unauthorized(detail: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
) -> CurrentUser:
    if credentials is None:
        raise _unauthorized("Missing bearer token")
    if not settings.jwt_secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="JWT authentication is not configured",
        )

    try:
        payload = jwt.decode(
            credentials.credentials,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
            audience=settings.jwt_audience,
            issuer=settings.jwt_issuer,
        )
    except jwt.PyJWTError:
        raise _unauthorized("Invalid or expired token")

    raw_sub = payload.get("sub")
    if isinstance(raw_sub, bool):
        raise _unauthorized("Invalid token payload")
    try:
        sub = int(raw_sub)
    except (TypeError, ValueError):
        raise _unauthorized("Invalid token payload")

    username = payload.get("username")
    role = payload.get("role")
    if not username or role not in {item.value for item in Role}:
        raise _unauthorized("Invalid token payload")

    return CurrentUser(sub=sub, username=str(username), role=Role(role))


def require_roles(*roles: Role) -> Callable:
    async def role_checker(
        user: CurrentUser = Depends(get_current_user),
    ) -> CurrentUser:
        if user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions",
            )
        return user

    return role_checker
