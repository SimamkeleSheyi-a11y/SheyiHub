from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from .models import User


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    model = User
    list_display = ("email", "display_name", "email_verified", "is_staff", "is_active", "created_at")
    list_filter = ("email_verified", "is_staff", "is_active", "theme_preference")
    search_fields = ("email", "display_name")
    ordering = ("-created_at",)
    readonly_fields = ("id", "created_at")

    # AbstractBaseUser has no username/first_name/last_name — redefine the
    # fieldsets DjangoUserAdmin assumes exist.
    fieldsets = (
        (None, {"fields": ("email", "password")}),
        ("Profile", {"fields": ("display_name", "avatar_url", "theme_preference", "email_verified")}),
        ("Permissions", {"fields": ("is_active", "is_staff", "is_superuser", "groups", "user_permissions")}),
        ("Important dates", {"fields": ("created_at",)}),
    )
    add_fieldsets = (
        (None, {"classes": ("wide",), "fields": ("email", "display_name", "password1", "password2")}),
    )
