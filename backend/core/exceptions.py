from rest_framework.views import exception_handler


def api_exception_handler(exc, context):
    """
    Wraps DRF's default handler so every error response has the same shape:
        {"detail": "...", "code": "..."}
    instead of DRF's default (which varies: a string, a list, or a dict
    depending on the exception type). Makes frontend error handling uniform.
    """
    response = exception_handler(exc, context)
    if response is None:
        return None

    detail = response.data
    if isinstance(detail, dict) and "detail" in detail and len(detail) == 1:
        # Already the shape we want (e.g. NotAuthenticated, PermissionDenied)
        response.data = {
            "detail": str(detail["detail"]),
            "code": getattr(exc, "default_code", "error"),
        }
    else:
        # Validation errors etc. come back as {"field": ["msg"]} — keep the
        # field-level detail but add a top-level summary too.
        response.data = {
            "detail": "Validation failed." if response.status_code == 400 else "Request failed.",
            "code": getattr(exc, "default_code", "error"),
            "errors": detail,
        }
    return response
