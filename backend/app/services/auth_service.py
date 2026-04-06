import hashlib
import re
import secrets
from datetime import datetime, timedelta, timezone
from uuid import UUID

import bcrypt
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.config import settings
from app.database.models import Organization, PasswordResetToken, User

class AuthService:
    """Password hashing and JWT session helpers."""

    HASH_PREFIX = "bcrypt_sha256$"

    def _normalized_password(self, password: str) -> bytes:
        return hashlib.sha256(password.encode("utf-8")).hexdigest().encode("utf-8")

    def hash_password(self, password: str) -> str:
        hashed = bcrypt.hashpw(self._normalized_password(password), bcrypt.gensalt())
        return f"{self.HASH_PREFIX}{hashed.decode('utf-8')}"

    def verify_password(self, plain_password: str, password_hash: str) -> bool:
        if not password_hash:
            return False

        normalized_password = self._normalized_password(plain_password)

        if password_hash.startswith(self.HASH_PREFIX):
            stored_hash = password_hash.removeprefix(self.HASH_PREFIX).encode("utf-8")
            return bcrypt.checkpw(normalized_password, stored_hash)

        if password_hash.startswith(("$2a$", "$2b$", "$2y$")):
            return bcrypt.checkpw(normalized_password, password_hash.encode("utf-8"))

        if password_hash.startswith("$bcrypt-sha256$"):
            try:
                from passlib.context import CryptContext

                legacy_context = CryptContext(
                    schemes=["bcrypt_sha256", "bcrypt"],
                    deprecated="auto",
                )
                return legacy_context.verify(plain_password, password_hash)
            except Exception:
                return False

        return False

    def set_password(self, user: User, new_password: str, db: Session) -> User:
        user.password_hash = self.hash_password(new_password)
        db.commit()
        db.refresh(user)
        return user

    def create_access_token(self, user: User) -> tuple[str, int]:
        expires_delta = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        expires_at = datetime.now(timezone.utc) + expires_delta
        payload = {
            "sub": str(user.id),
            "org_id": str(user.org_id),
            "email": user.email,
            "role": user.role,
            "exp": expires_at,
        }
        token = jwt.encode(
            payload,
            settings.JWT_SECRET_KEY,
            algorithm=settings.JWT_ALGORITHM,
        )
        return token, int(expires_delta.total_seconds())

    def decode_token(self, token: str) -> dict:
        return jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )

    def authenticate_user(
        self,
        email: str,
        password: str,
        db: Session,
    ) -> User | None:
        user = db.query(User).filter(User.email == email.lower().strip()).first()
        if not user or not user.is_active:
            return None
        if not self.verify_password(password, user.password_hash):
            return None
        return user

    def generate_unique_slug(self, base_value: str, db: Session) -> str:
        base_slug = re.sub(r"[^a-z0-9]+", "-", base_value.lower()).strip("-") or "org"
        slug = base_slug
        suffix = 1
        while db.query(Organization).filter(Organization.slug == slug).first():
            suffix += 1
            slug = f"{base_slug}-{suffix}"
        return slug

    def get_user_and_org_from_token(self, token: str, db: Session) -> tuple[User, Organization]:
        payload = self.decode_token(token)
        user_id = payload.get("sub")
        org_id = payload.get("org_id")
        if not user_id or not org_id:
            raise JWTError("Token missing required claims")

        user = db.query(User).filter(User.id == UUID(user_id)).first()
        org = db.query(Organization).filter(Organization.id == UUID(org_id)).first()
        if not user or not org or user.org_id != org.id or not user.is_active:
            raise JWTError("Authenticated user or organization not found")
        return user, org

    def generate_password_reset_token(self) -> str:
        return secrets.token_urlsafe(32)

    def hash_reset_token(self, token: str) -> str:
        return hashlib.sha256(token.encode("utf-8")).hexdigest()

    def create_password_reset(
        self,
        *,
        user: User,
        db: Session,
    ) -> tuple[PasswordResetToken, str]:
        raw_token = self.generate_password_reset_token()
        expires_at = datetime.now(timezone.utc) + timedelta(
            minutes=settings.PASSWORD_RESET_TOKEN_EXPIRE_MINUTES
        )
        reset_token = PasswordResetToken(
            org_id=user.org_id,
            user_id=user.id,
            token_hash=self.hash_reset_token(raw_token),
            expires_at=expires_at.replace(tzinfo=None),
        )
        db.add(reset_token)
        db.commit()
        db.refresh(reset_token)
        return reset_token, raw_token

    def get_valid_password_reset(
        self,
        *,
        raw_token: str,
        db: Session,
    ) -> PasswordResetToken | None:
        token_hash = self.hash_reset_token(raw_token)
        now = datetime.utcnow()
        return (
            db.query(PasswordResetToken)
            .filter(
                PasswordResetToken.token_hash == token_hash,
                PasswordResetToken.used_at.is_(None),
                PasswordResetToken.expires_at > now,
            )
            .order_by(PasswordResetToken.created_at.desc())
            .first()
        )

    def mark_password_reset_used(
        self,
        reset_token: PasswordResetToken,
        db: Session,
    ) -> PasswordResetToken:
        reset_token.used_at = datetime.utcnow()
        db.commit()
        db.refresh(reset_token)
        return reset_token


auth_service = AuthService()
