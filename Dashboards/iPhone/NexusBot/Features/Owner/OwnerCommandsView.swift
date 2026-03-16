import SwiftUI

struct OwnerCommandsView: View {
    @State private var selectedTab: CommandTab = .commands
    @State private var isLoading = false
    @State private var userActivityStats: UserActivityStats?
    @State private var commandStats: [CommandStat] = []
    @State private var moduleStats: [ModuleAnalyticsStat] = []
    @State private var errorMessage: String?

    enum CommandTab {
        case commands
        case modules
    }

    var body: some View {
        ZStack {
            NexusColors.background
                .ignoresSafeArea()

            VStack(spacing: 0) {
                // Tab Picker
                Picker("View", selection: $selectedTab) {
                    Text("Commands").tag(CommandTab.commands)
                    Text("Modules").tag(CommandTab.modules)
                }
                .pickerStyle(.segmented)
                .padding(.horizontal, NexusSpacing.lg)
                .padding(.vertical, NexusSpacing.md)

                // Content
                if isLoading && userActivityStats == nil {
                    loadingView
                } else if let error = errorMessage {
                    errorView(error)
                } else {
                    scrollView
                }
            }
            .navigationTitle("Command Usage")
            .navigationBarTitleDisplayMode(.inline)
        }
        .onAppear {
            loadData()
        }
        .refreshable {
            await refreshData()
        }
    }

    @ViewBuilder
    private var scrollView: some View {
        ScrollView {
            VStack(spacing: NexusSpacing.lg) {
                // User Activity Stats
                userActivitySection

                // Command Stats Section
                commandStatsHeaderSection

                // Tab Content
                if selectedTab == .commands {
                    commandsListSection
                } else {
                    modulesListSection
                }
            }
            .padding(.horizontal, NexusSpacing.lg)
            .padding(.vertical, NexusSpacing.md)
        }
    }

    @ViewBuilder
    private var userActivitySection: some View {
        if let stats = userActivityStats {
            VStack(spacing: NexusSpacing.md) {
                NexusSectionHeader(title: "User Activity")

                // 2-column grid for DAU, WAU, MAU
                VStack(spacing: NexusSpacing.md) {
                    HStack(spacing: NexusSpacing.md) {
                        StatCard(
                            title: "DAU",
                            value: "\(stats.dau)",
                            subtitle: "Daily Active Users",
                            icon: "person.fill",
                            color: NexusColors.cyan
                        )

                        StatCard(
                            title: "WAU",
                            value: "\(stats.wau)",
                            subtitle: "Weekly Active Users",
                            icon: "calendar",
                            color: NexusColors.purple
                        )
                    }

                    HStack(spacing: NexusSpacing.md) {
                        StatCard(
                            title: "MAU",
                            value: "\(stats.mau)",
                            subtitle: "Monthly Active Users",
                            icon: "chart.bar.fill",
                            color: NexusColors.success
                        )

                        // Empty spacer for grid alignment
                        Color.clear
                    }
                }
            }
        }
    }

    @ViewBuilder
    private var commandStatsHeaderSection: some View {
        if let stats = userActivityStats {
            VStack(spacing: NexusSpacing.md) {
                NexusSectionHeader(title: "Command Usage Stats")

                HStack(spacing: NexusSpacing.md) {
                    StatCard(
                        title: "Cmds/24h",
                        value: "\(stats.commands24h)",
                        subtitle: "Last 24 hours",
                        icon: "bolt.fill",
                        color: NexusColors.warning
                    )

                    StatCard(
                        title: "Cmds/7d",
                        value: "\(stats.commands7d)",
                        subtitle: "Last 7 days",
                        icon: "bolt.fill",
                        color: NexusColors.cyan
                    )
                }

                HStack(spacing: NexusSpacing.md) {
                    StatCard(
                        title: "Cmds/30d",
                        value: "\(stats.commands30d)",
                        subtitle: "Last 30 days",
                        icon: "bolt.fill",
                        color: NexusColors.purple
                    )

                    Color.clear
                }
            }
        }
    }

    @ViewBuilder
    private var commandsListSection: some View {
        VStack(spacing: NexusSpacing.md) {
            NexusSectionHeader(title: "Top Commands")

            if commandStats.isEmpty {
                EmptyStateView(
                    title: "No Commands",
                    subtitle: "No command usage data available yet"
                )
                .frame(maxWidth: .infinity, alignment: .top)
            } else {
                VStack(spacing: NexusSpacing.sm) {
                    ForEach(commandStats, id: \.commandName) { stat in
                        commandRow(stat)
                    }
                }
            }
        }
    }

    @ViewBuilder
    private var modulesListSection: some View {
        VStack(spacing: NexusSpacing.md) {
            NexusSectionHeader(title: "Modules")

            if moduleStats.isEmpty {
                EmptyStateView(
                    title: "No Modules",
                    subtitle: "No module data available yet"
                )
                .frame(maxWidth: .infinity, alignment: .top)
            } else {
                VStack(spacing: NexusSpacing.sm) {
                    ForEach(moduleStats, id: \.moduleName) { stat in
                        moduleRow(stat)
                    }
                }
            }
        }
    }

    @ViewBuilder
    private func commandRow(_ stat: CommandStat) -> some View {
        NexusCard {
            VStack(alignment: .leading, spacing: NexusSpacing.sm) {
                // Header with command name and module badge
                HStack(spacing: NexusSpacing.md) {
                    VStack(alignment: .leading, spacing: NexusSpacing.xs) {
                        HStack(spacing: NexusSpacing.sm) {
                            Text(stat.commandName)
                                .font(NexusFont.heading(18))
                                .foregroundStyle(NexusColors.textPrimary)

                            if let subcommand = stat.subcommandName, !subcommand.isEmpty {
                                Text(subcommand)
                                    .font(NexusFont.caption(12))
                                    .foregroundStyle(NexusColors.textSecondary)
                            }
                        }

                        NexusBadge(
                            text: stat.moduleName,
                            backgroundColor: NexusColors.surfaceElevated,
                            textColor: NexusColors.textPrimary
                        )
                    }

                    Spacer()

                    VStack(alignment: .trailing, spacing: NexusSpacing.xs) {
                        Text("\(stat.totalUses)")
                            .font(NexusFont.stat(22))
                            .foregroundStyle(NexusColors.textPrimary)

                        Text("Total Uses")
                            .font(NexusFont.caption(12))
                            .foregroundStyle(NexusColors.textMuted)
                    }
                }

                Divider()
                    .background(NexusColors.border)

                // Stats grid
                HStack(spacing: NexusSpacing.lg) {
                    VStack(alignment: .leading, spacing: NexusSpacing.xs) {
                        Text("\(stat.successCount)")
                            .font(NexusFont.body(14))
                            .foregroundStyle(NexusColors.success)

                        Text("Success")
                            .font(NexusFont.caption(12))
                            .foregroundStyle(NexusColors.textMuted)
                    }

                    VStack(alignment: .leading, spacing: NexusSpacing.xs) {
                        Text("\(stat.errorCount)")
                            .font(NexusFont.body(14))
                            .foregroundStyle(NexusColors.error)

                        Text("Errors")
                            .font(NexusFont.caption(12))
                            .foregroundStyle(NexusColors.textMuted)
                    }

                    VStack(alignment: .leading, spacing: NexusSpacing.xs) {
                        Text("\(String(format: "%.0f", stat.avgMs))ms")
                            .font(NexusFont.body(14))
                            .foregroundStyle(NexusColors.cyan)

                        Text("Avg Latency")
                            .font(NexusFont.caption(12))
                            .foregroundStyle(NexusColors.textMuted)
                    }

                    Spacer()
                }
            }
            .padding(NexusSpacing.md)
        }
    }

    @ViewBuilder
    private func moduleRow(_ stat: ModuleAnalyticsStat) -> some View {
        NexusCard {
            VStack(alignment: .leading, spacing: NexusSpacing.sm) {
                // Header with module name and total uses
                HStack(spacing: NexusSpacing.md) {
                    VStack(alignment: .leading, spacing: NexusSpacing.xs) {
                        Text(stat.moduleName)
                            .font(NexusFont.heading(18))
                            .foregroundStyle(NexusColors.textPrimary)
                    }

                    Spacer()

                    VStack(alignment: .trailing, spacing: NexusSpacing.xs) {
                        Text("\(stat.totalUses)")
                            .font(NexusFont.stat(22))
                            .foregroundStyle(NexusColors.textPrimary)

                        Text("Total Uses")
                            .font(NexusFont.caption(12))
                            .foregroundStyle(NexusColors.textMuted)
                    }
                }

                Divider()
                    .background(NexusColors.border)

                // Stats grid
                HStack(spacing: NexusSpacing.lg) {
                    VStack(alignment: .leading, spacing: NexusSpacing.xs) {
                        Text("\(stat.uniqueCommands)")
                            .font(NexusFont.body(14))
                            .foregroundStyle(NexusColors.cyan)

                        Text("Commands")
                            .font(NexusFont.caption(12))
                            .foregroundStyle(NexusColors.textMuted)
                    }

                    VStack(alignment: .leading, spacing: NexusSpacing.xs) {
                        Text("\(stat.uniqueUsers)")
                            .font(NexusFont.body(14))
                            .foregroundStyle(NexusColors.purple)

                        Text("Users")
                            .font(NexusFont.caption(12))
                            .foregroundStyle(NexusColors.textMuted)
                    }

                    VStack(alignment: .leading, spacing: NexusSpacing.xs) {
                        Text("\(String(format: "%.0f", stat.avgMs))ms")
                            .font(NexusFont.body(14))
                            .foregroundStyle(NexusColors.warning)

                        Text("Avg Latency")
                            .font(NexusFont.caption(12))
                            .foregroundStyle(NexusColors.textMuted)
                    }

                    Spacer()
                }
            }
            .padding(NexusSpacing.md)
        }
    }

    @ViewBuilder
    private var loadingView: some View {
        ScrollView {
            VStack(spacing: NexusSpacing.lg) {
                SkeletonView()
                    .frame(height: 100)

                SkeletonView()
                    .frame(height: 150)

                SkeletonView()
                    .frame(height: 200)
            }
            .padding(.horizontal, NexusSpacing.lg)
            .padding(.vertical, NexusSpacing.md)
        }
    }

    @ViewBuilder
    private func errorView(_ error: String) -> some View {
        ScrollView {
            VStack(spacing: NexusSpacing.md) {
                Image(systemName: "exclamationmark.triangle.fill")
                    .font(.system(size: 48))
                    .foregroundStyle(NexusColors.error)

                Text("Error Loading Data")
                    .font(NexusFont.heading(18))
                    .foregroundStyle(NexusColors.textPrimary)

                Text(error)
                    .font(NexusFont.body(14))
                    .foregroundStyle(NexusColors.textSecondary)
                    .multilineTextAlignment(.center)

                Button(action: { loadData() }) {
                    Text("Retry")
                        .font(NexusFont.body(14))
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, NexusSpacing.sm)
                        .background(NexusColors.cyan)
                        .cornerRadius(NexusRadius.md)
                }

                Spacer()
            }
            .padding(NexusSpacing.lg)
        }
    }

    // MARK: - Data Loading

    private func loadData() {
        isLoading = true
        errorMessage = nil

        Task {
            do {
                async let userActivity = APIClient.shared.fetchUserActivityStats()
                async let commands = APIClient.shared.fetchCommandStats(range: "30d")
                async let modules = APIClient.shared.fetchModuleStats(range: "30d")

                let (activity, commandResponse, moduleResponse) = try await (userActivity, commands, modules)

                await MainActor.run {
                    self.userActivityStats = activity
                    self.commandStats = commandResponse.commands.sorted { $0.totalUses > $1.totalUses }
                    self.moduleStats = moduleResponse.modules.sorted { $0.totalUses > $1.totalUses }
                    self.isLoading = false
                }
            } catch {
                await MainActor.run {
                    self.errorMessage = error.localizedDescription
                    self.isLoading = false
                }
            }
        }
    }

    private func refreshData() async {
        do {
            async let userActivity = APIClient.shared.fetchUserActivityStats()
            async let commands = APIClient.shared.fetchCommandStats(range: "30d")
            async let modules = APIClient.shared.fetchModuleStats(range: "30d")

            let (activity, commandResponse, moduleResponse) = try await (userActivity, commands, modules)

            await MainActor.run {
                self.userActivityStats = activity
                self.commandStats = commandResponse.commands.sorted { $0.totalUses > $1.totalUses }
                self.moduleStats = moduleResponse.modules.sorted { $0.totalUses > $1.totalUses }
                self.errorMessage = nil
            }
        } catch {
            await MainActor.run {
                self.errorMessage = error.localizedDescription
            }
        }
    }
}

// MARK: - Data Models


