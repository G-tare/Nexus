# CorwinDev/Discord-Bot vs Nexus Bot — Feature Comparison

## Overview

| | CorwinDev Bot | Nexus Bot |
|---|---|---|
| **Modules** | 41 | 42 |
| **Commands** | ~400 | ~432 |
| **Framework** | Discord.js v14 | Discord.js v14 |
| **Database** | MongoDB | Neon (PostgreSQL) + Upstash (Redis) |
| **Dashboard** | None | iOS SwiftUI + Express API |

---

## PART 1: Modules They Have That We Don't

These are entirely new module concepts we could add.

### 1. Activities
Discord's built-in Activities launcher (YouTube Together, Poker Night, Chess, etc.)
- `/activity` — Launch a Discord activity in a voice channel
- `/activity help` — List available activities

**Complexity:** Low — Discord provides the API, just need to generate activity invites.

---

### 2. Announcement
Dedicated announcement creation and management system.
- `/announcement create` — Create a formatted announcement with embeds
- `/announcement edit` — Edit an existing announcement

**Complexity:** Low-Medium — We have ScheduledMessages but no dedicated announcement builder with templates/formatting.

---

### 3. Autosetup
One-command server setup wizard that auto-creates channels, roles, and configures modules.
- `/autosetup logs` — Auto-create logging channels and enable logging
- `/autosetup fun` — Create fun/games channels
- `/autosetup games` — Create game channels
- `/autosetup welcome` — Create welcome channel and configure welcome messages
- `/autosetup customvoice` — Set up join-to-create voice system
- `/autosetup ticketpanel` — Create ticket panel in current channel

**Complexity:** Medium — Needs to orchestrate multiple module configs at once.

---

### 4. Casino
Dedicated gambling module with currency integration.
- `/casino blackjack` — Play blackjack against the dealer
- `/casino crash` — Bet on a rising multiplier, cash out before crash
- `/casino roulette` — Bet on numbers/colors
- `/casino slots` — Slot machine with multiple paylines

**Complexity:** Medium — We have slots/blackjack in Fun already, but a dedicated Casino module with more games and better currency integration would be cleaner.

---

### 5. Family
Social relationship system for server communities.
- `/family adopt` — Adopt another member as your child
- `/family propose` — Propose marriage to another member
- `/family divorce` — Divorce your partner
- `/family disown` — Disown an adopted child
- `/family delete` — Delete your family tree

**Complexity:** Medium — Needs a family tree DB schema with parent/child/spouse relationships.

---

### 6. Images
Image generation and manipulation (30+ commands).
- **Memes:** `/images drake`, `/images trumptweet`, `/images wasted`, `/images meme`
- **Animals:** `/images cat`, `/images dog`, `/images fox`, `/images bird`, `/images panda`
- **User-based:** `/images avatar`, `/images banner`, `/images blur`, `/images burn`, `/images clown`, `/images greyscale`, `/images invert`, `/images triggered`, `/images wanted`, `/images facepalm`, `/images kiss`, `/images spank`
- **Other:** `/images car`, `/images wallpaper`, `/images colorify`, `/images darkness`, `/images ad`

**Complexity:** Medium-High — Most use external image APIs (some-random-api, popcat API, etc.) or Canvas for generation.

---

### 7. Notepad
Personal note-taking system.
- `/notepad add` — Save a note
- `/notepad notes` — View all your notes
- `/notepad edit` — Edit a note
- `/notepad delete` — Delete a note

**Complexity:** Low — Simple CRUD with a notes table.

---

### 8. Profile
Customizable user profiles with social fields.
- `/profile create` — Create your profile
- `/profile` — View a profile
- `/profile aboutme` — Set about me text
- `/profile age` — Set age
- `/profile bday` — Set birthday display
- `/profile color` — Set profile embed color
- `/profile gender` — Set gender
- `/profile origin` — Set origin/location
- `/profile status` — Set custom status
- **Lists:** `/profile addactor`, `/profile addartist`, `/profile addfood`, `/profile addhobby`, `/profile addmovie`, `/profile addpet`, `/profile addsong` (and corresponding delete commands)

**Complexity:** Medium — DB schema for profile fields + list items, embed card generation.

---

### 9. Radio
Live radio streaming in voice channels.
- `/radio play` — Play a radio station (from preset list)
- `/radio stop` — Stop radio playback
- `/radio playing` — Show current station info

**Complexity:** Low-Medium — Pre-configured stream URLs piped through voice connection. Could integrate with our existing Music module or be standalone.

---

### 10. Report
Bug and user reporting system.
- `/report` — Submit a report (user or bug) to staff

**Complexity:** Low — Simple form → staff channel embed. Could be part of Moderation.

---

### 11. Search
Internet search and lookup tools.
- `/search google` — Google search
- `/search bing` — Bing search
- `/search youtube` — YouTube video search
- `/search ddg` — DuckDuckGo search
- `/search github` — GitHub repository search
- `/search npm` — NPM package search
- `/search steam` — Steam game search
- `/search itunes` — iTunes/Apple Music search
- `/search crypto` — Cryptocurrency price lookup
- `/search weather` — Weather forecast
- `/search corona` — COVID stats
- `/search hexcolour` — Hex color preview
- `/search translate` — Text translation
- `/search docs` — Discord.js docs search

**Complexity:** Medium — Each subcommand hits a different API. Some APIs need keys.

---

### 12. Soundboard
Sound effects playback in voice channels.
- **Windows:** `windowserror`, `windowsshutdown`, `windowsstartup`
- **Earrape:** `reee`, `defaultdance`, `startup`, `thomas`, `wegothim`
- **Songs:** `dancememe`, `despacito`, `elevator`, `rickastley`, `running`, `tobecontinued`
- **Discord:** `discordcall`, `discordjoin`, `discordleave`, `discordnotification`
- **Memes:** `fbi`, `jeff`, `lambo`, `missionfailed`, `moaning`, `nani`, `nyancat`, `ohh`, `rimshot`, `roblox`, `shotdown`, `spongebob`, `wow`, `yeet`

**Complexity:** Low-Medium — Pre-stored audio files played through voice connection. ~36 sound clips.

---

### 13. Tools (Utility Toolkit)
Miscellaneous utility commands.
- `/tools calculator` — Math calculator
- `/tools qrcode` — Generate QR code from text/URL
- `/tools pwdgen` — Generate secure password
- `/tools encode` — Base64 encode text
- `/tools decode` — Base64 decode text
- `/tools emojify` — Convert text to emoji letters
- `/tools enlarge` — Enlarge an emoji to full size
- `/tools anagram` — Find anagrams of a word
- `/tools url` — Shorten a URL
- `/tools sourcebin` — Create a sourcebin paste
- `/tools mcskin` — Look up Minecraft player skin
- `/tools mcstatus` — Check Minecraft server status
- `/tools button` — Create a link button message
- `/tools review` — Review a product/item

**Complexity:** Low-Medium — Most are simple API calls or text manipulation.

---

### 14. Guild Info
Detailed server information commands.
- `/guild info` — Full server information embed
- `/guild members` — Member count breakdown
- `/guild channelinfo` — Channel details
- `/guild roleinfo` — Role details (members, permissions, color)
- `/guild oldestmember` — Find the oldest member
- `/guild youngestmember` — Find the newest member
- `/guild stealemoji` — Copy an emoji to your server
- `/guild emojis` — List all server emojis
- `/guild inviteinfo` — Detailed invite information
- `/guild userinfo` — User information

**Complexity:** Low — Mostly Discord API queries formatted into embeds. We have `userinfo` in Moderation but not the rest.

---

## PART 2: Modules We Both Have — Commands We're Missing

These are commands within existing shared modules that CorwinDev has but we don't.

### Currency / Economy
They have a significantly more fleshed-out earning system:
- **`beg`** — Beg for coins (random small amount with funny messages)
- **`crime`** — Commit a crime for coins (risk/reward, can lose money)
- **`work`** — Work a job for coins (cooldown-based)
- **`fish`** — Go fishing for coins (mini-game element)
- **`hunt`** — Go hunting for coins (mini-game element)
- **`rob`** — Rob another user (PvP risk/reward, can backfire)
- **`hourly`** — Hourly coin claim
- **`monthly`** — Monthly coin claim (large amount)
- **`yearly`** — Yearly coin claim (massive amount)
- **`deposit`** — Deposit coins into bank (protected from robbery)
- **`withdraw`** — Withdraw coins from bank
- **`present`** — Give a random present to someone

> **Note:** We have `daily` and `weekly` already. Adding `hourly`/`monthly`/`yearly` plus the earning mini-games (work, fish, hunt, crime, beg) and the bank system (deposit/withdraw/rob protection) would massively expand our economy.

---

### Fun / Games
Interactive game commands we're missing:
- **`fasttype`** — Typing speed challenge (race to type a phrase)
- **`music-trivia`** — Guess the song from an audio clip
- **`snake`** — Play Snake in Discord (emoji-based grid game)
- **`skipword`** — Word chain game (each player continues with last letter)
- **`ascii`** — Convert text to ASCII art
- **`gif`** — Search and send GIFs (Tenor/Giphy integration)
- **`reverse`** — Reverse text
- **`say`** — Bot echoes a message (with optional channel target)
- **`hack`** — Fake "hacking" animation (funny staged messages)
- **`rickroll`** — Send a disguised rickroll link
- **Rate commands:** `howgay`, `simprate`, `cleverrate`, `epicgamerrate`, `stankrate` — Fun percentage ratings
- **Animal facts:** `birdfact`, `koalafact`, `pandafact` — (We have `catfact`, `dogfact`, `fact` already)

---

### Moderation
- **`demote`** — Remove a role from a user (opposite of `/role add`)

> **Note:** We already have `/mod role` which can add/remove roles, so this is largely covered. Just a naming/UX difference.

---

### Reaction Roles
- **`menu`** — Create a select menu (dropdown) reaction role

> **Note:** We have button-based reaction roles. Adding dropdown/select menu support would be a nice addition.

---

### Tickets
- **`notice`** — Add a staff notice/note to a ticket thread

> **Note:** We have notes in Moderation but not ticket-specific notices. Minor addition.

---

## PART 3: Summary — What's Worth Adding

### High Value (Would significantly enhance the bot)

| Module/Feature | Why | Effort |
|---|---|---|
| **Economy Expansion** (beg, work, fish, hunt, crime, rob, bank) | Makes currency actually engaging — earning methods beyond daily/weekly | Medium |
| **Profile System** | Hugely popular in community bots, drives engagement | Medium |
| **Images** | Visual commands are among the most-used in any bot | Medium-High |
| **Casino** | Dedicated gambling with crash, roulette + existing slots/blackjack | Medium |
| **Search/Lookup Tools** | Weather, crypto, YouTube search — everyday utility | Medium |
| **Guild Info** | Server info commands are used constantly | Low |

### Medium Value (Nice to have)

| Module/Feature | Why | Effort |
|---|---|---|
| **Autosetup Wizard** | Great onboarding UX for new server admins | Medium |
| **Family System** | Social feature that drives community interaction | Medium |
| **Fun Games** (fasttype, snake, music-trivia, skipword) | Interactive games keep users in the server | Medium |
| **Tools/Utilities** (calculator, QR code, password gen) | Useful everyday tools | Low |
| **Notepad** | Simple but handy personal notes | Low |
| **Reaction Role Menus** (dropdown select) | Cleaner UX for many role options | Low |

### Lower Priority

| Module/Feature | Why | Effort |
|---|---|---|
| **Activities** | Just launches Discord's built-in activities | Low |
| **Soundboard** | Niche use, needs audio files stored | Low-Medium |
| **Radio** | Niche, overlaps with Music module | Low |
| **Report** | Simple, could be a single command in Moderation | Low |
| **Announcement** | We have ScheduledMessages, slight overlap | Low |

---

## PART 4: What We Have That They Don't

For perspective, here are significant modules/features Nexus Bot has that CorwinDev doesn't:

- **AI Chatbot** — Full AI integration with personas and dedicated channels
- **Anti-Raid** — Dedicated raid detection and lockdown system
- **Confessions** — Anonymous confession system with moderation
- **Counting** — Counting game with stats and leaderboards
- **Donation Tracking** — Donation goals, milestones, leaderboards
- **Forms** — Custom form builder with review system
- **Logging** — Comprehensive audit logging (they have basic logs)
- **Polls** — Full poll system with multiple types
- **Quote Board** — Starboard-style quote saving
- **Raffles** — Ticket-based raffle system
- **Reminders** — Personal reminder system with repeat
- **Reputation** — Full rep system with roles and history
- **Scheduled Messages** — Recurring/scheduled message system
- **Shop** — Full item shop with inventory
- **Timers** — General-purpose countdown timers
- **Translation** — Real-time translation with channel auto-translate
- **Userphone** — Cross-server phone calls
- **Voice Phone** — Voice-based calls
- **Color Roles** — Full color role management (25 commands)
- **iOS Dashboard** — Full native mobile dashboard
- **Express API** — REST API for external integrations

**Nexus Bot is significantly more feature-rich in most shared categories** (Moderation has 45+ commands vs their 17, Music has 38 vs their 15, etc.)
