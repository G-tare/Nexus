import SwiftUI

/// Main server dashboard — bottom tab bar with 4 tabs + settings in top-right
struct DashboardTabView: View {
    let guild: Guild
    @State private var selectedTab: DashboardTab = .overview
    @Environment(\.dismiss) private var dismiss

    /// Guild-scoped data cache — pre-loads roles, members, permissions ONCE
    /// and shares across all child views via @EnvironmentObject
    @StateObject private var guildCache: GuildDataCache

    init(guild: Guild) {
        self.guild = guild
        self._guildCache = StateObject(wrappedValue: GuildDataCache(guildId: guild.id))
        Self.configureAppearances()
    }

    enum DashboardTab: String, CaseIterable {
        case overview, modules, leaderboards, modlogs

        var title: String {
            switch self {
            case .overview: return "Overview"
            case .modules: return "Modules"
            case .leaderboards: return "Rankings"
            case .modlogs: return "Mod Logs"
            }
        }

        var icon: String {
            switch self {
            case .overview: return "square.grid.2x2.fill"
            case .modules: return "puzzlepiece.extension.fill"
            case .leaderboards: return "trophy.fill"
            case .modlogs: return "doc.text.fill"
            }
        }
    }

    var body: some View {
        VStack(spacing: 0) {
            // Custom top header — back button, centered name, settings gear
            serverHeader

            // Tab content
            TabView(selection: $selectedTab) {
                // MARK: - Overview
                NavigationStack {
                    OverviewView(guildId: guild.id)
                        .toolbar(.hidden, for: .navigationBar)
                }
                .environmentObject(guildCache)
                .tag(DashboardTab.overview)
                .tabItem {
                    Label(DashboardTab.overview.title, systemImage: DashboardTab.overview.icon)
                }

                // MARK: - Modules
                NavigationStack {
                    ModuleListView(guildId: guild.id)
                        .toolbar(.hidden, for: .navigationBar)
                }
                .environmentObject(guildCache)
                .tag(DashboardTab.modules)
                .tabItem {
                    Label(DashboardTab.modules.title, systemImage: DashboardTab.modules.icon)
                }

                // MARK: - Leaderboards
                NavigationStack {
                    LeaderboardView(guildId: guild.id)
                        .toolbar(.hidden, for: .navigationBar)
                }
                .environmentObject(guildCache)
                .tag(DashboardTab.leaderboards)
                .tabItem {
                    Label(DashboardTab.leaderboards.title, systemImage: DashboardTab.leaderboards.icon)
                }

                // MARK: - Mod Logs
                NavigationStack {
                    ModLogsView(guildId: guild.id)
                        .toolbar(.hidden, for: .navigationBar)
                }
                .environmentObject(guildCache)
                .tag(DashboardTab.modlogs)
                .tabItem {
                    Label(DashboardTab.modlogs.title, systemImage: DashboardTab.modlogs.icon)
                }
            }
            .tint(NexusColors.cyan)
        }
        .navigationBarHidden(true)
        .environmentObject(guildCache)
        .task {
            // Pre-load ALL guild data in parallel on dashboard entry
            await guildCache.preload()
            // Start background sync so changes from web dashboard appear automatically
            guildCache.startPeriodicSync()
        }
        .onDisappear {
            guildCache.stopPeriodicSync()
        }
    }

    // MARK: - Custom Server Header: [< Back] [icon + name centered] [gear]

    private var serverHeader: some View {
        ZStack {
            // Center: server icon + name
            HStack(spacing: NexusSpacing.sm) {
                if let iconURL = guild.iconURL {
                    AsyncImage(url: iconURL) { image in
                        image.resizable().scaledToFill()
                    } placeholder: {
                        Text(guild.initial)
                            .font(NexusFont.caption(10))
                            .foregroundStyle(NexusColors.cyan)
                            .frame(width: 26, height: 26)
                            .background(NexusColors.surfaceElevated)
                            .clipShape(RoundedRectangle(cornerRadius: 6))
                    }
                    .frame(width: 26, height: 26)
                    .clipShape(RoundedRectangle(cornerRadius: 6))
                } else {
                    Text(guild.initial)
                        .font(NexusFont.caption(10))
                        .foregroundStyle(NexusColors.cyan)
                        .frame(width: 26, height: 26)
                        .background(NexusColors.surfaceElevated)
                        .clipShape(RoundedRectangle(cornerRadius: 6))
                }

                Text(guild.name)
                    .font(NexusFont.heading(16))
                    .foregroundColor(.white)
                    .lineLimit(1)
            }

            // Left: back button
            HStack {
                Button {
                    dismiss()
                } label: {
                    HStack(spacing: 4) {
                        Image(systemName: "chevron.left")
                            .font(.system(size: 16, weight: .semibold))
                        Text("Servers")
                            .font(NexusFont.body(16))
                    }
                    .foregroundStyle(NexusColors.cyan)
                }

                Spacer()
            }

            // Right: settings gear
            HStack {
                Spacer()

                NavigationLink {
                    SettingsView(guildId: guild.id, guildName: guild.name)
                } label: {
                    Image(systemName: "gearshape.fill")
                        .font(.system(size: 18))
                        .foregroundStyle(NexusColors.textSecondary)
                        .frame(width: 36, height: 36)
                }
            }
        }
        .padding(.horizontal, NexusSpacing.md)
        .padding(.vertical, 8)
        .background(NexusColors.background)
    }

    // MARK: - Appearance Configuration

    private static func configureAppearances() {
        let navAppearance = UINavigationBarAppearance()
        navAppearance.configureWithOpaqueBackground()
        navAppearance.backgroundColor = UIColor(NexusColors.background)
        navAppearance.titleTextAttributes = [.foregroundColor: UIColor.white]
        navAppearance.largeTitleTextAttributes = [.foregroundColor: UIColor.white]
        navAppearance.backButtonAppearance.normal.titleTextAttributes = [
            .foregroundColor: UIColor(NexusColors.cyan)
        ]
        UINavigationBar.appearance().standardAppearance = navAppearance
        UINavigationBar.appearance().compactAppearance = navAppearance
        UINavigationBar.appearance().scrollEdgeAppearance = navAppearance
        UINavigationBar.appearance().tintColor = UIColor(NexusColors.cyan)

        let tabAppearance = UITabBarAppearance()
        tabAppearance.configureWithOpaqueBackground()
        tabAppearance.backgroundColor = UIColor(NexusColors.cardBackground)

        let normalAttrs: [NSAttributedString.Key: Any] = [
            .foregroundColor: UIColor(NexusColors.textMuted)
        ]
        tabAppearance.stackedLayoutAppearance.normal.iconColor = UIColor(NexusColors.textMuted)
        tabAppearance.stackedLayoutAppearance.normal.titleTextAttributes = normalAttrs

        let selectedAttrs: [NSAttributedString.Key: Any] = [
            .foregroundColor: UIColor(NexusColors.cyan)
        ]
        tabAppearance.stackedLayoutAppearance.selected.iconColor = UIColor(NexusColors.cyan)
        tabAppearance.stackedLayoutAppearance.selected.titleTextAttributes = selectedAttrs

        UITabBar.appearance().standardAppearance = tabAppearance
        UITabBar.appearance().scrollEdgeAppearance = tabAppearance
    }
}

// Keep backward compat
typealias ServerDashboardView = DashboardTabView
