import SwiftUI

struct OwnerRevenueView: View {
    @State private var revenueOverview: RevenueOverview?
    @State private var expiringSubscriptions: [ExpiringSubscription] = []
    @State private var isLoading = true
    @State private var error: String?
    @State private var isRefreshing = false

    var body: some View {
        ZStack {
            NexusColors.background.ignoresSafeArea()

            if isLoading && revenueOverview == nil {
                LoadingState()
            } else if let error = error {
                ErrorState(error: error, retryAction: loadData)
            } else {
                ScrollViewReader { proxy in
                    ScrollView {
                        VStack(spacing: NexusSpacing.lg) {
                            // Tier Distribution Cards
                            TierDistributionSection(tierCounts: revenueOverview?.tiers ?? [])

                            // Revenue Breakdown Section
                            if let subs = revenueOverview?.subscriptions, !subs.isEmpty {
                                RevenueBreakdownSection(breakdown: subs)
                            }

                            // Expiring Subscriptions Section
                            if !expiringSubscriptions.isEmpty {
                                ExpiringSubscriptionsSection(subscriptions: expiringSubscriptions)
                            }

                            Spacer(minLength: NexusSpacing.xl)
                        }
                        .padding(NexusSpacing.lg)
                        .id("top")
                    }
                    .refreshable {
                        await refresh()
                    }
                }
            }
        }
        .navigationTitle("Revenue")
        .onAppear {
            loadData()
        }
    }

    private func loadData() {
        isLoading = true
        error = nil

        Task {
            async let revenueTask = APIClient.shared.fetchRevenueOverview()
            async let expiringTask = APIClient.shared.fetchExpiringSubscriptions(days: 30)

            do {
                let revenue = try await revenueTask
                let expiring = try await expiringTask

                DispatchQueue.main.async {
                    self.revenueOverview = revenue
                    self.expiringSubscriptions = expiring.subscriptions
                    self.isLoading = false
                    self.error = nil
                }
            } catch {
                DispatchQueue.main.async {
                    self.error = "Failed to load revenue data"
                    self.isLoading = false
                }
            }
        }
    }

    private func refresh() async {
        await MainActor.run {
            isRefreshing = true
        }

        async let revenueTask = APIClient.shared.fetchRevenueOverview()
        async let expiringTask = APIClient.shared.fetchExpiringSubscriptions(days: 30)

        do {
            let revenue = try await revenueTask
            let expiring = try await expiringTask

            await MainActor.run {
                self.revenueOverview = revenue
                self.expiringSubscriptions = expiring.subscriptions
                self.error = nil
                self.isRefreshing = false
            }
        } catch {
            await MainActor.run {
                self.error = "Failed to refresh data"
                self.isRefreshing = false
            }
        }
    }
}

// MARK: - Tier Distribution Section
struct TierDistributionSection: View {
    let tierCounts: [TierCount]

    var body: some View {
        VStack(alignment: .leading, spacing: NexusSpacing.md) {
            NexusSectionHeader(title: "Tier Distribution", subtitle: nil)

            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: NexusSpacing.lg) {
                ForEach(tierCounts, id: \.tier) { tierCount in
                    let tierEnum = SubscriptionTier(rawValue: tierCount.tier.lowercased())
                    StatCard(
                        title: tierEnum?.displayName ?? tierCount.tier.capitalized,
                        value: "\(tierCount.count)",
                        subtitle: tierCount.count == 1 ? "subscriber" : "subscribers",
                        icon: tierEnum?.icon ?? "circle.fill",
                        iconColor: tierEnum?.color ?? NexusColors.textSecondary
                    )
                }
            }
        }
    }
}

// MARK: - Revenue Breakdown Section
struct RevenueBreakdownSection: View {
    let breakdown: [SubBreakdown]

    var body: some View {
        VStack(alignment: .leading, spacing: NexusSpacing.md) {
            NexusSectionHeader(title: "Revenue Breakdown", subtitle: nil)

            VStack(spacing: NexusSpacing.sm) {
                ForEach(breakdown, id: \.tier) { item in
                    RevenueBreakdownRow(breakdown: item)
                }
            }
        }
    }
}

struct RevenueBreakdownRow: View {
    let breakdown: SubBreakdown

    private var tierEnum: SubscriptionTier? {
        SubscriptionTier(rawValue: breakdown.tier.lowercased())
    }

    var body: some View {
        NexusCard {
            VStack(alignment: .leading, spacing: NexusSpacing.sm) {
                HStack {
                    HStack(spacing: NexusSpacing.sm) {
                        Image(systemName: tierEnum?.icon ?? "circle.fill")
                            .foregroundStyle(tierEnum?.color ?? NexusColors.textSecondary)
                            .font(.system(size: 14, weight: .semibold))

                        Text(tierEnum?.displayName ?? breakdown.tier.capitalized)
                            .font(NexusFont.heading(18))
                            .foregroundStyle(NexusColors.textPrimary)
                    }

                    Spacer()

                    NexusBadge(
                        text: "\(breakdown.activeCount) active",
                        style: .secondary
                    )
                }

                Divider()
                    .foregroundStyle(NexusColors.border)

                HStack(spacing: NexusSpacing.lg) {
                    VStack(alignment: .leading, spacing: NexusSpacing.xs) {
                        Text("Total Revenue")
                            .font(NexusFont.caption(12))
                            .foregroundStyle(NexusColors.textSecondary)

                        Text(breakdown.totalRevenue.formattedCurrency)
                            .font(NexusFont.stat(22))
                            .foregroundStyle(NexusColors.success)
                    }

                    Spacer()

                    VStack(alignment: .trailing, spacing: NexusSpacing.xs) {
                        Text("Avg Amount")
                            .font(NexusFont.caption(12))
                            .foregroundStyle(NexusColors.textSecondary)

                        Text(breakdown.avgAmount.formattedCurrency)
                            .font(NexusFont.stat(22))
                            .foregroundStyle(NexusColors.textPrimary)
                    }
                }
            }
        }
    }
}

// MARK: - Expiring Subscriptions Section
struct ExpiringSubscriptionsSection: View {
    let subscriptions: [ExpiringSubscription]

    var body: some View {
        VStack(alignment: .leading, spacing: NexusSpacing.md) {
            NexusSectionHeader(
                title: "Expiring Soon",
                subtitle: "\(subscriptions.count) in next 30 days"
            )

            VStack(spacing: NexusSpacing.sm) {
                ForEach(subscriptions, id: \.guildId) { subscription in
                    ExpiringSubscriptionRow(subscription: subscription)
                }
            }
        }
    }
}

struct ExpiringSubscriptionRow: View {
    let subscription: ExpiringSubscription

    var daysUntilExpiry: Int {
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let expiryDate = iso.date(from: subscription.expiryDate) ?? {
            iso.formatOptions = [.withInternetDateTime]
            return iso.date(from: subscription.expiryDate) ?? Date()
        }()
        let calendar = Calendar.current
        let components = calendar.dateComponents([.day], from: Date(), to: expiryDate)
        return components.day ?? 0
    }

    var expiryLabel: String {
        let days = daysUntilExpiry
        if days == 0 {
            return "Expires today"
        } else if days == 1 {
            return "Expires tomorrow"
        } else {
            return "Expires in \(days) days"
        }
    }

    var urgencyColor: Color {
        let days = daysUntilExpiry
        if days <= 3 {
            return NexusColors.error
        } else if days <= 7 {
            return NexusColors.warning
        } else {
            return NexusColors.textSecondary
        }
    }

    var body: some View {
        NexusCard {
            VStack(alignment: .leading, spacing: NexusSpacing.sm) {
                HStack {
                    VStack(alignment: .leading, spacing: NexusSpacing.xs) {
                        Text(subscription.guildName ?? "Unknown Server")
                            .font(NexusFont.heading(18))
                            .foregroundStyle(NexusColors.textPrimary)
                            .lineLimit(1)

                        HStack(spacing: NexusSpacing.sm) {
                            let tierEnum = SubscriptionTier(rawValue: subscription.tier.lowercased())
                            NexusBadge(
                                text: tierEnum?.displayName ?? subscription.tier.capitalized,
                                style: tierEnum?.badgeStyle ?? .secondary
                            )

                            Text("\(subscription.memberCount ?? 0) members")
                                .font(NexusFont.caption(12))
                                .foregroundStyle(NexusColors.textMuted)
                        }
                    }

                    Spacer()

                    VStack(alignment: .trailing, spacing: NexusSpacing.xs) {
                        Text(subscription.amount.formattedCurrency)
                            .font(NexusFont.stat(22))
                            .foregroundStyle(NexusColors.success)

                        Text(expiryLabel)
                            .font(NexusFont.caption(12))
                            .foregroundStyle(urgencyColor)
                    }
                }
            }
        }
    }
}

// MARK: - Loading State
struct LoadingState: View {
    var body: some View {
        ScrollView {
            VStack(spacing: NexusSpacing.lg) {
                SkeletonView()
                    .frame(height: 100)

                SkeletonView()
                    .frame(height: 200)

                SkeletonView()
                    .frame(height: 150)
            }
            .padding(NexusSpacing.lg)
        }
    }
}

// MARK: - Error State
struct ErrorState: View {
    let error: String
    let retryAction: () -> Void

    var body: some View {
        ScrollView {
            VStack(spacing: NexusSpacing.lg) {
                EmptyStateView(
                    title: "Error Loading Data",
                    subtitle: error,
                    iconName: "exclamationmark.triangle.fill"
                )

                Button(action: retryAction) {
                    Text("Try Again")
                        .font(NexusFont.body(14))
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity)
                        .frame(height: 44)
                        .background(NexusColors.cyan)
                        .cornerRadius(NexusRadius.md)
                }
                .padding(NexusSpacing.lg)

                Spacer()
            }
            .padding(NexusSpacing.lg)
        }
    }
}

// MARK: - Subscription Tier (alias for PremiumTier)
typealias SubscriptionTier = PremiumTier

extension PremiumTier {
    var badgeStyle: NexusBadgeStyle {
        switch self {
        case .free: return .secondary
        case .pro: return .primary
        case .plus: return .highlight
        case .premium: return .success
        }
    }
}

extension Double {
    var formattedCurrency: String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = "USD"
        formatter.minimumFractionDigits = 2
        formatter.maximumFractionDigits = 2
        return formatter.string(from: NSNumber(value: self)) ?? "$0.00"
    }
}

// MARK: - Preview
#Preview {
    NavigationStack {
        OwnerRevenueView()
    }
}
