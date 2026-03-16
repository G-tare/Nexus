import Foundation

// MARK: - Default Permission Level

enum DefaultAccess: String {
    case everyone = "Everyone"
    case staffOnly = "Staff Only"      // Manage Messages / Manage Guild / Mod role
    case adminOnly = "Admin Only"      // Administrator permission
    case ownerOnly = "Server Owner"    // Guild owner only
}

// MARK: - Command Definition

struct CommandDef: Identifiable {
    let id: String          // unique path like "moderation.ban"
    let name: String        // display name like "/ban"
    let description: String
    let module: String      // module key
    let subcommands: [String]  // subcommand names if any
    let defaultAccess: DefaultAccess

    init(_ name: String, desc: String, module: String, subs: [String] = [], access: DefaultAccess = .everyone) {
        self.id = "\(module).\(name)"
        self.name = name
        self.description = desc
        self.module = module
        self.subcommands = subs
        self.defaultAccess = access
    }
}

// MARK: - Complete Command Registry

enum CommandRegistry {

    /// All commands grouped by module key
    static let commands: [String: [CommandDef]] = [

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // CORE
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        "core": [
            CommandDef("report-user", desc: "Report a user", module: "core"),
            CommandDef("report-bug", desc: "Report a bug", module: "core"),
        ],

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // MODERATION
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        "moderation": [
            CommandDef("ban", desc: "Permanently ban a member", module: "moderation", access: .staffOnly),
            CommandDef("tempban", desc: "Temporarily ban a member", module: "moderation", access: .staffOnly),
            CommandDef("unban", desc: "Unban a user", module: "moderation", access: .staffOnly),
            CommandDef("massban", desc: "Ban multiple users at once", module: "moderation", access: .staffOnly),
            CommandDef("banlist", desc: "View server ban list", module: "moderation", access: .staffOnly),
            CommandDef("kick", desc: "Kick a member from the server", module: "moderation", access: .staffOnly),
            CommandDef("warn", desc: "Issue a warning", module: "moderation", access: .staffOnly),
            CommandDef("warnings", desc: "View warnings for a user", module: "moderation", access: .staffOnly),
            CommandDef("unwarn", desc: "Remove a specific warning", module: "moderation", access: .staffOnly),
            CommandDef("clearwarnings", desc: "Clear all warnings for a user", module: "moderation", access: .staffOnly),
            CommandDef("serverwarns", desc: "View all server warnings", module: "moderation", access: .staffOnly),
            CommandDef("mute", desc: "Mute a member", module: "moderation", access: .staffOnly),
            CommandDef("unmute", desc: "Unmute a member", module: "moderation", access: .staffOnly),
            CommandDef("massmute", desc: "Mute multiple members", module: "moderation", access: .staffOnly),
            CommandDef("mutelist", desc: "View active mutes", module: "moderation", access: .staffOnly),
            CommandDef("lock", desc: "Lock a channel", module: "moderation", access: .staffOnly),
            CommandDef("unlock", desc: "Unlock a channel", module: "moderation", access: .staffOnly),
            CommandDef("lockdown", desc: "Lock all channels", module: "moderation", access: .staffOnly),
            CommandDef("unlockdown", desc: "Unlock all channels", module: "moderation", access: .staffOnly),
            CommandDef("slowmode", desc: "Set channel slowmode", module: "moderation", access: .staffOnly),
            CommandDef("nuke", desc: "Clone and delete a channel", module: "moderation", access: .staffOnly),
            CommandDef("purge", desc: "Bulk delete messages", module: "moderation", access: .staffOnly),
            CommandDef("bulkdelete", desc: "Delete messages by count", module: "moderation", access: .staffOnly),
            CommandDef("purgeuser", desc: "Purge messages from a user", module: "moderation", access: .staffOnly),
            CommandDef("purgebot", desc: "Purge bot messages", module: "moderation", access: .staffOnly),
            CommandDef("purgehuman", desc: "Purge human messages", module: "moderation", access: .staffOnly),
            CommandDef("history", desc: "View moderation history", module: "moderation", access: .staffOnly),
            CommandDef("note", desc: "Add a note to a user", module: "moderation", access: .staffOnly),
            CommandDef("userinfo", desc: "View user information", module: "moderation", access: .staffOnly),
            CommandDef("softban", desc: "Ban and immediately unban", module: "moderation", access: .staffOnly),
            CommandDef("role", desc: "Add/remove roles from members", module: "moderation", access: .staffOnly),
            CommandDef("watchlist", desc: "Add user to watchlist", module: "moderation", access: .staffOnly),
            CommandDef("altdetect", desc: "Detect alt accounts", module: "moderation", access: .staffOnly),
            CommandDef("quarantine", desc: "Quarantine a member", module: "moderation", access: .staffOnly),
            CommandDef("unquarantine", desc: "Remove quarantine", module: "moderation", access: .staffOnly),
            CommandDef("shadowban", desc: "Shadow ban a member", module: "moderation", access: .staffOnly),
            CommandDef("unshadowban", desc: "Remove shadow ban", module: "moderation", access: .staffOnly),
            CommandDef("addreputation", desc: "Add reputation to a user", module: "moderation", access: .staffOnly),
            CommandDef("removereputation", desc: "Remove reputation from a user", module: "moderation", access: .staffOnly),
            CommandDef("setreputation", desc: "Set a user's reputation", module: "moderation", access: .staffOnly),
            CommandDef("reputationhistory", desc: "View reputation history", module: "moderation", access: .staffOnly),
            CommandDef("nickname", desc: "Change a member's nickname", module: "moderation", access: .staffOnly),
            CommandDef("case", desc: "View a specific moderation case", module: "moderation", access: .staffOnly),
            CommandDef("modstats", desc: "View moderation statistics", module: "moderation", access: .staffOnly),
            CommandDef("notes", desc: "View all notes for a user", module: "moderation", access: .staffOnly),
        ],

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // AUTOMOD
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        "automod": [
            CommandDef("automod", desc: "View automod settings", module: "automod", access: .staffOnly),
            CommandDef("testword", desc: "Test word filter", module: "automod", access: .staffOnly),
            CommandDef("antilink", desc: "Anti-link settings", module: "automod",
                       subs: ["toggle", "whitelist-add", "whitelist-remove", "blacklist-add", "blacklist-remove", "exempt-channel", "exempt-role"], access: .staffOnly),
            CommandDef("wordfilter", desc: "Word filter settings", module: "automod",
                       subs: ["add-words", "remove-words", "add-regex", "remove-regex", "list", "import"], access: .staffOnly),
        ],

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // LOGGING
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        "logging": [
            CommandDef("logchannel", desc: "Configure channels for logging event types", module: "logging", access: .staffOnly),
            CommandDef("logconfig", desc: "View all logging configuration", module: "logging", access: .staffOnly),
            CommandDef("logignore", desc: "Exclude channels, roles, or users from logging", module: "logging", access: .staffOnly),
            CommandDef("logtoggle", desc: "Toggle logging for specific event types", module: "logging", access: .staffOnly),
            CommandDef("logs", desc: "View recent log entries and logging configuration", module: "logging", access: .staffOnly),
        ],

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // ANTI-RAID
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        "antiraid": [
            CommandDef("antiraidconfig", desc: "Configure anti-raid settings", module: "antiraid",
                       subs: ["view", "enable", "disable", "jointhreshold", "joinwindow", "accountage", "action", "alertchannel", "quarantinerole", "lockdownduration", "verification"], access: .staffOnly),
            CommandDef("raidstatus", desc: "View current raid status", module: "antiraid", access: .staffOnly),
            CommandDef("raid-lockdown", desc: "Manually trigger lockdown", module: "antiraid", access: .staffOnly),
            CommandDef("raid-unlockdown", desc: "End lockdown", module: "antiraid", access: .staffOnly),
        ],

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // LEVELING
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        "leveling": [
            CommandDef("levels", desc: "View server level leaderboard", module: "leveling"),
            CommandDef("rank", desc: "View your or another's rank card", module: "leveling"),
            CommandDef("rewards", desc: "View level-up role rewards", module: "leveling"),
            CommandDef("levelroles", desc: "Manage level roles", module: "leveling",
                       subs: ["add", "remove", "list"], access: .adminOnly),
            CommandDef("doublexp", desc: "Toggle double XP events", module: "leveling",
                       subs: ["start", "stop", "status"], access: .adminOnly),
            CommandDef("setxp", desc: "Set a user's XP", module: "leveling", access: .staffOnly),
            CommandDef("setlevel", desc: "Set a user's level", module: "leveling", access: .staffOnly),
            CommandDef("resetxp", desc: "Reset a user's XP", module: "leveling", access: .staffOnly),
            CommandDef("xpmultiplier", desc: "Manage XP multipliers", module: "leveling",
                       subs: ["set", "remove", "list"], access: .adminOnly),
            CommandDef("noxproles", desc: "Roles that earn no XP", module: "leveling",
                       subs: ["add", "remove", "list"], access: .adminOnly),
            CommandDef("levelconfig", desc: "Configure leveling", module: "leveling",
                       subs: ["xp-range", "cooldown", "voice-xp", "announce", "announce-message", "stack-roles"], access: .adminOnly),
            CommandDef("cardstyle", desc: "Set rank card style", module: "leveling"),
            CommandDef("cardbg", desc: "Set rank card background", module: "leveling"),
        ],

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // WELCOME
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        "welcome": [
            CommandDef("welcometest", desc: "Preview welcome message", module: "welcome", access: .adminOnly),
            CommandDef("membercount", desc: "View member count", module: "welcome"),
            CommandDef("welcome", desc: "Configure welcome messages", module: "welcome",
                       subs: ["toggle", "channel", "message", "embed", "embed-color", "embed-title", "embed-footer", "embed-thumbnail", "image", "image-background"], access: .adminOnly),
            CommandDef("welcome-config", desc: "View welcome config", module: "welcome",
                       subs: ["view", "toggle"], access: .adminOnly),
            CommandDef("greet", desc: "Greeting settings", module: "welcome",
                       subs: ["toggle", "channel", "message"], access: .adminOnly),
            CommandDef("leave", desc: "Leave message settings", module: "welcome",
                       subs: ["toggle", "channel", "message", "embed", "embed-color", "embed-title"], access: .adminOnly),
            CommandDef("welcomedm", desc: "Welcome DM settings", module: "welcome",
                       subs: ["toggle", "message", "embed"], access: .adminOnly),
            CommandDef("autorole", desc: "Auto role settings", module: "welcome",
                       subs: ["toggle", "add", "remove", "add-bot", "remove-bot", "delay", "list"], access: .adminOnly),
            CommandDef("screening", desc: "Membership screening", module: "welcome",
                       subs: ["toggle", "role", "message"], access: .adminOnly),
            CommandDef("joingate", desc: "Join gate settings", module: "welcome",
                       subs: ["toggle", "min-age", "action", "verify-channel", "log-kicks"], access: .adminOnly),
        ],

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // TICKETS
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        "tickets": [
            CommandDef("ticket", desc: "Create a new ticket", module: "tickets"),
            CommandDef("close", desc: "Close a ticket", module: "tickets", access: .staffOnly),
            CommandDef("ticket-add", desc: "Add a user to a ticket", module: "tickets", access: .staffOnly),
            CommandDef("ticket-remove", desc: "Remove a user from a ticket", module: "tickets", access: .staffOnly),
            CommandDef("ticket-rename", desc: "Rename a ticket", module: "tickets", access: .staffOnly),
            CommandDef("claim", desc: "Claim a ticket", module: "tickets", access: .staffOnly),
            CommandDef("transfer", desc: "Transfer a ticket to another staff", module: "tickets", access: .staffOnly),
            CommandDef("priority", desc: "Set ticket priority", module: "tickets", access: .staffOnly),
            CommandDef("panellist", desc: "List ticket panels", module: "tickets", access: .staffOnly),
            CommandDef("ticketpanel", desc: "Create a ticket panel", module: "tickets", access: .adminOnly),
            CommandDef("paneledit", desc: "Edit a ticket panel", module: "tickets", access: .adminOnly),
            CommandDef("transcript", desc: "Generate ticket transcript", module: "tickets", access: .staffOnly),
            CommandDef("transcriptlog", desc: "View transcript log", module: "tickets", access: .staffOnly),
            CommandDef("ticket-notice", desc: "Add a staff notice to ticket", module: "tickets", access: .staffOnly),
            CommandDef("ticket-config", desc: "Configure ticket system", module: "tickets",
                       subs: ["view", "max-tickets", "auto-close", "close-behavior", "claim-toggle", "priority-toggle", "transcript-toggle", "feedback-toggle", "log-channel", "add-category", "remove-category", "edit-category", "staff-role", "naming-format", "welcome-message"], access: .adminOnly),
            CommandDef("ticket-staffrole", desc: "Manage staff roles", module: "tickets",
                       subs: ["add", "remove", "list"], access: .adminOnly),
            CommandDef("ticket-stats", desc: "View ticket statistics", module: "tickets", access: .staffOnly),
            CommandDef("ticket-feedback", desc: "Feedback settings", module: "tickets",
                       subs: ["toggle", "view"], access: .adminOnly),
        ],

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // MUSIC
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        "music": [
            CommandDef("play", desc: "Play a song or playlist", module: "music"),
            CommandDef("pause", desc: "Pause playback", module: "music"),
            CommandDef("resume", desc: "Resume playback", module: "music"),
            CommandDef("stop", desc: "Stop and clear queue", module: "music"),
            CommandDef("skip", desc: "Skip current track", module: "music"),
            CommandDef("previous", desc: "Play previous track", module: "music"),
            CommandDef("nowplaying", desc: "Show current track", module: "music"),
            CommandDef("seek", desc: "Seek to position", module: "music"),
            CommandDef("queue", desc: "View the queue", module: "music"),
            CommandDef("clear", desc: "Clear the queue", module: "music"),
            CommandDef("remove", desc: "Remove a track from queue", module: "music"),
            CommandDef("move", desc: "Move a track in queue", module: "music"),
            CommandDef("skipto", desc: "Skip to a specific track", module: "music"),
            CommandDef("shuffle", desc: "Shuffle the queue", module: "music"),
            CommandDef("loop", desc: "Toggle loop mode", module: "music"),
            CommandDef("volume", desc: "Set playback volume", module: "music"),
            CommandDef("filters", desc: "Audio filter settings", module: "music"),
            CommandDef("voteskip", desc: "Start a vote skip", module: "music"),
            CommandDef("autoplay", desc: "Toggle auto-play", module: "music"),
            CommandDef("playlist", desc: "Manage personal playlists", module: "music"),
            CommandDef("serverplaylist", desc: "Manage server playlists", module: "music"),
            CommandDef("favorites", desc: "Manage favorite tracks", module: "music"),
            CommandDef("songinfo", desc: "View song details", module: "music"),
            CommandDef("lyrics", desc: "View song lyrics", module: "music"),
            CommandDef("musicconfig", desc: "Music configuration", module: "music", access: .adminOnly),
            CommandDef("forceplay", desc: "Force play a track now", module: "music", access: .staffOnly),
            CommandDef("djrole", desc: "Set the DJ role", module: "music", access: .adminOnly),
            CommandDef("radio-play", desc: "Play a radio station", module: "music"),
            CommandDef("radio-stop", desc: "Stop radio", module: "music"),
            CommandDef("radio-list", desc: "List radio stations", module: "music"),
        ],

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // CURRENCY
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        "currency": [
            CommandDef("balance", desc: "View your currency balance or another user's balance", module: "currency"),
            CommandDef("daily", desc: "Claim your daily currency reward", module: "currency"),
            CommandDef("weekly", desc: "Claim your weekly currency reward", module: "currency"),
            CommandDef("pay", desc: "Transfer currency to another user", module: "currency"),
            CommandDef("economy", desc: "View the server economy overview", module: "currency"),
            CommandDef("richest", desc: "View the richest users in the server", module: "currency"),
            CommandDef("currency-give", desc: "Give currency to a user", module: "currency", access: .staffOnly),
            CommandDef("currency-take", desc: "Remove currency from a user", module: "currency", access: .staffOnly),
            CommandDef("currency-setbalance", desc: "Set exact currency balance for a user", module: "currency", access: .staffOnly),
            CommandDef("currency-reset", desc: "Reset all currency balances to 0 for a user", module: "currency", access: .staffOnly),
            CommandDef("currency-config", desc: "Configure currency settings", module: "currency", access: .adminOnly),
            CommandDef("currency-audit", desc: "View transaction history for a user", module: "currency", access: .staffOnly),
            CommandDef("bank-deposit", desc: "Deposit coins into your bank", module: "currency"),
            CommandDef("bank-withdraw", desc: "Withdraw coins from your bank", module: "currency"),
            CommandDef("bank-balance", desc: "View bank and savings balances", module: "currency"),
            CommandDef("bank-savings", desc: "Deposit into savings account", module: "currency",
                       subs: ["deposit", "check", "collect"]),
            CommandDef("bank-collect", desc: "Collect matured savings with interest", module: "currency"),
            CommandDef("bank-upgrade", desc: "Upgrade your deposit limit", module: "currency"),
            CommandDef("earn-beg", desc: "Beg for coins", module: "currency"),
            CommandDef("earn-fish", desc: "Go fishing for coins", module: "currency"),
            CommandDef("earn-hunt", desc: "Hunt for coins", module: "currency"),
            CommandDef("earn-crime", desc: "Commit a crime for coins", module: "currency"),
            CommandDef("earn-rob", desc: "Rob another user's wallet", module: "currency"),
            CommandDef("earn-dig", desc: "Dig for buried treasure", module: "currency"),
            CommandDef("earn-search", desc: "Search for coins in random locations", module: "currency"),
            CommandDef("earn-monthly", desc: "Claim monthly bonus", module: "currency"),
            CommandDef("job-apply", desc: "Apply for a job", module: "currency"),
            CommandDef("job-work", desc: "Complete a work shift", module: "currency"),
            CommandDef("job-info", desc: "View your job info", module: "currency"),
            CommandDef("job-quit", desc: "Quit your current job", module: "currency"),
            CommandDef("job-list", desc: "View available jobs", module: "currency"),
            CommandDef("job-leaderboard", desc: "Top earners leaderboard", module: "currency"),
        ],

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // SHOP
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        "shop": [
            CommandDef("shop", desc: "Browse the server shop", module: "shop"),
            CommandDef("buy", desc: "Buy an item", module: "shop"),
            CommandDef("use", desc: "Use an item from inventory", module: "shop"),
            CommandDef("inventory", desc: "View your inventory", module: "shop"),
            CommandDef("shop-config", desc: "Configure the shop", module: "shop",
                       subs: ["view", "currency", "tax", "max-items", "log-channel", "show-out-of-stock", "refunds", "refund-percent", "toggle"], access: .adminOnly),
            CommandDef("shop-add", desc: "Add an item to the shop", module: "shop", access: .adminOnly),
            CommandDef("shop-edit", desc: "Edit a shop item", module: "shop",
                       subs: ["price", "stock", "description", "toggle", "max-per-user", "requirement"], access: .adminOnly),
            CommandDef("shop-remove", desc: "Remove a shop item", module: "shop", access: .adminOnly),
        ],

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // CASINO
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        "casino": [
            CommandDef("blackjack", desc: "Play blackjack against the dealer", module: "casino"),
            CommandDef("slots", desc: "Spin the slot machine", module: "casino"),
            CommandDef("crash", desc: "Bet on a rising multiplier", module: "casino"),
            CommandDef("roulette", desc: "Bet on the roulette wheel", module: "casino"),
            CommandDef("coinflip", desc: "Flip a coin heads or tails", module: "casino"),
            CommandDef("poker", desc: "Play video poker", module: "casino"),
            CommandDef("wheel", desc: "Spin the wheel of fortune", module: "casino"),
            CommandDef("scratchcard", desc: "Scratch a card for prizes", module: "casino"),
            CommandDef("horserace", desc: "Bet on horse racing", module: "casino"),
            CommandDef("highlow", desc: "Higher or lower card game", module: "casino"),
            CommandDef("casino-config", desc: "Configure casino settings", module: "casino", access: .staffOnly),
        ],

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // FUN
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        "fun": [
            CommandDef("wouldyourather", desc: "Would you rather game", module: "fun"),
            CommandDef("blackjack", desc: "Play blackjack", module: "fun"),
            CommandDef("wordle", desc: "Play wordle", module: "fun", subs: ["start", "guess"]),
            CommandDef("trivia", desc: "Trivia quiz", module: "fun"),
            CommandDef("tictactoe", desc: "Tic tac toe game", module: "fun"),
            CommandDef("rps", desc: "Rock paper scissors", module: "fun"),
            CommandDef("roll", desc: "Roll dice", module: "fun"),
            CommandDef("connect4", desc: "Connect 4 game", module: "fun"),
            CommandDef("hug", desc: "Hug someone", module: "fun"),
            CommandDef("pat", desc: "Pat someone", module: "fun"),
            CommandDef("pout", desc: "Pout at someone", module: "fun"),
            CommandDef("wave", desc: "Wave at someone", module: "fun"),
            CommandDef("poke", desc: "Poke someone", module: "fun"),
            CommandDef("bite", desc: "Bite someone", module: "fun"),
            CommandDef("dance", desc: "Dance emote", module: "fun"),
            CommandDef("boop", desc: "Boop someone", module: "fun"),
            CommandDef("punch", desc: "Punch someone", module: "fun"),
            CommandDef("laugh", desc: "Laugh emote", module: "fun"),
            CommandDef("highfive", desc: "High five someone", module: "fun"),
            CommandDef("kick-fun", desc: "Fun kick emote", module: "fun"),
            CommandDef("slap", desc: "Slap someone", module: "fun"),
            CommandDef("kiss", desc: "Kiss someone", module: "fun"),
            CommandDef("cry", desc: "Cry emote", module: "fun"),
            CommandDef("cuddle", desc: "Cuddle someone", module: "fun"),
            CommandDef("compliment", desc: "Give a compliment", module: "fun"),
            CommandDef("fact", desc: "Random fun fact", module: "fun"),
            CommandDef("roast", desc: "Roast someone", module: "fun"),
            CommandDef("meme", desc: "Random meme", module: "fun"),
            CommandDef("quote", desc: "Random quote", module: "fun"),
            CommandDef("dog", desc: "Random dog image", module: "fun"),
            CommandDef("cat", desc: "Random cat image", module: "fun"),
            CommandDef("joke", desc: "Random joke", module: "fun"),
            CommandDef("guess", desc: "Number guessing game", module: "fun"),
            CommandDef("hangman", desc: "Play hangman", module: "fun"),
            CommandDef("tord", desc: "Truth or dare", module: "fun"),
            CommandDef("wordchain", desc: "Word chain game", module: "fun"),
            CommandDef("snake", desc: "Play snake", module: "fun"),
            CommandDef("fasttype", desc: "Typing speed challenge", module: "fun"),
            CommandDef("memory", desc: "Memory match game", module: "fun"),
            CommandDef("reaction", desc: "Reaction speed test", module: "fun"),
            CommandDef("mathrace", desc: "Math race game", module: "fun"),
            CommandDef("scramble", desc: "Word scramble", module: "fun"),
            CommandDef("quizbowl", desc: "Extended quiz", module: "fun"),
            CommandDef("puzzle", desc: "Number slide puzzle", module: "fun"),
            CommandDef("highlow", desc: "Higher or lower cards", module: "fun"),
            CommandDef("duel", desc: "PvP duel challenge", module: "fun"),
            CommandDef("activity", desc: "Launch Discord activity", module: "fun"),
            CommandDef("ascii", desc: "Convert text to ASCII art", module: "fun"),
            CommandDef("say", desc: "Echo a message", module: "fun", access: .staffOnly),
            CommandDef("reverse", desc: "Reverse text", module: "fun"),
            CommandDef("emojify", desc: "Convert text to emojis", module: "fun"),
            CommandDef("rate", desc: "Rate anything 0-10", module: "fun"),
            CommandDef("ship", desc: "Ship two users", module: "fun"),
            CommandDef("hack", desc: "Fake hacking animation", module: "fun"),
            CommandDef("birdfact", desc: "Random bird fact", module: "fun"),
            CommandDef("pandafact", desc: "Random panda fact", module: "fun"),
            CommandDef("fox", desc: "Random fox image", module: "fun"),
        ],

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // GIVEAWAYS
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        "giveaways": [
            CommandDef("giveaway-config", desc: "Configure giveaways", module: "giveaways",
                       subs: ["view", "channel", "emoji", "buttons", "dm-winners", "ping-role", "color", "end-action", "max-active", "self-entry"], access: .staffOnly),
            CommandDef("gschedule", desc: "Schedule a giveaway", module: "giveaways", access: .staffOnly),
            CommandDef("drop", desc: "Create an instant giveaway", module: "giveaways", access: .staffOnly),
            CommandDef("glist", desc: "List active giveaways", module: "giveaways"),
            CommandDef("greroll", desc: "Reroll a giveaway winner", module: "giveaways", access: .staffOnly),
            CommandDef("gcancel", desc: "Cancel a giveaway", module: "giveaways", access: .staffOnly),
        ],

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // COUNTING
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        "counting": [
            CommandDef("counting", desc: "View counting status", module: "counting"),
            CommandDef("counting-config", desc: "Configure counting", module: "counting", access: .adminOnly),
        ],

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // AFK
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        "afk": [
            CommandDef("afk", desc: "Set your AFK status", module: "afk"),
            CommandDef("afklist", desc: "View AFK members", module: "afk"),
            CommandDef("afk-config", desc: "Configure AFK system", module: "afk",
                       subs: ["view", "toggle", "max-length", "dm-pings", "max-pings", "auto-remove", "log-channel"], access: .adminOnly),
            CommandDef("afk-remove", desc: "Remove someone's AFK", module: "afk", subs: ["user"], access: .staffOnly),
            CommandDef("afk-ban", desc: "Ban user from AFK", module: "afk", subs: ["ban", "unban", "list"], access: .staffOnly),
        ],

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // AI CHATBOT
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        "aichatbot": [
            CommandDef("ask", desc: "Ask the AI a question", module: "aichatbot"),
            CommandDef("aiclear", desc: "Clear AI conversation history", module: "aichatbot"),
            CommandDef("aiconfig", desc: "Configure AI chatbot", module: "aichatbot", access: .adminOnly),
            CommandDef("aichannel", desc: "Set AI channel", module: "aichatbot", access: .adminOnly),
            CommandDef("aipersona", desc: "Set AI persona", module: "aichatbot", access: .adminOnly),
        ],

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // ACTIVITY TRACKING
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        "activitytracking": [
            CommandDef("inactivelist", desc: "View inactive members", module: "activitytracking", access: .staffOnly),
            CommandDef("activityconfig", desc: "Configure activity tracking", module: "activitytracking",
                       subs: ["view", "excludechannel", "excluderole", "threshold"], access: .adminOnly),
        ],

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // MESSAGE TRACKING
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        "messagetracking": [
            CommandDef("snipe", desc: "View last deleted message", module: "messagetracking"),
            CommandDef("editsnipe", desc: "View last edited message", module: "messagetracking"),
            CommandDef("messagetrackconfig", desc: "Configure message tracking", module: "messagetracking",
                       subs: ["view", "logchannel", "snipe", "ghostping", "ignorechannel"], access: .adminOnly),
        ],

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // INVITE TRACKER
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        "invitetracker": [
            CommandDef("invites", desc: "View invite stats", module: "invitetracker"),
            CommandDef("invite-leaderboard", desc: "Invite leaderboard", module: "invitetracker"),
            CommandDef("invite-config", desc: "Configure invite tracker", module: "invitetracker",
                       subs: ["view", "toggle", "track-leaves", "track-fakes", "fake-age", "fake-leave-hours", "log-channel", "announce"], access: .adminOnly),
            CommandDef("invite-reset", desc: "Reset invite counts", module: "invitetracker",
                       subs: ["user", "all"], access: .staffOnly),
            CommandDef("invite-bonus", desc: "Manage invite bonuses", module: "invitetracker",
                       subs: ["add", "remove", "view"], access: .staffOnly),
        ],

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // SUGGESTIONS
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        "suggestions": [
            CommandDef("suggest", desc: "Submit a suggestion", module: "suggestions"),
            CommandDef("suggestion-config", desc: "Configure suggestions", module: "suggestions",
                       subs: ["view", "channel", "anonymous", "emojis", "thread", "require-reason", "dm-notify", "editing", "colors"], access: .adminOnly),
            CommandDef("suggestion-approve", desc: "Approve a suggestion", module: "suggestions", access: .staffOnly),
            CommandDef("suggestion-consider", desc: "Mark as considering", module: "suggestions", access: .staffOnly),
            CommandDef("suggestion-deny", desc: "Deny a suggestion", module: "suggestions", access: .staffOnly),
            CommandDef("suggestion-remove", desc: "Remove a suggestion", module: "suggestions", access: .staffOnly),
            CommandDef("suggestion-implement", desc: "Mark as implemented", module: "suggestions", access: .staffOnly),
        ],

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // POLLS
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        "polls": [
            CommandDef("poll", desc: "Create a poll", module: "polls"),
            CommandDef("quickpoll", desc: "Create a quick yes/no poll", module: "polls"),
            CommandDef("pollresults", desc: "View poll results", module: "polls"),
            CommandDef("pollend", desc: "End a poll early", module: "polls", access: .staffOnly),
            CommandDef("poll-config", desc: "Configure polls", module: "polls",
                       subs: ["view", "anonymous", "live-results", "max-votes", "max-options", "max-duration"], access: .adminOnly),
        ],

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // FORMS
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        "forms": [
            CommandDef("form", desc: "Fill out a form", module: "forms"),
            CommandDef("formresponses", desc: "View form responses", module: "forms", access: .staffOnly),
            CommandDef("formconfig", desc: "Configure forms", module: "forms",
                       subs: ["view", "enable", "disable", "toggleapproval", "setnotificationchannel"], access: .adminOnly),
            CommandDef("formcreate", desc: "Create a new form", module: "forms", access: .adminOnly),
            CommandDef("formedit", desc: "Edit a form", module: "forms",
                       subs: ["addquestion", "removequestion", "viewquestions", "updatemeta"], access: .adminOnly),
            CommandDef("formdelete", desc: "Delete a form", module: "forms", access: .adminOnly),
            CommandDef("formtoggle", desc: "Enable/disable a form", module: "forms", access: .adminOnly),
            CommandDef("formreview", desc: "Review form submissions", module: "forms", access: .staffOnly),
        ],

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // AUTOROLES
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        "autoroles": [
            CommandDef("autoroleconfig", desc: "Configure auto roles", module: "autoroles",
                       subs: ["view", "persistent", "ignorebots", "logchannel", "stackroles"], access: .adminOnly),
            CommandDef("autorolelist", desc: "List auto roles", module: "autoroles"),
            CommandDef("autoroleadd", desc: "Add an auto role", module: "autoroles", access: .adminOnly),
            CommandDef("autoroleedit", desc: "Edit an auto role", module: "autoroles", access: .adminOnly),
            CommandDef("autoroledelete", desc: "Delete an auto role", module: "autoroles", access: .adminOnly),
            CommandDef("autoroleclear", desc: "Clear all auto roles", module: "autoroles", access: .adminOnly),
            CommandDef("myroles", desc: "View your roles", module: "autoroles"),
        ],

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // REPUTATION
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        "reputation": [
            CommandDef("setrep", desc: "Set reputation", module: "reputation"),
            CommandDef("repconfig", desc: "Configure reputation", module: "reputation", subs: ["view", "defaultrep"], access: .adminOnly),
        ],

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // COLOR ROLES
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        "colorroles": [
            CommandDef("color", desc: "Set your color", module: "colorroles"),
            CommandDef("colorinfo", desc: "View color info", module: "colorroles"),
            CommandDef("colorlist", desc: "List available colors", module: "colorroles"),
            CommandDef("colorremove", desc: "Remove your color", module: "colorroles"),
            CommandDef("colorrandom", desc: "Get a random color", module: "colorroles"),
            CommandDef("colorconfig", desc: "Configure color roles", module: "colorroles",
                       subs: ["view", "joincolor", "channel", "reactionmessages", "deleteresponses", "overlapwarning", "maxcolors", "managementrole", "whitelist", "anchor"], access: .adminOnly),
            CommandDef("coloradd", desc: "Add a color role", module: "colorroles", access: .adminOnly),
            CommandDef("coloredit", desc: "Edit a color role", module: "colorroles", access: .adminOnly),
            CommandDef("colordelete", desc: "Delete a color role", module: "colorroles", access: .adminOnly),
            CommandDef("colorexport", desc: "Export color config", module: "colorroles", access: .adminOnly),
            CommandDef("colorimport", desc: "Import color config", module: "colorroles", access: .adminOnly),
        ],

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // QUOTE BOARD
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        "quoteboard": [
            CommandDef("board", desc: "View the quote board", module: "quoteboard"),
            CommandDef("random-star", desc: "Random starred message", module: "quoteboard"),
            CommandDef("board-config", desc: "Configure quote board", module: "quoteboard",
                       subs: ["view", "create", "delete", "threshold", "self-react", "nsfw", "ignore-channel", "ignore-role", "color"], access: .adminOnly),
        ],

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // LEADERBOARDS
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        "leaderboards": [
            CommandDef("leaderboard", desc: "View leaderboards", module: "leaderboards"),
            CommandDef("top", desc: "View top members", module: "leaderboards"),
            CommandDef("leaderboard-config", desc: "Configure leaderboards", module: "leaderboards",
                       subs: ["view", "default-type", "entries", "rank-card", "toggle-type"], access: .adminOnly),
        ],

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // SCHEDULED MESSAGES
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        "scheduledmessages": [
            CommandDef("schedule", desc: "Schedule a message", module: "scheduledmessages", access: .staffOnly),
            CommandDef("scheduleedit", desc: "Edit a scheduled message", module: "scheduledmessages", access: .staffOnly),
            CommandDef("scheduledelete", desc: "Delete a scheduled message", module: "scheduledmessages", access: .staffOnly),
            CommandDef("schedulelist", desc: "List scheduled messages", module: "scheduledmessages", access: .staffOnly),
            CommandDef("scheduleconfig", desc: "Configure scheduling", module: "scheduledmessages", subs: ["view", "set"], access: .adminOnly),
        ],

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // CUSTOM COMMANDS
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        "customcommands": [
            CommandDef("ccreate", desc: "Create a custom command", module: "customcommands", access: .adminOnly),
            CommandDef("cedit", desc: "Edit a custom command", module: "customcommands", access: .adminOnly),
            CommandDef("cdelete", desc: "Delete a custom command", module: "customcommands", access: .adminOnly),
            CommandDef("clist", desc: "List custom commands", module: "customcommands"),
            CommandDef("cconfig", desc: "Configure custom commands", module: "customcommands", subs: ["view", "set"], access: .adminOnly),
            CommandDef("cvariables", desc: "View available variables", module: "customcommands"),
        ],

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // STICKY MESSAGES
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        "stickymessages": [
            CommandDef("stick", desc: "Stick a message", module: "stickymessages", access: .staffOnly),
            CommandDef("unstick", desc: "Unstick a message", module: "stickymessages", access: .staffOnly),
            CommandDef("stickyedit", desc: "Edit a sticky message", module: "stickymessages", access: .staffOnly),
            CommandDef("sticky-config", desc: "Configure sticky messages", module: "stickymessages", access: .adminOnly),
        ],

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // STATS CHANNELS
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        "statschannels": [
            CommandDef("statsconfig", desc: "Configure stats channels", module: "statschannels",
                       subs: ["view", "interval", "format", "categoryname", "goal"], access: .adminOnly),
            CommandDef("statsedit", desc: "Edit a stats channel", module: "statschannels", access: .adminOnly),
            CommandDef("statscreate", desc: "Create a stats channel", module: "statschannels", access: .adminOnly),
            CommandDef("statsdelete", desc: "Delete a stats channel", module: "statschannels", access: .adminOnly),
            CommandDef("statslist", desc: "List stats channels", module: "statschannels"),
        ],

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // TEMP VOICE
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        "tempvoice": [
            CommandDef("vcconfig", desc: "Configure temp voice", module: "tempvoice",
                       subs: ["view", "enable", "disable", "creator", "category", "maxvcs", "cooldown", "deleteempty", "inactivity"], access: .adminOnly),
            CommandDef("vcban", desc: "Ban from temp voice", module: "tempvoice", access: .staffOnly),
            CommandDef("vcunban", desc: "Unban from temp voice", module: "tempvoice", access: .staffOnly),
            CommandDef("vcforceclose", desc: "Force close a temp VC", module: "tempvoice", access: .staffOnly),
        ],

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // REMINDERS
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        "reminders": [
            CommandDef("remind", desc: "Set a reminder for a specific time", module: "reminders"),
            CommandDef("reminders", desc: "View all your active reminders", module: "reminders"),
            CommandDef("remind-repeat", desc: "Set a recurring reminder", module: "reminders"),
            CommandDef("reminder-cancel", desc: "Cancel a reminder by ID", module: "reminders"),
            CommandDef("snooze", desc: "Snooze a recently fired reminder", module: "reminders"),
        ],

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // TRANSLATION
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        "translation": [
            CommandDef("translate", desc: "Translate text", module: "translation"),
            CommandDef("translatelast", desc: "Translate last message", module: "translation"),
            CommandDef("languages", desc: "View supported languages", module: "translation"),
            CommandDef("translateconfig", desc: "Configure translation", module: "translation",
                       subs: ["view", "provider", "libreurl", "flagreactions", "defaultlang", "webhooks", "cooldown"], access: .adminOnly),
            CommandDef("translatechannel", desc: "Set auto-translate channel", module: "translation", access: .adminOnly),
            CommandDef("translateremove", desc: "Remove auto-translate", module: "translation", access: .adminOnly),
        ],

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // REACTION ROLES
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        "reactionroles": [
            CommandDef("reactionrole", desc: "Create a new reaction role panel", module: "reactionroles", access: .adminOnly),
            CommandDef("rr-button", desc: "Create a quick button-based reaction role panel", module: "reactionroles", access: .adminOnly),
            CommandDef("rr-list", desc: "List all reaction role panels in this server", module: "reactionroles"),
            CommandDef("rr-edit", desc: "Edit a reaction role panel", module: "reactionroles", access: .adminOnly),
            CommandDef("rr-remove", desc: "Delete a reaction role panel", module: "reactionroles", access: .adminOnly),
            CommandDef("rr-config", desc: "Manage reaction role settings", module: "reactionroles", access: .adminOnly),
        ],

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // BIRTHDAYS
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        "birthdays": [
            CommandDef("birthday", desc: "Set your birthday", module: "birthdays"),
            CommandDef("birthdayview", desc: "View someone's birthday", module: "birthdays"),
            CommandDef("birthdaylist", desc: "Show all birthdays in a specific month", module: "birthdays"),
            CommandDef("birthdayupcoming", desc: "Show upcoming birthdays in this server", module: "birthdays"),
            CommandDef("birthdayannounce", desc: "Manually trigger a birthday announcement (staff only)", module: "birthdays", access: .staffOnly),
            CommandDef("birthdayconfig", desc: "Configure birthday module settings (staff only)", module: "birthdays", access: .adminOnly),
            CommandDef("birthdayremove", desc: "Remove a user's birthday (staff only)", module: "birthdays", access: .staffOnly),
        ],

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // CONFESSIONS
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        "confessions": [
            CommandDef("confess", desc: "Submit an anonymous confession", module: "confessions"),
            CommandDef("confession-approve", desc: "Approve a pending confession", module: "confessions", access: .staffOnly),
            CommandDef("confession-deny", desc: "Deny a pending confession", module: "confessions", access: .staffOnly),
            CommandDef("confession-ban", desc: "Ban or unban users from confessions", module: "confessions", access: .staffOnly),
            CommandDef("confession-config", desc: "Configure confessions module", module: "confessions", access: .adminOnly),
            CommandDef("confession-reveal", desc: "Reveal the author of a confession (owner only)", module: "confessions", access: .ownerOnly),
        ],

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // PROFILE
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        "profile": [
            CommandDef("profile-view", desc: "View a user's profile", module: "profile"),
            CommandDef("profile-create", desc: "Create your profile", module: "profile"),
            CommandDef("profile-delete", desc: "Delete your profile", module: "profile"),
            CommandDef("profile-aboutme", desc: "Set your about me", module: "profile"),
            CommandDef("profile-age", desc: "Set your age", module: "profile"),
            CommandDef("profile-gender", desc: "Set your gender", module: "profile"),
            CommandDef("profile-location", desc: "Set your location", module: "profile"),
            CommandDef("profile-status", desc: "Set your status", module: "profile"),
            CommandDef("profile-birthday", desc: "Set your birthday", module: "profile"),
            CommandDef("profile-color", desc: "Set profile embed color", module: "profile"),
            CommandDef("profile-banner", desc: "Set banner image", module: "profile"),
            CommandDef("profile-add", desc: "Add to a favorites list", module: "profile"),
            CommandDef("profile-remove", desc: "Remove from a favorites list", module: "profile"),
            CommandDef("profile-config", desc: "Configure profile settings", module: "profile", access: .staffOnly),
        ],

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // FAMILY
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        "family": [
            CommandDef("family-propose", desc: "Propose marriage", module: "family"),
            CommandDef("family-adopt", desc: "Adopt a user as your child", module: "family"),
            CommandDef("family-divorce", desc: "Divorce your partner", module: "family"),
            CommandDef("family-disown", desc: "Disown a child", module: "family"),
            CommandDef("family-tree", desc: "View family tree", module: "family"),
            CommandDef("family-partner", desc: "View partner info", module: "family"),
            CommandDef("family-children", desc: "View children list", module: "family"),
            CommandDef("family-family", desc: "View full family overview", module: "family"),
            CommandDef("family-config", desc: "Configure family settings", module: "family", access: .staffOnly),
        ],

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // USERPHONE
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        "userphone": [
            CommandDef("userphone", desc: "Start a cross-server phone call", module: "userphone"),
            CommandDef("hangup", desc: "End the current userphone call", module: "userphone"),
            CommandDef("phonebook", desc: "View your server's userphone statistics and recent calls", module: "userphone"),
            CommandDef("userphoneconfig", desc: "Configure userphone settings", module: "userphone", access: .adminOnly),
        ],

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // BACKUP
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        "backup": [
            CommandDef("backupcreate", desc: "Create a full backup of the server configuration", module: "backup", access: .adminOnly),
            CommandDef("backuplist", desc: "View all server backups", module: "backup", access: .adminOnly),
            CommandDef("backupinfo", desc: "View detailed information about a backup", module: "backup", access: .adminOnly),
            CommandDef("backuprestore", desc: "Restore the server from a backup", module: "backup", access: .adminOnly),
            CommandDef("backupcompare", desc: "Compare a backup against the current server state", module: "backup", access: .adminOnly),
            CommandDef("backupdelete", desc: "Delete a server backup", module: "backup", access: .adminOnly),
            CommandDef("backupconfig", desc: "Configure backup settings", module: "backup", access: .adminOnly),
        ],

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // RAFFLES
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        "raffles": [
            CommandDef("raffle", desc: "Create a new raffle", module: "raffles", access: .staffOnly),
            CommandDef("enterraffle", desc: "Buy tickets for a raffle", module: "raffles"),
            CommandDef("mytickets", desc: "View your tickets in active raffles", module: "raffles"),
            CommandDef("raffleinfo", desc: "View raffle details", module: "raffles"),
            CommandDef("endraffle", desc: "End a raffle early", module: "raffles", access: .staffOnly),
            CommandDef("cancelraffle", desc: "Cancel and refund a raffle", module: "raffles", access: .staffOnly),
            CommandDef("rafflelist", desc: "List active raffles", module: "raffles"),
            CommandDef("raffle-config", desc: "Configure raffle settings", module: "raffles",
                       subs: ["view", "channel", "ticket-price", "currency", "max-tickets", "max-active", "dm-winners", "ping-role", "color", "refund-on-cancel"], access: .adminOnly),
        ],

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // DONATION TRACKING
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        "donationtracking": [
            CommandDef("donate", desc: "Donate currency toward a goal", module: "donationtracking"),
            CommandDef("donationleaderboard", desc: "View top donors", module: "donationtracking"),
            CommandDef("donationprogress", desc: "View donation progress toward goal", module: "donationtracking"),
            CommandDef("mydonations", desc: "View your donation history", module: "donationtracking"),
            CommandDef("donationgoal", desc: "Set/view/clear donation goal", module: "donationtracking",
                       subs: ["set", "view", "clear"], access: .staffOnly),
            CommandDef("donationlist", desc: "List donation campaigns", module: "donationtracking"),
            CommandDef("donationconfig", desc: "Configure donation settings", module: "donationtracking",
                       subs: ["view", "channel", "currency", "goal-amount", "goal-name", "goal-toggle", "min-donation", "max-donation", "milestone-toggle", "leaderboard-size", "color", "log-channel"], access: .adminOnly),
            CommandDef("donationreset", desc: "Reset all donation data", module: "donationtracking", access: .adminOnly),
        ],

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // TIMERS
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        "timers": [
            CommandDef("timer", desc: "Start a countdown timer", module: "timers"),
            CommandDef("timerlist", desc: "List your active timers", module: "timers"),
            CommandDef("timercancel", desc: "Cancel a timer", module: "timers"),
            CommandDef("timercheck", desc: "Check time remaining on a timer", module: "timers"),
            CommandDef("timerserverlist", desc: "View all active timers in the server", module: "timers", access: .staffOnly),
            CommandDef("timerconfig", desc: "Configure timer settings", module: "timers",
                       subs: ["view", "max-per-user", "max-duration", "notify-channel", "allow-dm", "color", "log-channel"], access: .adminOnly),
        ],

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // IMAGES
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        "images": [
            CommandDef("cat", desc: "Random cat image", module: "images"),
            CommandDef("dog", desc: "Random dog image", module: "images"),
            CommandDef("fox", desc: "Random fox image", module: "images"),
            CommandDef("bird", desc: "Random bird image", module: "images"),
            CommandDef("panda", desc: "Random panda image", module: "images"),
            CommandDef("redpanda", desc: "Random red panda image", module: "images"),
            CommandDef("drake", desc: "Drake meme format", module: "images"),
            CommandDef("meme", desc: "Random meme", module: "images"),
            CommandDef("wasted", desc: "GTA wasted effect on avatar", module: "images"),
            CommandDef("wanted", desc: "Wanted poster with avatar", module: "images"),
            CommandDef("triggered", desc: "Triggered effect on avatar", module: "images"),
            CommandDef("blur", desc: "Blur a user's avatar", module: "images"),
            CommandDef("greyscale", desc: "Greyscale a user's avatar", module: "images"),
            CommandDef("invert", desc: "Invert avatar colors", module: "images"),
            CommandDef("pixelate", desc: "Pixelate a user's avatar", module: "images"),
            CommandDef("mirror", desc: "Mirror a user's avatar", module: "images"),
            CommandDef("avatar", desc: "View full-size avatar", module: "images"),
            CommandDef("banner", desc: "View user banner", module: "images"),
            CommandDef("servericon", desc: "View server icon", module: "images"),
            CommandDef("images-config", desc: "Configure image settings", module: "images", access: .staffOnly),
        ],

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // UTILITIES
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        "utilities": [
            CommandDef("google", desc: "Search Google", module: "utilities"),
            CommandDef("youtube", desc: "Search YouTube", module: "utilities"),
            CommandDef("github", desc: "Search GitHub repos", module: "utilities"),
            CommandDef("npm", desc: "Search NPM packages", module: "utilities"),
            CommandDef("steam", desc: "Search Steam games", module: "utilities"),
            CommandDef("weather", desc: "Get weather forecast", module: "utilities"),
            CommandDef("crypto", desc: "Cryptocurrency prices", module: "utilities"),
            CommandDef("translate", desc: "Translate text", module: "utilities"),
            CommandDef("color", desc: "Color preview", module: "utilities"),
            CommandDef("calculator", desc: "Math calculator", module: "utilities"),
            CommandDef("qrcode", desc: "Generate QR code", module: "utilities"),
            CommandDef("password", desc: "Generate password", module: "utilities"),
            CommandDef("encode", desc: "Base64 encode", module: "utilities"),
            CommandDef("decode", desc: "Base64 decode", module: "utilities"),
            CommandDef("emojify", desc: "Convert text to emojis", module: "utilities"),
            CommandDef("enlarge", desc: "Enlarge a custom emoji", module: "utilities"),
            CommandDef("anagram", desc: "Find anagrams", module: "utilities"),
            CommandDef("minecraft", desc: "Minecraft server status", module: "utilities"),
            CommandDef("poll", desc: "Create a quick poll", module: "utilities"),
            CommandDef("notepad-add", desc: "Add a note", module: "utilities"),
            CommandDef("notepad-view", desc: "View your notes", module: "utilities"),
            CommandDef("notepad-edit", desc: "Edit a note", module: "utilities"),
            CommandDef("notepad-delete", desc: "Delete a note", module: "utilities"),
            CommandDef("utilities-config", desc: "Configure utility settings", module: "utilities", access: .staffOnly),
        ],

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // SOUNDBOARD
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        "soundboard": [
            CommandDef("soundboard-play", desc: "Play a sound effect", module: "soundboard"),
            CommandDef("soundboard-list", desc: "List available sounds", module: "soundboard"),
            CommandDef("soundboard-random", desc: "Play a random sound", module: "soundboard"),
            CommandDef("soundboard-add", desc: "Add a custom sound", module: "soundboard"),
            CommandDef("soundboard-remove", desc: "Remove a sound", module: "soundboard"),
            CommandDef("soundboard-rename", desc: "Rename a sound", module: "soundboard"),
            CommandDef("soundboard-config", desc: "Configure soundboard settings", module: "soundboard", access: .staffOnly),
        ],

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // AUTOSETUP
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        "autosetup": [
            CommandDef("autosetup-logs", desc: "Auto-setup logging channels", module: "autosetup", access: .staffOnly),
            CommandDef("autosetup-welcome", desc: "Auto-setup welcome system", module: "autosetup", access: .staffOnly),
            CommandDef("autosetup-tickets", desc: "Auto-setup ticket system", module: "autosetup", access: .staffOnly),
            CommandDef("autosetup-fun", desc: "Auto-setup fun channels", module: "autosetup", access: .staffOnly),
            CommandDef("autosetup-music", desc: "Auto-setup music channels", module: "autosetup", access: .staffOnly),
            CommandDef("autosetup-moderation", desc: "Auto-setup moderation", module: "autosetup", access: .staffOnly),
            CommandDef("autosetup-leveling", desc: "Auto-setup leveling system", module: "autosetup", access: .staffOnly),
            CommandDef("autosetup-all", desc: "Run all setup wizards", module: "autosetup", access: .staffOnly),
            CommandDef("autosetup-config", desc: "Configure autosetup settings", module: "autosetup", access: .staffOnly),
        ],
    ]

    /// Get commands for a module
    static func forModule(_ moduleKey: String) -> [CommandDef] {
        commands[moduleKey] ?? []
    }

    /// Total number of commands
    static var totalCommands: Int {
        commands.values.reduce(0) { $0 + $1.count }
    }

    /// Get a grouped summary of default access levels for a module
    static func accessSummary(for moduleKey: String) -> [(access: DefaultAccess, commands: [CommandDef])] {
        let cmds = forModule(moduleKey)
        let grouped = Dictionary(grouping: cmds, by: { $0.defaultAccess })

        // Order: everyone, staffOnly, adminOnly, ownerOnly
        let order: [DefaultAccess] = [.everyone, .staffOnly, .adminOnly, .ownerOnly]
        return order.compactMap { level in
            guard let list = grouped[level], !list.isEmpty else { return nil }
            return (access: level, commands: list)
        }
    }
}
