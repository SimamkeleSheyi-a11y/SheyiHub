class SecurityHeadersMiddleware:
    """Small headers not currently covered by Django's SecurityMiddleware."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        response.setdefault(
            "Permissions-Policy",
            "camera=(self), microphone=(self), display-capture=(self), "
            "geolocation=(), payment=(), usb=()",
        )
        return response
