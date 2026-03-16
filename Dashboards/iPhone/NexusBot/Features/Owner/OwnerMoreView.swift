import SwiftUI

/// "More" tab — navigation list linking to all secondary owner admin pages.
struct OwnerMoreView: View {
    var body: some View {
        ZStack {
            NexusColors.background.ignoresSafeArea()

            ScrollView {
                VStack(spacing: NexusSpacing.xl) {
                    // Header
                    VStack(alignment: .leading, spacing: NexusSpacing.xs) {
                        Text("Management")
                            .font(NexusFont.title(24))
                            .foregroundStyle(NexusColors.textPrimary)
                        Text("All admin tools and settings")
                            .font(NexusFont.body(14))
                            .foregroundStyle(NexusColors.textSecondary)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)

                    // MARK: - Analytics
                    VStack(spacing: NexusSpacing.sm) {
                        NexusSectionHeader(title: "Analytics")

                        NavigationLink(destination: OwnerCommandsView()) {
                            moreRow(icon: "chart.bar.fill", color: NexusColors.cyan, title: "Command Usage", subtitle: "Track command analytics and performance")
                        }

                        NavigationLink(destination: OwnerRevenueView()) {
                            moreRow(icon: "dollarsign.circle.fill", color: Color(hex: "FFD700"), title: "Revenue", subtitle: "Premium subscriptions and revenue")
                        }
                    }

                    // MARK: - Management
                    VStack(spacing: NexusSpacing.sm) {
                        NexusSectionHeader(title: "Management")

                        NavigationLink(destination: OwnerStaffView()) {
                            moreRow(icon: "person.2.fill", color: NexusColors.purple, title: "Staff", subtitle: "Manage bot staff and roles")
                        }

                        NavigationLink(destination: OwnerModulesView()) {
                            moreRow(icon: "puzzlepiece.extension.fill", color: NexusColors.cyan, title: "Global Modules", subtitle: "Toggle modules and server bans")
                        }

                        NavigationLink(destination: OwnerModerationView()) {
                            moreRow(icon: "shield.fill", color: NexusColors.error, title: "Moderation", subtitle: "Blocked users and safety tools")
                        }
                    }

                    // MARK: - System
                    VStack(spacing: NexusSpacing.sm) {
                        NexusSectionHeader(title: "System")

                        NavigationLink(destination: OwnerHealthView()) {
                            moreRow(icon: "heart.fill", color: NexusColors.success, title: "Health & Performance", subtitle: "Uptime, latency, and memory")
                        }

                        NavigationLink(destination: OwnerAlertsView()) {
                            moreRow(icon: "bell.fill", color: NexusColors.warning, title: "Alerts", subtitle: "Alert rules and triggered history")
                        }

                        NavigationLink(destination: OwnerInfrastructureView()) {
                            moreRow(icon: "cpu", color: NexusColors.textSecondary, title: "Infrastructure", subtitle: "Database and system information")
                        }
                    }
                }
                .padding(.horizontal, NexusSpacing.lg)
                .padding(.top, NexusSpacing.lg)
                .padding(.bottom, 100)
            }
        }
    }

    // MARK: - Row Component

    private func moreRow(icon: String, color: Color, title: String, subtitle: String) -> some View {
        HStack(spacing: NexusSpacing.md) {
            Image(systemName: icon)
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(.white)
                .frame(width: 36, height: 36)
                .background(color.opacity(0.85))
                .clipShape(RoundedRectangle(cornerRadius: NexusRadius.sm))

            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(NexusFont.body(14))
                    .foregroundStyle(NexusColors.textPrimary)
                Text(subtitle)
                    .font(NexusFont.caption(12))
                    .foregroundStyle(NexusColors.textSecondary)
            }

            Spacer()

            Image(systemName: "chevron.right")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(NexusColors.textMuted)
        }
        .padding(NexusSpacing.md)
        .background(NexusColors.cardBackground)
        .clipShape(RoundedRectangle(cornerRadius: NexusRadius.md))
    }
}
