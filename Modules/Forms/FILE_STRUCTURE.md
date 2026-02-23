# Forms Module - Complete File Structure

## Directory Layout

```
Modules/Forms/
├── core/                          # User-facing commands
│   ├── form.ts                    # /form - View available forms & get links
│   └── responses.ts               # /formresponses - View form responses
├── staff/                         # Staff management commands
│   ├── config.ts                  # /formconfig - Module settings
│   ├── create.ts                  # /formcreate - Create new form
│   ├── edit.ts                    # /formedit - Edit form & questions
│   ├── delete.ts                  # /formdelete - Delete form
│   ├── toggle.ts                  # /formtoggle - Enable/disable form
│   └── review.ts                  # /formreview - Review submissions
├── web/                           # Web interface
│   ├── formPage.ts                # HTML generation for forms
│   └── routes.ts                  # Express routes (GET/POST)
├── helpers.ts                     # Database operations & validation
├── events.ts                      # Event bus integration
├── types.ts                       # TypeScript type definitions
├── index.ts                       # Module entry point
├── DATABASE_SCHEMA.sql            # PostgreSQL schema
├── README.md                      # Full documentation
├── INTEGRATION_GUIDE.md           # Integration instructions
├── FILE_STRUCTURE.md              # This file
└── QUICK_START.md                 # Quick reference guide
```

## File Descriptions

### Core Commands (`core/`)

#### `form.ts` (2.8 KB)
**Command**: `/form [form]`
- View all active forms in guild
- Get direct link to specific form
- Copy link button functionality
- Uses autocomplete for form selection

**Exports**: `BotCommand`

**Dependencies**:
- discord.js (SlashCommandBuilder, etc)
- helpers.ts (getActiveFormsByGuild)
- logger

---

#### `responses.ts` (3.2 KB)
**Command**: `/formresponses formid [page]`
- View paginated list of form responses
- Filter by form ID
- Show response status and submission time
- Pagination buttons (Previous/Next)

**Exports**: `BotCommand`

**Dependencies**:
- discord.js
- helpers.ts (getFormById, getFormResponses)
- logger

**Permissions**: Manage Guild

---

### Staff Commands (`staff/`)

#### `config.ts` (3.5 KB)
**Command**: `/formconfig <subcommand>`

**Subcommands**:
- `view` - Show current configuration
- `enable` - Enable forms module
- `disable` - Disable forms module
- `toggleapproval` - Toggle approval requirement
- `setnotificationchannel <channel>` - Set notification channel

**Exports**: `BotCommand`

**Dependencies**:
- discord.js
- helpers.ts (getFormConfig, updateFormConfig)
- logger

**Permissions**: Manage Guild

---

#### `create.ts` (3.8 KB)
**Command**: `/formcreate name description responsechannel [oneperuser] [dmconfirm] [maxresponses]`
- Create new form with settings
- Validates response channel exists
- Sets up form with no questions (add via edit)
- Shows creation success with button to add questions

**Exports**: `BotCommand`

**Dependencies**:
- discord.js
- helpers.ts (createForm)
- logger

**Permissions**: Manage Guild

---

#### `edit.ts` (5.2 KB)
**Command**: `/formedit formid <subcommand>`

**Subcommands**:
- `addquestion label type required` - Add question to form
- `removequestion questionindex` - Remove question by index
- `viewquestions` - Display all questions
- `updatemeta [name] [description]` - Update form metadata

**Exports**: `BotCommand`

**Dependencies**:
- discord.js
- helpers.ts (getFormById, updateForm, FormQuestion)
- logger

**Permissions**: Manage Guild

---

#### `delete.ts` (2.9 KB)
**Command**: `/formdelete formid`
- Delete form and all responses
- Confirmation dialog with Danger/Cancel buttons
- Cascade deletes all associated responses

**Exports**: `BotCommand`

**Dependencies**:
- discord.js
- helpers.ts (getFormById, deleteForm)
- logger

**Permissions**: Manage Guild

---

#### `toggle.ts` (3.1 KB)
**Command**: `/formtoggle formid`
- Toggle form active/inactive status
- Changes form visibility to users
- Shows updated status in response

**Exports**: `BotCommand`

**Dependencies**:
- discord.js
- helpers.ts (getFormById, toggleFormActive)
- logger

**Permissions**: Manage Guild

---

#### `review.ts` (3.6 KB)
**Command**: `/formreview formid [status]`
- Review form submissions
- Filter by status (pending/approved/denied)
- Paginated response listing
- Quick-filter buttons for each status

**Exports**: `BotCommand`

**Dependencies**:
- discord.js
- helpers.ts (getFormById, getFormResponses, updateResponseStatus)
- events.ts (emitFormApproved, emitFormDenied)
- logger

**Permissions**: Manage Guild

---

### Web Interface (`web/`)

#### `formPage.ts` (8.5 KB)
**Purpose**: Generate responsive HTML form pages

**Features**:
- Guild branding (name, icon, color)
- All 8 question types rendered
- Client-side validation
- Error display
- Success confirmation
- Mobile responsive (CSS)
- Accessibility (labels, ARIA)

**Exports**: `generateFormHTML(form, guildInfo): string`

**Functions**:
- `generateFormHTML()` - Main HTML generation
- `generateQuestionHTML()` - Individual question rendering
- `escapeHtml()` - HTML sanitization

**Dependencies**:
- helpers.ts (FormData, FormQuestion)

---

#### `routes.ts` (6.8 KB)
**Purpose**: Express routes for form serving and submission

**Endpoints**:
- `GET /forms/:guildId/:formId` - Serve form page
- `POST /forms/:guildId/:formId` - Submit response

**GET Handler**:
- Validates form exists and is active
- Fetches guild info from Discord
- Generates HTML with branding
- Returns 404 if not found

**POST Handler**:
- Validates user identification (x-user-id header)
- Checks constraints (max responses, one per user)
- Validates answers against questions
- Stores response in database
- Sends notification to response channel
- Sends DM confirmation (if enabled)
- Emits event bus events
- Returns response ID on success

**Dependencies**:
- express
- discord.js (Client)
- helpers.ts (database operations, validation)
- formPage.ts (HTML generation)
- events.ts (emitFormSubmitted)
- logger

**Error Handling**:
- 400: Validation failed
- 401: No user identification
- 403: Form closed, max responses, or already submitted
- 404: Form not found
- 500: Server error

---

### Utility Files

#### `helpers.ts` (13.2 KB)
**Purpose**: Database operations and validation utilities

**Type Definitions**:
- `FormQuestion` - Question structure
- `FormData` - Complete form data
- `FormResponse` - User submission data
- `FormConfig` - Guild configuration

**Database Functions**:
- `initializePool(pool)` - Set up database connection
- `createForm()` - Create new form
- `getFormById()` - Fetch single form
- `getFormsByGuild()` - All forms in guild
- `getActiveFormsByGuild()` - Active forms only
- `updateForm()` - Update form fields
- `deleteForm()` - Delete form and responses
- `toggleFormActive()` - Toggle form status
- `submitFormResponse()` - Store user response
- `getFormResponses()` - Paginated responses
- `getUserFormResponses()` - User's submissions
- `updateResponseStatus()` - Approve/deny response
- `deleteFormResponse()` - Remove response
- `getFormConfig()` - Get guild config
- `createFormConfig()` - Initialize config
- `updateFormConfig()` - Update config
- `checkUserFormSubmissions()` - Count user's responses
- `checkFormResponseCount()` - Total response count

**Validation Functions**:
- `validateAnswer()` - Validate single answer
- `validateAnswers()` - Validate all answers
- Custom validators for each question type

**Utility Functions**:
- `formatFormData()` - Database row to FormData
- `formatResponseData()` - Database row to FormResponse

---

#### `events.ts` (2.9 KB)
**Purpose**: Event bus integration

**Event Types**:
- `formSubmitted` - New response submitted
- `formApproved` - Response approved by staff
- `formDenied` - Response denied by staff

**Functions**:
- `initializeEventBus()` - Setup event listeners
- `emitFormEvent()` - Emit typed event
- `emitFormSubmitted()` - Emit submission event
- `emitFormApproved()` - Emit approval event
- `emitFormDenied()` - Emit denial event

**Dependencies**:
- events (EventEmitter)
- logger

---

#### `types.ts` (2.1 KB)
**Purpose**: TypeScript type definitions

**Exports**:
- `QuestionType` - Union of question types
- `ResponseStatus` - Submission status
- `FormQuestion` - Question structure
- `FormData` - Form structure
- `FormResponse` - Response structure
- `FormConfig` - Configuration structure
- `ValidationResult` - Validation output
- `FormSubmissionResult` - Submission result
- `GuildInfo` - Guild metadata
- `FormEvent` - Event structure
- `PaginatedResponse<T>` - Pagination structure

---

#### `index.ts` (2.1 KB)
**Purpose**: Module entry point and loader

**Exports**:
- `formsModule` - Module object with commands collection
- `initializeFormsWebRoutes()` - Web route initialization

**Features**:
- Loads all 8 commands
- Initializes database pool
- Initializes event bus
- Registers with Discord client
- Provides module interface

---

### Documentation Files

#### `README.md` (12.8 KB)
Complete module documentation including:
- Features overview
- Installation instructions
- Environment setup
- All command documentation
- Question type reference
- API endpoint documentation
- Database schema explanation
- Event system documentation
- File structure
- Security considerations
- Troubleshooting guide

---

#### `INTEGRATION_GUIDE.md` (9.5 KB)
Step-by-step integration instructions:
- Database setup
- Environment variables
- Bot file integration
- Command registration
- Express route setup
- User identification methods (3 options)
- Event bus setup
- Autocomplete handlers
- Button handlers
- Complete minimal example
- Testing procedures
- Troubleshooting table
- Performance tips
- Security checklist

---

#### `DATABASE_SCHEMA.sql` (2.3 KB)
PostgreSQL schema with:
- `forms` table
- `form_responses` table
- `forms_config` table
- Indexes for performance
- Constraints and validations
- Update timestamp triggers
- Foreign key relationships

---

## File Statistics

| File | Lines | Size | Purpose |
|------|-------|------|---------|
| helpers.ts | 450+ | 13.2 KB | Database & validation |
| formPage.ts | 350+ | 8.5 KB | HTML generation |
| routes.ts | 250+ | 6.8 KB | Express routes |
| edit.ts | 180+ | 5.2 KB | Form editing |
| config.ts | 130+ | 3.5 KB | Configuration |
| responses.ts | 110+ | 3.2 KB | View responses |
| toggle.ts | 110+ | 3.1 KB | Toggle form |
| create.ts | 120+ | 3.8 KB | Create form |
| delete.ts | 100+ | 2.9 KB | Delete form |
| review.ts | 120+ | 3.6 KB | Review submissions |
| form.ts | 100+ | 2.8 KB | View forms |
| events.ts | 100+ | 2.9 KB | Event handling |
| types.ts | 70+ | 2.1 KB | Type definitions |
| index.ts | 70+ | 2.1 KB | Module loader |
| DATABASE_SCHEMA.sql | 80+ | 2.3 KB | Database |
| README.md | 450+ | 12.8 KB | Documentation |
| INTEGRATION_GUIDE.md | 350+ | 9.5 KB | Integration |

**Total**: ~2600 lines of code and documentation, ~96 KB

## Import Dependencies

### Discord.js Imports
```typescript
import {
  SlashCommandBuilder,
  CommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  Client,
  // ... other imports
} from 'discord.js';
```

### Node.js Core
```typescript
import { EventEmitter } from 'events';
import { Router, Request, Response } from 'express';
import { Pool, PoolClient } from 'pg';
import crypto from 'crypto';
```

### Internal Imports
```typescript
import { BotCommand } from '../../types/command';
import { logger } from '../../utils/logger';
```

## Database Tables

### forms
- UUID primary key
- Guild ID foreign key
- Form metadata (name, description)
- Questions (JSONB)
- Response channel ID
- Constraints (max responses, one per user)
- Settings (DM confirm, active status)
- Timestamps

### form_responses
- UUID primary key
- Form ID foreign key
- User ID
- Answers (JSONB)
- Status (pending/approved/denied)
- Review metadata
- Timestamps

### forms_config
- Guild ID primary key
- Enabled flag
- Approval requirement flag
- Notification channel ID
- Timestamps

## Integration Points

1. **Bot Client** - For guild/user lookups, DM sending
2. **Event Bus** - For form event emission
3. **Database Pool** - For all CRUD operations
4. **Express App** - For web routes
5. **Logger** - For error/info logging
6. **Discord API** - For sending embeds/DMs

## Security Features

- Input validation on all fields
- HTML escaping in form generation
- Parameterized SQL queries
- Permission checks on all commands
- User identification on form submissions
- Rate limiting ready (implement in middleware)
- HTTPS ready for production

## Performance Optimizations

- Database indexes on frequently queried fields
- Connection pooling support
- Pagination on large response sets
- Async/await throughout
- Efficient JSON serialization
- Minimal database roundtrips

## Testing Checklist

- [ ] Database schema creates successfully
- [ ] All 8 commands register correctly
- [ ] Form creation works
- [ ] Questions can be added/removed
- [ ] Form page generates valid HTML
- [ ] Form submissions validate correctly
- [ ] Responses store in database
- [ ] Notifications send to channel
- [ ] DMs send to users
- [ ] Events emit correctly
- [ ] Pagination works
- [ ] Permission checks enforce
- [ ] Form toggling works
- [ ] Form deletion cascades
- [ ] Autocomplete functions
- [ ] Mobile form view works
