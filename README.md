# Sports Intelligence Hub

## What is it?

**Purpose**: The Sports Intelligence Hub is a website designed to take raw sports data and be able to express it in different ways.

There are many features that will be added to this website but here are the features as of 2/4/2026

- Draft Optimizer

## Draft Optimizer

### What is a Draft Optimizer?

A draft optimizer is a feature that will allow users to never have to study for their fantasy drafts. The feature will
take the players you are adding to your team (and players other people are taking) and give you a tailored list of players
to choose from that either benefit the stats you already have or the stats you lack in the most depending on the filters you assign.

As of right now, this feature focuses primarily on a standard 12 man, 9 category, $200 auction draft fantasy format for fantasy basketball,
but will expand to allow for different formats as well as different sports (football)

### Understanding the technical side of the Draft Optimizer

#### Layer 1: Data Foundation

**Purpose**: Fetches NBA data from the `nba_api` and gets the season averages to then feed to the next layer
**Flow**:

1. Fetches NBA data from API
2. Caches the data
3. Transforms the game logs into season averages

#### Layer 2: Database design

**Purpose**: Uses SQLAlchemy ORM models and PostgresSQL schema to form relationships between the tables we have
**Tables**:

1. `players`: Player info (name, team, position, active status)
2. `games`: Game records (teams, scores, winner)
3. `player_game_stats`: One player's stats for one game
4. `player_season_stats`: Season averages per player (what layer 1 produces)
5. `game_predictions`: ML predictions for game outcomes (future feature)

**Key Concepts**:

- ORM: Writes python objects instead of raw SQL which is better than engine since IDE fills in gaps as well as we are able to allow for more flexibility
- Foreign Keys: Link tables together (`player_id` references `players`)
- Relationships: Navigate between objects (`stats.player.name`)
- Session: One session created to connect to the database for read/write operations (mainly read since we only need on write operation for the nba stats itself)

#### Layer 3: Feature Engineering

**Purpose**: Calculate fantasy points (FPTS) for 9-cat scoring + auction values
**Key Concepts**:

- Each category has a weight defined to it so that when we calculate the total FPTS for a player -> it takes into account the weight of each category
  (i.e. steals get a 3.0 weight since that category is more scarce compared to points with a 1.0 weight)
- Also take into account the volume and efficiency of free throw and field goal percentages. A player with a 90% FT with 2 FT attempts on average will have less weight than a
  player with 88% FT with 8 FT attempts. Bonuses are added on to the actual FPTS, but the FPTS only takes in to account the actual seasonal stats and no other external factors
- The actual value calculations actually take into account the external factors such as Age, Number of games played, all players FPTS, position, etc. since those values matter
  when it comes to figuring out the value of a player's auction cost. For example: A 25 year old player with the same FPTS and a 35 year old player will be more costly since the player
  that is older has a higher chance to decline in production. This principle is the same for the number of games played since some players could constantly be injure prone leaving for
  more risk as well.

#### Layer 4: Machine Learning

**Purpose**: Uses XGBoost models to predict next-season stats based on 2-3 years of past NBA data
**XGBoost**:

- What is XGBoost? -> highly efficient and scalable machine learning library that implements optimized gradient-boosted decision trees and combines them.
  Essentially, each tree is learning off of each other and combines the prediction to get a weighted average
- Why XGBoost? -> handles small datasets well, fast to train, great for tabular data
- Inputs? -> Season stats
- Hyperparameters? -> number of trees to build, how deep each tree can go, the learning rate, the subsample
- Evaluation Metrics?

1. MAE (mean absolute error) = Average(|predicted - actual|), if MAE = 2.0 for PPG -> on average our prediction is off by 2 points per game
2. R^2 = How much variance the model explains

**Key Concepts**:

- We use 9 different XGBoost models for each stat because each stat has a different pattern and allows to tune each model independently

#### Layer 5: Linear Programming Optimizer

**Purpose**: Optimizer to select best 13 players given constraints
**Linear Programming**:

- What is linear programming? -> mathematical technique that finds the optimal solution to problems with an objective to maximize/minimize (total FPTS), contraints must be satisfied (budget, positions), decision variables (which players to pick)
- Why linear programming? -> guaranteed optimal and fast since constraints are linear (budget, roster size), objective is linear (sum of FPTS), problem size is manageable (150 players × 13 slots)

**Key Concepts**:

- Decision Variables: `x[player, slot] = 1` -> 1 means player is there and 0 means otherwise
- Objective Function (maximize): Sum up the FPTS of all selected players
- Constraints:

1. Each slot filled exactly once
2. Each player selected at most once
3. Budget constraint
4. Position Eligibilty

#### Layer 6: Draft Room

**Purpose**: Manages a live draft session and provides the user with recommendations bringing together the data from the different layers
**Flow**:

1. Create Session: load 150+ players into pool, set budget to $200, and slots = 13
2. During draft (repeat):
   a. Get recommendations
   b. Opponent picks
   c. Your picks
3. Track state
   a. Budget remaining
   b. Slots filled
   c. Category strengths
   d. Available players

**Key Concepts**:

- Category-Aware recommendations: instead of just picking the best FPTS player -> it analyzes the roster strength analysis with (Z-scores)
- Recommendation strategies:

1. Fill gap -> fill in weak category recommendations
2. Reinforce strength -> emphasize the categories you are good in

- Composite Scoring: each recommendation gets a score combining multiple factors

#### Layer 7: FastAPI backend

**Purpose**: Exposes all logic from previous layers as REST API endpoints that the frontend can call
**FastAPI**:

- What is FastAPI? -> automatic docs, type validation, async support

**Key Concepts**:

- CORS: Cross-Origin Resource Sharing - allows frontend (port 3000) to call backend (port 8000)
- Routers: Organize endpoints into logical groups
- Tags: Group endpoints in the docs UI

#### Layer 8: React Frontend

**Purpose**: Shows the actual draft room to uses and calls the FastAPI backend

#### Layer 9: Infrastructure

- Docker Compose: Runs multiple containers together

1. PostgreSQL database
2. MLFlow server
