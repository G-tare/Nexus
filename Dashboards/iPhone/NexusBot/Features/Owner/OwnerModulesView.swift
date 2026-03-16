import SwiftUI

struct OwnerModulesView: View {
    @State private var selectedTab: ModuleTab = .globalToggles
    @State private var globalToggles: [GlobalToggle] = []
    @State private var serverBans: [ServerModuleBan] = []
    @State private var isLoadingGlobalToggles = false
    @State private var isLoadingServerBans = false
    @State private var refreshID = UUID()

    // Toggle OFF sheet
    @State private var showToggleOffSheet = false
    @State private var toggleOffModuleName = ""
    @State private var selectedReason: DisableReason = .update
    @State private var reasonDetail = ""
    @State private var isSubmittingToggle = false

    var body: some View {
        ZStack {
            NexusColors.background
                .ignoresSafeArea()

            VStack(spacing: 0) {
                // Segmented Picker
                Picker("Module Tab", selection: $selectedTab) {
                    Text("Global Toggles").tag(ModuleTab.globalToggles)
                    Text("Server Bans").tag(ModuleTab.serverBans)
                }
                .pickerStyle(.segmented)
                .padding(.horizontal, NexusSpacing.lg)
                .padding(.vertical, NexusSpacing.md)

                // Content
                if selectedTab == .globalToggles {
                    globalTogglesView
                } else {
                    serverBansView
                }
            }
            .navigationTitle("Global Modules")
            .refreshable {
                refreshID = UUID()
                await loadGlobalToggles()
                await loadServerBans()
            }
        }
        .sheet(isPresented: $showToggleOffSheet) {
            toggleOffSheet
        }
        .onAppear {
            Task {
                await loadGlobalToggles()
                await loadServerBans()
            }
        }
        .id(refreshID)
    }

    // MARK: - Global Toggles View

    private var globalTogglesView: some View {
        ZStack {
            NexusColors.background
                .ignoresSafeArea()

            if isLoadingGlobalToggles && globalToggles.isEmpty {
                ScrollView {
                    VStack(spacing: NexusSpacing.lg) {
                        ForEach(0..<5, id: \.self) { _ in
                            SkeletonView()
                                .frame(height: 80)
                                .padding(.horizontal, NexusSpacing.lg)
                        }
                    }
                    .padding(.vertical, NexusSpacing.lg)
                }
            } else if globalToggles.isEmpty {
                ScrollView {
                    EmptyStateView(
                        title: "No Modules",
                        subtitle: "No modules found to manage"
                    )
                    .frame(maxWidth: .infinity, alignment: .top)
                    .padding(.vertical, NexusSpacing.lg)
                }
            } else {
                ScrollView {
                    VStack(spacing: NexusSpacing.md) {
                        ForEach(globalToggles, id: \.moduleName) { toggle in
                            globalToggleRow(toggle: toggle)
                        }
                    }
                    .padding(.horizontal, NexusSpacing.lg)
                    .padding(.vertical, NexusSpacing.lg)
                }
            }
        }
        .task {
            await loadGlobalToggles()
        }
    }

    private func globalToggleRow(toggle: GlobalToggle) -> some View {
        NexusCard {
            VStack(alignment: .leading, spacing: NexusSpacing.sm) {
                HStack(alignment: .center, spacing: NexusSpacing.md) {
                    VStack(alignment: .leading, spacing: NexusSpacing.xs) {
                        Text(toggle.moduleName)
                            .font(NexusFont.heading(18))
                            .foregroundStyle(NexusColors.textPrimary)

                        if !toggle.enabled {
                            if let reason = toggle.reason {
                                Text(reason.capitalized)
                                    .font(NexusFont.caption(12))
                                    .foregroundStyle(NexusColors.warning)
                            }
                        }
                    }

                    Spacer()

                    VStack(alignment: .trailing, spacing: NexusSpacing.xs) {
                        NexusBadge(
                            text: toggle.enabled ? "Enabled" : "Disabled",
                            backgroundColor: toggle.enabled ? NexusColors.success : NexusColors.error
                        )

                        Toggle("", isOn: Binding(
                            get: { toggle.enabled },
                            set: { newValue in
                                handleToggleChange(moduleName: toggle.moduleName, enabled: newValue)
                            }
                        ))
                        .tint(NexusColors.cyan)
                    }
                }

                if !toggle.enabled {
                    Divider()
                        .foregroundStyle(NexusColors.border)

                    VStack(alignment: .leading, spacing: NexusSpacing.xs) {
                        if let reasonDetail = toggle.reasonDetail, !reasonDetail.isEmpty {
                            VStack(alignment: .leading, spacing: NexusSpacing.xs) {
                                Text("Details")
                                    .font(NexusFont.caption(12))
                                    .foregroundStyle(NexusColors.textMuted)

                                Text(reasonDetail)
                                    .font(NexusFont.body(14))
                                    .foregroundStyle(NexusColors.textSecondary)
                            }
                        }

                        if let disabledBy = toggle.disabledBy {
                            Text("Disabled by: \(disabledBy)")
                                .font(NexusFont.caption(12))
                                .foregroundStyle(NexusColors.textMuted)
                        }

                        if let updatedAt = toggle.updatedAt, !updatedAt.isEmpty {
                            Text("Updated: \(updatedAt)")
                                .font(NexusFont.caption(12))
                                .foregroundStyle(NexusColors.textMuted)
                        }
                    }
                }
            }
            .padding(NexusSpacing.md)
        }
    }

    // MARK: - Server Bans View

    private var serverBansView: some View {
        ZStack {
            NexusColors.background
                .ignoresSafeArea()

            if isLoadingServerBans && serverBans.isEmpty {
                ScrollView {
                    VStack(spacing: NexusSpacing.lg) {
                        ForEach(0..<5, id: \.self) { _ in
                            SkeletonView()
                                .frame(height: 100)
                                .padding(.horizontal, NexusSpacing.lg)
                        }
                    }
                    .padding(.vertical, NexusSpacing.lg)
                }
            } else if serverBans.isEmpty {
                ScrollView {
                    EmptyStateView(
                        title: "No Bans",
                        subtitle: "No server-level module bans"
                    )
                    .frame(maxWidth: .infinity, alignment: .top)
                    .padding(.vertical, NexusSpacing.lg)
                }
            } else {
                ScrollView {
                    VStack(spacing: NexusSpacing.md) {
                        ForEach(serverBans, id: \.id) { ban in
                            serverBanRow(ban: ban)
                        }
                    }
                    .padding(.horizontal, NexusSpacing.lg)
                    .padding(.vertical, NexusSpacing.lg)
                }
            }
        }
        .task {
            await loadServerBans()
        }
    }

    private func serverBanRow(ban: ServerModuleBan) -> some View {
        NexusCard {
            VStack(alignment: .leading, spacing: NexusSpacing.sm) {
                // Header
                HStack(alignment: .top, spacing: NexusSpacing.md) {
                    VStack(alignment: .leading, spacing: NexusSpacing.xs) {
                        Text(ban.moduleName)
                            .font(NexusFont.heading(18))
                            .foregroundStyle(NexusColors.textPrimary)

                        Text("Guild: \(ban.guildId)")
                            .font(NexusFont.body(14))
                            .foregroundStyle(NexusColors.textSecondary)
                            .lineLimit(1)
                    }

                    Spacer()

                    NexusBadge(
                        text: (ban.reason ?? "banned").capitalized,
                        backgroundColor: NexusColors.warning
                    )
                }

                Divider()
                    .foregroundStyle(NexusColors.border)

                // Details
                VStack(alignment: .leading, spacing: NexusSpacing.sm) {
                    if let detail = ban.reasonDetail, !detail.isEmpty {
                        VStack(alignment: .leading, spacing: NexusSpacing.xs) {
                            Text("Details")
                                .font(NexusFont.caption(12))
                                .foregroundStyle(NexusColors.textMuted)

                            Text(detail)
                                .font(NexusFont.body(14))
                                .foregroundStyle(NexusColors.textSecondary)
                        }
                    }

                    HStack(spacing: NexusSpacing.lg) {
                        VStack(alignment: .leading, spacing: NexusSpacing.xs) {
                            Text("Banned by")
                                .font(NexusFont.caption(12))
                                .foregroundStyle(NexusColors.textMuted)

                            Text(ban.bannedBy ?? "Unknown")
                                .font(NexusFont.body(14))
                                .foregroundStyle(NexusColors.textSecondary)
                        }

                        Spacer()

                        VStack(alignment: .trailing, spacing: NexusSpacing.xs) {
                            Text("Date")
                                .font(NexusFont.caption(12))
                                .foregroundStyle(NexusColors.textMuted)

                            Text(ban.createdAt ?? "Unknown")
                                .font(NexusFont.body(14))
                                .foregroundStyle(NexusColors.textSecondary)
                        }
                    }
                }
            }
            .padding(NexusSpacing.md)
        }
    }

    // MARK: - Toggle Off Sheet

    private var toggleOffSheet: some View {
        NavigationStack {
            ZStack {
                NexusColors.background
                    .ignoresSafeArea()

                VStack(spacing: NexusSpacing.lg) {
                    VStack(alignment: .leading, spacing: NexusSpacing.md) {
                        Text("Disable Module")
                            .font(NexusFont.title(24))
                            .foregroundStyle(NexusColors.textPrimary)

                        Text("Select a reason for disabling \(toggleOffModuleName)")
                            .font(NexusFont.body(14))
                            .foregroundStyle(NexusColors.textSecondary)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)

                    VStack(alignment: .leading, spacing: NexusSpacing.sm) {
                        Text("Reason")
                            .font(NexusFont.body(14))
                            .foregroundStyle(NexusColors.textPrimary)

                        Picker("Reason", selection: $selectedReason) {
                            ForEach(DisableReason.allCases, id: \.self) { reason in
                                Text(reason.rawValue.capitalized).tag(reason)
                            }
                        }
                        .pickerStyle(.segmented)
                    }

                    VStack(alignment: .leading, spacing: NexusSpacing.sm) {
                        Text("Details (Optional)")
                            .font(NexusFont.body(14))
                            .foregroundStyle(NexusColors.textPrimary)

                        TextEditor(text: $reasonDetail)
                            .frame(height: 100)
                            .padding(NexusSpacing.sm)
                            .background(NexusColors.cardBackground)
                            .cornerRadius(NexusRadius.md)
                            .foregroundStyle(NexusColors.textPrimary)
                            .font(NexusFont.body(14))
                    }

                    Spacer()

                    VStack(spacing: NexusSpacing.sm) {
                        NexusButton(
                            title: isSubmittingToggle ? "Disabling..." : "Disable Module",
                            style: .destructive,
                            isLoading: isSubmittingToggle,
                            action: submitToggleOff
                        )

                        NexusButton(
                            title: "Cancel",
                            style: .ghost,
                            action: {
                                showToggleOffSheet = false
                                resetToggleOffSheet()
                            }
                        )
                    }
                }
                .padding(NexusSpacing.lg)
            }
            .navigationBarTitleDisplayMode(.inline)
        }
    }

    // MARK: - Actions

    private func handleToggleChange(moduleName: String, enabled: Bool) {
        if !enabled {
            toggleOffModuleName = moduleName
            selectedReason = .update
            reasonDetail = ""
            showToggleOffSheet = true
        } else {
            // Toggle ON - direct API call
            Task {
                await toggleModule(moduleName: moduleName, enabled: true)
            }
        }
    }

    private func submitToggleOff() {
        Task {
            isSubmittingToggle = true
            await toggleModule(
                moduleName: toggleOffModuleName,
                enabled: false,
                reason: selectedReason,
                reasonDetail: reasonDetail
            )
            isSubmittingToggle = false
            showToggleOffSheet = false
            resetToggleOffSheet()
        }
    }

    private func toggleModule(
        moduleName: String,
        enabled: Bool,
        reason: DisableReason? = nil,
        reasonDetail: String = ""
    ) async {
        do {
            try await APIClient.shared.toggleGlobalModule(
                moduleName,
                enabled: enabled,
                reason: reason?.rawValue,
                reasonDetail: reasonDetail.isEmpty ? nil : reasonDetail
            )

            // Refresh toggles
            await loadGlobalToggles()
        } catch {
            print("Error toggling module: \(error)")
        }
    }

    /// All known bot modules — shown by default as enabled,
    /// then overridden by explicit entries from the global_module_toggles table.
    private static let allModuleNames: [String] = [
        "moderation", "welcome", "leveling", "currency", "automod",
        "counting", "reaction_roles", "reminders", "fun", "afk",
        "reputation", "polls", "logging", "confessions", "tickets",
        "giveaways", "boards", "invite_tracker", "music",
        "shop", "color_roles", "forms", "suggestions",
        "scheduled_messages", "translation", "custom_commands",
        "leaderboards", "temp_voice", "sticky_messages", "userphone",
        "message_tracking", "ai_chatbot", "voicephone",
        "advanced_analytics", "soundboard", "backup", "anti_raid",
        "stats_channels", "profile", "family", "birthdays",
        "donation_tracking", "casino", "anti_nuke", "custom_branding"
    ]

    private func loadGlobalToggles() async {
        isLoadingGlobalToggles = true
        do {
            let response = try await APIClient.shared.fetchGlobalToggles()

            // Merge API toggles with all known modules
            let apiToggles = Dictionary(uniqueKeysWithValues: response.toggles.map { ($0.moduleName, $0) })
            var merged: [GlobalToggle] = []

            for moduleName in Self.allModuleNames {
                if let existing = apiToggles[moduleName] {
                    merged.append(existing)
                } else {
                    merged.append(GlobalToggle(
                        moduleName: moduleName,
                        enabled: true,
                        reason: nil,
                        reasonDetail: nil,
                        disabledBy: nil,
                        updatedAt: nil
                    ))
                }
            }

            // Also include any API toggles for modules not in our hardcoded list
            for toggle in response.toggles where !Self.allModuleNames.contains(toggle.moduleName) {
                merged.append(toggle)
            }

            await MainActor.run {
                self.globalToggles = merged
                self.isLoadingGlobalToggles = false
            }
        } catch {
            print("Error loading global toggles: \(error)")
            isLoadingGlobalToggles = false
        }
    }

    private func loadServerBans() async {
        isLoadingServerBans = true
        do {
            let response = try await APIClient.shared.fetchServerBans(limit: 50)
            await MainActor.run {
                self.serverBans = response.bans
                self.isLoadingServerBans = false
            }
        } catch {
            print("Error loading server bans: \(error)")
            isLoadingServerBans = false
        }
    }

    private func resetToggleOffSheet() {
        toggleOffModuleName = ""
        selectedReason = .update
        reasonDetail = ""
    }

}

// MARK: - Supporting Types

enum ModuleTab {
    case globalToggles
    case serverBans
}

enum DisableReason: String, CaseIterable {
    case update
    case glitch
    case issue
    case misuse
}

// MARK: - API Models


// MARK: - Preview

#Preview {
    NavigationStack {
        OwnerModulesView()
    }
}
