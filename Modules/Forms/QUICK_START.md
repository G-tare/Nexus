# Forms Module - Quick Start Guide

Get the Forms module up and running in 5 minutes.

## 1. Database Setup (2 minutes)

```bash
# Run the schema
psql -U postgres -d your_database -f Modules/Forms/DATABASE_SCHEMA.sql
```

That's it! Three tables are now created.

## 2. Environment Variables (1 minute)

Add to `.env`:
```env
FORM_BASE_URL=https://your-domain.com
API_BASE_URL=http://localhost:3000
```

## 3. Bot Integration (1 minute)

In your main bot file:
```typescript
import formsModule from './Modules/Forms';

client.on('ready', () => {
  formsModule.initialize(client, dbPool, eventBus);
});

// Register commands
formsModule.commands.forEach((cmd) => {
  // Add to your command handler
});
```

## 4. Express Setup (1 minute)

```typescript
import formsRouter from './Modules/Forms/web/routes';

app.use('/forms', formsRouter);
```

## Basic Usage

### Create a Form
```
/formcreate name:"Job Application" responsechannel:#applications
```

### Add Questions
```
/formedit formid:<id> addquestion label:"Full Name" type:short_text required:true
/formedit formid:<id> addquestion label:"Email" type:email required:true
/formedit formid:<id> addquestion label:"Cover Letter" type:long_text required:false
```

### Get Form Link
```
/form form:"Job Application"
```

### Review Responses
```
/formreview formid:<id>
```

## Question Types

| Type | Input | Validation |
|------|-------|-----------|
| `short_text` | Single line | Min/max length |
| `long_text` | Multi-line | Min/max length |
| `email` | Text | RFC5322 format |
| `url` | Text | Valid URL |
| `number` | Numeric | Min/max value |
| `multiple_choice` | Radio | From options |
| `checkbox` | Toggle | Boolean |
| `dropdown` | Select | From options |

## Full Command Reference

### User Commands
- `/form [form]` - View available forms

### Staff Commands
- `/formconfig view|enable|disable|toggleapproval|setnotificationchannel`
- `/formcreate name description responsechannel [options]`
- `/formedit formid addquestion|removequestion|viewquestions|updatemeta`
- `/formdelete formid`
- `/formtoggle formid`
- `/formresponses formid [page]`
- `/formreview formid [status]`

## Setting User ID

The form submission needs to identify users. Add middleware:

```typescript
app.use((req, res, next) => {
  // Option 1: From JWT token
  const token = req.headers.authorization?.split(' ')[1];
  if (token) {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.headers['x-user-id'] = decoded.userId;
  }
  
  // Option 2: From session
  // req.headers['x-user-id'] = req.session.userId;
  
  next();
});
```

## Test It

1. Create form: `/formcreate name:Test responsechannel:#general`
2. Add question: `/formedit formid:<id> addquestion label:Test type:short_text required:true`
3. Get link: `/form form:Test`
4. Open link and submit
5. Check #general for notification

## Common Issues

| Issue | Fix |
|-------|-----|
| Form not appearing | Check `is_active=true` in database |
| No response notifications | Verify bot can send messages in response channel |
| Form link 404 | Ensure form exists: check database |
| DM not sending | Enable `dmConfirm` on form creation |
| x-user-id missing | Add middleware to set header |

## File Locations

- Commands: `Modules/Forms/core/` and `Modules/Forms/staff/`
- Web routes: `Modules/Forms/web/routes.ts`
- Helpers: `Modules/Forms/helpers.ts`
- Types: `Modules/Forms/types.ts`
- Schema: `Modules/Forms/DATABASE_SCHEMA.sql`

## Next Steps

1. Read `README.md` for full documentation
2. Read `INTEGRATION_GUIDE.md` for detailed setup
3. Check `FILE_STRUCTURE.md` for code organization
4. Test with the step-by-step example above
5. Deploy to production

## Support Files

- **README.md** - Complete documentation (12.8 KB)
- **INTEGRATION_GUIDE.md** - Step-by-step integration (9.5 KB)
- **FILE_STRUCTURE.md** - Code organization (8 KB)
- **DATABASE_SCHEMA.sql** - Database setup (2.3 KB)
- **types.ts** - Type definitions (2.1 KB)

Total: 16 TypeScript files, 1 SQL file, 4 markdown files (~96 KB total)

## Production Checklist

- [ ] Database schema applied
- [ ] Environment variables set
- [ ] User identification middleware added
- [ ] All 8 commands registered
- [ ] Web routes mounted on Express
- [ ] Discord bot has permissions
- [ ] Form base URL is correct
- [ ] Database backups enabled
- [ ] Rate limiting configured
- [ ] Logging enabled
- [ ] Error handling tested
- [ ] Mobile form tested
