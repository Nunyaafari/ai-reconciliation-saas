from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
import logging
from typing import Optional

from app.database import get_db
from app.database.models import Organization
from app.schemas import OrganizationCreate, OrganizationResponse, OrganizationBootstrap

router = APIRouter(prefix="/api/orgs", tags=["Organizations"])
logger = logging.getLogger(__name__)


@router.post("", response_model=OrganizationResponse)
async def create_organization(
    payload: OrganizationCreate,
    db: Session = Depends(get_db),
):
    """Create a new organization."""
    org = Organization(
        name=payload.name,
        slug=payload.slug,
        email=payload.email,
    )
    db.add(org)
    db.commit()
    db.refresh(org)
    logger.info(f"Created organization {org.id} ({org.slug})")
    return OrganizationResponse.from_orm(org)


@router.post("/bootstrap", response_model=OrganizationResponse)
async def bootstrap_organization(
    payload: Optional[OrganizationBootstrap] = None,
    db: Session = Depends(get_db),
):
    """
    Fetch an existing org by slug or create a default one.
    Useful for local/dev to avoid manual seeding.
    """
    slug = (payload.slug if payload and payload.slug else "default-org")
    org = db.query(Organization).filter(Organization.slug == slug).first()
    if org:
        return OrganizationResponse.from_orm(org)

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
    return OrganizationResponse.from_orm(org)
