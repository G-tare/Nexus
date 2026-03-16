import SwiftUI

/// Owner Dashboard — bottom tab bar matching the DashboardTabView UX pattern.
/// 4 main tabs: Overview, Tickets, Servers, More (links to all other admin pages).
struct OwnerDashboardView: View {
    @State private var selectedTab: OwnerTab = .overview
    @Environment(\.dismiss) private var dismiss

    init() {
        Self.configureAppearances()
    }

    enum OwnerTab: String, CaseIterable {
        case overview, tickets, servers, more

        var title: String {
            switch self {
            case .overview: return "Overview"
            case .tickets: return "Tickets"
            case .servers: return "Servers"
            case .more: return "More"
            }
        }

        var icon: String {
            switch self {
            case .overview: return "square.grid.2x2.fill"
            case .tickets: return "envelope.fill"
            case .servers: return "server.rack"
            case .more: return "ellipsis.circle.fill"
            }
        }
    }

    var body: some View {
        VStack(spacing: 0) {
            // Custom top header — back button, centered title
            ownerHeader

            // Tab content
            TabView(selection: $selectedTab) {
                // MARK: - Overview
                NavigationStack {
                    OwnerOverviewView()
                        .toolbar(.hidden, for: .navigationBar)
                }
                .tag(OwnerTab.overview)
                .tabItem {
                    Label(OwnerTab.overview.title, systemImage: OwnerTab.overview.icon)
                }

                // MARK: - Tickets
                NavigationStack {
                    OwnerTicketsView()
                        .toolbar(.hidden, for: .navigationBar)
                }
                .tag(OwnerTab.tickets)
                .tabItem {
                    Label(OwnerTab.tickets.title, systemImage: OwnerTab.tickets.icon)
                }

                // MARK: - Servers
                NavigationStack {
                    OwnerServersView()
                        .toolbar(.hidden, for: .navigationBar)
                }
                .tag(OwnerTab.servers)
                .tabItem {
                    Label(OwnerTab.servers.title, systemImage: OwnerTab.servers.icon)
                }

                // MARK: - More
                NavigationStack {
                    OwnerMoreView()
                        .toolbar(.hidden, for: .navigationBar)
                }
                .tag(OwnerTab.more)
                .tabItem {
                    Label(OwnerTab.more.title, systemImage: OwnerTab.more.icon)
                }
            }
            .tint(NexusColors.cyan)
        }
        .navigationBarHidden(true)
    }

    // MARK: - Custom Header

    private var ownerHeader: some View {
        ZStack {
            // Center: title
            HStack(spacing: NexusSpacing.sm) {
                Image(systemName: "crown.fill")
                    .font(.system(size: 18))
                    .foregroundStyle(Color(hex: "FFD700"))
                Text("Owner Panel")
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
