# Casino Module - Quick Start Guide

## File Organization

```
Casino/
├── index.ts                    # Module definition & exports
├── helpers.ts                  # Shared utilities & helpers
├── events.ts                   # Event listeners (empty)
├── games/                      # 10 individual game commands
│   ├── blackjack.ts
│   ├── slots.ts
│   ├── crash.ts
│   ├── roulette.ts
│   ├── coinflip.ts
│   ├── poker.ts
│   ├── wheel.ts
│   ├── scratchcard.ts
│   ├── horserace.ts
│   └── highlow.ts
└── staff/                      # Admin/staff commands
    └── config.ts              # Configuration subcommands
```

## Key Helper Functions

### Configuration
```typescript
getCasinoConfig(guildId) → CasinoConfig
```

### Currency
```typescript
placeBet(guildId, userId, amount, config) → {success, error?}
awardWinnings(guildId, userId, amount) → void
```

### Logging
```typescript
logCasinoGame(guildId, userId, game, betAmount, winAmount, multiplier, result, metadata?) → void
```

### Cooldowns
```typescript
checkCooldown(guildId, userId, game) → boolean
setCooldown(guildId, userId, game, seconds) → void
```

### UI
```typescript
buildCasinoEmbed(title, description, color?) → EmbedBuilder
```

### Utilities
```typescript
getRandomNumber(min, max) → number
getRandomElement<T>(array) → T
exponentialDistribution(max) → number
sleep(ms) → Promise<void>
```

### Cards
```typescript
createDeck() → Card[]
getCardEmoji(card) → string
getCardValue(card) → number
calculateHandValue(cards) → number
```

## Game Implementation Pattern

Each game follows this pattern:

```typescript
1. Validate subcommand name
2. Check user cooldown
3. Get casino configuration
4. Place bet (deduct currency)
5. Initialize game state
6. Send initial embed
7. Handle interactions (buttons/selects)
8. Determine outcome
9. Award winnings if won
10. Log game result
11. Set cooldown
12. Clean up collectors
```

## Common Patterns

### Placing Bets
```typescript
const config = await getCasinoConfig(guildId);
const betResult = await placeBet(guildId, userId, betAmount, config);
if (!betResult.success) {
  await interaction.reply({
    content: betResult.error,
    flags: MessageFlags.Ephemeral,
  });
  return;
}
```

### Awarding Winnings
```typescript
if (won) {
  const winAmount = betAmount * multiplier;
  await awardWinnings(guildId, userId, winAmount);
}
```

### Logging Results
```typescript
await logCasinoGame(
  guildId,
  userId,
  'gameName',
  betAmount,
  winAmount,
  multiplier,
  result,
  metadata
);
```

### Setting Cooldowns
```typescript
await setCooldown(guildId, userId, 'gameName', config.cooldown);
```

### Button Collectors
```typescript
const collector = message.createMessageComponentCollector({
  time: 60000, // 60 seconds
});

collector.on('collect', async (buttonInteraction) => {
  if (buttonInteraction.user.id !== userId) {
    await buttonInteraction.reply({
      content: 'This is not your game.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Handle interaction
  await buttonInteraction.update({ embeds: [newEmbed], components: [] });
});

collector.on('end', async () => {
  // Cleanup if needed
});
```

### Animations
```typescript
for (let i = 0; i < 3; i++) {
  await sleep(300);
  const animEmbed = /* build embed */;
  await message.edit({ embeds: [animEmbed] });
}
```

## Color Casting

All colors must be cast to `as number | \`#${string}\``:

```typescript
.setColor(config.embedColor as number | `#${string}`)
.setColor('#FFD700' as number | `#${string}`)
```

## TypeScript Notes

- All code is strict mode compliant
- No `@ts-expect-error` directives
- Card interface uses union types:
  ```typescript
  suit: 'hearts' | 'diamonds' | 'clubs' | 'spades'
  value: 'A' | '2' | ... | 'K'
  ```
- CasinoConfig interface defines all configuration options
- Hand interface in poker uses `cards: Card[]` and `held: boolean[]`

## Database

Uses Drizzle ORM with these imports:
```typescript
import { getDb, getRedis } from '../../Shared/src/database/connection';
import { casinoHistory } from '../../Shared/src/database/models/schema';
```

The `casinoHistory` table has:
- id, guildId, userId, game, betAmount, winAmount, multiplier, result, metadata, createdAt

## Command Structure

All games are subcommands of `/casino`:
- `/casino blackjack <bet>`
- `/casino slots <bet>`
- `/casino crash <bet>`
- etc.

Config is a subcommand group:
- `/casino config view`
- `/casino config min-bet <amount>`
- etc.

## Ephemeral Messages

Error messages use `MessageFlags.Ephemeral` (1 << 6):
```typescript
flags: MessageFlags.Ephemeral
// or
flags: 1 << 6
```

Configuration commands are NOT ephemeral (staff-facing).

## Default Configuration

```typescript
{
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
}
```

## Testing Checklist

- Insufficient balance error
- Bet validation (min/max)
- Cooldown check
- Game completion & payout
- Database logging
- Collector timeout
- Button permission check
- Color casting
- All 10 games functional
- Config commands non-ephemeral
- Error messages ephemeral

## Common Issues & Solutions

**Issue**: Missing import from Currency module
**Solution**: Verify path `../Currency/helpers` exists

**Issue**: Color not setting properly
**Solution**: Cast with `as number | \`#${string}\``

**Issue**: Buttons not responding
**Solution**: Verify `buttonInteraction.user.id === userId` check

**Issue**: Game doesn't set cooldown
**Solution**: Call `setCooldown()` before collector.stop()

**Issue**: Bet deducts but game errors
**Solution**: Wrap in try-catch, log errors before returning

## Performance Notes

- Redis cooldowns are fast (< 1ms)
- Database inserts are async (fire and forget safe)
- Message edits for animations use 300-800ms delays
- Button collectors timeout after 60-120 seconds
- Deck shuffling uses Math.random() (sufficient for casual games)
