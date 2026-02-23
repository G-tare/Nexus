# Forms Module - START HERE

Welcome to the Discord Bot Forms Module! This document will guide you to the right place.

## What This Module Does

Creates web-based forms for Discord servers where:
- Staff create forms via Discord commands
- Bot generates a web link
- Users fill out forms in browser
- Submissions appear in Discord with review options

## Get Started in 3 Steps

### Step 1: Quick Start (5 minutes)
Read: **QUICK_START.md**
- Database setup command
- Environment variables
- Bot integration snippet
- Basic usage examples

### Step 2: Full Integration (20 minutes)
Read: **INTEGRATION_GUIDE.md**
- Detailed setup instructions
- User identification methods
- Express middleware setup
- Testing procedures
- Troubleshooting

### Step 3: Reference
Keep handy:
- **README.md** - Full command documentation
- **FILE_STRUCTURE.md** - Code organization

## Document Map

| Document | Time | Purpose |
|----------|------|---------|
| **START_HERE.md** (this) | 2 min | Navigation guide |
| **QUICK_START.md** | 5 min | Get running fast |
| **INTEGRATION_GUIDE.md** | 20 min | Detailed setup |
| **README.md** | Reference | Complete reference |
| **FILE_STRUCTURE.md** | Reference | Code details |
| **MANIFEST.md** | Reference | Module inventory |

## 5-Minute Quick Start

```bash
# 1. Database
psql -U postgres -d your_db -f DATABASE_SCHEMA.sql

# 2. Environment (.env)
FORM_BASE_URL=https://your-domain.com
API_BASE_URL=http://localhost:3000

# 3. Bot file
import formsModule from './Modules/Forms';
client.on('ready', () => {
  formsModule.initialize(client, dbPool, eventBus);
});

# 4. Express
import formsRouter from './Modules/Forms/web/routes';
app.use('/forms', formsRouter);

# 5. Try it
/formcreate name:Test responsechannel:#general
/form form:Test
```

## All 8 Commands

### User Commands
- `/form [form]` - Get link to a form
- `/formresponses formid [page]` - View responses (staff)

### Staff Commands  
- `/formconfig view|enable|disable|...` - Settings
- `/formcreate ...` - Create new form
- `/formedit formid <action>` - Manage questions
- `/formdelete formid` - Delete form
- `/formtoggle formid` - Enable/disable
- `/formreview formid [status]` - Review submissions

## Question Types (8)

1. **short_text** - Single line, length constraints
2. **long_text** - Multi-line, length constraints
3. **email** - Email validation
4. **url** - URL validation  
5. **number** - Numeric, min/max
6. **multiple_choice** - Radio buttons
7. **dropdown** - Select dropdown
8. **checkbox** - Boolean toggle

## File Organization

```
Forms Module/
├── START_HERE.md ← You are here
├── QUICK_START.md ← Read next
├── INTEGRATION_GUIDE.md ← Then this
├── README.md ← Full reference
├── FILE_STRUCTURE.md ← Code details
├── MANIFEST.md ← Inventory
│
├── core/ → User commands
├── staff/ → Staff commands
├── web/ → Web interface
├── helpers.ts → Database/validation
├── events.ts → Event handling
├── types.ts → TypeScript types
├── index.ts → Module loader
└── DATABASE_SCHEMA.sql → Database
```

## Key Features

✅ Web-based forms (not Discord modals)
✅ 8 question types with validation
✅ Response storage and review
✅ Approval workflow
✅ Notifications to Discord
✅ Optional DM confirmations
✅ User/response limits
✅ Mobile responsive
✅ Guild branding
✅ Full event system

## Common Tasks

### Create a Form
```
/formcreate name:Job Application responsechannel:#applications
/formedit formid:<id> addquestion label:Name type:short_text required:true
/formedit formid:<id> addquestion label:Email type:email required:true
```

### Share the Form
```
/form form:Job Application
```
(Copy the link, send to users)

### Check Responses
```
/formreview formid:<id>
```

### Manage Settings
```
/formconfig view
/formconfig setnotificationchannel #general
```

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "Form not found" | Create form first with `/formcreate` |
| Form link 404 | Check form `is_active` in DB, restart bot |
| No response notifications | Check response channel permissions |
| DM not sending | Enable `dmConfirm` on form creation |
| Database error | Run DATABASE_SCHEMA.sql |

See INTEGRATION_GUIDE.md for more troubleshooting.

## Architecture Overview

```
Discord Command
    ↓
Bot Handler (index.ts)
    ↓
Command File (staff/create.ts, etc)
    ↓
Database (helpers.ts)
    ↓
PostgreSQL

Web Browser
    ↓
Express Route (web/routes.ts)
    ↓
HTML Form (web/formPage.ts)
    ↓
Form Submission
    ↓
Database + Discord Channel
```

## Database

3 tables created:
- **forms** - Form definitions with questions
- **form_responses** - User submissions
- **forms_config** - Guild settings

See DATABASE_SCHEMA.sql for exact schema.

## Authentication

Forms need to identify users. Options:
1. JWT tokens
2. Discord OAuth2
3. Session cookies

See INTEGRATION_GUIDE.md for all 3 methods.

## Production Checklist

Before deploying:
- [ ] Database schema applied
- [ ] Environment variables set
- [ ] User identification working
- [ ] All 8 commands registered
- [ ] Web routes mounted
- [ ] Form base URL correct
- [ ] Bot has message permissions
- [ ] Logging configured
- [ ] Backups enabled

## Support Materials

This module includes:
- 9 TypeScript files (complete code)
- 1 SQL file (database)
- 6 documentation files
- 2,383 total lines
- Full type safety
- Error handling
- Production ready

## Next: Quick Start

→ Go to **QUICK_START.md** to get running in 5 minutes

Or jump to **INTEGRATION_GUIDE.md** for detailed setup.

---

**Need help?** Check the relevant document above.  
**Want details?** Read README.md.  
**Need to understand code?** See FILE_STRUCTURE.md.
