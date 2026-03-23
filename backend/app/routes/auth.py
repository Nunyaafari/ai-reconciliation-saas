import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.database.models import Organization, User
from app.dependencies.auth import get_admin_user, get_current_organization, get_current_user
from app.schemas import (
    AuthSessionResponse,
    ChangePasswordRequest,
    CreateUserRequest,
    LoginRequest,
    OrganizationResponse,
    PasswordResetConfirmRequest,
    PasswordResetRequest,
    PasswordResetResponse,
    RegisterRequest,
    UserResponse,
)
from app.services.audit_service import audit_service
from app.services.auth_service import auth_service
from app.services.email_service import email_service

router = APIRouter(prefix="/api/auth", tags=["Authentication"])
logger = logging.getLogger(__name__)


@router.post("/register", response_model=AuthSessionResponse)
async def register(
    payload: RegisterRequest,
    db: Session = Depends(get_db),
):
    """Create a tenant admin account and sign them in."""
    email = payload.email.lower().strip()
    existing_user = db.query(User).filter(User.email == email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="An account with this email already exists")

    requested_slug = (payload.organization_slug or "").strip().lower()
    if requested_slug:
        existing_org = (
            db.query(Organization).filter(Organization.slug == requested_slug).first()
        )
        if existing_org and existing_org.users:
            raise HTTPException(status_code=400, detail="Organization slug is already in use")
        organization = existing_org
        organization_slug = requested_slug
    else:
        inferred_slug = auth_service.generate_unique_slug(payload.organization_name, db)
        organization = (
            db.query(Organization).filter(Organization.slug == inferred_slug).first()
        )
        organization_slug = inferred_slug

    if organization is None:
        organization = Organization(
            name=payload.organization_name.strip(),
            slug=organization_slug,
            email=email,
        )
        db.add(organization)
        db.flush()
    else:
        organization.name = payload.organization_name.strip()
        organization.email = email

    user = User(
        org_id=organization.id,
        email=email,
        name=payload.name.strip(),
        password_hash=auth_service.hash_password(payload.password),
        role="admin",
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(organization)
    db.refresh(user)

    access_token, expires_in_seconds = auth_service.create_access_token(user)
    logger.info(
        "Registered new tenant admin",
        extra={
            "event": "auth.registered",
            "org_id": str(organization.id),
            "user_id": str(user.id),
            "email": email,
        },
    )
    audit_service.log(
        db=db,
        org_id=organization.id,
        actor_user_id=user.id,
        action="auth.registered",
        entity_type="user",
        entity_id=str(user.id),
        metadata={"email": email, "role": user.role},
    )
    return AuthSessionResponse(
        access_token=access_token,
        expires_in_seconds=expires_in_seconds,
        user=UserResponse.model_validate(user),
        organization=OrganizationResponse.model_validate(organization),
    )


@router.post("/login", response_model=AuthSessionResponse)
async def login(
    payload: LoginRequest,
    db: Session = Depends(get_db),
):
    """Authenticate a user and return a bearer token."""
    user = auth_service.authenticate_user(payload.email, payload.password, db)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    organization = db.query(Organization).filter(Organization.id == user.org_id).first()
    if not organization:
        raise HTTPException(status_code=404, detail="Organization not found")

    access_token, expires_in_seconds = auth_service.create_access_token(user)
    logger.info(
        "User logged in",
        extra={
            "event": "auth.logged_in",
            "org_id": str(organization.id),
            "user_id": str(user.id),
            "email": user.email,
        },
    )
    audit_service.log(
        db=db,
        org_id=organization.id,
        actor_user_id=user.id,
        action="auth.logged_in",
        entity_type="user",
        entity_id=str(user.id),
        metadata={"email": user.email},
    )
    return AuthSessionResponse(
        access_token=access_token,
        expires_in_seconds=expires_in_seconds,
        user=UserResponse.model_validate(user),
        organization=OrganizationResponse.model_validate(organization),
    )


@router.get("/me", response_model=AuthSessionResponse)
async def me(
    current_user: User = Depends(get_current_user),
    current_org: Organization = Depends(get_current_organization),
):
    """Return the current authenticated session context."""
    access_token, expires_in_seconds = auth_service.create_access_token(current_user)
    return AuthSessionResponse(
        access_token=access_token,
        expires_in_seconds=expires_in_seconds,
        user=UserResponse.model_validate(current_user),
        organization=OrganizationResponse.model_validate(current_org),
    )


@router.get("/users", response_model=list[UserResponse])
async def list_users(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List users in the current organization."""
    users = (
        db.query(User)
        .filter(User.org_id == current_user.org_id)
        .order_by(User.created_at.asc())
        .all()
    )
    return [UserResponse.model_validate(user) for user in users]


@router.post("/users", response_model=UserResponse)
async def create_user(
    payload: CreateUserRequest,
    admin_user: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    """Admin-only: create another user inside the same tenant."""
    email = payload.email.lower().strip()
    existing_user = db.query(User).filter(User.email == email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="An account with this email already exists")

    user = User(
        org_id=admin_user.org_id,
        email=email,
        name=payload.name.strip(),
        password_hash=auth_service.hash_password(payload.password),
        role=payload.role,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    logger.info(
        "Created org user",
        extra={
            "event": "auth.user_created",
            "org_id": str(admin_user.org_id),
            "created_by_user_id": str(admin_user.id),
            "user_id": str(user.id),
            "role": user.role,
            "email": user.email,
        },
    )
    audit_service.log(
        db=db,
        org_id=admin_user.org_id,
        actor_user_id=admin_user.id,
        action="auth.user_created",
        entity_type="user",
        entity_id=str(user.id),
        metadata={"email": user.email, "role": user.role},
    )
    return UserResponse.model_validate(user)


@router.post("/change-password", response_model=PasswordResetResponse)
async def change_password(
    payload: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Authenticated password change for the current user."""
    if not auth_service.verify_password(payload.current_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    auth_service.set_password(current_user, payload.new_password, db)
    audit_service.log(
        db=db,
        org_id=current_user.org_id,
        actor_user_id=current_user.id,
        action="auth.password_changed",
        entity_type="user",
        entity_id=str(current_user.id),
    )
    return PasswordResetResponse(
        status="success",
        message="Password updated successfully",
    )


@router.post("/password-reset/request", response_model=PasswordResetResponse)
async def request_password_reset(
    payload: PasswordResetRequest,
    db: Session = Depends(get_db),
):
    """Issue a short-lived password reset token and email it when SMTP is configured."""
    email = payload.email.lower().strip()
    user = db.query(User).filter(User.email == email).first()
    if not user or not user.is_active:
        return PasswordResetResponse(
            status="accepted",
            message="If that email exists, a password reset email has been sent.",
        )

    reset_token, raw_token = auth_service.create_password_reset(user=user, db=db)
    delivery_method = "local_token"

    if email_service.is_configured():
        try:
            email_service.send_password_reset_email(
                recipient_email=user.email,
                recipient_name=user.name,
                reset_url=email_service.build_password_reset_url(
                    email=user.email,
                    token=raw_token,
                ),
                raw_token=raw_token,
                expires_minutes=settings.PASSWORD_RESET_TOKEN_EXPIRE_MINUTES,
            )
            delivery_method = "email"
        except Exception as exc:
            logger.exception("Failed to send password reset email")
            if settings.is_production:
                raise HTTPException(
                    status_code=503,
                    detail="Password reset email could not be sent right now",
                ) from exc

    audit_service.log(
        db=db,
        org_id=user.org_id,
        actor_user_id=user.id,
        action="auth.password_reset_requested",
        entity_type="password_reset_token",
        entity_id=str(reset_token.id),
        metadata={"email": user.email, "delivery_method": delivery_method},
    )
    return PasswordResetResponse(
        status="accepted",
        message=(
            "If that email exists, a password reset email has been sent."
            if delivery_method == "email"
            else "SMTP is not configured locally yet, so the reset token is shown here."
        ),
        reset_token=raw_token if delivery_method != "email" and not settings.is_production else None,
    )


@router.post("/password-reset/confirm", response_model=PasswordResetResponse)
async def confirm_password_reset(
    payload: PasswordResetConfirmRequest,
    db: Session = Depends(get_db),
):
    """Complete a password reset using a valid reset token."""
    reset_token = auth_service.get_valid_password_reset(raw_token=payload.token, db=db)
    if not reset_token:
        raise HTTPException(status_code=400, detail="Password reset token is invalid or expired")

    user = db.query(User).filter(User.id == reset_token.user_id).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=404, detail="User account not found")

    auth_service.set_password(user, payload.new_password, db)
    auth_service.mark_password_reset_used(reset_token, db)
    audit_service.log(
        db=db,
        org_id=user.org_id,
        actor_user_id=user.id,
        action="auth.password_reset_completed",
        entity_type="user",
        entity_id=str(user.id),
    )
    return PasswordResetResponse(
        status="success",
        message="Password reset completed successfully",
    )
