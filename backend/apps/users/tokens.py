from django.contrib.auth.tokens import PasswordResetTokenGenerator


class EmailVerificationTokenGenerator(PasswordResetTokenGenerator):
    """
    Same signed-token approach Django uses for password reset, but the hash
    incorporates `email_verified` instead of the password — so a link becomes
    invalid the moment it's used once, without needing a separate DB table.
    """

    def _make_hash_value(self, user, timestamp):
        return f"{user.pk}{user.email}{user.email_verified}{timestamp}"


email_verification_token = EmailVerificationTokenGenerator()

# Django's built-in generator already incorporates password + last_login,
# so a reset link naturally invalidates itself once the password changes.
from django.contrib.auth.tokens import default_token_generator as password_reset_token  # noqa: E402,F401
