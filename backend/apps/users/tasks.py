from celery import shared_task
from django.conf import settings
from django.core.mail import send_mail


@shared_task
def send_verification_email(user_id: str, uidb64: str, token: str):
    from .models import User

    try:
        user = User.objects.get(pk=user_id)
    except User.DoesNotExist:
        return

    link = f"{settings.FRONTEND_URL}/verify-email?uid={uidb64}&token={token}"
    send_mail(
        subject="Verify your SheyiHub email",
        message=f"Hi {user.display_name},\n\nVerify your email: {link}\n\nThis link expires in 24 hours.",
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
    send_mail(
        subject="Reset your SheyiHub password",
        message=f"Hi {user.display_name},\n\nReset your password: {link}\n\nThis link expires in 1 hour. "
        "If you didn't request this, you can ignore this email.",
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[user.email],
    )
