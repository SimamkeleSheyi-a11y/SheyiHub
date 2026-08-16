from celery import shared_task
from django.conf import settings
from django.core.mail import send_mail
from django.utils.html import escape


@shared_task
def send_verification_code_email(user_id: str, code: str):
    from .models import User

    try:
        user = User.objects.get(pk=user_id)
    except User.DoesNotExist:
        return

    safe_name = escape(user.display_name)
    safe_code = escape(code)
    ttl_minutes = max(1, int(getattr(settings, "EMAIL_VERIFICATION_CODE_TTL", 600)) // 60)

    text_message = (
        f"Hi {user.display_name},\n\n"
        f"Your SheyiHub verification code is: {code}\n\n"
        f"This code expires in {ttl_minutes} minutes.\n"
        "If you did not create a SheyiHub account, you can ignore this email."
    )

    html_message = f"""
    <div style="margin:0;padding:32px;background:#070916;color:#f7f7ff;
                font-family:Arial,Helvetica,sans-serif">
      <div style="max-width:520px;margin:0 auto;padding:32px;border-radius:20px;
                  border:1px solid #30265c;background:#10142b">
        <div style="font-size:24px;font-weight:700;margin-bottom:24px">
          <span style="display:inline-block;background:#754cff;color:#fff;
                       width:36px;height:36px;line-height:36px;text-align:center;
                       border-radius:10px;margin-right:10px">S</span>
          SheyiHub
        </div>
        <h1 style="font-size:24px;margin:0 0 12px">Verify your email</h1>
        <p style="color:#aeb4d3;line-height:1.6;margin:0 0 22px">
          Hi {safe_name}, enter this code in SheyiHub to finish creating your account.
        </p>
        <div style="letter-spacing:10px;font-size:34px;font-weight:700;text-align:center;
                    padding:20px;border-radius:14px;background:#0a0d20;
                    border:1px solid #473685;color:#c2a8ff">
          {safe_code}
        </div>
        <p style="color:#7f87a9;font-size:13px;line-height:1.6;margin:22px 0 0">
          This code expires in {ttl_minutes} minutes. Never share this code with anyone.
        </p>
      </div>
    </div>
    """

    return send_mail(
        subject="Verify your SheyiHub email",
        message=text_message,
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[user.email],
        html_message=html_message,
    )


# Kept for backwards compatibility with verification links already issued
# before the six-digit-code rollout.
@shared_task
def send_verification_email(user_id: str, uidb64: str, token: str):
    from .models import User

    try:
        user = User.objects.get(pk=user_id)
    except User.DoesNotExist:
        return

    link = f"{settings.FRONTEND_URL}/verify-email?uid={uidb64}&token={token}"
    return send_mail(
        subject="Verify your SheyiHub email",
        message=(
            f"Hi {user.display_name},\n\nVerify your email: {link}\n\n"
            "This link expires in 24 hours."
        ),
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[user.email],
    )


@shared_task
def send_password_reset_email(user_id: str, uidb64: str, token: str):
    from .models import User

    try:
        user = User.objects.get(pk=user_id)
    except User.DoesNotExist:
        return

    link = f"{settings.FRONTEND_URL}/reset-password?uid={uidb64}&token={token}"
    return send_mail(
        subject="Reset your SheyiHub password",
        message=(
            f"Hi {user.display_name},\n\nReset your password: {link}\n\n"
            "This link expires in 1 hour. "
            "If you didn't request this, you can ignore this email."
        ),
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[user.email],
    )
