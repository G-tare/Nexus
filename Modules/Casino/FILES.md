# Casino Module - File Reference

## Core Module Files

### index.ts (45 lines)
Module definition and command routing.
- CasinoModule export
- Command path registration (11 commands)
- Default configuration object
- Empty events array

### helpers.ts (600+ lines)
Shared utilities and helper functions.
- CasinoConfig interface
- getCasinoConfig() - Fetch guild configuration
- placeBet() - Validate and deduct bet
- awardWinnings() - Add currency to user
- logCasinoGame() - Insert game result to database
- checkCooldown() - Redis cooldown verification
- setCooldown() - Redis cooldown creation
- buildCasinoEmbed() - Standard embed builder
- Utility functions:
  - getRandomNumber()
  - getRandomElement()
  - exponentialDistribution()
  - sleep()
- Card utilities:
  - Card interface
  - createDeck()
  - getCardEmoji()
  - getCardValue()
  - calculateHandValue()

### events.ts (3 lines)
Event definitions.
- Empty Events array (no background events)

## Game Files

### games/blackjack.ts (400+ lines)
21 card game against dealer.
- Command: `/casino blackjack <bet>`
- Features:
  - Hit, Stand, Double Down buttons
  - Ace handling (11 or 1)
  - Dealer AI (hits on soft 16, stands on 17)
  - Card visualization
  - Payouts: Win 2x, Blackjack 2.5x, Push (refund)
- Includes:
  - buildInitialEmbed() - Game start UI
  - buildGameEmbed() - Game progress UI
  - buildGameButtons() - Button creation logic

### games/slots.ts (250+ lines)
3×3 spinning slot machine.
- Command: `/casino slots <bet>`
- Features:
  - 8 symbols: 🍒🍋🍊🍇🔔⭐💎7️⃣
  - Spinning animation (3 edits)
  - 6 paylines (center, top, bottom, diagonals)
  - Payouts: 7s (50x), Diamonds (25x), Stars (15x), Bells (10x), Fruits (5x), 2-match (2x)
- Includes:
  - buildSlotsEmbed() - Grid visualization
  - checkSlotsWin() - Payline and payout logic

### games/crash.ts (200+ lines)
Rising multiplier crash game.
- Command: `/casino crash <bet>`
- Features:
  - Multiplier increases every second
  - Real-time embed updates
  - Cash Out button
  - Exponential distribution for crash point
  - Max duration: 30 seconds
  - Color changes (green rising, red crash)
- Includes:
  - buildCrashEmbed() - Multiplier display

### games/roulette.ts (250+ lines)
European roulette wheel.
- Command: `/casino roulette <bet> <type> [number]`
- Bet types: red, black, odd, even, high, low, number
- Features:
  - Spinning animation (2-3 edits)
  - Visual result emoji (🔴🟢⚫)
  - Payouts: Color/odd/even/high/low (2x), Number (36x)
- Includes:
  - checkRouletteWin() - Bet logic
  - buildRouletteEmbed() - Spinning UI

### games/coinflip.ts (180+ lines)
Simple heads/tails flip.
- Command: `/casino coinflip <bet> <choice>`
- Features:
  - Heads or Tails selection
  - Spinning animation (🪙 emoji)
  - Payout: 1.95x (2% house edge)
- Includes:
  - Emoji-based animation

### games/poker.ts (450+ lines)
Video poker with 5-card draw.
- Command: `/casino poker <bet>`
- Features:
  - Deal 5 cards
  - Hold/discard selection (5 buttons)
  - Draw button
  - Hand evaluation:
    - Royal Flush: 250x
    - Straight Flush: 50x
    - 4 of a Kind: 25x
    - Full House: 9x
    - Flush: 6x
    - Straight: 4x
    - 3 of a Kind: 3x
    - Two Pair: 2x
    - Jacks or Better: 1x
- Includes:
  - Hand interface (cards[], held[])
  - buildPokerEmbed() - Hand visualization
  - evaluatePokerHand() - Complex hand logic
  - getCardValue() - Card ranking

### games/wheel.ts (200+ lines)
Wheel of Fortune.
- Command: `/casino wheel <bet>`
- Features:
  - 8 weighted segments
  - Multipliers: 0x (25%), 0.5x (20%), 1x (20%), 1.5x (15%), 2x (10%), 3x (5%), 5x (3%), 10x (2%)
  - Spinning animation (directional arrows)
  - Confetti on big wins (5x+)
- Includes:
  - WheelSegment interface
  - buildWheelEmbed() - Wheel display
  - selectWheelResult() - Weighted probability

### games/scratchcard.ts (280+ lines)
Scratch card game.
- Command: `/casino scratchcard <bet>`
- Features:
  - 3×3 grid, initially hidden (⬛)
  - 3 scratch buttons (rows)
  - Match 3 in row for multipliers (slots payouts)
  - Button state updates (✅ after scratch)
- Includes:
  - buildScratchEmbed() - Hidden grid display
  - checkScratchWin() - Row matching logic

### games/horserace.ts (280+ lines)
Horse racing game.
- Command: `/casino horserace <bet> <horse>`
- Features:
  - 6 horses with randomized speeds
  - Race animation (5-6 edits with progress bars)
  - Payout: Winner (5x), Top 2 (2x)
  - Visual progress display
- Includes:
  - Horse interface (name, emoji, speed, position)
  - buildRaceEmbed() - Progress bar visualization
  - Speed-based race logic

### games/highlow.ts (380+ lines)
Card guessing progression game.
- Command: `/casino highlow <bet>`
- Features:
  - Start with one card, guess higher/lower
  - Progressive multipliers (1.5x → 2.25x → 3.4x → 5x → 7.5x...)
  - 10 rounds maximum
  - Lose all on wrong guess
  - Cash Out button
- Includes:
  - buildHighLowEmbed() - Card display
  - getHighLowValue() - Card ranking
  - Complex multiplier progression

## Admin Files

### staff/config.ts (320+ lines)
Configuration command with 9 subcommands.
- Command: `/casino config <subcommand>`
- Subcommands:
  1. view - Display current configuration
  2. min-bet - Set minimum bet
  3. max-bet - Set maximum bet
  4. currency - Set currency type
  5. cooldown - Set cooldown seconds
  6. house-edge - Set house edge percentage
  7. log-channel - Set logging channel
  8. color - Set embed color (hex validation)
  9. daily-loss-limit - Set daily loss limit
- Features:
  - Permission checks (Administrator/ManageGuild)
  - Input validation
  - Not ephemeral (staff-facing)
  - Color preview in embed

## Documentation Files

### README.md (500+ lines)
Comprehensive module documentation.
- Features overview
- Directory structure
- Detailed game descriptions
- Configuration commands
- Implementation details
- Type safety notes
- Error handling
- Module definition

### QUICK_START.md (400+ lines)
Developer quick reference guide.
- File organization
- Key helper functions
- Game implementation pattern
- Common patterns with code examples
- Color casting guide
- TypeScript notes
- Database information
- Command structure
- Testing checklist
- Common issues & solutions
- Performance notes

### IMPLEMENTATION_SUMMARY.md (300+ lines)
Implementation overview and metrics.
- File count statistics
- LOC breakdown
- Architecture highlights
- Compliance checklist
- Key features
- Testing recommendations
- Integration notes
- Configuration defaults
- Performance profile
- Code quality metrics
- Security considerations

### FILES.md (This file)
File-by-file reference guide.
- Each file with description
- Line counts and content overview
- Function/interface listings

## File Statistics

| File | Lines | Purpose |
|------|-------|---------|
| index.ts | 45 | Module definition |
| helpers.ts | 600+ | Shared utilities |
| events.ts | 3 | Event definitions |
| blackjack.ts | 400+ | Blackjack game |
| slots.ts | 250+ | Slots game |
| crash.ts | 200+ | Crash game |
| roulette.ts | 250+ | Roulette game |
| coinflip.ts | 180+ | Coin flip game |
| poker.ts | 450+ | Poker game |
| wheel.ts | 200+ | Wheel game |
| scratchcard.ts | 280+ | Scratch card game |
| horserace.ts | 280+ | Horse race game |
| highlow.ts | 380+ | High/Low game |
| config.ts | 320+ | Configuration |
| **Total Code** | **3,500+** | **Production code** |
| README.md | 500+ | Main documentation |
| QUICK_START.md | 400+ | Developer guide |
| IMPLEMENTATION_SUMMARY.md | 300+ | Overview & metrics |
| FILES.md | 250+ | File reference |
| **Total Docs** | **1,450+** | **Documentation** |

## Key Patterns Used

### Per File
- One command per game file
- Consistent subcommand structure
- Proper error handling
- Button collector pattern
- Message edit animations
- Database logging
- Cooldown enforcement

### Across Module
- Shared helper functions
- Common embed builder
- Unified import paths
- Consistent color casting
- Standard payouts/multipliers
- User permission checks

## Dependencies

### Internal Imports
- `../../Shared/src/types/command` - Command interface
- `../../Shared/src/types/event` - Event interface
- `../../Shared/src/database/connection` - getDb, getRedis
- `../../Shared/src/database/models/schema` - casinoHistory table
- `../../Shared/src/utils/embed` - Colors, buildEmbed
- `../../Shared/src/utils/logger` - Logger (if used)
- `../../Shared/src/middleware/moduleConfig` - Module config (if used)
- `../Currency/helpers` - Currency operations

### External Dependencies
- discord.js v14 (SlashCommandBuilder, ButtonBuilder, etc.)

## Export Structure

```
index.ts exports:
  - CasinoModule (default)

Each game file exports:
  - default command (Command interface)

config.ts exports:
  - default command (Command interface)

helpers.ts exports:
  - All functions and interfaces
```

## Testing Points

Each file should test:
- **Games**: Win condition, lose condition, cooldown, database logging
- **Helpers**: Bet validation, currency operations, cooldown check
- **Config**: Each subcommand, permission check, validation
- **All**: Error handling, timeout behavior, user permission checks

