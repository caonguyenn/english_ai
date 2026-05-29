"""add_mock_test_session_type

Revision ID: f832686a04f7
Revises: 4dda205240cc
Create Date: 2026-05-29 06:55:51.176165

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f832686a04f7'
down_revision: Union[str, None] = '4dda205240cc'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ALTER TYPE ... ADD VALUE cannot run inside a transaction in Postgres.
    # op.execute uses the current connection which is in a transaction by default,
    # but Postgres 12+ supports this if the enum type has not been used in the
    # current transaction. Using IF NOT EXISTS makes it idempotent.
    op.execute("ALTER TYPE session_type_enum ADD VALUE IF NOT EXISTS 'mock_test'")


def downgrade() -> None:
    # Postgres does not support removing enum values — downgrade is a no-op.
    pass
