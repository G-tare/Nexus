import SwiftUI

struct ModuleConfigView: View {
    let guildId: String
    let moduleKey: String
    let moduleName: String
    let moduleIcon: String
    let category: ModuleCategory

    @EnvironmentObject var guildCache: GuildDataCache

    @State private var isEnabled = false
    @State private var config: [String: AnyCodable] = [:]
    @State private var isLoading = true
    @State private var isSaving = false
    @State private var showSavedToast = false
    @State private var validationError: String? = nil
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ZStack {
            NexusColors.background.ignoresSafeArea()

            ScrollView {
                VStack(alignment: .leading, spacing: NexusSpacing.xl) {
                    // Module header with toggle
                    NexusCard(glowColor: category.color) {
                        HStack(spacing: NexusSpacing.lg) {
                            Image(systemName: moduleIcon)
                                .font(.system(size: 28))
                                .foregroundStyle(category.color)
                                .frame(width: 56, height: 56)
                                .background(category.color.opacity(0.1))
                                .clipShape(RoundedRectangle(cornerRadius: NexusRadius.md))

                            VStack(alignment: .leading, spacing: NexusSpacing.xs) {
                                Text(moduleName)
                                    .font(NexusFont.heading(20))
                                    .foregroundStyle(NexusColors.textPrimary)
                                NexusBadge(text: category.rawValue, color: category.color)
                            }

                            Spacer()

                            Toggle("", isOn: $isEnabled)
                                .tint(NexusColors.cyan)
                                .labelsHidden()
                                .onChange(of: isEnabled) { _, newValue in
                                    Task {
                                        await guildCache.setModuleEnabled(moduleKey, enabled: newValue)
                                    }
                                }
                        }
                    }

                    // Commands & Permissions link
                    commandsPermissionsLink

                    // Default permissions summary
                    defaultPermissionsSummary

                    // Typed config sections based on module
                    if isLoading {
                        ForEach(0..<3, id: \.self) { _ in
                            SkeletonView(height: 60)
                        }
                    } else {
                        typedConfigSections
                    }

                    // Validation error
                    if let validationError {
                        HStack(spacing: NexusSpacing.sm) {
                            Image(systemName: "exclamationmark.triangle.fill")
                                .foregroundStyle(.red)
                            Text(validationError)
                                .font(NexusFont.body(13))
                                .foregroundStyle(.red)
                        }
                        .padding(NexusSpacing.md)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Color.red.opacity(0.1))
                        .clipShape(RoundedRectangle(cornerRadius: NexusRadius.md))
                    }

                    // Save button
                    if !isLoading {
                        NexusButton(
                            title: "Save Changes",
                            icon: "checkmark.circle.fill",
                            style: .primary,
                            isLoading: isSaving
                        ) {
                            Task { await saveConfig() }
                        }
                        .frame(maxWidth: .infinity)
                    }
                }
                .padding(.horizontal, NexusSpacing.lg)
                .padding(.top, NexusSpacing.lg)
                .padding(.bottom, 100)
            }

            // Save toast
            if showSavedToast {
                VStack {
                    Spacer()
                    HStack(spacing: NexusSpacing.sm) {
                        Image(systemName: "checkmark.circle.fill")
                            .foregroundStyle(NexusColors.success)
                        Text("Changes saved")
                            .font(NexusFont.body(14))
                            .foregroundStyle(NexusColors.textPrimary)
                    }
                    .padding(NexusSpacing.lg)
                    .background(NexusColors.cardBackgroundLight)
                    .clipShape(RoundedRectangle(cornerRadius: NexusRadius.lg))
                    .shadow(color: NexusColors.success.opacity(0.2), radius: 8)
                    .padding(.bottom, 40)
                }
                .transition(.move(edge: .bottom).combined(with: .opacity))
            }
        }
        .navigationTitle(moduleName)
        .navigationBarTitleDisplayMode(.inline)
        .task { await loadConfig() }
    }

    // MARK: - Default Permissions Summary

    @ViewBuilder
    private var defaultPermissionsSummary: some View {
        let summary = CommandRegistry.accessSummary(for: moduleKey)
        if !summary.isEmpty {
            VStack(alignment: .leading, spacing: NexusSpacing.sm) {
                HStack(spacing: NexusSpacing.sm) {
                    Image(systemName: "shield.lefthalf.filled")
                        .font(.system(size: 13))
                        .foregroundStyle(NexusColors.textSecondary)
                    Text("Default Permissions")
                        .font(NexusFont.heading(14))
                        .foregroundStyle(NexusColors.textSecondary)
                }
                .padding(.leading, NexusSpacing.xs)

                VStack(spacing: 0) {
                    ForEach(Array(summary.enumerated()), id: \.element.access) { index, group in
                        VStack(alignment: .leading, spacing: 6) {
                            HStack(spacing: NexusSpacing.sm) {
                                Circle()
                                    .fill(accessColor(group.access))
                                    .frame(width: 8, height: 8)
                                Text(group.access.rawValue)
                                    .font(NexusFont.heading(13))
                                    .foregroundStyle(accessColor(group.access))
                                Spacer()
                                NexusBadge(text: "\(group.commands.count)", color: accessColor(group.access))
                            }

                            Text(group.commands.map { "/\($0.name)" }.joined(separator: ", "))
                                .font(NexusFont.caption(11))
                                .foregroundStyle(NexusColors.textMuted)
                                .lineLimit(3)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                        .padding(.horizontal, NexusSpacing.md)
                        .padding(.vertical, NexusSpacing.sm + 4)

                        if index < summary.count - 1 {
                            Divider()
                                .background(NexusColors.border)
                                .padding(.horizontal, NexusSpacing.md)
                        }
                    }
                }
                .background(NexusColors.cardBackground)
                .clipShape(RoundedRectangle(cornerRadius: NexusRadius.md))
            }
        }
    }

    private func accessColor(_ access: DefaultAccess) -> Color {
        switch access {
        case .everyone: return NexusColors.success
        case .staffOnly: return NexusColors.warning
        case .adminOnly: return NexusColors.error
        case .ownerOnly: return NexusColors.purple
        }
    }

    // MARK: - Commands & Permissions Link

    @ViewBuilder
    private var commandsPermissionsLink: some View {
        let commandCount = CommandRegistry.forModule(moduleKey).count
        if commandCount > 0 {
            NavigationLink {
                ModuleCommandsView(
                    guildId: guildId,
                    moduleKey: moduleKey,
                    moduleName: moduleName,
                    moduleColor: category.color
                )
                .environmentObject(guildCache)
            } label: {
                NexusCard(glowColor: NexusColors.cyan) {
                    HStack(spacing: NexusSpacing.md) {
                        Image(systemName: "lock.shield.fill")
                            .font(.system(size: 22))
                            .foregroundStyle(NexusColors.cyan)
                            .frame(width: 44, height: 44)
                            .background(NexusColors.cyan.opacity(0.1))
                            .clipShape(RoundedRectangle(cornerRadius: NexusRadius.md))

                        VStack(alignment: .leading, spacing: 3) {
                            Text("Commands & Permissions")
                                .font(NexusFont.heading(15))
                                .foregroundStyle(NexusColors.textPrimary)
                            Text("\(commandCount) commands — configure who can use each")
                                .font(NexusFont.caption(12))
                                .foregroundStyle(NexusColors.textMuted)
                        }

                        Spacer()

                        Image(systemName: "chevron.right")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(NexusColors.textMuted)
                    }
                }
            }
        }
    }

    // MARK: - Typed Config Sections

    @ViewBuilder
    private var typedConfigSections: some View {
        switch moduleKey {
        case "core":
            coreConfig
        case "moderation":
            moderationConfig
        case "automod":
            automodConfig
        case "leveling":
            levelingConfig
        case "welcome":
            welcomeConfig
        case "tickets":
            ticketsConfig
        case "music":
            musicConfig
        case "currency":
            currencyConfig
        case "antiraid":
            antiraidConfig
        case "logging":
            loggingConfig
        case "activitytracking":
            activityTrackingConfig
        case "aichatbot":
            aichatbotConfig
        case "stickymessages":
            stickyMessagesConfig
        case "counting":
            countingConfig
        case "customcommands":
            customCommandsConfig
        case "forms":
            formsConfig
        case "autoroles":
            autorolesConfig
        case "translation":
            translationConfig
        case "reactionroles":
            reactionRolesConfig
        case "reputation":
            reputationConfig
        case "shop":
            shopConfig
        case "quoteboard":
            quoteboardConfig
        case "confessions":
            confessionsConfig
        case "fun":
            funConfig
        case "afk":
            afkConfig
        case "polls":
            pollsConfig
        case "birthdays":
            birthdaysConfig
        case "messagetracking":
            messageTrackingConfig
        case "giveaways":
            giveawaysConfig
        case "colorroles":
            colorRolesConfig
        case "invitetracker":
            inviteTrackerConfig
        case "statschannels":
            statsChannelsConfig
        case "leaderboards":
            leaderboardsConfig
        case "suggestions":
            suggestionsConfig
        case "scheduledmessages":
            scheduledMessagesConfig
        case "backup":
            backupConfig
        case "userphone":
            userphoneConfig
        case "voicephone":
            voicephoneConfig
        case "raffles":
            rafflesConfig
        case "donationtracking":
            donationTrackingConfig
        case "timers":
            timersConfig
        case "reminders":
            remindersConfig
        case "tempvoice":
            tempvoiceConfig
        case "casino":
            casinoConfig
        case "profile":
            profileConfig
        case "family":
            familyConfig
        case "images":
            imagesConfig
        case "utilities":
            utilitiesConfig
        case "soundboard":
            soundboardConfig
        case "autosetup":
            autosetupConfig
        default:
            genericConfig
        }
    }

    // MARK: - Core Config

    @ViewBuilder
    private var coreConfig: some View {
        ConfigSection(title: "Embed Colors", icon: "paintbrush.fill") {
            ConfigToggle(label: "Help Embed Colors", key: "helpEmbedColors", config: $config)
            ConfigToggle(label: "Config Embed Colors", key: "configEmbedColors", config: $config)
        }
    }

    // MARK: - Moderation Config

    @ViewBuilder
    private var moderationConfig: some View {
        ConfigSection(title: "DM Notifications", icon: "bell.fill") {
            ConfigToggle(label: "DM on Ban", key: "dmOnBan", config: $config)
            ConfigToggle(label: "DM on Kick", key: "dmOnKick", config: $config)
            ConfigToggle(label: "DM on Mute", key: "dmOnMute", config: $config)
            ConfigToggle(label: "DM on Warn", key: "dmOnWarn", config: $config)
        }

        ConfigSection(title: "Rules", icon: "doc.text.fill") {
            ConfigToggle(label: "Require Reason", key: "requireReason", config: $config)
            ConfigToggle(label: "Enable Appeals", key: "appealEnabled", config: $config)
            ConfigChannelPicker(label: "Appeal Channel", key: "appealChannelId", config: $config)
        }

        ConfigSection(title: "Reputation", icon: "star.fill") {
            ConfigToggle(label: "Reputation System", key: "reputationEnabled", config: $config)
            ConfigNumberField(label: "Default Reputation", key: "defaultReputation", config: $config)
            ConfigNumberField(label: "Warn Penalty", key: "reputationPenalties.warn", config: $config, nested: true)
            ConfigNumberField(label: "Mute Penalty", key: "reputationPenalties.mute", config: $config, nested: true)
            ConfigNumberField(label: "Kick Penalty", key: "reputationPenalties.kick", config: $config, nested: true)
            ConfigNumberField(label: "Temp Ban Penalty", key: "reputationPenalties.tempban", config: $config, nested: true)
            ConfigNumberField(label: "Ban Penalty", key: "reputationPenalties.ban", config: $config, nested: true)
        }

        ConfigSection(title: "Warn Thresholds", icon: "exclamationmark.triangle.fill") {
            ConfigToggle(label: "Auto-Mute", key: "warnAutoMuteEnabled", config: $config)
            ConfigNumberField(label: "Auto-Mute at Warns", key: "warnAutoMuteCount", config: $config, minValue: 1, maxValue: 50, disabled: !(config["warnAutoMuteEnabled"]?.value as? Bool ?? false))
            ConfigNumberField(label: "Auto-Mute Duration (s)", key: "warnAutoMuteDuration", config: $config, minValue: 60, maxValue: 2419200, disabled: !(config["warnAutoMuteEnabled"]?.value as? Bool ?? false))
            ConfigToggle(label: "Auto-Kick", key: "warnAutoKickEnabled", config: $config)
            ConfigNumberField(label: "Auto-Kick at Warns", key: "warnAutoKickCount", config: $config, minValue: 1, maxValue: 50, disabled: !(config["warnAutoKickEnabled"]?.value as? Bool ?? false))
            ConfigToggle(label: "Auto-Ban", key: "warnAutoBanEnabled", config: $config)
            ConfigNumberField(label: "Auto-Ban at Warns", key: "warnAutoBanCount", config: $config, minValue: 1, maxValue: 50, disabled: !(config["warnAutoBanEnabled"]?.value as? Bool ?? false))
        }

        ConfigSection(title: "Advanced", icon: "gearshape.2.fill") {
            ConfigToggle(label: "Shadow Bans", key: "shadowBanEnabled", config: $config)
            ConfigToggle(label: "Alt Detection", key: "altDetectionEnabled", config: $config)
            ConfigChannelPicker(label: "Alt Log Channel", key: "altDetectionLogChannelId", config: $config)
            ConfigToggle(label: "Currency Fines", key: "fineEnabled", config: $config)
            ConfigNumberField(label: "Warn Fine", key: "fineAmounts.warn", config: $config, nested: true)
            ConfigNumberField(label: "Mute Fine", key: "fineAmounts.mute", config: $config, nested: true)
            ConfigNumberField(label: "Kick Fine", key: "fineAmounts.kick", config: $config, nested: true)
            ConfigNumberField(label: "Ban Fine", key: "fineAmounts.ban", config: $config, nested: true)
        }
    }

    // MARK: - AutoMod Config

    @ViewBuilder
    private var automodConfig: some View {
        ConfigSection(title: "Anti-Spam", icon: "exclamationmark.shield.fill") {
            ConfigToggle(label: "Enabled", key: "antispam.enabled", config: $config, nested: true)
            ConfigNumberField(label: "Max Messages", key: "antispam.maxMessages", config: $config, nested: true)
            ConfigNumberField(label: "Timeframe (sec)", key: "antispam.timeframeSeconds", config: $config, nested: true)
            ConfigNumberField(label: "Max Emojis", key: "antispam.maxEmojis", config: $config, nested: true)
            ConfigNumberField(label: "Max Caps %", key: "antispam.maxCaps", config: $config, nested: true)
            ConfigNumberField(label: "Max Mentions", key: "antispam.maxMentions", config: $config, nested: true)
        }

        ConfigSection(title: "Anti-Link", icon: "link.badge.plus") {
            ConfigToggle(label: "Enabled", key: "antilink.enabled", config: $config, nested: true)
        }

        ConfigSection(title: "Anti-Invite", icon: "envelope.badge.shield.half.filled.fill") {
            ConfigToggle(label: "Enabled", key: "antiinvite.enabled", config: $config, nested: true)
        }

        ConfigSection(title: "Word Filter", icon: "text.badge.xmark") {
            ConfigToggle(label: "Enabled", key: "wordfilter.enabled", config: $config, nested: true)
        }

        ConfigSection(title: "Anti-Nuke", icon: "exclamationmark.triangle.fill") {
            ConfigToggle(label: "Enabled", key: "antinuke.enabled", config: $config, nested: true)
            ConfigNumberField(label: "Max Channel Deletes/min", key: "antinuke.maxChannelDeletesPerMinute", config: $config, nested: true)
            ConfigNumberField(label: "Max Role Deletes/min", key: "antinuke.maxRoleDeletesPerMinute", config: $config, nested: true)
            ConfigNumberField(label: "Max Bans/min", key: "antinuke.maxBansPerMinute", config: $config, nested: true)
        }

        ConfigSection(title: "Logging", icon: "doc.text.fill") {
            ConfigChannelPicker(label: "Log Channel", key: "logChannelId", config: $config)
        }
    }

    // MARK: - Leveling Config

    @ViewBuilder
    private var levelingConfig: some View {
        ConfigSection(title: "XP Settings", icon: "sparkles") {
            ConfigNumberField(label: "Min XP per Message", key: "xpPerMessage.min", config: $config, nested: true)
            ConfigNumberField(label: "Max XP per Message", key: "xpPerMessage.max", config: $config, nested: true)
            ConfigNumberField(label: "XP Cooldown (sec)", key: "xpCooldownSeconds", config: $config)
            ConfigNumberField(label: "XP per Voice Minute", key: "xpPerVoiceMinute", config: $config)
            ConfigToggle(label: "Require Unmuted for Voice XP", key: "voiceRequireUnmuted", config: $config)
        }

        ConfigSection(title: "Boosts", icon: "bolt.fill") {
            ConfigToggle(label: "Double XP Active", key: "doubleXpActive", config: $config)
        }

        ConfigSection(title: "Level-Up Announcements", icon: "megaphone.fill") {
            ConfigPicker(label: "Announce Type", key: "announceType", config: $config, options: [
                ("current", "Current Channel"),
                ("channel", "Specific Channel"),
                ("dm", "Direct Message"),
                ("off", "Off"),
            ])
            ConfigChannelPicker(label: "Announce Channel", key: "announceChannelId", config: $config)
            ConfigTextField(label: "Announce Message", key: "announceMessage", config: $config, placeholder: "{user} reached level {level}!")
        }

        ConfigSection(title: "Role Stacking", icon: "person.2.fill") {
            ConfigToggle(label: "Stack Level Roles", key: "stackRoles", config: $config)
        }

        ConfigSection(title: "Prestige", icon: "crown.fill") {
            ConfigToggle(label: "Enable Prestige", key: "prestigeEnabled", config: $config)
            ConfigNumberField(label: "Max Level to Prestige", key: "prestigeMaxLevel", config: $config)
            ConfigNumberField(label: "Prestige XP Multiplier", key: "prestigeXpMultiplier", config: $config)
        }
    }

    // MARK: - Welcome Config

    @ViewBuilder
    private var welcomeConfig: some View {
        ConfigSection(title: "Welcome Message", icon: "hand.wave.fill") {
            ConfigToggle(label: "Enabled", key: "welcome.enabled", config: $config, nested: true)
            ConfigChannelPicker(label: "Channel", key: "welcome.channelId", config: $config, nested: true)
            ConfigTextField(label: "Message", key: "welcome.message", config: $config, nested: true, placeholder: "Welcome {user} to {server}!")
        }

        // Welcome embed editor
        EmbedEditorView(sectionTitle: "Welcome Embed", configPrefix: "welcome", config: $config)

        ConfigSection(title: "Leave Message", icon: "figure.walk") {
            ConfigToggle(label: "Enabled", key: "leave.enabled", config: $config, nested: true)
            ConfigChannelPicker(label: "Channel", key: "leave.channelId", config: $config, nested: true)
            ConfigTextField(label: "Message", key: "leave.message", config: $config, nested: true, placeholder: "{username} has left the server")
        }

        // Leave embed editor
        EmbedEditorView(sectionTitle: "Leave Embed", configPrefix: "leave", config: $config)

        ConfigSection(title: "DM on Join", icon: "envelope.fill") {
            ConfigToggle(label: "Enabled", key: "dm.enabled", config: $config, nested: true)
            ConfigTextField(label: "DM Message", key: "dm.message", config: $config, nested: true, placeholder: "Welcome to {server}!")
        }

        ConfigSection(title: "Auto Roles", icon: "person.badge.plus") {
            ConfigToggle(label: "Enabled", key: "autorole.enabled", config: $config, nested: true)
            ConfigNumberField(label: "Delay (seconds)", key: "autorole.delaySeconds", config: $config, nested: true)
        }

        ConfigSection(title: "Join Gate", icon: "lock.shield.fill") {
            ConfigToggle(label: "Enabled", key: "joingate.enabled", config: $config, nested: true)
            ConfigNumberField(label: "Min Account Age (days)", key: "joingate.minAccountAgeDays", config: $config, nested: true)
            ConfigToggle(label: "Log Kicks", key: "joingate.logKicks", config: $config, nested: true)
        }
    }

    // MARK: - Tickets Config

    @ViewBuilder
    private var ticketsConfig: some View {
        ConfigSection(title: "General", icon: "ticket.fill") {
            ConfigNumberField(label: "Max Open Tickets/User", key: "maxOpenTicketsPerUser", config: $config)
            ConfigToggle(label: "Claim System", key: "claimEnabled", config: $config)
            ConfigToggle(label: "Priority Levels", key: "priorityEnabled", config: $config)
            ConfigToggle(label: "Feedback on Close", key: "feedbackEnabled", config: $config)
        }

        ConfigSection(title: "Transcripts", icon: "doc.text.fill") {
            ConfigToggle(label: "Enable Transcripts", key: "transcriptEnabled", config: $config)
            ConfigChannelPicker(label: "Transcript Channel", key: "transcriptChannelId", config: $config)
        }

        ConfigSection(title: "Auto-Close", icon: "clock.fill") {
            ConfigToggle(label: "Auto-Close Inactive", key: "autoCloseEnabled", config: $config)
            ConfigNumberField(label: "Close After (hours)", key: "autoCloseHours", config: $config)
            ConfigNumberField(label: "Warning Before (hours)", key: "autoCloseWarningHours", config: $config)
        }

        ConfigSection(title: "Close Behavior", icon: "xmark.circle.fill") {
            ConfigToggle(label: "Require Confirmation", key: "closeConfirmation", config: $config)
            ConfigToggle(label: "Delete on Close", key: "deleteOnClose", config: $config)
            ConfigNumberField(label: "Delete Delay (sec)", key: "closeDelay", config: $config)
            ConfigChannelPicker(label: "Log Channel", key: "logChannelId", config: $config)
        }
    }

    // MARK: - Music Config

    @ViewBuilder
    private var musicConfig: some View {
        ConfigSection(title: "DJ System", icon: "music.mic") {
            ConfigToggle(label: "DJ Mode", key: "djEnabled", config: $config)
            ConfigRolePicker(label: "DJ Role", key: "djRoleId", config: $config)
        }

        ConfigSection(title: "Playback", icon: "play.circle.fill") {
            ConfigNumberField(label: "Default Volume", key: "defaultVolume", config: $config)
            ConfigNumberField(label: "Max Volume", key: "maxVolume", config: $config)
            ConfigNumberField(label: "Max Queue Size (0=∞)", key: "maxQueueSize", config: $config)
            ConfigNumberField(label: "Max Song Duration (sec)", key: "maxSongDuration", config: $config)
        }

        ConfigSection(title: "Vote Skip", icon: "hand.raised.fill") {
            ConfigToggle(label: "Vote Skip", key: "voteSkipEnabled", config: $config)
            ConfigNumberField(label: "Required %", key: "voteSkipPercent", config: $config)
        }

        ConfigSection(title: "Behavior", icon: "gearshape.fill") {
            ConfigToggle(label: "Auto-Play", key: "autoplayEnabled", config: $config)
            ConfigToggle(label: "24/7 Mode", key: "twentyFourSevenEnabled", config: $config)
            ConfigChannelPicker(label: "24/7 Voice Channel", key: "twentyFourSevenChannelId", config: $config, voiceOnly: true)
            ConfigToggle(label: "Now Playing Announce", key: "announceNowPlaying", config: $config)
            ConfigToggle(label: "Leave on Empty", key: "leaveOnEmpty", config: $config)
            ConfigNumberField(label: "Leave Delay (sec)", key: "leaveOnEmptyDelay", config: $config)
        }
    }

    // MARK: - Currency Config

    @ViewBuilder
    private var currencyConfig: some View {
        ConfigSection(title: "Transfer Limits", icon: "dollarsign.circle.fill") {
            ConfigNumberField(label: "Daily Send Cap", key: "sendCap", config: $config)
            ConfigNumberField(label: "Daily Receive Cap", key: "receiveCap", config: $config)
            ConfigNumberField(label: "Tax %", key: "taxPercent", config: $config)
        }

        ConfigSection(title: "Earning", icon: "arrow.up.circle.fill") {
            ConfigNumberField(label: "Streak Bonus", key: "streakBonusMultiplier", config: $config)
            ConfigNumberField(label: "Max Multiplier", key: "streakMaxMultiplier", config: $config)
        }

        ConfigSection(title: "Banking", icon: "building.columns.fill") {
            ConfigToggle(label: "Enable Banking", key: "banking", config: $config)
            ConfigToggle(label: "Enable Savings", key: "savings", config: $config)
            ConfigToggle(label: "Enable Robbery", key: "robbery", config: $config)
            ConfigNumberField(label: "Rob Chance %", key: "robChance", config: $config)
        }

        ConfigSection(title: "Earning Options", icon: "dollarsign.circle.fill") {
            ConfigToggle(label: "Enable Earning", key: "earning", config: $config)
            ConfigNumberField(label: "Monthly Amount", key: "monthlyAmount", config: $config)
            ConfigNumberField(label: "Monthly Gems", key: "monthlyGems", config: $config)
        }

        ConfigSection(title: "Jobs", icon: "briefcase.fill") {
            ConfigToggle(label: "Enable Jobs", key: "jobs", config: $config)
            ConfigToggle(label: "Job Slacking Detection", key: "jobSlacking", config: $config)
            ConfigNumberField(label: "Slacking Threshold", key: "slackingThreshold", config: $config)
            ConfigNumberField(label: "Jail Duration (sec)", key: "jailDuration", config: $config)
        }
    }

    // MARK: - Anti-Raid Config

    @ViewBuilder
    private var antiraidConfig: some View {
        ConfigSection(title: "Detection", icon: "shield.fill") {
            ConfigNumberField(label: "Join Threshold", key: "joinThreshold", config: $config)
            ConfigNumberField(label: "Join Window (sec)", key: "joinWindow", config: $config)
            ConfigNumberField(label: "Min Account Age (hrs)", key: "minAccountAge", config: $config)
        }

        ConfigSection(title: "Response", icon: "exclamationmark.triangle.fill") {
            ConfigToggle(label: "Auto Lockdown", key: "autoLockdown", config: $config)
            ConfigNumberField(label: "Lockdown Duration (sec)", key: "lockdownDuration", config: $config)
            ConfigPicker(label: "Action", key: "action", config: $config, options: [
                ("kick", "Kick"),
                ("ban", "Ban"),
                ("quarantine", "Quarantine"),
                ("alert", "Alert Only"),
            ])
            ConfigChannelPicker(label: "Alert Channel", key: "alertChannelId", config: $config)
            ConfigRolePicker(label: "Quarantine Role", key: "quarantineRoleId", config: $config)
        }

        ConfigSection(title: "Verification", icon: "checkmark.shield.fill") {
            ConfigToggle(label: "Verification", key: "verificationEnabled", config: $config)
            ConfigTextField(label: "Verification Message", key: "verificationMessage", config: $config, placeholder: "Please verify...")
        }
    }

    // MARK: - Logging Config

    @ViewBuilder
    private var loggingConfig: some View {
        ConfigSection(title: "General", icon: "doc.text.fill") {
            ConfigChannelPicker(label: "Default Log Channel", key: "defaultChannelId", config: $config)
        }

        ConfigSection(title: "Event Categories", icon: "list.bullet") {
            ConfigToggle(label: "Message Events", key: "enabledEvents.messageEdit", config: $config, nested: true)
            ConfigToggle(label: "Member Events", key: "enabledEvents.memberJoin", config: $config, nested: true)
            ConfigToggle(label: "Voice Events", key: "enabledEvents.voiceJoin", config: $config, nested: true)
            ConfigToggle(label: "Channel Events", key: "enabledEvents.channelCreate", config: $config, nested: true)
            ConfigToggle(label: "Role Events", key: "enabledEvents.roleCreate", config: $config, nested: true)
            ConfigToggle(label: "Server Events", key: "enabledEvents.serverUpdate", config: $config, nested: true)
        }
    }

    // MARK: - Activity Tracking Config

    @ViewBuilder
    private var activityTrackingConfig: some View {
        ConfigSection(title: "Tracking", icon: "chart.xyaxis.line") {
            ConfigToggle(label: "Track Messages", key: "trackMessages", config: $config)
            ConfigToggle(label: "Track Voice", key: "trackVoice", config: $config)
            ConfigToggle(label: "Track Reactions", key: "trackReactions", config: $config)
        }

        ConfigSection(title: "Behavior", icon: "gearshape.fill") {
            ConfigNumberField(label: "Inactive Threshold (days)", key: "inactiveThresholdDays", config: $config)
            ConfigNumberField(label: "Leaderboard Size", key: "leaderboardSize", config: $config)
            ConfigToggle(label: "Reset on Leave", key: "resetOnLeave", config: $config)
            ConfigChannelPicker(label: "Log Channel", key: "logChannelId", config: $config)
        }
    }

    // MARK: - AI Chatbot Config

    @ViewBuilder
    private var aichatbotConfig: some View {
        ConfigSection(title: "AI Provider", icon: "brain.fill") {
            ConfigPicker(label: "Provider", key: "provider", config: $config, options: [
                ("groq", "Groq (Free Tier, Llama)"),
                ("gemini", "Gemini (Google)"),
                ("grok", "Grok (xAI)"),
                ("openai", "OpenAI"),
                ("anthropic", "Anthropic"),
            ])
            ConfigTextField(label: "Model", key: "model", config: $config, placeholder: "llama-3.3-70b-versatile")
            ConfigTextField(label: "Server API Key", key: "apiKey", config: $config, placeholder: "Encrypted on save")
            ConfigNumberField(label: "Max Tokens", key: "maxTokens", config: $config)
            ConfigPicker(label: "Temperature", key: "temperature", config: $config, options: [
                ("0", "0.0 — Precise"),
                ("0.3", "0.3 — Focused"),
                ("0.5", "0.5 — Balanced"),
                ("0.7", "0.7 — Creative (Default)"),
                ("1.0", "1.0 — Very Creative"),
                ("1.5", "1.5 — Wild"),
            ])
        }

        ConfigSection(title: "Agent System", icon: "cpu.fill") {
            ConfigToggle(label: "Agent Mode (Tool Use)", key: "agentEnabled", config: $config)
            ConfigToggle(label: "Confirm Destructive Actions", key: "confirmDestructive", config: $config)
            ConfigNumberField(label: "Max Tool Calls Per Message", key: "maxToolCalls", config: $config)
        }

        ConfigSection(title: "Activation", icon: "bubble.left.and.bubble.right.fill") {
            ConfigTextField(label: "Trigger Phrase", key: "triggerPhrase", config: $config, placeholder: "hey nexus")
            ConfigToggle(label: "Auto Reply in AI Channels", key: "autoReply", config: $config)
            ConfigToggle(label: "Reply on @Mention", key: "mentionReply", config: $config)
        }

        ConfigSection(title: "Usage Limits", icon: "gauge.with.needle.fill") {
            ConfigNumberField(label: "Cooldown (sec)", key: "cooldown", config: $config)
            ConfigNumberField(label: "Max History Messages", key: "maxHistory", config: $config)
        }
    }

    // MARK: - Sticky Messages Config

    @ViewBuilder
    private var stickyMessagesConfig: some View {
        ConfigSection(title: "General", icon: "pin.fill") {
            ConfigPicker(label: "Mode", key: "mode", config: $config, options: [
                ("edit", "Edit Message"),
                ("resend", "Resend Message"),
            ])
            ConfigNumberField(label: "Max Stickies Per Channel", key: "maxStickiesPerChannel", config: $config)
            ConfigToggle(label: "Delete Bot Message", key: "deleteBotMessage", config: $config)
        }
    }

    // MARK: - Counting Config

    @ViewBuilder
    private var countingConfig: some View {
        ConfigSection(title: "General", icon: "number") {
            ConfigChannelPicker(label: "Channel", key: "channelId", config: $config)
            ConfigToggle(label: "Math Mode", key: "mathMode", config: $config)
            ConfigToggle(label: "Allow Double Count", key: "allowDoubleCount", config: $config)
        }

        ConfigSection(title: "Behavior", icon: "gearshape.fill") {
            ConfigToggle(label: "Delete Wrong Numbers", key: "deleteWrongNumbers", config: $config)
            ConfigToggle(label: "Reset on Wrong", key: "resetOnWrong", config: $config)
            ConfigToggle(label: "React on Correct", key: "reactOnCorrect", config: $config)
        }

        ConfigSection(title: "Milestones", icon: "flag.fill") {
            ConfigToggle(label: "Notify on Milestone", key: "notifyOnMilestone", config: $config)
            ConfigNumberField(label: "Milestone Interval", key: "milestoneInterval", config: $config)
        }

        ConfigSection(title: "Extra", icon: "heart.fill") {
            ConfigToggle(label: "Lives Enabled", key: "livesEnabled", config: $config)
            ConfigToggle(label: "Global Leaderboard", key: "globalLeaderboardEnabled", config: $config)
        }
    }

    // MARK: - Custom Commands Config

    @ViewBuilder
    private var customCommandsConfig: some View {
        ConfigSection(title: "General", icon: "terminal.fill") {
            ConfigTextField(label: "Prefix", key: "prefix", config: $config, placeholder: "!")
            ConfigNumberField(label: "Max Commands", key: "maxCommands", config: $config)
            ConfigToggle(label: "Allow Slash Commands", key: "allowSlash", config: $config)
        }
    }

    // MARK: - Forms Config

    @ViewBuilder
    private var formsConfig: some View {
        ConfigSection(title: "General", icon: "doc.text.fill") {
            ConfigToggle(label: "Require Approval", key: "requireApproval", config: $config)
            ConfigChannelPicker(label: "Notification Channel", key: "notificationChannelId", config: $config)
        }
    }

    // MARK: - Auto Roles Config

    @ViewBuilder
    private var autorolesConfig: some View {
        ConfigSection(title: "General", icon: "person.badge.plus") {
            ConfigToggle(label: "Persistent Roles", key: "persistentRoles", config: $config)
            ConfigToggle(label: "Ignore Bots", key: "ignoreBots", config: $config)
            ConfigToggle(label: "Stack Roles", key: "stackRoles", config: $config)
            ConfigChannelPicker(label: "Log Channel", key: "logChannelId", config: $config)
        }
    }

    // MARK: - Translation Config

    @ViewBuilder
    private var translationConfig: some View {
        ConfigSection(title: "Provider", icon: "globe") {
            ConfigPicker(label: "Provider", key: "provider", config: $config, options: [
                ("google", "Google"),
                ("libre", "LibreTranslate"),
            ])
            ConfigTextField(label: "LibreTranslate URL", key: "libreUrl", config: $config, placeholder: "https://...")
        }

        ConfigSection(title: "Behavior", icon: "gearshape.fill") {
            ConfigToggle(label: "Flag Reactions", key: "flagReactions", config: $config)
            ConfigToggle(label: "Use Webhooks", key: "useWebhooks", config: $config)
            ConfigTextField(label: "Default Language", key: "defaultLanguage", config: $config, placeholder: "en")
            ConfigNumberField(label: "User Cooldown (sec)", key: "userCooldown", config: $config)
        }
    }

    // MARK: - Reaction Roles Config

    @ViewBuilder
    private var reactionRolesConfig: some View {
        ConfigSection(title: "Defaults", icon: "hand.tap.fill") {
            ConfigPicker(label: "Default Mode", key: "defaultMode", config: $config, options: [
                ("toggle", "Toggle"),
                ("add", "Add Only"),
                ("remove", "Remove Only"),
            ])
            ConfigPicker(label: "Default Type", key: "defaultType", config: $config, options: [
                ("reaction", "Reaction"),
                ("button", "Button"),
            ])
            ConfigToggle(label: "DM Confirmation", key: "dmConfirmation", config: $config)
            ConfigChannelPicker(label: "Log Channel", key: "logChannelId", config: $config)
        }
    }

    // MARK: - Reputation Config

    @ViewBuilder
    private var reputationConfig: some View {
        ConfigSection(title: "General", icon: "star.fill") {
            ConfigNumberField(label: "Default Rep", key: "defaultRep", config: $config)
            ConfigNumberField(label: "Give Cooldown (sec)", key: "giveCooldown", config: $config)
            ConfigNumberField(label: "Daily Limit", key: "dailyLimit", config: $config)
            ConfigToggle(label: "Allow Negative", key: "allowNegative", config: $config)
        }

        ConfigSection(title: "Decay", icon: "arrow.down.circle.fill") {
            ConfigToggle(label: "Decay Enabled", key: "decayEnabled", config: $config)
            ConfigNumberField(label: "After Days Inactive", key: "decayAfterDays", config: $config)
            ConfigNumberField(label: "Decay Amount", key: "decayAmount", config: $config)
            ConfigNumberField(label: "Decay Floor", key: "decayFloor", config: $config)
        }

        ConfigSection(title: "Reaction Rep", icon: "hand.thumbsup.fill") {
            ConfigToggle(label: "Reaction Rep Enabled", key: "reactionRepEnabled", config: $config)
            ConfigTextField(label: "Upvote Emoji", key: "upvoteEmoji", config: $config, placeholder: "👍")
            ConfigTextField(label: "Downvote Emoji", key: "downvoteEmoji", config: $config, placeholder: "👎")
        }

        ConfigSection(title: "Logging", icon: "doc.text.fill") {
            ConfigChannelPicker(label: "Log Channel", key: "logChannelId", config: $config)
        }
    }

    // MARK: - Shop Config

    @ViewBuilder
    private var shopConfig: some View {
        ConfigSection(title: "General", icon: "storefront.fill") {
            ConfigPicker(label: "Currency Type", key: "currencyType", config: $config, options: [
                ("coins", "Coins"),
                ("gems", "Gems"),
            ])
            ConfigNumberField(label: "Tax %", key: "taxPercent", config: $config)
            ConfigNumberField(label: "Max Items Per Server", key: "maxItemsPerServer", config: $config)
            ConfigToggle(label: "Show Out of Stock", key: "showOutOfStock", config: $config)
        }

        ConfigSection(title: "Refunds", icon: "arrow.uturn.left.circle.fill") {
            ConfigToggle(label: "Refunds Enabled", key: "refundsEnabled", config: $config)
            ConfigNumberField(label: "Refund %", key: "refundPercent", config: $config)
        }

        ConfigSection(title: "Logging", icon: "doc.text.fill") {
            ConfigChannelPicker(label: "Log Channel", key: "logChannelId", config: $config)
        }
    }

    // MARK: - QuoteBoard Config

    @ViewBuilder
    private var quoteboardConfig: some View {
        ConfigSection(title: "Board Settings", icon: "star.bubble.fill") {
            ConfigToggle(label: "Allow Self-React", key: "selfReact", config: $config)
            ConfigToggle(label: "NSFW Allowed", key: "nsfw", config: $config)
        }
    }

    // MARK: - Confessions Config

    @ViewBuilder
    private var confessionsConfig: some View {
        ConfigSection(title: "General", icon: "theatermasks.fill") {
            ConfigChannelPicker(label: "Channel", key: "channelId", config: $config)
            ConfigToggle(label: "Full Anonymity", key: "fullAnonymity", config: $config)
            ConfigNumberField(label: "Cooldown (sec)", key: "cooldownSeconds", config: $config)
            ConfigToggle(label: "Allow Images", key: "allowImages", config: $config)
        }

        ConfigSection(title: "Moderation", icon: "shield.fill") {
            ConfigToggle(label: "Moderation Enabled", key: "moderationEnabled", config: $config)
            ConfigChannelPicker(label: "Moderation Channel", key: "moderationChannelId", config: $config)
        }

        // Confessions embed editor
        EmbedEditorView(sectionTitle: "Confession Embed", configPrefix: "", config: $config)
    }

    // MARK: - Fun Config

    @ViewBuilder
    private var funConfig: some View {
        ConfigSection(title: "Gambling", icon: "dice.fill") {
            ConfigToggle(label: "Gambling Enabled", key: "gambling", config: $config)
            ConfigNumberField(label: "Min Bet", key: "minBet", config: $config)
            ConfigNumberField(label: "Max Bet", key: "maxBet", config: $config)
        }

        ConfigSection(title: "Features", icon: "sparkles") {
            ConfigToggle(label: "Interactions", key: "interactionsEnabled", config: $config)
            ConfigToggle(label: "Games", key: "gamesEnabled", config: $config)
            ConfigToggle(label: "GIFs", key: "gifsEnabled", config: $config)
            ConfigNumberField(label: "Global Cooldown (sec)", key: "globalCooldown", config: $config)
        }
    }

    // MARK: - AFK Config

    @ViewBuilder
    private var afkConfig: some View {
        ConfigSection(title: "General", icon: "moon.fill") {
            ConfigNumberField(label: "Max Message Length", key: "maxMessageLength", config: $config)
            ConfigToggle(label: "DM Pings on Return", key: "dmPingsOnReturn", config: $config)
            ConfigNumberField(label: "Max Pings to Track", key: "maxPingsToTrack", config: $config)
            ConfigToggle(label: "Auto-Remove on Message", key: "autoRemoveOnMessage", config: $config)
            ConfigChannelPicker(label: "Log Channel", key: "logChannelId", config: $config)
        }
    }

    // MARK: - Polls Config

    @ViewBuilder
    private var pollsConfig: some View {
        ConfigSection(title: "Defaults", icon: "chart.bar.fill") {
            ConfigToggle(label: "Default Anonymous", key: "defaultAnonymous", config: $config)
            ConfigToggle(label: "Show Live Results", key: "defaultShowLiveResults", config: $config)
            ConfigNumberField(label: "Default Max Votes", key: "defaultMaxVotes", config: $config)
            ConfigNumberField(label: "Max Options", key: "maxOptions", config: $config)
            ConfigNumberField(label: "Max Duration (min)", key: "maxDuration", config: $config)
        }
    }

    // MARK: - Birthdays Config

    @ViewBuilder
    private var birthdaysConfig: some View {
        ConfigSection(title: "General", icon: "birthday.cake.fill") {
            ConfigChannelPicker(label: "Channel", key: "channelId", config: $config)
            ConfigRolePicker(label: "Birthday Role", key: "roleId", config: $config)
            ConfigTextField(label: "Timezone", key: "timezone", config: $config, placeholder: "UTC")
        }

        ConfigSection(title: "Notifications", icon: "bell.fill") {
            ConfigToggle(label: "DM Notification", key: "dmNotification", config: $config)
            ConfigToggle(label: "Show Age", key: "showAge", config: $config)
            ConfigToggle(label: "Allow Hide Year", key: "allowHideYear", config: $config)
            ConfigTextField(label: "Announcement Message", key: "announcementMessage", config: $config, placeholder: "Happy birthday {user}!")
        }
    }

    // MARK: - Message Tracking Config

    @ViewBuilder
    private var messageTrackingConfig: some View {
        ConfigSection(title: "Events", icon: "message.fill") {
            ConfigToggle(label: "Log Edits", key: "logEdits", config: $config)
            ConfigToggle(label: "Log Deletes", key: "logDeletes", config: $config)
            ConfigToggle(label: "Log Bulk Deletes", key: "logBulkDeletes", config: $config)
            ConfigToggle(label: "Ghost Ping Alert", key: "ghostPingAlert", config: $config)
        }

        ConfigSection(title: "Snipe", icon: "eye.fill") {
            ConfigToggle(label: "Snipe Enabled", key: "snipeEnabled", config: $config)
            ConfigNumberField(label: "Snipe Timeout (sec)", key: "snipeTimeout", config: $config)
        }

        ConfigSection(title: "Logging", icon: "doc.text.fill") {
            ConfigChannelPicker(label: "Log Channel", key: "logChannelId", config: $config)
            ConfigToggle(label: "Ignore Bots", key: "ignoreBots", config: $config)
        }
    }

    // MARK: - Giveaways Config

    @ViewBuilder
    private var giveawaysConfig: some View {
        ConfigSection(title: "General", icon: "gift.fill") {
            ConfigChannelPicker(label: "Default Channel", key: "defaultChannel", config: $config)
            ConfigTextField(label: "Reaction Emoji", key: "reactionEmoji", config: $config, placeholder: "🎉")
            ConfigToggle(label: "Button Mode", key: "buttonMode", config: $config)
            ConfigToggle(label: "DM Winners", key: "dmWinners", config: $config)
            ConfigToggle(label: "Allow Self Entry", key: "allowSelfEntry", config: $config)
            ConfigNumberField(label: "Max Active", key: "maxActive", config: $config)
        }

        ConfigSection(title: "Appearance", icon: "paintbrush.fill") {
            ConfigRolePicker(label: "Ping Role", key: "pingRole", config: $config)
            ConfigPicker(label: "End Action", key: "endAction", config: $config, options: [
                ("edit", "Edit Message"),
                ("new", "New Message"),
            ])
        }

        // Giveaway embed editor
        EmbedEditorView(sectionTitle: "Giveaway Embed", configPrefix: "", config: $config)
    }

    // MARK: - Color Roles Config

    @ViewBuilder
    private var colorRolesConfig: some View {
        ConfigSection(title: "General", icon: "paintpalette.fill") {
            ConfigChannelPicker(label: "Command Channel", key: "commandChannelId", config: $config)
            ConfigTextField(label: "Join Color (hex)", key: "joinColor", config: $config, placeholder: "#FFFFFF")
            ConfigNumberField(label: "Max Colors", key: "maxColors", config: $config)
        }

        ConfigSection(title: "Behavior", icon: "gearshape.fill") {
            ConfigToggle(label: "Delete Responses", key: "deleteResponses", config: $config)
            ConfigNumberField(label: "Delete Delay (sec)", key: "deleteResponseDelay", config: $config)
            ConfigToggle(label: "Overlap Warning", key: "overlapWarning", config: $config)
            ConfigNumberField(label: "Overlap Threshold", key: "overlapThreshold", config: $config)
        }

        ConfigSection(title: "Whitelist", icon: "checkmark.shield.fill") {
            ConfigToggle(label: "Whitelist Enabled", key: "whitelistEnabled", config: $config)
        }
    }

    // MARK: - Invite Tracker Config

    @ViewBuilder
    private var inviteTrackerConfig: some View {
        ConfigSection(title: "Tracking", icon: "link.badge.plus") {
            ConfigToggle(label: "Track Joins", key: "trackJoins", config: $config)
            ConfigToggle(label: "Track Leaves", key: "trackLeaves", config: $config)
            ConfigToggle(label: "Track Fakes", key: "trackFakes", config: $config)
            ConfigNumberField(label: "Fake Account Age (days)", key: "fakeAccountAgeDays", config: $config)
            ConfigNumberField(label: "Fake Leave Hours", key: "fakeLeaveHours", config: $config)
        }

        ConfigSection(title: "Announcements", icon: "megaphone.fill") {
            ConfigToggle(label: "Announce Joins", key: "announceJoins", config: $config)
            ConfigChannelPicker(label: "Announce Channel", key: "announceChannelId", config: $config)
            ConfigChannelPicker(label: "Log Channel", key: "logChannelId", config: $config)
        }
    }

    // MARK: - Stats Channels Config

    @ViewBuilder
    private var statsChannelsConfig: some View {
        ConfigSection(title: "General", icon: "chart.bar.fill") {
            ConfigNumberField(label: "Update Interval (min)", key: "updateInterval", config: $config)
            ConfigPicker(label: "Number Format", key: "numberFormat", config: $config, options: [
                ("full", "Full (1,234)"),
                ("abbreviated", "Abbreviated (1.2K)"),
            ])
            ConfigTextField(label: "Category Name", key: "categoryName", config: $config, placeholder: "Server Stats")
        }

        ConfigSection(title: "Goal", icon: "flag.fill") {
            ConfigNumberField(label: "Goal Target", key: "goalTarget", config: $config)
            ConfigPicker(label: "Goal Stat Type", key: "goalStatType", config: $config, options: [
                ("members", "Members"),
                ("messages", "Messages"),
                ("voice", "Voice Hours"),
            ])
        }
    }

    // MARK: - Leaderboards Config

    @ViewBuilder
    private var leaderboardsConfig: some View {
        ConfigSection(title: "General", icon: "trophy.fill") {
            ConfigPicker(label: "Default Type", key: "defaultType", config: $config, options: [
                ("xp", "XP"),
                ("level", "Level"),
                ("currency", "Currency"),
                ("messages", "Messages"),
                ("invites", "Invites"),
                ("voice", "Voice Time"),
                ("reputation", "Reputation"),
                ("counting", "Counting"),
            ])
            ConfigNumberField(label: "Entries Per Page", key: "entriesPerPage", config: $config)
            ConfigToggle(label: "Show Rank Card", key: "showRankCard", config: $config)
        }
    }

    // MARK: - Suggestions Config

    @ViewBuilder
    private var suggestionsConfig: some View {
        ConfigSection(title: "General", icon: "lightbulb.fill") {
            ConfigChannelPicker(label: "Channel", key: "channelId", config: $config)
            ConfigToggle(label: "Anonymous", key: "anonymous", config: $config)
            ConfigToggle(label: "Auto Thread", key: "autoThread", config: $config)
            ConfigToggle(label: "Require Reason", key: "requireReason", config: $config)
            ConfigToggle(label: "Allow Editing", key: "allowEditing", config: $config)
            ConfigToggle(label: "DM on Status Change", key: "dmOnStatusChange", config: $config)
        }

        ConfigSection(title: "Emojis", icon: "face.smiling.fill") {
            ConfigTextField(label: "Upvote Emoji", key: "upvoteEmoji", config: $config, placeholder: "👍")
            ConfigTextField(label: "Downvote Emoji", key: "downvoteEmoji", config: $config, placeholder: "👎")
        }

        ConfigSection(title: "Colors", icon: "paintbrush.fill") {
            ConfigColorPicker(label: "Embed Color", key: "embedColor", config: $config, defaultColor: "#3498DB")
            ConfigColorPicker(label: "Approved Color", key: "approvedColor", config: $config, defaultColor: "#2ECC71")
            ConfigColorPicker(label: "Denied Color", key: "deniedColor", config: $config, defaultColor: "#E74C3C")
            ConfigColorPicker(label: "Considering Color", key: "consideringColor", config: $config, defaultColor: "#F39C12")
            ConfigColorPicker(label: "Implemented Color", key: "implementedColor", config: $config, defaultColor: "#9B59B6")
        }

        // Suggestion embed editor
        EmbedEditorView(sectionTitle: "Suggestion Embed", configPrefix: "", config: $config)
    }

    // MARK: - Scheduled Messages Config

    @ViewBuilder
    private var scheduledMessagesConfig: some View {
        ConfigSection(title: "General", icon: "clock.fill") {
            ConfigNumberField(label: "Max Scheduled/Guild", key: "maxScheduledPerGuild", config: $config)
            ConfigTextField(label: "Timezone", key: "timezone", config: $config, placeholder: "UTC")
        }
    }

    // MARK: - Backup Config

    @ViewBuilder
    private var backupConfig: some View {
        ConfigSection(title: "Auto Backup", icon: "externaldrive.fill") {
            ConfigNumberField(label: "Auto Backup Interval (hrs)", key: "autoBackupInterval", config: $config)
            ConfigNumberField(label: "Max Backups", key: "maxBackups", config: $config)
            ConfigToggle(label: "Backup on Change", key: "backupOnChange", config: $config)
            ConfigNumberField(label: "Change Cooldown (sec)", key: "changeCooldown", config: $config)
        }
    }

    // MARK: - Userphone Config

    @ViewBuilder
    private var userphoneConfig: some View {
        ConfigSection(title: "General", icon: "phone.fill") {
            ConfigNumberField(label: "Max Duration (min)", key: "maxDuration", config: $config)
            ConfigToggle(label: "Allow Attachments", key: "allowAttachments", config: $config)
            ConfigToggle(label: "Show Server Name", key: "showServerName", config: $config)
            ConfigChannelPicker(label: "Report Channel", key: "reportChannelId", config: $config)
            ConfigNumberField(label: "Call Cooldown (sec)", key: "callCooldown", config: $config)
        }

        ConfigSection(title: "Message Format", icon: "text.bubble.fill") {
            ConfigPicker(label: "Format", key: "messageFormat", config: $config, options: [
                ("embed", "Embed"),
                ("plain", "Plain Text"),
            ])
        }

        ConfigSection(title: "Content Filter", icon: "shield.fill") {
            ConfigToggle(label: "Block NSFW", key: "contentFilter.blockNSFW", config: $config, nested: true)
            ConfigToggle(label: "Block Profanity", key: "contentFilter.blockProfanity", config: $config, nested: true)
            ConfigToggle(label: "Block Links", key: "contentFilter.blockLinks", config: $config, nested: true)
        }
    }

    // MARK: - Voice Phone Config

    @ViewBuilder
    private var voicephoneConfig: some View {
        ConfigSection(title: "General", icon: "phone.arrow.up.right.fill") {
            ConfigNumberField(label: "Max Duration (sec)", key: "maxDuration", config: $config)
            ConfigNumberField(label: "Call Cooldown (sec)", key: "callCooldown", config: $config)
            ConfigToggle(label: "Show Server Name", key: "showServerName", config: $config)
            ConfigChannelPicker(label: "Report Channel", key: "reportChannelId", config: $config)
        }

        ConfigSection(title: "Audio", icon: "waveform") {
            ConfigNumberField(label: "Bitrate", key: "bitrate", config: $config)
            ConfigNumberField(label: "Max Speakers/Side", key: "maxSpeakersPerSide", config: $config)
        }

        ConfigSection(title: "Safety & Trust", icon: "shield.checkmark.fill") {
            ConfigNumberField(label: "Min Server Size", key: "minServerSize", config: $config)
            ConfigToggle(label: "Require Community Server", key: "requireCommunity", config: $config)
            ConfigNumberField(label: "Max Strikes", key: "maxStrikes", config: $config)
            ConfigNumberField(label: "Strike Ban Duration (sec)", key: "strikeBanDuration", config: $config)
        }
    }

    // MARK: - Raffles Config

    @ViewBuilder
    private var rafflesConfig: some View {
        ConfigSection(title: "Tickets", icon: "ticket.fill") {
            ConfigNumberField(label: "Ticket Price", key: "ticketPrice", config: $config)
            ConfigPicker(label: "Currency", key: "currencyType", config: $config, options: [
                ("coins", "Coins"),
                ("gems", "Gems"),
                ("event_tokens", "Event Tokens"),
            ])
            ConfigNumberField(label: "Max Tickets/User", key: "maxTicketsPerUser", config: $config)
            ConfigNumberField(label: "Max Active Raffles", key: "maxActive", config: $config)
        }

        ConfigSection(title: "Behavior", icon: "gearshape.fill") {
            ConfigToggle(label: "DM Winners", key: "dmWinners", config: $config)
            ConfigToggle(label: "Refund on Cancel", key: "refundOnCancel", config: $config)
        }

        ConfigSection(title: "Channels & Roles", icon: "number") {
            ConfigChannelPicker(label: "Default Channel", key: "defaultChannelId", config: $config)
            ConfigRolePicker(label: "Ping Role", key: "pingRoleId", config: $config)
        }

        ConfigSection(title: "Appearance", icon: "paintbrush.fill") {
            ConfigColorPicker(label: "Embed Color", key: "embedColor", config: $config, defaultColor: "#FF6B35")
        }
    }

    // MARK: - Donation Tracking Config

    @ViewBuilder
    private var donationTrackingConfig: some View {
        ConfigSection(title: "Currency", icon: "banknote.fill") {
            ConfigPicker(label: "Currency", key: "currencyType", config: $config, options: [
                ("coins", "Coins"),
                ("gems", "Gems"),
                ("event_tokens", "Event Tokens"),
            ])
            ConfigNumberField(label: "Min Donation", key: "minDonation", config: $config)
            ConfigNumberField(label: "Max Donation", key: "maxDonation", config: $config)
        }

        ConfigSection(title: "Goal", icon: "flag.fill") {
            ConfigToggle(label: "Goal Active", key: "goalActive", config: $config)
            ConfigTextField(label: "Goal Name", key: "goalName", config: $config, placeholder: "Server Upgrade Fund")
            ConfigNumberField(label: "Goal Amount", key: "goalAmount", config: $config)
        }

        ConfigSection(title: "Announcements", icon: "megaphone.fill") {
            ConfigToggle(label: "Announce Milestones", key: "announceMilestones", config: $config)
            ConfigNumberField(label: "Leaderboard Size", key: "leaderboardSize", config: $config)
        }

        ConfigSection(title: "Channels", icon: "number") {
            ConfigChannelPicker(label: "Default Channel", key: "defaultChannelId", config: $config)
            ConfigChannelPicker(label: "Log Channel", key: "logChannelId", config: $config)
        }

        ConfigSection(title: "Appearance", icon: "paintbrush.fill") {
            ConfigColorPicker(label: "Embed Color", key: "embedColor", config: $config, defaultColor: "#2ECC71")
        }
    }

    // MARK: - Timers Config

    @ViewBuilder
    private var timersConfig: some View {
        ConfigSection(title: "Limits", icon: "timer") {
            ConfigNumberField(label: "Max Per User", key: "maxPerUser", config: $config)
            ConfigToggle(label: "Allow DM Notifications", key: "allowDm", config: $config)
        }

        ConfigSection(title: "Channels", icon: "number") {
            ConfigChannelPicker(label: "Notify Channel", key: "defaultNotifyChannelId", config: $config)
            ConfigChannelPicker(label: "Log Channel", key: "logChannelId", config: $config)
        }

        ConfigSection(title: "Appearance", icon: "paintbrush.fill") {
            ConfigColorPicker(label: "Embed Color", key: "embedColor", config: $config, defaultColor: "#3498DB")
        }
    }

    // MARK: - Reminders Config

    @ViewBuilder
    private var remindersConfig: some View {
        ConfigSection(title: "Limits", icon: "bell.badge.fill") {
            ConfigNumberField(label: "Max Reminders Per User", key: "maxReminders", config: $config)
            ConfigNumberField(label: "Max Repeat Count", key: "maxRepeat", config: $config)
        }
    }

    // MARK: - Temp Voice Config

    @ViewBuilder
    private var tempvoiceConfig: some View {
        ConfigSection(title: "Channel Setup", icon: "waveform") {
            ConfigChannelPicker(label: "Category", key: "categoryId", config: $config)
            ConfigChannelPicker(label: "Lobby Channel", key: "lobbyChannelId", config: $config)
        }

        ConfigSection(title: "Defaults", icon: "gearshape.fill") {
            ConfigNumberField(label: "Default User Limit", key: "defaultUserLimit", config: $config)
            ConfigNumberField(label: "Default Bitrate", key: "defaultBitrate", config: $config)
            ConfigTextField(label: "Name Template", key: "nameTemplate", config: $config, placeholder: "{user}'s Channel")
        }
    }

    // MARK: - Casino Config

    @ViewBuilder
    private var casinoConfig: some View {
        ConfigSection(title: "Betting", icon: "dice.fill") {
            ConfigNumberField(label: "Min Bet", key: "minBet", config: $config)
            ConfigNumberField(label: "Max Bet", key: "maxBet", config: $config)
            ConfigPicker(label: "Currency", key: "currencyType", config: $config, options: [
                ("coins", "Coins"),
                ("gems", "Gems"),
            ])
        }
        ConfigSection(title: "Settings", icon: "gearshape.fill") {
            ConfigNumberField(label: "Cooldown (seconds)", key: "cooldown", config: $config)
            ConfigChannelPicker(label: "Log Channel", key: "logChannelId", config: $config)
        }
        ConfigSection(title: "Appearance", icon: "paintbrush.fill") {
            ConfigColorPicker(label: "Embed Color", key: "embedColor", config: $config, defaultColor: "#FFD700")
        }
    }

    // MARK: - Profile Config

    @ViewBuilder
    private var profileConfig: some View {
        ConfigSection(title: "General", icon: "person.crop.circle.fill") {
            ConfigNumberField(label: "Max List Items", key: "maxListItems", config: $config)
            ConfigToggle(label: "Require /profile create", key: "requireCreate", config: $config)
        }
        ConfigSection(title: "Appearance", icon: "paintbrush.fill") {
            ConfigColorPicker(label: "Embed Color", key: "embedColor", config: $config, defaultColor: "#9B59B6")
        }
    }

    // MARK: - Family Config

    @ViewBuilder
    private var familyConfig: some View {
        ConfigSection(title: "Limits", icon: "figure.2.and.child.holdinghands") {
            ConfigNumberField(label: "Max Children", key: "maxChildren", config: $config)
            ConfigNumberField(label: "Proposal Expiry (sec)", key: "proposalExpiry", config: $config)
        }
        ConfigSection(title: "Appearance", icon: "paintbrush.fill") {
            ConfigColorPicker(label: "Embed Color", key: "embedColor", config: $config, defaultColor: "#E91E63")
        }
    }

    // MARK: - Images Config

    @ViewBuilder
    private var imagesConfig: some View {
        ConfigSection(title: "Settings", icon: "photo.fill") {
            ConfigNumberField(label: "Cooldown (seconds)", key: "cooldown", config: $config)
        }
        ConfigSection(title: "Appearance", icon: "paintbrush.fill") {
            ConfigColorPicker(label: "Embed Color", key: "embedColor", config: $config, defaultColor: "#3498DB")
        }
    }

    // MARK: - Utilities Config

    @ViewBuilder
    private var utilitiesConfig: some View {
        ConfigSection(title: "Search", icon: "magnifyingglass") {
            ConfigNumberField(label: "Search Cooldown (sec)", key: "searchCooldown", config: $config)
        }
        ConfigSection(title: "Notepad", icon: "note.text") {
            ConfigToggle(label: "Enable Notepad", key: "notepadEnabled", config: $config)
            ConfigNumberField(label: "Max Notes", key: "maxNotes", config: $config)
        }
        ConfigSection(title: "Appearance", icon: "paintbrush.fill") {
            ConfigColorPicker(label: "Embed Color", key: "embedColor", config: $config, defaultColor: "#2ECC71")
        }
    }

    // MARK: - Soundboard Config

    @ViewBuilder
    private var soundboardConfig: some View {
        ConfigSection(title: "Settings", icon: "speaker.wave.3.fill") {
            ConfigNumberField(label: "Max Custom Sounds", key: "maxCustomSounds", config: $config)
            ConfigToggle(label: "Allow User Upload", key: "allowUserUpload", config: $config)
            ConfigNumberField(label: "Cooldown (seconds)", key: "cooldown", config: $config)
        }
        ConfigSection(title: "Appearance", icon: "paintbrush.fill") {
            ConfigColorPicker(label: "Embed Color", key: "embedColor", config: $config, defaultColor: "#E67E22")
        }
    }

    // MARK: - Autosetup Config

    @ViewBuilder
    private var autosetupConfig: some View {
        ConfigSection(title: "Settings", icon: "wand.and.stars") {
            ConfigTextField(label: "Category Name", key: "categoryName", config: $config, placeholder: "Bot Setup")
        }
        ConfigSection(title: "Appearance", icon: "paintbrush.fill") {
            ConfigColorPicker(label: "Embed Color", key: "embedColor", config: $config, defaultColor: "#1ABC9C")
        }
    }

    // MARK: - Generic Fallback

    @ViewBuilder
    private var genericConfig: some View {
        if config.isEmpty {
            NexusCard {
                VStack(spacing: NexusSpacing.md) {
                    Image(systemName: "slider.horizontal.3")
                        .font(.system(size: 32))
                        .foregroundStyle(NexusColors.textMuted)
                    Text("No configurable settings")
                        .font(NexusFont.body(14))
                        .foregroundStyle(NexusColors.textSecondary)
                    Text("This module works with its default settings.")
                        .font(NexusFont.caption(12))
                        .foregroundStyle(NexusColors.textMuted)
                        .multilineTextAlignment(.center)
                }
                .frame(maxWidth: .infinity)
            }
        } else {
            ConfigSection(title: "Settings", icon: "gearshape.fill") {
                ForEach(Array(config.keys.sorted()), id: \.self) { key in
                    genericField(key: key, value: config[key])
                }
            }
        }
    }

    @ViewBuilder
    private func genericField(key: String, value: AnyCodable?) -> some View {
        if let val = value?.value {
            if val is Bool {
                ConfigToggle(label: key.splitCamelCase, key: key, config: $config)
            } else if val is Int || val is Double {
                ConfigNumberField(label: key.splitCamelCase, key: key, config: $config)
            } else if val is String {
                ConfigTextField(label: key.splitCamelCase, key: key, config: $config, placeholder: "")
            } else {
                HStack {
                    Text(key.splitCamelCase)
                        .font(NexusFont.body(14))
                        .foregroundStyle(NexusColors.textPrimary)
                    Spacer()
                    Text("Complex value")
                        .font(NexusFont.caption(13))
                        .foregroundStyle(NexusColors.textMuted)
                }
                .padding(.horizontal, NexusSpacing.md)
                .padding(.vertical, NexusSpacing.sm + 2)
            }
        }
    }

    // MARK: - Actions

    private func loadConfig() async {
        isLoading = true
        do {
            let moduleConfig = try await APIClient.shared.fetchModule(guildId, name: moduleKey)
            isEnabled = moduleConfig.enabled
            config = moduleConfig.config ?? [:]
        } catch {
            print("Failed to load module config: \(error)")
        }
        isLoading = false
    }

    private func saveConfig() async {
        // Validate warn threshold escalation order for moderation
        if moduleKey == "moderation" {
            let muteEnabled = config["warnAutoMuteEnabled"]?.value as? Bool ?? false
            let kickEnabled = config["warnAutoKickEnabled"]?.value as? Bool ?? false
            let banEnabled = config["warnAutoBanEnabled"]?.value as? Bool ?? false
            let muteCount = (config["warnAutoMuteCount"]?.value as? Int) ?? (config["warnAutoMuteCount"]?.value as? Double).map { Int($0) } ?? 0
            let kickCount = (config["warnAutoKickCount"]?.value as? Int) ?? (config["warnAutoKickCount"]?.value as? Double).map { Int($0) } ?? 0
            let banCount = (config["warnAutoBanCount"]?.value as? Int) ?? (config["warnAutoBanCount"]?.value as? Double).map { Int($0) } ?? 0

            if muteEnabled && kickEnabled && muteCount >= kickCount {
                validationError = "Auto-Mute threshold (\(muteCount)) must be lower than Auto-Kick (\(kickCount))"
                return
            }
            if muteEnabled && banEnabled && muteCount >= banCount {
                validationError = "Auto-Mute threshold (\(muteCount)) must be lower than Auto-Ban (\(banCount))"
                return
            }
            if kickEnabled && banEnabled && kickCount >= banCount {
                validationError = "Auto-Kick threshold (\(kickCount)) must be lower than Auto-Ban (\(banCount))"
                return
            }
        }

        validationError = nil
        isSaving = true
        do {
            try await APIClient.shared.updateModuleConfig(guildId, name: moduleKey, config: config)
            withAnimation(.spring(duration: 0.3)) { showSavedToast = true }
            try? await Task.sleep(for: .seconds(2))
            withAnimation(.spring(duration: 0.3)) { showSavedToast = false }
        } catch {
            print("Failed to save config: \(error)")
        }
        isSaving = false
    }
}

// MARK: - Reusable Config Components

struct ConfigSection<Content: View>: View {
    let title: String
    let icon: String
    @ViewBuilder let content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: NexusSpacing.sm) {
            HStack(spacing: NexusSpacing.sm) {
                Image(systemName: icon)
                    .font(.system(size: 13))
                    .foregroundStyle(NexusColors.cyan)
                Text(title)
                    .font(NexusFont.heading(14))
                    .foregroundStyle(NexusColors.textSecondary)
            }
            .padding(.leading, NexusSpacing.xs)

            VStack(spacing: 1) {
                content
            }
            .background(NexusColors.cardBackground)
            .clipShape(RoundedRectangle(cornerRadius: NexusRadius.md))
        }
    }
}

struct ConfigToggle: View {
    let label: String
    let key: String
    @Binding var config: [String: AnyCodable]
    var nested: Bool = false

    private var currentValue: Bool {
        if nested {
            let parts = key.split(separator: ".")
            if parts.count == 2, let parent = config[String(parts[0])]?.value as? [String: Any] {
                return parent[String(parts[1])] as? Bool ?? false
            }
            return false
        }
        return config[key]?.value as? Bool ?? false
    }

    var body: some View {
        HStack {
            Text(label)
                .font(NexusFont.body(14))
                .foregroundStyle(NexusColors.textPrimary)
            Spacer()
            Toggle("", isOn: Binding(
                get: { currentValue },
                set: { newValue in
                    if nested {
                        let parts = key.split(separator: ".")
                        if parts.count == 2 {
                            var parent = (config[String(parts[0])]?.value as? [String: Any]) ?? [:]
                            parent[String(parts[1])] = newValue
                            config[String(parts[0])] = AnyCodable(parent)
                        }
                    } else {
                        config[key] = AnyCodable(newValue)
                    }
                }
            ))
            .tint(NexusColors.cyan)
            .labelsHidden()
        }
        .padding(.horizontal, NexusSpacing.md)
        .padding(.vertical, NexusSpacing.sm + 2)
    }
}

struct ConfigTextField: View {
    let label: String
    let key: String
    @Binding var config: [String: AnyCodable]
    var nested: Bool = false
    var placeholder: String = ""

    private var currentValue: String {
        if nested {
            let parts = key.split(separator: ".")
            if parts.count == 2, let parent = config[String(parts[0])]?.value as? [String: Any] {
                return parent[String(parts[1])] as? String ?? ""
            }
            return ""
        }
        return config[key]?.value as? String ?? ""
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label)
                .font(NexusFont.caption(12))
                .foregroundStyle(NexusColors.textSecondary)
            TextField(placeholder, text: Binding(
                get: { currentValue },
                set: { newValue in
                    if nested {
                        let parts = key.split(separator: ".")
                        if parts.count == 2 {
                            var parent = (config[String(parts[0])]?.value as? [String: Any]) ?? [:]
                            parent[String(parts[1])] = newValue
                            config[String(parts[0])] = AnyCodable(parent)
                        }
                    } else {
                        config[key] = AnyCodable(newValue)
                    }
                }
            ))
            .font(NexusFont.mono(14))
            .foregroundStyle(NexusColors.textPrimary)
            .padding(NexusSpacing.sm)
            .background(NexusColors.surfaceElevated)
            .clipShape(RoundedRectangle(cornerRadius: NexusRadius.sm))
        }
        .padding(.horizontal, NexusSpacing.md)
        .padding(.vertical, NexusSpacing.sm)
    }
}

struct ConfigNumberField: View {
    let label: String
    let key: String
    @Binding var config: [String: AnyCodable]
    var nested: Bool = false
    var minValue: Int? = nil
    var maxValue: Int? = nil
    var disabled: Bool = false

    private var currentValue: Int {
        if nested {
            let parts = key.split(separator: ".")
            if parts.count == 2, let parent = config[String(parts[0])]?.value as? [String: Any] {
                if let intVal = parent[String(parts[1])] as? Int { return intVal }
                if let doubleVal = parent[String(parts[1])] as? Double { return Int(doubleVal) }
                return 0
            }
            return 0
        }
        if let intVal = config[key]?.value as? Int { return intVal }
        if let doubleVal = config[key]?.value as? Double { return Int(doubleVal) }
        return 0
    }

    var body: some View {
        HStack {
            Text(label)
                .font(NexusFont.body(14))
                .foregroundStyle(disabled ? NexusColors.textPrimary.opacity(0.35) : NexusColors.textPrimary)
            Spacer()
            TextField("0", text: Binding(
                get: { "\(currentValue)" },
                set: { newValue in
                    guard !disabled else { return }
                    guard var n = Int(newValue) else { return }
                    if let minValue, n < minValue { n = minValue }
                    if let maxValue, n > maxValue { n = maxValue }
                    if nested {
                        let parts = key.split(separator: ".")
                        if parts.count == 2 {
                            var parent = (config[String(parts[0])]?.value as? [String: Any]) ?? [:]
                            parent[String(parts[1])] = n
                            config[String(parts[0])] = AnyCodable(parent)
                        }
                    } else {
                        config[key] = AnyCodable(n)
                    }
                }
            ))
            .font(NexusFont.mono(14))
            .foregroundStyle(disabled ? NexusColors.cyan.opacity(0.35) : NexusColors.cyan)
            .multilineTextAlignment(.trailing)
            .keyboardType(.numberPad)
            .frame(width: 80)
            .disabled(disabled)
        }
        .padding(.horizontal, NexusSpacing.md)
        .padding(.vertical, NexusSpacing.sm + 2)
    }
}

struct ConfigPicker: View {
    let label: String
    let key: String
    @Binding var config: [String: AnyCodable]
    let options: [(value: String, label: String)]

    private var currentValue: String {
        config[key]?.value as? String ?? options.first?.value ?? ""
    }

    var body: some View {
        HStack {
            Text(label)
                .font(NexusFont.body(14))
                .foregroundStyle(NexusColors.textPrimary)
            Spacer()
            Menu {
                ForEach(options, id: \.value) { option in
                    Button(option.label) {
                        config[key] = AnyCodable(option.value)
                    }
                }
            } label: {
                HStack(spacing: 4) {
                    Text(options.first(where: { $0.value == currentValue })?.label ?? currentValue)
                        .font(NexusFont.body(13))
                        .foregroundStyle(NexusColors.cyan)
                    Image(systemName: "chevron.up.chevron.down")
                        .font(.system(size: 10))
                        .foregroundStyle(NexusColors.textMuted)
                }
            }
        }
        .padding(.horizontal, NexusSpacing.md)
        .padding(.vertical, NexusSpacing.sm + 2)
    }
}

// MARK: - String Extension

extension String {
    var splitCamelCase: String {
        unicodeScalars.reduce("") { result, scalar in
            if CharacterSet.uppercaseLetters.contains(scalar) && !result.isEmpty {
                return result + " " + String(scalar)
            }
            return result + String(scalar)
        }
        .capitalized
    }
}
