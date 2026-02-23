# Forms Module

A comprehensive Discord bot forms system that allows staff to create web-based forms, generate links, and manage user submissions through a Discord bot interface.

## Features

- **Web-Based Forms**: Create clean, responsive web forms (not Discord modals)
- **Form Management**: Create, edit, delete, and toggle forms
- **Question Types**: Support for 8 different question types with validation
- **User Submissions**: Store and manage user responses with approval workflow
- **Response Review**: Review pending, approved, and denied submissions
- **Constraints**: Max responses, one-per-user, optional DM confirmations
- **Event System**: Emit events for form submissions and reviews
- **Guild Branding**: Forms display guild name and icon for branding

## Installation

### 1. Database Setup

Run the SQL schema to create required tables:

```bash
psql -U your_user -d your_database -f DATABASE_SCHEMA.sql
```

This creates:
- `forms` table - Form definitions
- `form_responses` table - User submissions
- `forms_config` table - Module configuration per guild

### 2. Environment Variables

Add to your `.env` file:

```env
# Form web interface base URL
FORM_BASE_URL=https://your-domain.com
API_BASE_URL=http://localhost:3000

# Discord bot token
DISCORD_TOKEN=your_token_here
```

### 3. Module Integration

In your main bot initialization file:

```typescript
import formsModule, { initializeFormsWebRoutes } from './Modules/Forms';

// During bot initialization
client.on('ready', () => {
  // Initialize the Forms module
  formsModule.initialize(client, dbPool, eventBus);
  
  // Initialize web routes
  initializeFormsWebRoutes(client);
  
  logger.info('Forms module ready');
});

// Register all form commands
formsModule.commands.forEach((command) => {
  // Add to your command handler
});
```

### 4. Express Setup

Add the forms router to your Express app:

```typescript
import formsRouter from './Modules/Forms/web/routes';

app.use('/forms', formsRouter);
```

The router expects the `x-user-id` header to identify users:

```typescript
app.use((req, res, next) => {
  // Set x-user-id based on your authentication
  // For testing: req.headers['x-user-id'] = 'user_id_here';
  next();
});
```

## Commands

### User Commands

#### `/form [form]`
View available forms and get links to fill them out.
- `form` (optional): Select a specific form to get its link
- Shows all active forms if no form selected

**Example:**
```
/form form:Application Form
```

#### `/formresponses formid page`
View responses to a form with pagination.
- `formid` (required): The form ID
- `page` (optional): Page number (default: 1)

**Permission**: Manage Guild

### Staff Commands

#### `/formconfig <subcommand>`
Configure form module settings.

**Subcommands:**
- `view` - View current configuration
- `enable` - Enable the forms module
- `disable` - Disable the forms module
- `toggleapproval` - Toggle approval requirement
- `setnotificationchannel channel` - Set notification channel

**Permission**: Manage Guild

#### `/formcreate name [description] responsechannel [oneperuser] [dmconfirm] [maxresponses]`
Create a new form.
- `name` (required): Form name (max 100 chars)
- `description` (optional): Form description (max 500 chars)
- `responsechannel` (required): Where responses are sent
- `oneperuser` (optional): Only allow one submission per user (default: true)
- `dmconfirm` (optional): DM user after submission (default: false)
- `maxresponses` (optional): Maximum responses allowed

**Permission**: Manage Guild

**Example:**
```
/formcreate name:Application Form description:Join our team! responsechannel:#applications oneperuser:true dmconfirm:true maxresponses:100
```

#### `/formedit formid <subcommand>`
Edit a form and manage questions.

**Subcommands:**
- `addquestion label type required` - Add a question
  - `label`: Question text
  - `type`: short_text, long_text, multiple_choice, checkbox, dropdown, number, email, url
  - `required`: Yes/No
- `removequestion questionindex` - Remove a question (index starts at 1)
- `viewquestions` - View all questions
- `updatemeta [name] [description]` - Update form name/description

**Permission**: Manage Guild

**Example:**
```
/formedit formid:550e8400-e29b-41d4-a716-446655440000 addquestion label:Email type:email required:true

/formedit formid:550e8400-e29b-41d4-a716-446655440000 viewquestions
```

#### `/formtoggle formid`
Enable or disable a form.
- `formid` (required): The form ID to toggle

**Permission**: Manage Guild

#### `/formdelete formid`
Delete a form and all its responses (requires confirmation).
- `formid` (required): The form ID to delete

**Permission**: Manage Guild

#### `/formreview formid [status]`
Review and manage form submissions.
- `formid` (required): The form ID
- `status` (optional): Filter by status (pending, approved, denied)

**Permission**: Manage Guild

## Question Types

### 1. Short Text
- Single line text input
- Constraints: `minLength`, `maxLength`

### 2. Long Text
- Multi-line textarea
- Constraints: `minLength`, `maxLength`

### 3. Email
- Email validation with regex
- Format: standard email address

### 4. URL
- URL validation
- Format: valid web address starting with http/https

### 5. Number
- Numeric input with constraints
- Constraints: `min`, `max`

### 6. Multiple Choice
- Radio buttons (single select)
- Requires `options` array

### 7. Dropdown
- Select dropdown (single select)
- Requires `options` array

### 8. Checkbox
- Boolean checkbox
- Returns true/false

## API Endpoints

### GET `/forms/:guildId/:formId`
Serve the web form page.

**Response**: HTML form page

### POST `/forms/:guildId/:formId`
Submit form response.

**Headers Required:**
- `x-user-id`: User's Discord ID
- `Content-Type: application/json`

**Request Body:**
```json
{
  "Question Label": "Answer value",
  "Email": "user@example.com",
  "Agree": true
}
```

**Success Response (200):**
```json
{
  "message": "Response submitted successfully",
  "responseId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Error Responses:**
- `404`: Form not found
- `403`: Form closed, max responses reached, or already submitted
- `401`: User identification required
- `400`: Validation failed

## Database Schema

### forms table
```
id (UUID) - Primary key
guild_id (VARCHAR) - Discord guild ID
name (VARCHAR) - Form name
description (TEXT) - Form description
questions (JSONB) - Array of question objects
response_channel_id (VARCHAR) - Channel for responses
max_responses (INTEGER) - Limit responses
one_per_user (BOOLEAN) - Restrict to one per user
dm_confirm (BOOLEAN) - DM confirmation
is_active (BOOLEAN) - Form status
created_at (TIMESTAMP)
updated_at (TIMESTAMP)
```

### form_responses table
```
id (UUID) - Primary key
form_id (UUID) - Foreign key to forms
user_id (VARCHAR) - Discord user ID
answers (JSONB) - User's answers
status (VARCHAR) - pending/approved/denied
submitted_at (TIMESTAMP)
reviewed_at (TIMESTAMP)
reviewed_by (VARCHAR) - Reviewer user ID
review_notes (TEXT) - Review feedback
```

### forms_config table
```
guild_id (VARCHAR) - Primary key
enabled (BOOLEAN) - Module enabled
require_approval (BOOLEAN) - Require approval
notification_channel_id (VARCHAR) - Notification channel
created_at (TIMESTAMP)
updated_at (TIMESTAMP)
```

## Event System

The module emits the following events:

### formSubmitted
Triggered when a user submits a form response.
```typescript
{
  type: 'formSubmitted',
  formId: string,
  userId: string,
  guildId: string,
  response: FormResponse
}
```

### formApproved
Triggered when a staff member approves a submission.
```typescript
{
  type: 'formApproved',
  formId: string,
  userId: string,
  guildId: string,
  reviewedBy: string,
  reviewNotes?: string
}
```

### formDenied
Triggered when a staff member denies a submission.
```typescript
{
  type: 'formDenied',
  formId: string,
  userId: string,
  guildId: string,
  reviewedBy: string,
  reviewNotes?: string
}
```

All events are also logged as `auditLog` events.

## File Structure

```
Forms/
├── core/
│   ├── form.ts                # /form command
│   └── responses.ts           # /formresponses command
├── staff/
│   ├── config.ts              # /formconfig command
│   ├── create.ts              # /formcreate command
│   ├── edit.ts                # /formedit command
│   ├── delete.ts              # /formdelete command
│   ├── toggle.ts              # /formtoggle command
│   └── review.ts              # /formreview command
├── web/
│   ├── formPage.ts            # HTML generation
│   └── routes.ts              # Express routes
├── helpers.ts                 # DB operations & validation
├── events.ts                  # Event handlers
├── index.ts                   # Module loader
├── DATABASE_SCHEMA.sql        # Database schema
└── README.md                  # This file
```

## Example Usage

### Create a Form
```
/formcreate name:Job Application description:Apply for open positions responsechannel:#applications
```

### Add Questions
```
/formedit formid:xxx addquestion label:Full Name type:short_text required:true
/formedit formid:xxx addquestion label:Email type:email required:true
/formedit formid:xxx addquestion label:Position type:dropdown required:true
/formedit formid:xxx addquestion label:Experience type:long_text required:false
```

### Get Form Link
```
/form form:Job Application
```

### Review Responses
```
/formreview formid:xxx status:pending
```

## Security Considerations

1. **User Authentication**: Set `x-user-id` header securely in middleware
2. **CORS**: Configure CORS appropriately for your domain
3. **Rate Limiting**: Implement rate limiting on form submission endpoint
4. **Input Validation**: All inputs are validated on both client and server
5. **Permission Checks**: Staff commands require Manage Guild permission
6. **Database**: Use parameterized queries (all implemented in helpers.ts)

## Troubleshooting

### Forms not appearing
- Check `is_active` status in database
- Verify guild has the Forms module enabled
- Ensure form has at least one question

### Responses not received
- Check response channel exists and bot has send permissions
- Verify `x-user-id` header is being set
- Check PostgreSQL for errors in form_responses table

### DM confirmations not working
- Verify `dmConfirm` is true on form
- Check bot can DM user (user settings)
- Review logs for Discord API errors

### Web form not loading
- Verify `FORM_BASE_URL` environment variable is set correctly
- Check Express route is properly registered
- Verify form exists and is active in database

## Support

For issues or feature requests, contact the bot development team.
