try:
    from .procrastinate_app import app as procrastinate_app
    __all__ = ('procrastinate_app',)
except (ImportError, Exception):
    # procrastinate/psycopg may not be available in all environments (e.g. local
    # makemigrations runs without libpq installed).  The worker and the full
    # Docker stack will always have the library present.
    pass
