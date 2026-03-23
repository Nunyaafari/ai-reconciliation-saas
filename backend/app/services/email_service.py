import logging
import smtplib
from email.message import EmailMessage
from email.utils import formataddr
from urllib.parse import urlencode

from app.config import settings

logger = logging.getLogger(__name__)


class EmailService:
    """Simple SMTP-backed email delivery service."""

    def is_configured(self) -> bool:
        return bool(settings.SMTP_HOST and settings.SMTP_FROM_EMAIL)

    def build_password_reset_url(self, *, email: str, token: str) -> str:
        query = urlencode(
            {
                "mode": "reset",
                "reset_email": email,
                "reset_token": token,
            }
        )
        return f"{settings.FRONTEND_APP_URL.rstrip('/')}/?{query}"

    def send_password_reset_email(
        self,
        *,
        recipient_email: str,
        recipient_name: str | None,
        reset_url: str,
        raw_token: str,
        expires_minutes: int,
    ) -> None:
        if not self.is_configured():
            raise RuntimeError("SMTP is not configured")

        app_name = settings.APP_NAME
        greeting_name = recipient_name or "there"
        from_header = formataddr((settings.SMTP_FROM_NAME, settings.SMTP_FROM_EMAIL or ""))

        plain_body = (
            f"Hi {greeting_name},\n\n"
            f"We received a request to reset your {app_name} password.\n\n"
            f"Use this link to continue:\n{reset_url}\n\n"
            f"If the link does not open properly, use this reset token instead:\n{raw_token}\n\n"
            f"This link and token expire in {expires_minutes} minutes.\n"
            f"If you did not request this, you can safely ignore this email.\n"
        )

        html_body = f"""
        <html>
          <body style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.6;">
            <p>Hi {greeting_name},</p>
            <p>We received a request to reset your <strong>{app_name}</strong> password.</p>
            <p>
              <a
                href="{reset_url}"
                style="display:inline-block;padding:12px 18px;background:#0f172a;color:#ffffff;text-decoration:none;border-radius:10px;font-weight:600;"
              >
                Reset Password
              </a>
            </p>
            <p>If the button does not work, use this link:</p>
            <p><a href="{reset_url}">{reset_url}</a></p>
            <p>If you need the token manually, use:</p>
            <pre style="padding:12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;">{raw_token}</pre>
            <p>This link and token expire in {expires_minutes} minutes.</p>
            <p>If you did not request this, you can safely ignore this email.</p>
          </body>
        </html>
        """

        message = EmailMessage()
        message["Subject"] = f"Reset your {app_name} password"
        message["From"] = from_header
        message["To"] = recipient_email
        message.set_content(plain_body)
        message.add_alternative(html_body, subtype="html")

        self._send_message(message)

    def _send_message(self, message: EmailMessage) -> None:
        smtp: smtplib.SMTP | smtplib.SMTP_SSL
        if settings.SMTP_USE_SSL:
            smtp = smtplib.SMTP_SSL(
                settings.SMTP_HOST,
                settings.SMTP_PORT,
                timeout=settings.SMTP_TIMEOUT_SECONDS,
            )
        else:
            smtp = smtplib.SMTP(
                settings.SMTP_HOST,
                settings.SMTP_PORT,
                timeout=settings.SMTP_TIMEOUT_SECONDS,
            )

        with smtp:
            if not settings.SMTP_USE_SSL and settings.SMTP_USE_STARTTLS:
                smtp.starttls()

            if settings.SMTP_USERNAME:
                smtp.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD or "")

            smtp.send_message(message)
            logger.info(
                "Email sent successfully",
                extra={
                    "event": "notification.email.sent",
                    "recipient": message["To"],
                    "subject": message["Subject"],
                },
            )


email_service = EmailService()
