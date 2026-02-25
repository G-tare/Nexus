import SwiftUI

struct SettingsView: View {
    let guildId: String
    let guildName: String
    @EnvironmentObject var authManager: AuthManager
    @State private var locale = "en"
    @State private var timezone = "UTC"
    @State private var isSaving = false
    @State private var showSaved = false
    @State private var permissions: [String: [Permission]] = [:]
    @State private var isLoadingPerms = true

    private let timezones = [
        "UTC", "US/Eastern", "US/Central", "US/Mountain", "US/Pacific",
        "Europe/London", "Europe/Paris", "Europe/Berlin", "Asia/Tokyo",
        "Asia/Shanghai", "Asia/Kolkata", "Australia/Sydney",
    ]

    private let locales = [
        ("en", "English"), ("es", "Spanish"), ("fr", "French"),
        ("de", "German"), ("ja", "Japanese"), ("ko", "Korean"),
        ("pt", "Portuguese"), ("zh", "Chinese"),
    ]

    var body: some View {
        ZStack {
            NexusColors.background.ignoresSafeArea()

            ScrollView {
                VStack(alignment: .leading, spacing: NexusSpacing.xl) {
                    // Server Settings
                    NexusSectionHeader(title: "Server Settings")

                    NexusCard {
                        VStack(spacing: NexusSpacing.lg) {
                            // Locale picker
                            HStack {
                                Image(systemName: "globe")
                                    .foregroundStyle(NexusColors.cyan)
                                Text("Language")
                                    .font(NexusFont.body(14))
                                    .foregroundStyle(NexusColors.textPrimary)
                                Spacer()
                                Picker("", selection: $locale) {
                                    ForEach(locales, id: \.0) { code, name in
                                        Text(name).tag(code)
                                    }
                                }
                                .tint(NexusColors.cyan)
                            }

                            Divider().background(NexusColors.border)

                            // Timezone picker
                            HStack {
                                Image(systemName: "clock")
                                    .foregroundStyle(NexusColors.purple)
                                Text("Timezone")
                                    .font(NexusFont.body(14))
                                    .foregroundStyle(NexusColors.textPrimary)
                                Spacer()
                                Picker("", selection: $timezone) {
                                    ForEach(timezones, id: \.self) { tz in
                                        Text(tz).tag(tz)
                                    }
                                }
                                .tint(NexusColors.cyan)
                            }
                        }
                    }

                    NexusButton(
                        title: "Save Settings",
                        icon: "checkmark.circle.fill",
                        isLoading: isSaving
                    ) {
                        Task { await saveSettings() }
                    }

                    // Permissions
                    NexusSectionHeader(title: "Command Permissions")

                    if isLoadingPerms {
                        ForEach(0..<3, id: \.self) { _ in
                            SkeletonView(height: 48)
                        }
                    } else if permissions.isEmpty {
                        NexusCard {
                            HStack {
                                Image(systemName: "lock.open.fill")
                                    .foregroundStyle(NexusColors.success)
                                Text("Using default permissions for all commands")
                                    .font(NexusFont.body(14))
                                    .foregroundStyle(NexusColors.textSecondary)
                            }
                        }
                    } else {
                        VStack(spacing: NexusSpacing.sm) {
                            ForEach(Array(permissions.keys.sorted()), id: \.self) { command in
                                if let rules = permissions[command] {
                                    permissionRow(command: command, rules: rules)
                                }
                            }
                        }
                    }

                    // Premium
                    NexusSectionHeader(title: "Premium")

                    NexusCard(glowColor: NexusColors.purple) {
                        HStack {
                            VStack(alignment: .leading, spacing: NexusSpacing.xs) {
                                Text("Free Tier")
                                    .font(NexusFont.heading(16))
                                    .foregroundStyle(NexusColors.textPrimary)
                                Text("Upgrade for advanced features")
                                    .font(NexusFont.caption(12))
                                    .foregroundStyle(NexusColors.textSecondary)
                            }
                            Spacer()
                            NexusBadge(text: "FREE", color: NexusColors.textSecondary)
                        }
                    }

                    // Account
                    NexusSectionHeader(title: "Account")

                    Button {
                        authManager.logout()
                    } label: {
                        HStack {
                            Image(systemName: "arrow.right.square")
                                .foregroundStyle(NexusColors.error)
                            Text("Sign Out")
                                .font(NexusFont.body(14))
                                .foregroundStyle(NexusColors.error)
                            Spacer()
                        }
                        .padding(NexusSpacing.md)
                        .background(NexusColors.cardBackground)
                        .clipShape(RoundedRectangle(cornerRadius: NexusRadius.md))
                    }

                    // App info
                    HStack {
                        Spacer()
                        Text("Nexus Bot v1.0.0")
                            .font(NexusFont.caption(11))
                            .foregroundStyle(NexusColors.textMuted)
                        Spacer()
                    }
                    .padding(.top, NexusSpacing.lg)
                }
                .padding(.horizontal, NexusSpacing.lg)
                .padding(.top, NexusSpacing.lg)
                .padding(.bottom, 100)
            }
        }
        .task {
            await loadSettings()
            await loadPermissions()
        }
    }

    private func permissionRow(command: String, rules: [Permission]) -> some View {
        NexusCard {
            VStack(alignment: .leading, spacing: NexusSpacing.sm) {
                Text("/\(command)")
                    .font(NexusFont.mono(13))
                    .foregroundStyle(NexusColors.cyan)

                ForEach(rules) { rule in
                    HStack(spacing: NexusSpacing.sm) {
                        Image(systemName: rule.allowed ? "checkmark.circle.fill" : "xmark.circle.fill")
                            .foregroundStyle(rule.allowed ? NexusColors.success : NexusColors.error)
                            .font(.system(size: 12))
                        Text(rule.targetType.capitalized)
                            .font(NexusFont.caption(11))
                            .foregroundStyle(NexusColors.textSecondary)
                        Text(rule.targetId)
                            .font(NexusFont.caption(11))
                            .foregroundStyle(NexusColors.textMuted)
                            .lineLimit(1)
                    }
                }
            }
        }
    }

    private func loadSettings() async {
        do {
            let detail = try await APIClient.shared.fetchGuild(guildId)
            locale = detail.guild.locale ?? "en"
            timezone = detail.guild.timezone ?? "UTC"
        } catch {
            print("Failed to load settings: \(error)")
        }
    }

    private func loadPermissions() async {
        isLoadingPerms = true
        do {
            permissions = try await APIClient.shared.fetchPermissions(guildId)
        } catch {
            print("Failed to load permissions: \(error)")
        }
        isLoadingPerms = false
    }

    private func saveSettings() async {
        isSaving = true
        do {
            try await APIClient.shared.updateGuildSettings(
                guildId,
                settings: GuildSettings(locale: locale, timezone: timezone)
            )
        } catch {
            print("Failed to save settings: \(error)")
        }
        isSaving = false
    }
}
