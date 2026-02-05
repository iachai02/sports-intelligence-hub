"""add room tables and multi-user support

Revision ID: a1b2c3d4e5f6
Revises: 5d751b19e16d
Create Date: 2026-02-05 18:00:00.000000

"""

import secrets
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "a1b2c3d4e5f6"
down_revision: str | None = "5d751b19e16d"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# Safe alphabet for friend codes (no 0/O, 1/I/L)
_SAFE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"


def _generate_friend_code(length: int = 6) -> str:
    return "".join(secrets.choice(_SAFE_ALPHABET) for _ in range(length))


def _column_exists(conn: sa.Connection, table: str, column: str) -> bool:
    result = conn.execute(
        sa.text(
            "SELECT 1 FROM information_schema.columns "
            "WHERE table_name = :table AND column_name = :column"
        ),
        {"table": table, "column": column},
    )
    return result.scalar() is not None


def _table_exists(conn: sa.Connection, table: str) -> bool:
    result = conn.execute(
        sa.text(
            "SELECT 1 FROM information_schema.tables "
            "WHERE table_name = :table AND table_schema = 'public'"
        ),
        {"table": table},
    )
    return result.scalar() is not None


def upgrade() -> None:
    conn = op.get_bind()

    # --- Create room_members table first (DraftPick FK depends on it) ---
    if not _table_exists(conn, "room_members"):
        op.create_table(
            "room_members",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("session_id", sa.Integer(), nullable=False),
            sa.Column("user_id", sa.Integer(), nullable=True),
            sa.Column("team_name", sa.String(length=100), nullable=False),
            sa.Column("team_order", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("is_phantom", sa.Boolean(), nullable=False, server_default="false"),
            sa.Column("budget_total", sa.Integer(), nullable=True),
            sa.Column("joined_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.ForeignKeyConstraint(
                ["session_id"], ["draft_sessions.id"], ondelete="CASCADE"
            ),
            sa.ForeignKeyConstraint(
                ["user_id"], ["users.id"], ondelete="SET NULL"
            ),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("session_id", "user_id", name="uq_room_member_session_user"),
        )

    # --- Create room_activity_log table ---
    if not _table_exists(conn, "room_activity_log"):
        op.create_table(
            "room_activity_log",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("session_id", sa.Integer(), nullable=False),
            sa.Column("user_id", sa.Integer(), nullable=True),
            sa.Column("action_type", sa.String(length=30), nullable=False),
            sa.Column(
                "payload",
                postgresql.JSONB(astext_type=sa.Text()),
                nullable=True,
            ),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.ForeignKeyConstraint(
                ["session_id"], ["draft_sessions.id"], ondelete="CASCADE"
            ),
            sa.ForeignKeyConstraint(
                ["user_id"], ["users.id"], ondelete="SET NULL"
            ),
            sa.PrimaryKeyConstraint("id"),
        )

    # --- Add new columns to draft_sessions ---
    if not _column_exists(conn, "draft_sessions", "friend_code"):
        op.add_column(
            "draft_sessions",
            sa.Column("friend_code", sa.String(length=8), nullable=True),
        )

    if not _column_exists(conn, "draft_sessions", "draft_format"):
        op.add_column(
            "draft_sessions",
            sa.Column(
                "draft_format",
                sa.String(length=20),
                nullable=False,
                server_default="auction",
            ),
        )

    # --- Add drafter_member_id to draft_picks ---
    if not _column_exists(conn, "draft_picks", "drafter_member_id"):
        op.add_column(
            "draft_picks",
            sa.Column("drafter_member_id", sa.Integer(), nullable=True),
        )
        op.create_foreign_key(
            "fk_draft_picks_drafter_member",
            "draft_picks",
            "room_members",
            ["drafter_member_id"],
            ["id"],
            ondelete="SET NULL",
        )

    # --- Data migration: backfill existing sessions ---
    # Only backfill sessions that don't have a friend_code yet
    sessions = conn.execute(
        sa.text("SELECT id, user_id FROM draft_sessions WHERE friend_code IS NULL")
    ).fetchall()

    # Generate unique friend codes for each existing session
    existing_codes = conn.execute(
        sa.text("SELECT friend_code FROM draft_sessions WHERE friend_code IS NOT NULL")
    ).fetchall()
    used_codes: set[str] = {row[0] for row in existing_codes}

    for session in sessions:
        code = _generate_friend_code()
        while code in used_codes:
            code = _generate_friend_code()
        used_codes.add(code)

        # Set friend_code
        conn.execute(
            sa.text("UPDATE draft_sessions SET friend_code = :code WHERE id = :sid"),
            {"code": code, "sid": session[0]},
        )

        # Create a RoomMember for the session owner (if not already exists)
        existing_member = conn.execute(
            sa.text(
                "SELECT 1 FROM room_members WHERE session_id = :sid AND user_id = :uid"
            ),
            {"sid": session[0], "uid": session[1]},
        ).scalar()
        if not existing_member:
            conn.execute(
                sa.text(
                    "INSERT INTO room_members (session_id, user_id, team_name, team_order, is_phantom, joined_at) "
                    "VALUES (:sid, :uid, :name, 0, false, now())"
                ),
                {"sid": session[0], "uid": session[1], "name": "My Team"},
            )

    # Now make friend_code NOT NULL and add unique constraint
    op.alter_column("draft_sessions", "friend_code", nullable=False)

    # Only create constraint if it doesn't exist
    constraint_exists = conn.execute(
        sa.text(
            "SELECT 1 FROM information_schema.table_constraints "
            "WHERE constraint_name = 'uq_draft_sessions_friend_code'"
        )
    ).scalar()
    if not constraint_exists:
        op.create_unique_constraint("uq_draft_sessions_friend_code", "draft_sessions", ["friend_code"])


def downgrade() -> None:
    # Drop FK constraint on draft_picks
    op.drop_constraint("fk_draft_picks_drafter_member", "draft_picks", type_="foreignkey")
    op.drop_column("draft_picks", "drafter_member_id")

    # Drop new columns from draft_sessions
    op.drop_constraint("uq_draft_sessions_friend_code", "draft_sessions", type_="unique")
    op.drop_column("draft_sessions", "draft_format")
    op.drop_column("draft_sessions", "friend_code")

    # Drop new tables
    op.drop_table("room_activity_log")
    op.drop_table("room_members")
