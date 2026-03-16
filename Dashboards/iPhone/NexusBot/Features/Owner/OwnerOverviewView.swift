import SwiftUI
import Charts

/// Overview tab — stats cards, premium breakdown, quick-links to all sections.
struct OwnerOverviewView: View {
    @State private var stats: OwnerStats?
    @State private var health: HealthOverview?
    @State private var ticketStats: TicketStats?
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
                    // MARK: - Header
                    VStack(alignment: .leading, spacing: NexusSpacing.xs) {
                        Text("Dashboard")
                            .font(NexusFont.title(24))
                            .foregroundStyle(NexusColors.textPrimary)
                        Text("Bot-wide statistics and management")
                            .font(NexusFont.body(14))
                            .foregroundStyle(NexusColors.textSecondary)
                    }

                    // MARK: - Stats Grid
                    if let stats {
                        LazyVGrid(columns: statsColumns, spacing: NexusSpacing.md) {
                            StatCard(
                                title: "Total Servers",
                                value: formatNumber(stats.totalGuilds),
                                icon: "server.rack",
                                accentColor: NexusColors.cyan
                            )

                            let totalPremium = stats.premiumBreakdown
                                .filter { $0.tier != "free" && $0.tier != "none" }
                                .reduce(0) { $0 + $1.count }
                            StatCard(
                                title: "Premium",
                                value: formatNumber(totalPremium),
                                icon: "star.fill",
                                accentColor: NexusColors.purple
                            )

                            if let ticketStats {
                                StatCard(
                                    title: "Open Tickets",
                                    value: "\(ticketStats.openCount)",
                                    icon: "envelope.open.fill",
                                    accentColor: NexusColors.success
                                )

                                StatCard(
                                    title: "Claimed",
                                    value: "\(ticketStats.claimedCount)",
                                    icon: "person.fill",
                                    accentColor: NexusColors.warning
                                )
                            }
                        }

                        // MARK: - Health Quick Status
                        if let health {
                            NexusSectionHeader(title: "System Status")

                            NexusCard(glowColor: health.database.status == "ok" ? NexusColors.success : NexusColors.error, glowIntensity: 0.1) {
                                VStack(spacing: NexusSpacing.md) {
                                    HStack {
                                        Circle()
                                            .fill(health.database.status == "ok" ? NexusColors.success : NexusColors.error)
                                            .frame(width: 8, height: 8)
                                        Text(health.database.status == "ok" ? "All Systems Operational" : "Issues Detected")
                                            .font(NexusFont.body(14))
                                            .foregroundStyle(NexusColors.textPrimary)
                                        Spacer()
                                    }

                                    HStack(spacing: NexusSpacing.xl) {
                                        VStack(alignment: .leading, spacing: 2) {
                                            Text("Uptime")
                                                .font(NexusFont.caption(11))
                                                .foregroundStyle(NexusColors.textSecondary)
                                            Text(health.uptimeFormatted)
                                                .font(NexusFont.mono(13))
                                                .foregroundStyle(NexusColors.textPrimary)
                                        }

                                        VStack(alignment: .leading, spacing: 2) {
                                            Text("DB Latency")
                                                .font(NexusFont.caption(11))
                                                .foregroundStyle(NexusColors.textSecondary)
                                            Text("\(String(format: "%.0f", health.database.latencyMs))ms")
                                                .font(NexusFont.mono(13))
                                                .foregroundStyle(NexusColors.textPrimary)
                                        }

                                        VStack(alignment: .leading, spacing: 2) {
                                            Text("Memory")
                                                .font(NexusFont.caption(11))
                                                .foregroundStyle(NexusColors.textSecondary)
                                            Text("\(String(format: "%.0f", health.memory.heapUsedMB))MB")
                                                .font(NexusFont.mono(13))
                                                .foregroundStyle(NexusColors.textPrimary)
                                        }

                                        Spacer()
                                    }

                                    HStack(spacing: NexusSpacing.xl) {
                                        VStack(alignment: .leading, spacing: 2) {
                                            Text("Cmds/1h")
                                                .font(NexusFont.caption(11))
                                                .foregroundStyle(NexusColors.textSecondary)
                                            Text("\(health.commands.commands1h)")
                                                .font(NexusFont.mono(13))
                                                .foregroundStyle(NexusColors.textPrimary)
                                        }

                                        VStack(alignment: .leading, spacing: 2) {
                                            Text("Cmds/24h")
                                                .font(NexusFont.caption(11))
                                                .foregroundStyle(NexusColors.textSecondary)
                                            Text("\(health.commands.commands24h)")
                                                .font(NexusFont.mono(13))
                                                .foregroundStyle(NexusColors.textPrimary)
                                        }

                                        VStack(alignment: .leading, spacing: 2) {
                                            Text("Errors/1h")
                                                .font(NexusFont.caption(11))
                                                .foregroundStyle(NexusColors.textSecondary)
                                            Text("\(health.commands.errors1h)")
                                                .font(NexusFont.mono(13))
                                                .foregroundStyle(health.commands.errors1h > 0 ? NexusColors.error : NexusColors.textPrimary)
                                        }

                                        Spacer()
                                    }
                                }
                            }
                        }

                        // MARK: - Premium Breakdown
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
                            ForEach(0..<4, id: \.self) { _ in
                                SkeletonView(height: 110)
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

    // MARK: - Helpers

    private func tierColor(_ tier: String) -> Color {
        switch tier.lowercased() {
        case "pro": return NexusColors.purple
        case "plus": return NexusColors.cyan
        case "premium": return Color(hex: "FFD700")
        default: return NexusColors.textSecondary
        }
    }

    private func tierIcon(_ tier: String) -> String {
        switch tier.lowercased() {
        case "pro": return "star.fill"
        case "plus": return "bolt.fill"
        case "premium": return "crown.fill"
        default: return "circle.fill"
        }
    }

    private func formatNumber(_ n: Int) -> String {
        if n >= 1000 { return "\(n / 1000).\((n % 1000) / 100)k" }
        return "\(n)"
    }

    // MARK: - Load Data

    private func loadData() async {
        isLoading = true

        // Load each independently so one failure doesn't block others
        do { stats = try await APIClient.shared.fetchOwnerStats() }
        catch { print("[OwnerOverview] stats error: \(error)") }

        do { health = try await APIClient.shared.fetchHealthOverview() }
        catch { print("[OwnerOverview] health error: \(error)") }

        do { ticketStats = try await APIClient.shared.fetchTicketStats() }
        catch { print("[OwnerOverview] tickets error: \(error)") }

        isLoading = false
    }
}
