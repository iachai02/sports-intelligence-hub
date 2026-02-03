"""Mock data generator for testing the draft optimizer.

Generates realistic NBA player projections based on position archetypes.
"""

import random
from typing import Literal

from draft_optimizer.features import calculate_player_projection
from draft_optimizer.schemas import PlayerProjection, Position

# Type alias for player tiers
PlayerTier = Literal["elite", "starter", "rotation", "bench"]

# Seed for reproducibility in tests
RANDOM_SEED = 42

# Player archetypes by position with stat ranges
# Format: (min, max) for each stat
POSITION_ARCHETYPES: dict[Position, dict[str, tuple[float, float]]] = {
    Position.PG: {
        "points": (8.0, 28.0),
        "rebounds": (2.5, 5.5),
        "assists": (4.0, 11.0),
        "steals": (0.5, 2.0),
        "blocks": (0.1, 0.5),
        "turnovers": (1.5, 4.0),
        "fg_pct": (0.40, 0.50),
        "ft_pct": (0.75, 0.92),
        "three_made": (1.0, 4.0),
    },
    Position.SG: {
        "points": (10.0, 30.0),
        "rebounds": (2.5, 5.0),
        "assists": (2.0, 7.0),
        "steals": (0.5, 1.8),
        "blocks": (0.1, 0.6),
        "turnovers": (1.2, 3.5),
        "fg_pct": (0.42, 0.52),
        "ft_pct": (0.78, 0.92),
        "three_made": (1.5, 4.5),
    },
    Position.SF: {
        "points": (8.0, 28.0),
        "rebounds": (3.5, 8.0),
        "assists": (1.5, 6.0),
        "steals": (0.5, 1.8),
        "blocks": (0.2, 1.0),
        "turnovers": (1.0, 3.0),
        "fg_pct": (0.43, 0.55),
        "ft_pct": (0.72, 0.88),
        "three_made": (0.8, 3.5),
    },
    Position.PF: {
        "points": (8.0, 26.0),
        "rebounds": (5.0, 12.0),
        "assists": (1.0, 5.0),
        "steals": (0.3, 1.2),
        "blocks": (0.3, 2.0),
        "turnovers": (1.0, 2.8),
        "fg_pct": (0.45, 0.58),
        "ft_pct": (0.65, 0.85),
        "three_made": (0.3, 2.5),
    },
    Position.C: {
        "points": (8.0, 25.0),
        "rebounds": (7.0, 14.0),
        "assists": (0.8, 4.5),
        "steals": (0.3, 1.0),
        "blocks": (0.8, 3.0),
        "turnovers": (1.0, 3.0),
        "fg_pct": (0.50, 0.65),
        "ft_pct": (0.55, 0.82),
        "three_made": (0.0, 1.5),
    },
}

# Sample player names by position (for realistic mock data)
SAMPLE_NAMES: dict[Position, list[str]] = {
    Position.PG: [
        "Trae Young", "Tyrese Haliburton", "Luka Doncic", "Ja Morant", "Shai Gilgeous-Alexander",
        "Darius Garland", "De'Aaron Fox", "Jalen Brunson", "Fred VanVleet", "Tyrese Maxey",
        "Cade Cunningham", "LaMelo Ball", "Dejounte Murray", "Chris Paul", "Kyrie Irving",
        "Mike Conley", "Malcolm Brogdon", "D'Angelo Russell", "Dennis Schroder", "Jalen Suggs",
        "Scoot Henderson", "Marcus Smart", "Kyle Lowry", "Lonzo Ball", "Jordan Poole",
        "Tre Jones", "Jose Alvarado", "Bones Hyland", "Ayo Dosunmu", "Immanuel Quickley",
    ],
    Position.SG: [
        "Devin Booker", "Donovan Mitchell", "Anthony Edwards", "Zach LaVine", "Bradley Beal",
        "CJ McCollum", "Tyler Herro", "Desmond Bane", "Anfernee Simons", "Jalen Green",
        "Bogdan Bogdanovic", "Gary Trent Jr.", "Buddy Hield", "Kevin Huerter", "Austin Reaves",
        "Malik Monk", "Coby White", "Josh Giddey", "Gradey Dick", "Brandin Podziemski",
        "Cam Thomas", "Quentin Grimes", "Josh Hart", "Max Strus", "Seth Curry",
        "Malik Beasley", "Tim Hardaway Jr.", "Terence Davis", "Bones Hyland", "Jaden Ivey",
    ],
    Position.SF: [
        "LeBron James", "Kevin Durant", "Jayson Tatum", "Jimmy Butler", "Kawhi Leonard",
        "Paul George", "Brandon Ingram", "Khris Middleton", "Mikal Bridges", "OG Anunoby",
        "Michael Porter Jr.", "Franz Wagner", "Scottie Barnes", "Deni Avdija", "Herb Jones",
        "Keldon Johnson", "Harrison Barnes", "Andrew Wiggins", "Bojan Bogdanovic", "Gordon Hayward",
        "Kyle Kuzma", "Cam Johnson", "Jalen Williams", "Aaron Gordon", "Dorian Finney-Smith",
        "Saddiq Bey", "Patrick Williams", "Trey Murphy III", "Keegan Murray", "Jabari Smith Jr.",
    ],
    Position.PF: [
        "Giannis Antetokounmpo", "Jaylen Brown", "Zion Williamson", "Julius Randle", "Pascal Siakam",
        "Lauri Markkanen", "Domantas Sabonis", "John Collins", "Jerami Grant", "Tobias Harris",
        "Jonathan Kuminga", "Jabari Smith Jr.", "Paolo Banchero", "Chet Holmgren", "Evan Mobley",
        "Jaren Jackson Jr.", "Kristaps Porzingis", "Zach Collins", "Obi Toppin", "Jalen Duren",
        "Marvin Bagley III", "Bobby Portis", "Kyle Anderson", "PJ Washington", "Grant Williams",
        "Naz Reid", "Isaiah Stewart", "Jabari Walker", "Tari Eason", "Keegan Murray",
    ],
    Position.C: [
        "Nikola Jokic", "Joel Embiid", "Anthony Davis", "Karl-Anthony Towns", "Bam Adebayo",
        "Rudy Gobert", "Jarrett Allen", "Myles Turner", "Brook Lopez", "Clint Capela",
        "Mitchell Robinson", "Ivica Zubac", "Jonas Valanciunas", "Nic Claxton", "Walker Kessler",
        "Mark Williams", "Alperen Sengun", "Wendell Carter Jr.", "Robert Williams III", "Deandre Ayton",
        "Mo Bamba", "Isaiah Hartenstein", "Daniel Gafford", "Jalen Smith", "Onyeka Okongwu",
        "Nick Richards", "Mason Plumlee", "Drew Eubanks", "Jaxson Hayes", "Precious Achiuwa",
    ],
}

# Team abbreviations
TEAMS = [
    "ATL", "BOS", "BKN", "CHA", "CHI", "CLE", "DAL", "DEN", "DET", "GSW",
    "HOU", "IND", "LAC", "LAL", "MEM", "MIA", "MIL", "MIN", "NOP", "NYK",
    "OKC", "ORL", "PHI", "PHX", "POR", "SAC", "SAS", "TOR", "UTA", "WAS",
]


def _generate_stats_for_position(
    position: Position,
    tier: PlayerTier,
    rng: random.Random,
) -> dict[str, float]:
    """Generate random stats based on position and player tier.

    Args:
        position: Player position
        tier: Player quality tier (affects stat multiplier)
        rng: Random number generator

    Returns:
        Dictionary of stat projections
    """
    archetypes = POSITION_ARCHETYPES[position]

    # Tier multipliers (elite players closer to max, bench closer to min)
    tier_multipliers = {
        "elite": (0.75, 1.0),
        "starter": (0.50, 0.80),
        "rotation": (0.25, 0.55),
        "bench": (0.0, 0.30),
    }
    low_mult, high_mult = tier_multipliers[tier]

    stats = {}
    for stat_name, (min_val, max_val) in archetypes.items():
        # Generate value within tier range
        range_size = max_val - min_val
        tier_min = min_val + range_size * low_mult
        tier_max = min_val + range_size * high_mult
        stats[stat_name] = round(rng.uniform(tier_min, tier_max), 1)

    return stats


def generate_mock_players(
    count: int = 150,
    seed: int | None = RANDOM_SEED,
    budget: float = 200.0,
    roster_size: int = 13,
) -> list[PlayerProjection]:
    """Generate a pool of mock NBA players with projections.

    Creates a realistic distribution of players by position and tier:
    - ~10% elite (stars)
    - ~25% starters
    - ~35% rotation players
    - ~30% bench players

    Args:
        count: Number of players to generate
        seed: Random seed for reproducibility (None for random)
        budget: Auction budget for value calculation
        roster_size: Roster size for value calculation

    Returns:
        List of PlayerProjection objects
    """
    rng = random.Random(seed)

    # Distribution of players per position
    players_per_position = count // 5
    extra = count % 5

    players: list[PlayerProjection] = []

    for i, position in enumerate(Position):
        # Add one extra player to first few positions if count not divisible by 5
        pos_count = players_per_position + (1 if i < extra else 0)

        # Get available names for this position
        available_names = SAMPLE_NAMES[position].copy()
        rng.shuffle(available_names)

        for j in range(pos_count):
            # Determine tier based on index (first players are better)
            tier: PlayerTier
            if j < pos_count * 0.10:
                tier = "elite"
            elif j < pos_count * 0.35:
                tier = "starter"
            elif j < pos_count * 0.70:
                tier = "rotation"
            else:
                tier = "bench"

            # Get name (cycle through if we need more than available)
            name = available_names[j % len(available_names)]
            if j >= len(available_names):
                name = f"{name} Jr."

            # Generate stats
            stats = _generate_stats_for_position(position, tier, rng)

            # Create player projection
            player = calculate_player_projection(
                player_id=f"player_{position.value}_{j:03d}",
                name=name,
                team=rng.choice(TEAMS),
                position=position.value,
                stats=stats,
                budget=budget,
                roster_size=roster_size,
            )
            players.append(player)

    # Shuffle to mix positions
    rng.shuffle(players)

    return players


def generate_mock_player(
    position: Position | str,
    tier: Literal["elite", "starter", "rotation", "bench"] = "starter",
    name: str | None = None,
    seed: int | None = None,
    budget: float = 200.0,
    roster_size: int = 13,
) -> PlayerProjection:
    """Generate a single mock player.

    Useful for testing specific scenarios.

    Args:
        position: Player position
        tier: Player quality tier
        name: Player name (auto-generated if None)
        seed: Random seed (None for random)
        budget: Auction budget for value calculation
        roster_size: Roster size for value calculation

    Returns:
        Single PlayerProjection
    """
    rng = random.Random(seed)

    if isinstance(position, str):
        position = Position(position)

    if name is None:
        name = rng.choice(SAMPLE_NAMES[position])

    stats = _generate_stats_for_position(position, tier, rng)

    return calculate_player_projection(
        player_id=f"player_{rng.randint(1000, 9999)}",
        name=name,
        team=rng.choice(TEAMS),
        position=position.value,
        stats=stats,
        budget=budget,
        roster_size=roster_size,
    )
