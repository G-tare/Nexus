# Casino Module

A complete gambling module for Discord.js v14 with 10 unique games, full currency integration, and production-ready code.

## Features

- **10 Casino Games**: Blackjack, Slots, Crash, Roulette, Coin Flip, Poker, Wheel of Fortune, Scratch Card, Horse Race, and High/Low
- **Currency Integration**: Works with the Currency module for seamless bet placement and winnings
- **Cooldown System**: Redis-backed per-game cooldowns to prevent spam
- **Game Logging**: All games logged to `casinoHistory` table with full metadata
- **Staff Configuration**: Admin commands to configure casino parameters
- **Animations**: Smooth embed-based animations for spinning wheels, races, and other effects
- **House Edge**: Configurable house edge for mathematical fairness
- **TypeScript Strict**: 100% TypeScript strict mode compliance, zero `@ts-expect-error`

## Directory Structure

```
Casino/
├── index.ts              # Module definition
├── helpers.ts            # Shared utilities, types, and helpers
├── events.ts             # Event listeners (empty for this module)
├── games/
│   ├── blackjack.ts      # Blackjack with hit/stand/double down
│   ├── slots.ts          # 3x3 slot machine with paylines
│   ├── crash.ts          # Rising multiplier crash game
│   ├── roulette.ts       # Roulette with multiple bet types
│   ├── coinflip.ts       # Simple heads/tails flip
│   ├── poker.ts          # Video poker with 5-card draw
│   ├── wheel.ts          # Wheel of Fortune with 8 segments
│   ├── scratchcard.ts    # Scratch card with hidden symbols
│   ├── horserace.ts      # Horse racing with 6 competitors
│   └── highlow.ts        # Card guessing game with progressive multipliers
└── staff/
    └── config.ts         # Admin configuration command
```

## Games Overview

### Blackjack (`/casino blackjack <bet>`)
Classic 21 card game against the dealer. Features:
- Hit, Stand, Double Down buttons
- Ace handling (11 or 1)
- Dealer AI (hits on soft 16, stands on 17)
- Payouts: Win 2x, Blackjack 2.5x, Push (refund)
- Full card visualization with emoji

### Slots (`/casino slots <bet>`)
3×3 spinning slot machine. Features:
- 8 symbols: 🍒🍋🍊🍇🔔⭐💎7️⃣
- Spinning animation (3 edits)
- 6 paylines: center, top, bottom, diagonals
- Payouts: 7s (50x), Diamonds (25x), Stars (15x), Bells (10x), Fruits (5x), 2-match (2x)

### Crash (`/casino crash <bet>`)
Rising multiplier that crashes randomly. Features:
- Starts at 1.00x, increases every second
- Real-time embed updates (1s refresh)
- Cash Out button to claim winnings
- Exponential distribution for crash point
- Max duration: 30 seconds
- Payout: bet × multiplier at cashout

### Roulette (`/casino roulette <bet> <type> [number]`)
European roulette wheel. Features:
- Bet types: red, black, odd, even, high (19-36), low (1-18), specific number
- Spinning animation
- Payouts: Color/odd/even/high/low (2x), Number (36x)
- Visual result with 🔴🟢⚫ emojis

### Coin Flip (`/casino coinflip <bet> <choice>`)
Simple coin flip. Features:
- Choose heads or tails
- Spinning animation
- Payout: 1.95x (2% house edge)

### Poker (`/casino poker <bet>`)
Video poker (5-card draw). Features:
- Deal 5 cards
- Hold/discard selection with buttons
- Draw button replaces non-held cards
- Hand evaluation with payouts:
  - Royal Flush: 250x
  - Straight Flush: 50x
  - 4 of a Kind: 25x
  - Full House: 9x
  - Flush: 6x
  - Straight: 4x
  - 3 of a Kind: 3x
  - Two Pair: 2x
  - Jacks or Better: 1x

### Wheel (`/casino wheel <bet>`)
Spinning wheel of fortune. Features:
- 8 segments with weighted probabilities
- Multipliers: 0x (25%), 0.5x (20%), 1x (20%), 1.5x (15%), 2x (10%), 3x (5%), 5x (3%), 10x (2%)
- Spinning animation with directional arrows
- Confetti emojis for big wins (5x+)

### Scratch Card (`/casino scratchcard <bet>`)
Scratch card game. Features:
- 3×3 grid, initially hidden (⬛)
- 3 scratch buttons, each reveals a row
- Match 3 in a row for multipliers (same as slots)
- All cells revealed after 3 scratches

### Horse Race (`/casino horserace <bet> <horse>`)
Horse racing with 6 competitors. Features:
- 6 horses with different speeds
- Race animation (5-6 edits with progress bars)
- Payout: Winner (5x), Top 2 (2x)
- Visual progress display for each horse

### High/Low (`/casino highlow <bet>`)
Card guessing progression game. Features:
- Start with one card, guess if next is higher or lower
- Progressive multipliers: 1.5x → 2.25x → 3.4x → 5x → 7.5x...
- 10 rounds maximum
- Lose all on wrong guess
- Cash Out button at any time

## Configuration Commands

### `/casino config view`
Display current casino configuration for the guild.

### `/casino config min-bet <amount>`
Set minimum bet amount.

### `/casino config max-bet <amount>`
Set maximum bet amount.

### `/casino config currency <type>`
Set currency type (e.g., 'coins').

### `/casino config cooldown <seconds>`
Set cooldown between game plays.

### `/casino config house-edge <percentage>`
Set house edge (0.02 = 2%).

### `/casino config log-channel [channel]`
Set channel for logging games.

### `/casino config color <hex>`
Set embed color (format: #RRGGBB).

### `/casino config daily-loss-limit <amount>`
Set daily loss limit per user (0 = unlimited).

## Implementation Details

### Currency Integration
All games use the Currency module's helper functions:
```typescript
import { addCurrency, removeCurrency } from '../Currency/helpers';

// Place bet (deducts from user balance)
const betResult = await placeBet(guildId, userId, amount, config);

// Award winnings (adds to user balance)
await awardWinnings(guildId, userId, winAmount);
```

### Database Logging
Every game result is logged to `casinoHistory` table:
```typescript
await logCasinoGame(
  guildId,
  userId,
  'blackjack',
  betAmount,
  winAmount,
  multiplier,
  'win',
  { playerValue: 21, dealerValue: 20 } // metadata
);
```

### Cooldown System
Redis-backed cooldowns prevent spam:
```typescript
// Check if user can play
const hasCooldown = await checkCooldown(guildId, userId, 'slots');

// Set cooldown after game
await setCooldown(guildId, userId, 'slots', 10); // 10 seconds
```

### Button Collectors
All interactive games use Discord.js button collectors with timeouts:
```typescript
const collector = message.createMessageComponentCollector({
  time: 60000, // 60 second timeout
});

collector.on('collect', async (buttonInteraction) => {
  // Handle button click
});
```

### Animations
Games use message edits with `sleep()` for smooth animations:
```typescript
for (let i = 0; i < 3; i++) {
  await sleep(300);
  await message.edit({ embeds: [newEmbed] });
}
```

## Type Safety

All code is TypeScript strict mode compliant:
- No `@ts-expect-error` directives
- Colors cast to `as number | \`#${string}\``
- Full type definitions for game state
- Proper Card interface with union types for suits and values
- CasinoConfig interface for configuration validation

## Error Handling

- Insufficient balance checks before bet placement
- Bet amount validation (min/max)
- Cooldown verification
- Collector timeout handling
- Database error catches with logging
- Invalid input validation (hex colors, horse numbers, etc.)

## Features Summary

✅ 10 unique games
✅ Full currency integration
✅ Redis cooldown system
✅ Complete game logging
✅ Staff configuration
✅ Smooth animations
✅ Emoji-based visuals
✅ TypeScript strict mode
✅ Production-ready code
✅ Error handling
✅ House edge support
✅ Button interactions
✅ Collector timeouts

## Module Configuration

```typescript
{
  name: 'casino',
  displayName: 'Casino',
  description: 'Gambling games with currency integration',
  category: 'economy',
  defaultConfig: {
    enabled: true,
    minBet: 10,
    maxBet: 50000,
    currencyType: 'coins',
    cooldown: 10,
    houseEdge: 0.02,
    embedColor: '#FFD700',
    logChannelId: null,
    dailyLossLimit: 0,
    jackpotPool: 0,
  },
}
```

## Notes

- All games use standard emoji representations (🃏 for cards, 🎰 for slots, etc.)
- Multipliers are calculated to account for house edge
- Games support both deferReply and deferred interactions
- Configuration commands are NOT ephemeral (staff-facing)
- Regular game commands use MessageFlags.Ephemeral for error messages
- All times in cooldowns are in seconds
- Database queries use Drizzle ORM with proper schema references
