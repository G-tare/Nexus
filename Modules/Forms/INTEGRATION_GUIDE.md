# Forms Module - Integration Guide

This guide walks through integrating the Forms module into your existing Discord bot.

## Step 1: Run Database Schema

First, create the required database tables:

```bash
psql -U your_postgres_user -d your_database_name -f "Modules/Forms/DATABASE_SCHEMA.sql"
```

This creates three tables:
- `forms` - Form definitions
- `form_responses` - User submissions  
- `forms_config` - Per-guild configuration

## Step 2: Update Environment Variables

Add these to your `.env` file:

```env
FORM_BASE_URL=https://your-domain.com
API_BASE_URL=http://localhost:3000
```

## Step 3: Import in Main Bot File

In your main bot initialization file (e.g., `bot.ts`, `index.ts`, or `main.ts`):

```typescript
import formsModule, { initializeFormsWebRoutes } from './Modules/Forms';

// After Discord client is created
const client = new Client({ intents: [...] });

client.on('ready', () => {
  logger.info(`Bot ready as ${client.user.tag}`);
  
  // Initialize Forms module with database pool and event bus
  formsModule.initialize(client, dbPool, eventBus);
  
  // Initialize web routes for form serving/submission
  initializeFormsWebRoutes(client);
});
```

## Step 4: Register Commands

In your command handler/loader, add Forms commands:

```typescript
// In your command loading logic
formsModule.commands.forEach((command) => {
  if (command.data) {
    // Add to your command collection
    commands.set(command.data.name, command);
    
    // If using SlashCommandBuilder, add to commands array for guild.commands.set()
    commandsData.push(command.data.toJSON());
  }
});

// Later, when registering slash commands:
await guild.commands.set(commandsData);
// OR for global commands:
await client.application.commands.set(commandsData);
```

## Step 5: Setup Express Routes

In your Express app setup:

```typescript
import express from 'express';
import formsRouter from './Modules/Forms/web/routes';

const app = express();

// Middleware to identify users
app.use((req, res, next) => {
  // Option 1: Extract from JWT token
  // const token = req.headers.authorization?.split(' ')[1];
  // const decoded = jwt.verify(token, process.env.JWT_SECRET);
  // req.headers['x-user-id'] = decoded.userId;
  
  // Option 2: From session
  // req.headers['x-user-id'] = req.session.userId;
  
  // Option 3: From cookie
  // req.headers['x-user-id'] = req.cookies.discord_user_id;
  
  next();
});

// Mount forms routes
app.use('/forms', formsRouter);

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
```

## Step 6: Setup User Identification

The forms system needs to identify users. Choose one approach:

### Option A: JWT Token Authentication
```typescript
import jwt from 'jsonwebtoken';

app.use((req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.headers['x-user-id'] = decoded.userId;
    } catch (e) {
      // Invalid token
    }
  }
  next();
});
```

### Option B: Discord OAuth2
```typescript
import passport from 'passport';
import DiscordStrategy from 'passport-discord';

passport.use(new DiscordStrategy({
  clientID: process.env.DISCORD_CLIENT_ID,
  clientSecret: process.env.DISCORD_CLIENT_SECRET,
  callbackURL: process.env.DISCORD_REDIRECT_URI,
}, (accessToken, refreshToken, profile, done) => {
  done(null, profile);
}));

app.use((req, res, next) => {
  if (req.user) {
    req.headers['x-user-id'] = req.user.id;
  }
  next();
});
```

### Option C: Session-Based
```typescript
import session from 'express-session';

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
}));

app.use((req, res, next) => {
  if (req.session.userId) {
    req.headers['x-user-id'] = req.session.userId;
  }
  next();
});
```

## Step 7: Configure Event Bus

If you have a central event bus, ensure it's passed to Forms module:

```typescript
import { EventEmitter } from 'events';

const eventBus = new EventEmitter();

// Listen for form events
eventBus.on('formSubmitted', (event) => {
  console.log(`Form submitted: ${event.formId}`);
});

eventBus.on('formApproved', (event) => {
  console.log(`Form approved by ${event.reviewedBy}`);
});

// Pass to Forms module
formsModule.initialize(client, dbPool, eventBus);
```

## Step 8: Autocomplete Handlers (Optional)

If your bot supports command autocomplete, add handlers:

```typescript
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isAutocomplete()) return;
  
  if (interaction.commandName === 'form') {
    // Autocomplete for form selection
    const { getActiveFormsByGuild } = require('./Modules/Forms/helpers');
    const forms = await getActiveFormsByGuild(interaction.guildId);
    
    const choices = forms
      .map(f => ({ name: f.name, value: f.id }))
      .slice(0, 25);
    
    await interaction.respond(choices);
  }
  
  if (interaction.commandName === 'formresponses' || 
      interaction.commandName === 'formedit' ||
      interaction.commandName === 'formdelete' ||
      interaction.commandName === 'formtoggle' ||
      interaction.commandName === 'formreview') {
    // Autocomplete for form selection (staff commands)
    const { getFormsByGuild } = require('./Modules/Forms/helpers');
    const forms = await getFormsByGuild(interaction.guildId);
    
    const choices = forms
      .map(f => ({ name: f.name, value: f.id }))
      .slice(0, 25);
    
    await interaction.respond(choices);
  }
});
```

## Step 9: Button Interaction Handlers (Optional)

If you want to support the interactive buttons shown in replies:

```typescript
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton()) return;
  
  if (interaction.customId.startsWith('confirm_delete_form_')) {
    const formId = interaction.customId.replace('confirm_delete_form_', '');
    const { deleteForm, getFormById } = require('./Modules/Forms/helpers');
    
    const form = await getFormById(formId);
    if (form?.guildId === interaction.guildId) {
      await deleteForm(formId);
      await interaction.reply({ 
        content: `✅ Form **${form.name}** has been deleted.`,
        ephemeral: false 
      });
    }
  }
});
```

## Complete Integration Example

Here's a minimal complete setup:

```typescript
// bot.ts
import { Client, IntentsBitField } from 'discord.js';
import { Pool } from 'pg';
import express from 'express';
import { EventEmitter } from 'events';

import formsModule, { initializeFormsWebRoutes } from './Modules/Forms';
import formsRouter from './Modules/Forms/web/routes';

// Initialize
const client = new Client({ intents: [IntentsBitField.Guilds] });
const dbPool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
const eventBus = new EventEmitter();
const app = express();

// Middleware
app.use(express.json());
app.use((req, res, next) => {
  // Set x-user-id from your auth method
  req.headers['x-user-id'] = req.headers['x-user-id'] || 'test-user';
  next();
});

// Bot ready
client.on('ready', () => {
  console.log(`Bot ready as ${client.user.tag}`);
  
  // Initialize Forms module
  formsModule.initialize(client, dbPool, eventBus);
  initializeFormsWebRoutes(client);
  
  // Register commands (implement based on your structure)
  // formsModule.commands.forEach((cmd) => { ... });
});

// Web server
app.use('/forms', formsRouter);

// Start
client.login(process.env.DISCORD_TOKEN);
app.listen(3000, () => console.log('Server on :3000'));
```

## Testing the Integration

1. **Create a test form**:
   ```
   /formcreate name:Test description:Test form responsechannel:#general
   ```

2. **Add a question**:
   ```
   /formedit formid:<id> addquestion label:Name type:short_text required:true
   ```

3. **Get the form link**:
   ```
   /form form:Test
   ```

4. **Visit the form URL** and submit a response

5. **Check the response channel** for the submission embed

6. **Review responses**:
   ```
   /formresponses formid:<id>
   ```

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Forms not appearing | Check `is_active` in database, ensure guild has Forms enabled |
| Responses not received | Check response channel permissions, verify `x-user-id` header is set |
| Form link returns 404 | Verify form exists and `is_active = true` in database |
| DM confirmations fail | Enable `dmConfirm` on form, check bot can DM user |
| Database errors | Run schema script, verify PostgreSQL version ≥ 12 |

## Performance Tips

1. **Enable connection pooling**: Set `max: 20` in Pool options
2. **Add database indexes**: Schema includes all recommended indexes
3. **Cache guild data**: Consider caching active forms in memory
4. **Rate limit submissions**: Implement rate limiting on form submission endpoint
5. **Async processing**: Consider queuing DMs and channel sends

## Security Checklist

- [ ] Set `x-user-id` header securely (don't trust client)
- [ ] Validate all form inputs on server (done in helpers.ts)
- [ ] Use HTTPS in production for form URLs
- [ ] Configure CORS appropriately
- [ ] Implement rate limiting on form endpoints
- [ ] Use environment variables for sensitive data
- [ ] Regularly backup database
- [ ] Monitor for suspicious submission patterns

## Next Steps

1. Test the module in a test guild
2. Configure proper user identification
3. Set up monitoring/logging for form submissions
4. Train staff on command usage
5. Deploy to production
