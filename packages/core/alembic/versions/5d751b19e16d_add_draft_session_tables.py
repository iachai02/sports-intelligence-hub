"""add draft session tables

Revision ID: 5d751b19e16d
Revises:
Create Date: 2026-02-05 12:08:23.534191

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "5d751b19e16d"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "draft_sessions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("league_type", sa.String(length=20), nullable=False),
        sa.Column("budget_total", sa.Integer(), nullable=False),
        sa.Column("roster_size", sa.Integer(), nullable=False),
        sa.Column("num_teams", sa.Integer(), nullable=False),
        sa.Column("season", sa.String(length=10), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "draft_picks",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("session_id", sa.Integer(), nullable=False),
        sa.Column("player_id", sa.String(length=50), nullable=False),
        sa.Column("purchase_price", sa.Float(), nullable=False),
        sa.Column("suggested_price", sa.Float(), nullable=True),
        sa.Column("slot", sa.String(length=10), nullable=True),
        sa.Column("pick_order", sa.Integer(), nullable=True),
        sa.Column("picked_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(
            ["session_id"], ["draft_sessions.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("session_id", "player_id"),
    )
    op.create_table(
        "session_preferences",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("session_id", sa.Integer(), nullable=False),
        sa.Column("scoring_mode", sa.String(length=20), nullable=False),
        sa.Column("position_filter", sa.String(length=10), nullable=True),
        sa.Column("min_cost", sa.Integer(), nullable=True),
        sa.Column("max_cost", sa.Integer(), nullable=True),
        sa.Column("min_fpts", sa.Float(), nullable=True),
        sa.Column("max_fpts", sa.Float(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(
            ["session_id"], ["draft_sessions.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("session_id"),
    )
    op.create_table(
        "skipped_players",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("session_id", sa.Integer(), nullable=False),
        sa.Column("player_id", sa.String(length=50), nullable=False),
        sa.Column("skip_reason", sa.String(length=50), nullable=True),
        sa.Column(
            "recommendation_context",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
        sa.Column("skipped_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(
            ["session_id"], ["draft_sessions.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "taken_players",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("session_id", sa.Integer(), nullable=False),
        sa.Column("player_id", sa.String(length=50), nullable=False),
        sa.Column("marked_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(
            ["session_id"], ["draft_sessions.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("session_id", "player_id"),
    )


def downgrade() -> None:
    op.drop_table("taken_players")
    op.drop_table("skipped_players")
    op.drop_table("session_preferences")
    op.drop_table("draft_picks")
    op.drop_table("draft_sessions")
