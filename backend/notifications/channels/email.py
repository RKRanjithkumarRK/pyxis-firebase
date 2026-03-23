"""Email channel — SendGrid delivery."""
from __future__ import annotations

import logging

logger = logging.getLogger(__name__)


async def deliver_email(
    to: str,
    subject: str,
    html_body: str,
    text_body: str = "",
) -> dict:
    """Send a transactional email via SendGrid."""
    from core.config import get_settings
    settings = get_settings()

    if not settings.sendgrid_api_key:
        logger.warning("SendGrid not configured — skipping email to %s", to)
        return {"status": "skipped", "reason": "no_api_key"}

    try:
        import sendgrid
        from sendgrid.helpers.mail import Mail, Content, To

        sg = sendgrid.SendGridAPIClient(api_key=settings.sendgrid_api_key)
        message = Mail(
            from_email=settings.sendgrid_from_email,
            to_emails=to,
            subject=subject,
            html_content=html_body,
        )
        if text_body:
            message.add_content(Content("text/plain", text_body))

        response = sg.send(message)
        logger.info("Email sent to %s status=%s", to, response.status_code)
        return {"status": "sent", "status_code": response.status_code}

    except Exception as exc:
        logger.error("Email delivery failed to %s: %s", to, exc)
        raise
