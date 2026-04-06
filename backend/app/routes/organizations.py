from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import logging
from typing import Optional

from app.config import settings
from app.database import get_db
from app.database.models import Organization
from app.dependencies.auth import get_admin_user, get_current_organization
from app.schemas import (
    OrganizationBootstrap,
    OrganizationCreate,
    OrganizationResponse,
    OrganizationUpdate,
)
from app.services.audit_service import audit_service

router = APIRouter(prefix="/api/orgs", tags=["Organizations"])
logger = logging.getLogger(__name__)


@router.post("", response_model=OrganizationResponse)
async def create_organization(
    payload: OrganizationCreate,
    db: Session = Depends(get_db),
):
    """Direct org creation is replaced by auth registration."""
    raise HTTPException(
        status_code=403,
        detail="Direct organization creation is disabled. Use /api/auth/register.",
    )


@router.post("/bootstrap", response_model=OrganizationResponse)
async def bootstrap_organization(
    payload: Optional[OrganizationBootstrap] = None,
    db: Session = Depends(get_db),
):
    """
    Fetch an existing org by slug or create a default one.
    Useful for local/dev to avoid manual seeding.
    """
    if not settings.is_development and not settings.AUTH_BOOTSTRAP_ENABLED:
        raise HTTPException(status_code=403, detail="Organization bootstrap is disabled")

    slug = (payload.slug if payload and payload.slug else "default-org")
    org = db.query(Organization).filter(Organization.slug == slug).first()
    if org:
        return OrganizationResponse.model_validate(org)

    name = payload.name if payload and payload.name else "Default Organization"
    email = payload.email if payload and payload.email else "admin@example.com"

    org = Organization(
        name=name,
        slug=slug,
        email=email,
    )
    db.add(org)
    db.commit()
    db.refresh(org)
    logger.info(f"Bootstrapped organization {org.id} ({org.slug})")
    return OrganizationResponse.model_validate(org)


@router.patch("/current", response_model=OrganizationResponse)
async def update_current_organization(
    payload: OrganizationUpdate,
    current_org: Organization = Depends(get_current_organization),
    admin_user=Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    """Update workspace-wide branding details that apply across reconciliations."""
    if payload.name is not None:
        normalized_name = payload.name.strip()
        if not normalized_name:
            raise HTTPException(status_code=400, detail="Workspace name cannot be blank")
        current_org.name = normalized_name

    if payload.company_address is not None:
        current_org.company_address = payload.company_address.strip() or None

    if payload.company_logo_data_url is not None:
        current_org.company_logo_data_url = payload.company_logo_data_url.strip() or None

    db.add(current_org)
    db.commit()
    db.refresh(current_org)

    audit_service.log(
        db=db,
        org_id=current_org.id,
        actor_user_id=admin_user.id,
        action="organization.updated",
        entity_type="organization",
        entity_id=str(current_org.id),
        metadata={
            "name": current_org.name,
            "has_company_address": bool(current_org.company_address),
            "has_company_logo": bool(current_org.company_logo_data_url),
        },
    )

    return OrganizationResponse.model_validate(current_org)
