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

                VStack(spacing: 1) {
                    ForEach(summary, id: \.access) { group in
                        VStack(alignment: .leading, spacing: 4) {
                            HStack(spacing: NexusSpacing.sm) {
                                Circle()
                                    .fill(accessColor(group.access))
                                    .frame(width: 8, height: 8)
                                Text(group.access.rawValue)
                                    .font(NexusFont.heading(13))
                                    .foregroundStyle(accessColor(group.access))
                                NexusBadge(text: "\(group.commands.count)", color: accessColor(group.access))
                            }

                            Text(group.commands.map { "/\($0.name)" }.joined(separator: ", "))
                                .font(NexusFont.caption(11))
                                .foregroundStyle(NexusColors.textMuted)
                                .lineLimit(3)
                        }
                        .padding(.horizontal, NexusSpacing.md)
                        .padding(.vertical, NexusSpacing.sm + 2)
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
        default:
            genericConfig
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
            ConfigTextField(label: "Appeal Channel ID", key: "appealChannelId", config: $config, placeholder: "Channel ID")
        }

        ConfigSection(title: "Reputation", icon: "star.fill") {
            ConfigToggle(label: "Reputation System", key: "reputationEnabled", config: $config)
            ConfigNumberField(label: "Default Reputation", key: "defaultReputation", config: $config)
        }

        ConfigSection(title: "Advanced", icon: "gearshape.2.fill") {
            ConfigToggle(label: "Shadow Bans", key: "shadowBanEnabled", config: $config)
            ConfigToggle(label: "Alt Detection", key: "altDetectionEnabled", config: $config)
            ConfigTextField(label: "Alt Log Channel", key: "altDetectionLogChannelId", config: $config, placeholder: "Channel ID")
            ConfigToggle(label: "Currency Fines", key: "fineEnabled", config: $config)
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
            ConfigTextField(label: "Log Channel ID", key: "logChannelId", config: $config, placeholder: "Channel ID")
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
            ConfigTextField(label: "Announce Channel ID", key: "announceChannelId", config: $config, placeholder: "Channel ID")
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
            ConfigTextField(label: "Channel ID", key: "welcome.channelId", config: $config, nested: true, placeholder: "Channel ID")
            ConfigTextField(label: "Message", key: "welcome.message", config: $config, nested: true, placeholder: "Welcome {user} to {server}!")
            ConfigToggle(label: "Use Embed", key: "welcome.useEmbed", config: $config, nested: true)
            ConfigTextField(label: "Embed Color", key: "welcome.embedColor", config: $config, nested: true, placeholder: "#00FFFF")
        }

        ConfigSection(title: "Leave Message", icon: "figure.walk") {
            ConfigToggle(label: "Enabled", key: "leave.enabled", config: $config, nested: true)
            ConfigTextField(label: "Channel ID", key: "leave.channelId", config: $config, nested: true, placeholder: "Channel ID")
            ConfigTextField(label: "Message", key: "leave.message", config: $config, nested: true, placeholder: "{username} has left the server")
        }

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
            ConfigTextField(label: "Transcript Channel", key: "transcriptChannelId", config: $config, placeholder: "Channel ID")
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
            ConfigTextField(label: "Log Channel", key: "logChannelId", config: $config, placeholder: "Channel ID")
        }
    }

    // MARK: - Music Config

    @ViewBuilder
    private var musicConfig: some View {
        ConfigSection(title: "DJ System", icon: "music.mic") {
            ConfigToggle(label: "DJ Mode", key: "djEnabled", config: $config)
            ConfigTextField(label: "DJ Role ID", key: "djRoleId", config: $config, placeholder: "Role ID")
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
            ConfigTextField(label: "24/7 Voice Channel", key: "twentyFourSevenChannelId", config: $config, placeholder: "Voice Channel ID")
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
            ConfigTextField(label: "Alert Channel", key: "alertChannelId", config: $config, placeholder: "Channel ID")
            ConfigTextField(label: "Quarantine Role", key: "quarantineRoleId", config: $config, placeholder: "Role ID")
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
            ConfigTextField(label: "Default Log Channel", key: "defaultChannelId", config: $config, placeholder: "Channel ID")
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
            ConfigTextField(label: "Log Channel", key: "logChannelId", config: $config, placeholder: "Channel ID")
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
                .foregroundStyle(NexusColors.textPrimary)
            Spacer()
            TextField("0", text: Binding(
                get: { "\(currentValue)" },
                set: { newValue in
                    guard let n = Int(newValue) else { return }
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
            .foregroundStyle(NexusColors.cyan)
            .multilineTextAlignment(.trailing)
            .keyboardType(.numberPad)
            .frame(width: 80)
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
