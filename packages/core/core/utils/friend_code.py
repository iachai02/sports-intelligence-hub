"""Friend code generation for draft rooms."""

import secrets

# Alphabet excluding ambiguous characters: 0/O, 1/I/L
_SAFE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"


def generate_friend_code(length: int = 6) -> str:
    """Generate a random alphanumeric friend code.

    Uses a safe alphabet that excludes visually ambiguous characters
    (0/O, 1/I/L) to reduce user confusion when sharing codes.

    Args:
        length: Number of characters in the code (default 6).

    Returns:
        Random code like "XK7M2P".
    """
    return "".join(secrets.choice(_SAFE_ALPHABET) for _ in range(length))
