from django.urls import path

from . import views

urlpatterns = [
    path("register", views.RegisterView.as_view(), name="register"),
    path("login", views.LoginView.as_view(), name="login"),
    path("refresh", views.RefreshView.as_view(), name="refresh"),
    path("logout", views.LogoutView.as_view(), name="logout"),
    path("verify-email", views.VerifyEmailView.as_view(), name="verify-email"),
    path(
        "verify-email/code",
        views.VerifyEmailCodeView.as_view(),
        name="verify-email-code",
    ),
    path(
        "resend-verification",
        views.ResendVerificationView.as_view(),
        name="resend-verification",
    ),
    path(
        "password-reset/request",
        views.PasswordResetRequestView.as_view(),
        name="password-reset-request",
    ),
    path(
        "password-reset/confirm",
        views.PasswordResetConfirmView.as_view(),
        name="password-reset-confirm",
    ),
    path("ws-ticket", views.WsTicketView.as_view(), name="ws-ticket"),
]
