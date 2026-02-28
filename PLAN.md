# AI Agent System — Full Implementation Plan

## What We're Building

Transforming the simple AI Chatbot module into a full **AI Agent** that can both converse naturally AND execute Discord server management actions through a tool-use system. Think of it as giving Nexus a brain that can actually DO things, not just talk.

**Example interactions:**
- "Hey Nexus, set up this server for gaming with channels for general chat, voice, announcements, and rules"
- "Hey Nexus, create a role called Moderators with blue color and give it manage messages permission"
- "Hey Nexus, change the permission for the ban command so only Admins can use it"
- "Hey Nexus, what's the weather like?" → just answers normally like a human

---

## Architecture: 3 Layers

### Layer 1: Provider Adapter (AI engine — provider-agnostic)
- **Default: Gemini Flash** (free tier: 15 req/min, 1M tokens/day)
- Also supports: Grok (xAI), OpenAI, Anthropic
- All use raw `fetch()` — no SDK packages
- Unified interface normalizes tool-use across all 4 providers
- Guild admins can swap provider + bring their own API key

### Layer 2: Discord Tool Registry (the "MCP server")
- **~36 tools** across 7 categories that the AI can call
- Each tool: name, description, JSON Schema params, permission check, execute function
- Categories: Channels (8), Roles (7), Messages (4), Permissions (3), Server (5), Bot Config (4), Utility (5)
- Permission-gated: AI can never exceed what the requesting user can do

### Layer 3: Agent Engine (orchestrates the tool-use loop)
1. User says "Hey Nexus, ..." → trigger detected
2. Build server context snapshot (channels, roles, categories, bot config)
3. Send to AI with system prompt + tools + context
4. AI returns tool calls → execute them → feed results back → AI calls more tools or responds
5. Max 15 iterations per message to prevent runaway loops
6. Final text response sent to Discord

---

## Files to Create (15 new files)

### Providers (5 files)
- `Modules/AIChatbot/providers/adapter.ts` — Unified interface + types + factory
- `Modules/AIChatbot/providers/gemini.ts` — Google Gemini (default free tier)
- `Modules/AIChatbot/providers/grok.ts` — xAI Grok (OpenAI-compatible format)
- `Modules/AIChatbot/providers/openai.ts` — OpenAI
- `Modules/AIChatbot/providers/anthropic.ts` — Anthropic Claude

### Tools (8 files)
- `Modules/AIChatbot/tools/registry.ts` — Tool registry class + DiscordTool interface
- `Modules/AIChatbot/tools/channels.ts` — create/delete/edit/move channel, create category, list channels, get channel info, set topic (8 tools)
- `Modules/AIChatbot/tools/roles.ts` — create/delete/edit role, assign/remove role, list roles, get role info (7 tools)
- `Modules/AIChatbot/tools/messages.ts` — send message, delete message, pin message, send embed (4 tools)
- `Modules/AIChatbot/tools/permissions.ts` — set channel perm, set role perm, set command perm (3 tools)
- `Modules/AIChatbot/tools/server.ts` — edit server, create/delete emoji, list members, get server info (5 tools)
- `Modules/AIChatbot/tools/botconfig.ts` — enable/disable module, update/get module config (4 tools)
- `Modules/AIChatbot/tools/utility.ts` — get server info, get channel info, get role info, get member info, list modules (5 tools)

### Core (2 files)
- `Modules/AIChatbot/agent.ts` — Agent engine (tool-use loop orchestrator)
- `Modules/AIChatbot/context.ts` — Server context builder (snapshots server state for AI)

---

## Files to Modify (5 existing files)

- `Modules/AIChatbot/helpers.ts` — Remove old provider calls (moved to adapter), add RateLimiter, update config interface with new fields
- `Modules/AIChatbot/events.ts` — Add "Hey Nexus" fuzzy trigger detection, route to agent engine
- `Modules/AIChatbot/index.ts` — Update defaultConfig with new agent fields
- `Modules/AIChatbot/staff/aiconfig.ts` — Add subcommands: trigger phrase, agent toggle, confirmation mode, provider selection (gemini/grok), tool access
- `Shared/src/config/index.ts` — Already has DEFAULT_AI_PROVIDER and DEFAULT_AI_API_KEY, no changes needed

---

## Config Changes

```
AIChatbotConfig adds:
  provider: 'gemini' | 'grok' | 'openai' | 'anthropic'  (was just openai|anthropic)
  agentEnabled: boolean          (default false — opt-in)
  triggerPhrase: string          (default "hey nexus")
  confirmDestructive: boolean    (default true)
  maxToolCalls: number           (default 20 per message)
  disabledTools: string[]        (tool IDs disabled for this guild)
```

---

## Safety & Permissions

- **Permission inheritance**: Before ANY tool executes, checks if the requesting user has the required Discord permission (ManageChannels, ManageRoles, etc.)
- **Destructive action confirmation**: Delete channel, delete role, disable module → confirmation embed with buttons, 30s timeout
- **Rate limiting**: 20 tool calls per message, 50 per minute per guild
- **Agent mode is opt-in**: `agentEnabled` defaults to false — guilds must explicitly enable it
- **Detailed error feedback**: When a tool fails, the AI gets a clear error message so it can self-correct or explain to the user

---

## Implementation Order

### Phase 1: Provider Adapter
adapter.ts → openai.ts → anthropic.ts → grok.ts → gemini.ts

### Phase 2: Tool Registry + All Tools
registry.ts → utility.ts → channels.ts → roles.ts → messages.ts → permissions.ts → server.ts → botconfig.ts

### Phase 3: Agent Engine + Context
context.ts → agent.ts → update helpers.ts → update events.ts

### Phase 4: Integration
update index.ts → update aiconfig.ts → typecheck

---

## Trigger System

Fuzzy matching for activation:
- "hey nexus" / "Hey Nexus," / "hey nexus!" / "Hey Nexus can you..." → all match
- @mention the bot + any message content
- Auto-reply in configured channels (existing feature, kept)
- If `agentEnabled` is false, falls back to simple chatbot mode (existing behavior preserved)
