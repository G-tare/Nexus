import SwiftUI
import Charts

struct OwnerDashboardView: View {
    @State private var stats: OwnerStats?
    @State private var guilds: [Guild] = []
    @State private var isLoading = true
    @State private var searchText = ""
    @State private var currentPage = 1
    @State private var hasMore = true

    private var filteredGuilds: [Guild] {
        if searchText.isEmpty { return guilds }
        return guilds.filter { $0.name.localizedCaseInsensitiveContains(searchText) }
    }

    private let statsColumns = [
        GridItem(.flexible(), spacing: NexusSpacing.md),
        GridItem(.flexible(), spacing: NexusSpacing.md),
    ]

    var body: some View {
        ZStack {
            NexusColors.background.ignoresSafeArea()

            ScrollView {
                VStack(alignment: .leading, spacing: NexusSpacing.xl) {
                    // MARK: - Header
                    VStack(alignment: .leading, spacing: NexusSpacing.xs) {
                        HStack(spacing: NexusSpacing.sm) {
                            Image(systemName: "crown.fill")
                                .font(.system(size: 20))
                                .foregroundStyle(Color(hex: "FFD700"))
                            Text("Owner Dashboard")
                                .font(NexusFont.title(24))
                                .foregroundStyle(NexusColors.textPrimary)
                        }
                        Text("Bot-wide statistics and server management")
                            .font(NexusFont.body(14))
                            .foregroundStyle(NexusColors.textSecondary)
                    }

                    // MARK: - Stats
                    if let stats {
                        LazyVGrid(columns: statsColumns, spacing: NexusSpacing.md) {
                            StatCard(
                                title: "Total Servers",
                                value: "\(stats.totalGuilds)",
                                icon: "server.rack",
                                accentColor: NexusColors.cyan
                            )

                            let totalPremium = stats.premiumBreakdown
                                .filter { $0.tier != "free" && $0.tier != "none" }
                                .reduce(0) { $0 + $1.count }
                            StatCard(
                                title: "Premium Servers",
                                value: "\(totalPremium)",
                                icon: "star.fill",
                                accentColor: NexusColors.purple
                            )
                        }

                        // Premium breakdown chart
                        if !stats.premiumBreakdown.isEmpty {
                            NexusSectionHeader(title: "Premium Breakdown")

                            NexusCard(glowColor: NexusColors.purple, glowIntensity: 0.1) {
                                VStack(spacing: NexusSpacing.md) {
                                    ForEach(stats.premiumBreakdown) { tier in
                                        premiumTierRow(tier: tier, total: stats.totalGuilds)
                                    }
                                }
                            }
                        }
                    } else if isLoading {
                        LazyVGrid(columns: statsColumns, spacing: NexusSpacing.md) {
                            ForEach(0..<2, id: \.self) { _ in
                                SkeletonView(height: 110)
                            }
                        }
                    }

                    // MARK: - Guild Browser
                    NexusSectionHeader(title: "All Servers")

                    // Search
                    HStack(spacing: NexusSpacing.sm) {
                        Image(systemName: "magnifyingglass")
                            .foregroundStyle(NexusColors.textMuted)
                        TextField("Search servers...", text: $searchText)
                            .font(NexusFont.body(14))
                            .foregroundStyle(NexusColors.textPrimary)
                    }
                    .padding(NexusSpacing.md)
                    .background(NexusColors.cardBackground)
                    .clipShape(RoundedRectangle(cornerRadius: NexusRadius.md))

                    if isLoading && guilds.isEmpty {
                        ForEach(0..<4, id: \.self) { _ in
                            SkeletonView(height: 80)
                        }
                    } else if filteredGuilds.isEmpty {
                        EmptyStateView(
                            icon: "magnifyingglass",
                            title: "No Servers",
                            message: searchText.isEmpty ? "No servers found." : "No servers match your search."
                        )
                    } else {
                        LazyVStack(spacing: NexusSpacing.sm) {
                            ForEach(filteredGuilds) { guild in
                                ownerGuildRow(guild)
                                    .onAppear {
                                        if guild.id == filteredGuilds.last?.id && hasMore {
                                            Task { await loadMoreGuilds() }
                                        }
                                    }
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
        .navigationTitle("Owner")
        .navigationBarTitleDisplayMode(.inline)
        .task { await loadData() }
    }

    // MARK: - Premium Tier Row

    private func premiumTierRow(tier: PremiumBreakdown, total: Int) -> some View {
        let percentage = total > 0 ? Double(tier.count) / Double(total) : 0

        return HStack(spacing: NexusSpacing.md) {
            Image(systemName: tierIcon(tier.tier))
                .font(.system(size: 14))
                .foregroundStyle(tierColor(tier.tier))
                .frame(width: 28, height: 28)
                .background(tierColor(tier.tier).opacity(0.12))
                .clipShape(RoundedRectangle(cornerRadius: 6))

            VStack(alignment: .leading, spacing: 2) {
                Text(tier.tier.capitalized)
                    .font(NexusFont.body(14))
                    .foregroundStyle(NexusColors.textPrimary)

                GeometryReader { geo in
                    ZStack(alignment: .leading) {
                        RoundedRectangle(cornerRadius: 3)
                            .fill(NexusColors.surfaceElevated)
                            .frame(height: 6)
                        RoundedRectangle(cornerRadius: 3)
                            .fill(tierColor(tier.tier))
                            .frame(width: geo.size.width * percentage, height: 6)
                    }
                }
                .frame(height: 6)
            }

            Spacer()

            VStack(alignment: .trailing, spacing: 2) {
                Text("\(tier.count)")
                    .font(NexusFont.mono(14))
                    .foregroundStyle(NexusColors.textPrimary)
                Text("\(Int(percentage * 100))%")
                    .font(NexusFont.caption(11))
                    .foregroundStyle(NexusColors.textMuted)
            }
        }
    }

    // MARK: - Guild Row

    private func ownerGuildRow(_ guild: Guild) -> some View {
        HStack(spacing: NexusSpacing.md) {
            // Server icon
            if let iconURL = guild.iconURL {
                AsyncImage(url: iconURL) { image in
                    image.resizable().scaledToFill()
                } placeholder: {
                    guildInitialPlaceholder(guild)
                }
                .frame(width: 40, height: 40)
                .clipShape(RoundedRectangle(cornerRadius: NexusRadius.sm))
            } else {
                guildInitialPlaceholder(guild)
            }

            VStack(alignment: .leading, spacing: 2) {
                Text(guild.name)
                    .font(NexusFont.body(14))
                    .foregroundStyle(NexusColors.textPrimary)
                    .lineLimit(1)

                HStack(spacing: NexusSpacing.sm) {
                    Text("ID: \(guild.id)")
                        .font(NexusFont.mono(10))
                        .foregroundStyle(NexusColors.textMuted)
                        .lineLimit(1)
                }
            }

            Spacer()

            // Premium badge
            let tier = guild.premiumTier ?? "free"
            NexusBadge(
                text: tier.uppercased(),
                color: tierColor(tier)
            )
        }
        .padding(NexusSpacing.md)
        .background(NexusColors.cardBackground)
        .clipShape(RoundedRectangle(cornerRadius: NexusRadius.md))
    }

    private func guildInitialPlaceholder(_ guild: Guild) -> some View {
        Text(guild.initial)
            .font(NexusFont.heading(16))
            .foregroundStyle(NexusColors.textMuted)
            .frame(width: 40, height: 40)
            .background(NexusColors.surfaceElevated)
            .clipShape(RoundedRectangle(cornerRadius: NexusRadius.sm))
    }

    // MARK: - Helpers

    private func tierColor(_ tier: String) -> Color {
        switch tier.lowercased() {
        case "pro": return NexusColors.purple
        case "plus", "premium": return NexusColors.cyan
        case "enterprise": return Color(hex: "FFD700")
        default: return NexusColors.textSecondary
        }
    }

    private func tierIcon(_ tier: String) -> String {
        switch tier.lowercased() {
        case "pro": return "star.fill"
        case "plus", "premium": return "bolt.fill"
        case "enterprise": return "crown.fill"
        default: return "circle.fill"
        }
    }

    // MARK: - Load Data

    private func loadData() async {
        isLoading = true
        currentPage = 1
        hasMore = true

        async let statsTask = APIClient.shared.fetchOwnerStats()
        async let guildsTask = APIClient.shared.fetchOwnerGuilds(page: 1, limit: 25)

        stats = try? await statsTask

        if let response = try? await guildsTask {
            guilds = response.guilds
            hasMore = response.guilds.count >= response.limit
        }

        isLoading = false
    }

    private func loadMoreGuilds() async {
        guard hasMore else { return }
        currentPage += 1
        if let response = try? await APIClient.shared.fetchOwnerGuilds(page: currentPage, limit: 25) {
            guilds.append(contentsOf: response.guilds)
            hasMore = response.guilds.count >= response.limit
        }
    }
}
