import factory

from apps.users.models import User


class UserFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = User
        skip_postgeneration_save = True

    email = factory.Sequence(lambda n: f"user{n}@example.com")
    display_name = factory.Sequence(lambda n: f"Test User {n}")
    email_verified = True

    @factory.post_generation
    def password(self, create, extracted, **kwargs):
        self.set_password(extracted or "TestPass123!")
        if create:
            self.save()
