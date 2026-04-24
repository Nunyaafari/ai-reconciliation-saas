from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy.orm import Session

from app.database import get_db
from app.database.models import Organization, User
from app.services.auth_service import auth_service

bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    """Resolve the authenticated user from a bearer token."""
    if credentials is None or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )

    try:
        user, _ = auth_service.get_user_and_org_from_token(
            credentials.credentials,
            db,
        )
        return user
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid authentication token: {exc}",
        ) from exc


def get_current_organization(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Organization:
    organization = (
        db.query(Organization).filter(Organization.id == current_user.org_id).first()
    )
    if not organization:
        raise HTTPException(status_code=404, detail="Organization not found")
    return organization


def ensure_org_access(requested_org_id, current_user: User) -> None:
    if str(requested_org_id) != str(current_user.org_id):
        raise HTTPException(status_code=403, detail="Cross-tenant access denied")


def require_role(*allowed_roles: str):
    def dependency(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=403,
                detail=f"Requires one of roles: {', '.join(allowed_roles)}",
            )
        return current_user

    return dependency


def get_admin_user(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role not in {"admin", "super_admin"}:
        raise HTTPException(status_code=403, detail="Admin or super admin access required")
    return current_user


def get_super_admin_user(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    """
    Require super-admin privileges.

    Bootstrap fallback:
    if an organization has no super admin yet, allow an existing admin
    to perform this action so they can create/promote the first super admin.
    """
    if current_user.role == "super_admin":
        return current_user

    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Super admin access required")

    has_super_admin = (
        db.query(User)
        .filter(
            User.org_id == current_user.org_id,
            User.role == "super_admin",
            User.is_active.is_(True),
        )
        .first()
    )
    if has_super_admin:
        raise HTTPException(status_code=403, detail="Super admin access required")
    return current_user
