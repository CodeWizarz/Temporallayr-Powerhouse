"""Patch PostgresStore to add an optional dsn __init__ parameter."""

from pathlib import Path

fpath = Path("src/temporallayr/core/store_postgres.py")
content = fpath.read_text(encoding="utf-8")

old = '    """\n\n    # \u2500'
new = '    """\n\n    def __init__(self, dsn: str | None = None) -> None:\n        if dsn is not None:\n            import os\n            os.environ["TEMPORALLAYR_POSTGRES_DSN"] = dsn\n\n    # \u2500'

if old in content:
    content = content.replace(old, new, 1)
    fpath.write_text(content, encoding="utf-8")
    print("Patched successfully")
else:
    # Try Windows line endings
    old_crlf = '    """\r\n\r\n    # \u2500'
    new_crlf = '    """\r\n\r\n    def __init__(self, dsn: str | None = None) -> None:\r\n        if dsn is not None:\r\n            import os\r\n            os.environ["TEMPORALLAYR_POSTGRES_DSN"] = dsn\r\n\r\n    # \u2500'
    if old_crlf in content:
        content = content.replace(old_crlf, new_crlf, 1)
        fpath.write_text(content, encoding="utf-8")
        print("Patched successfully (CRLF)")
    else:
        # Show the relevant section for debugging
        idx = content.find("class PostgresStore")
        print("Context around class:", repr(content[idx : idx + 200]))
        print("NOT FOUND - needs manual inspection")
