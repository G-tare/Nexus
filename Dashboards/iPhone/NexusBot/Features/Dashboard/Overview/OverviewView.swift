import SwiftUI
import Charts

struct OverviewView: View {
    let guildId: String
    @EnvironmentObject var guildCache: GuildDataCache
    @State private var stats: GuildStats?
    @State private var recentCases: [ModCase] = []
    @State private var isLoading = true

    private let statsColumns = [
        GridItem(.flexible(), spacing: NexusSpacing.md),
        GridItem(.flexible(), spacing: NexusSpacing.md),
    ]

    var body: some View {
        ZStack {
            NexusColors.background.ignoresSafeArea()

            ScrollView {
                VStack(alignment: .leading, spacing: NexusSpacing.xl) {

                    // MARK: - Stats Grid
                    if let stats {
                        LazyVGrid(columns: statsColumns, spacing: NexusSpacing.md) {
                            StatCard(
                                title: "Members",
                                value: formatNumber(stats.totalMembers),
                                icon: "person.2.fill",
                                accentColor: NexusColors.cyan
                            )
                            StatCard(
                                title: "Messages",
                                value: formatNumber(stats.totalMessages),
                                icon: "message.fill",
                                accentColor: NexusColors.purple
                            )
                            StatCard(
                                title: "Voice Time",
                                value: formatMinutes(stats.totalVoiceMinutes),
                                icon: "waveform",
                                accentColor: NexusColors.pink
                            )
                            StatCard(
                                title: "Highest Level",
                                value: "Lv. \(stats.highestLevel)",
                                icon: "arrow.up.circle.fill",
                                accentColor: NexusColors.success
                            )
                        }
                    } else if isLoading {
                        LazyVGrid(columns: statsColumns, spacing: NexusSpacing.md) {
                            ForEach(0..<4, id: \.self) { _ in
                                SkeletonView(height: 110)
                            }
                        }
                    }

                    // MARK: - Quick Module Toggles
                    NexusSectionHeader(title: "Quick Toggles")

                    let quickModules = ["moderation", "leveling", "music", "automod", "welcome", "tickets"]
                    VStack(spacing: NexusSpacing.sm) {
                        ForEach(quickModules, id: \.self) { moduleKey in
                            if let info = ModuleRegistry.info(for: moduleKey) {
                                let isEnabled = guildCache.modules[moduleKey]?.enabled ?? false
                                QuickToggleRow(
                                    name: info.name,
                                    icon: info.icon,
                                    isEnabled: isEnabled,
                                    accentColor: info.category.color
                                ) { newValue in
                                    Task {
                                        await guildCache.setModuleEnabled(moduleKey, enabled: newValue)
                                    }
                                }
                            }
                        }
                    }

                    // MARK: - Analytics Link
                    NavigationLink {
                        AnalyticsView(guildId: guildId)
                            .navigationTitle("Analytics")
                            .navigationBarTitleDisplayMode(.inline)
                    } label: {
                        HStack(spacing: NexusSpacing.md) {
                            Image(systemName: "chart.xyaxis.line")
                                .font(.system(size: 18))
                                .foregroundStyle(NexusColors.purple)
                                .frame(width: 36, height: 36)
                                .background(NexusColors.purple.opacity(0.12))
                                .clipShape(RoundedRectangle(cornerRadius: NexusRadius.sm))

                            VStack(alignment: .leading, spacing: 2) {
                                Text("Analytics & Charts")
                                    .font(NexusFont.body(15))
                                    .foregroundStyle(NexusColors.textPrimary)
                                Text("Activity graphs and insights")
                                    .font(NexusFont.caption(12))
                                    .foregroundStyle(NexusColors.textSecondary)
                            }

                            Spacer()

                            Image(systemName: "chevron.right")
                                .font(.system(size: 12))
                                .foregroundStyle(NexusColors.textMuted)
                        }
                        .padding(NexusSpacing.md)
                        .background(NexusColors.cardBackground)
                        .clipShape(RoundedRectangle(cornerRadius: NexusRadius.md))
                        .overlay(
                            RoundedRectangle(cornerRadius: NexusRadius.md)
                                .stroke(NexusColors.purple.opacity(0.2), lineWidth: 1)
                        )
                    }

                    // MARK: - Recent Mod Actions
                    NexusSectionHeader(title: "Recent Actions")

                    if recentCases.isEmpty && !isLoading {
                        NexusCard {
                            HStack {
                                Image(systemName: "checkmark.shield.fill")
                                    .foregroundStyle(NexusColors.success)
                                Text("No recent moderation actions")
                                    .font(NexusFont.body(14))
                                    .foregroundStyle(NexusColors.textSecondary)
                            }
                        }
                    } else {
                        VStack(spacing: NexusSpacing.sm) {
                            ForEach(recentCases.prefix(5)) { modCase in
                                ModCaseRow(
                                    caseNumber: modCase.caseNumber,
                                    actionType: modCase.action,
                                    targetUsername: modCase.username ?? modCase.userId,
                                    moderatorUsername: modCase.moderatorUsername ?? modCase.moderatorId,
                                    reason: modCase.reason,
                                    timestamp: modCase.createdDate
                                )
                            }
                        }
                    }
                }
                .padding(.horizontal, NexusSpacing.lg)
                .padding(.top, NexusSpacing.lg)
                .padding(.bottom, 100)
            }
            .refreshable { await loadData() }
        }
        .task { await loadData() }
    }

    private func loadData() async {
        let isFirstLoad = stats == nil
        if isFirstLoad { isLoading = true }

        async let statsTask = APIClient.shared.fetchGuildStats(guildId)
        async let casesTask: Void = loadCases()

        // Refresh modules in shared cache if not yet loaded
        if !guildCache.modulesLoaded {
            await guildCache.loadModules()
        }

        if let newStats = try? await statsTask {
            stats = newStats
        }
        await casesTask
        isLoading = false
    }

    private func loadCases() async {
        if let response = try? await APIClient.shared.fetchModLogs(guildId, page: 1, limit: 5) {
            recentCases = response.cases
        }
    }
}

// MARK: - Quick Toggle Row

struct QuickToggleRow: View {
    let name: String
    let icon: String
    let isEnabled: Bool
    let accentColor: Color
    let onToggle: (Bool) -> Void

    @State private var localEnabled: Bool

    init(name: String, icon: String, isEnabled: Bool, accentColor: Color, onToggle: @escaping (Bool) -> Void) {
        self.name = name
        self.icon = icon
        self.isEnabled = isEnabled
        self.accentColor = accentColor
        self.onToggle = onToggle
        self._localEnabled = State(initialValue: isEnabled)
    }

    var body: some View {
        HStack(spacing: NexusSpacing.md) {
            Image(systemName: icon)
                .font(.system(size: 16))
                .foregroundStyle(localEnabled ? accentColor : NexusColors.textMuted)
                .frame(width: 32, height: 32)
                .background((localEnabled ? accentColor : NexusColors.textMuted).opacity(0.1))
                .clipShape(RoundedRectangle(cornerRadius: NexusRadius.sm))

            Text(name)
                .font(NexusFont.body(14))
                .foregroundStyle(NexusColors.textPrimary)

            Spacer()

            Toggle("", isOn: $localEnabled)
                .tint(NexusColors.cyan)
                .labelsHidden()
                .onChange(of: localEnabled) { _, newValue in
                    onToggle(newValue)
                }
        }
        .padding(.horizontal, NexusSpacing.md)
        .padding(.vertical, NexusSpacing.sm)
        .background(NexusColors.cardBackground)
        .clipShape(RoundedRectangle(cornerRadius: NexusRadius.md))
        .onChange(of: isEnabled) { _, newValue in
            if localEnabled != newValue {
                localEnabled = newValue
            }
        }
    }
}
