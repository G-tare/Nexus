import SwiftUI

struct OwnerHealthView: View {
    @State private var healthOverview: HealthOverview?
    @State private var latencyStats: LatencyResponse?
    @State private var isLoading = false
    @State private var refreshTimer: Timer?
    @State private var showError = false
    @State private var errorMessage = ""
    @State private var lastRefreshTime = Date()

    var body: some View {
        ZStack {
            NexusColors.background
                .ignoresSafeArea()

            VStack(spacing: 0) {
                if isLoading && healthOverview == nil {
                    LoadingView()
                } else if let health = healthOverview {
                    ScrollView {
                        VStack(spacing: NexusSpacing.lg) {
                            // Status Indicator
                            StatusIndicatorView(
                                status: health.database.status,
                                isOperational: health.database.status == "healthy" || health.database.status == "operational"
                            )
                            .padding(.horizontal, NexusSpacing.lg)
                            .padding(.top, NexusSpacing.lg)

                            // Stat Cards Grid
                            VStack(spacing: NexusSpacing.md) {
                                NexusSectionHeader(title: "Performance Metrics")
                                    .padding(.horizontal, NexusSpacing.lg)

                                LazyVGrid(
                                    columns: [
                                        GridItem(.flexible(), spacing: NexusSpacing.md),
                                        GridItem(.flexible(), spacing: NexusSpacing.md)
                                    ],
                                    spacing: NexusSpacing.md
                                ) {
                                    StatCard(
                                        title: "Uptime",
                                        value: health.uptimeFormatted,
                                        icon: "checkmark.circle.fill",
                                        color: NexusColors.success
                                    )

                                    StatCard(
                                        title: "DB Latency",
                                        value: String(format: "%.1f ms", health.database.latencyMs),
                                        icon: "bolt.fill",
                                        color: NexusColors.cyan
                                    )

                                    StatCard(
                                        title: "Heap Memory",
                                        value: String(format: "%.1f MB", health.memory.heapUsedMB),
                                        icon: "memorychip.fill",
                                        color: NexusColors.purple
                                    )

                                    StatCard(
                                        title: "RSS Memory",
                                        value: String(format: "%.1f MB", health.memory.rssMB),
                                        icon: "ram.fill",
                                        color: NexusColors.warning
                                    )
                                }
                                .padding(.horizontal, NexusSpacing.lg)
                            }

                            // Command Performance Section
                            VStack(spacing: NexusSpacing.md) {
                                NexusSectionHeader(title: "Command Performance")
                                    .padding(.horizontal, NexusSpacing.lg)

                                NexusCard {
                                    VStack(spacing: NexusSpacing.md) {
                                        HStack {
                                            VStack(alignment: .leading, spacing: NexusSpacing.xs) {
                                                Text("Last Hour")
                                                    .font(NexusFont.caption(12))
                                                    .foregroundStyle(NexusColors.textSecondary)

                                                HStack(spacing: NexusSpacing.md) {
                                                    VStack(alignment: .leading) {
                                                        Text("\(health.commands.commands1h)")
                                                            .font(NexusFont.stat(22))
                                                            .foregroundStyle(NexusColors.textPrimary)
                                                        Text("Commands")
                                                            .font(NexusFont.caption(12))
                                                            .foregroundStyle(NexusColors.textMuted)
                                                    }

                                                    Spacer()

                                                    VStack(alignment: .trailing) {
                                                        Text("\(health.commands.errors1h)")
                                                            .font(NexusFont.stat(22))
                                                            .foregroundStyle(health.commands.errors1h > 0 ? NexusColors.error : NexusColors.success)
                                                        Text("Errors")
                                                            .font(NexusFont.caption(12))
                                                            .foregroundStyle(NexusColors.textMuted)
                                                    }
                                                }
                                            }

                                            Spacer()
                                        }

                                        Divider()
                                            .background(NexusColors.border)

                                        HStack {
                                            VStack(alignment: .leading, spacing: NexusSpacing.xs) {
                                                Text("Last 24 Hours")
                                                    .font(NexusFont.caption(12))
                                                    .foregroundStyle(NexusColors.textSecondary)

                                                HStack(spacing: NexusSpacing.md) {
                                                    VStack(alignment: .leading) {
                                                        Text("\(health.commands.commands24h)")
                                                            .font(NexusFont.stat(22))
                                                            .foregroundStyle(NexusColors.textPrimary)
                                                        Text("Commands")
                                                            .font(NexusFont.caption(12))
                                                            .foregroundStyle(NexusColors.textMuted)
                                                    }

                                                    Spacer()

                                                    VStack(alignment: .trailing) {
                                                        Text("\(health.commands.errors24h)")
                                                            .font(NexusFont.stat(22))
                                                            .foregroundStyle(health.commands.errors24h > 0 ? NexusColors.error : NexusColors.success)
                                                        Text("Errors")
                                                            .font(NexusFont.caption(12))
                                                            .foregroundStyle(NexusColors.textMuted)
                                                    }
                                                }
                                            }

                                            Spacer()
                                        }

                                        Divider()
                                            .background(NexusColors.border)

                                        HStack {
                                            Text("Avg Response Time (1h)")
                                                .font(NexusFont.caption(12))
                                                .foregroundStyle(NexusColors.textSecondary)

                                            Spacer()

                                            Text(String(format: "%.2f ms", health.commands.avgMs1h))
                                                .font(NexusFont.stat(22))
                                                .foregroundStyle(NexusColors.cyan)
                                                .fontDesign(.monospaced)
                                        }
                                    }
                                }
                                .padding(.horizontal, NexusSpacing.lg)
                            }

                            // Latency Percentiles Section
                            if let latency = latencyStats?.summary {
                                VStack(spacing: NexusSpacing.md) {
                                    NexusSectionHeader(title: "Latency Percentiles")
                                        .padding(.horizontal, NexusSpacing.lg)

                                    NexusCard {
                                        VStack(spacing: NexusSpacing.md) {
                                            LatencyPercentileRow(
                                                label: "P50",
                                                value: String(format: "%.2f ms", latency.p50),
                                                color: NexusColors.success
                                            )

                                            Divider()
                                                .background(NexusColors.border)

                                            LatencyPercentileRow(
                                                label: "P95",
                                                value: String(format: "%.2f ms", latency.p95),
                                                color: NexusColors.warning
                                            )

                                            Divider()
                                                .background(NexusColors.border)

                                            LatencyPercentileRow(
                                                label: "P99",
                                                value: String(format: "%.2f ms", latency.p99),
                                                color: NexusColors.error
                                            )

                                            Divider()
                                                .background(NexusColors.border)

                                            HStack {
                                                VStack(alignment: .leading, spacing: NexusSpacing.xs) {
                                                    Text("Min")
                                                        .font(NexusFont.caption(12))
                                                        .foregroundStyle(NexusColors.textSecondary)
                                                    Text(String(format: "%.2f ms", latency.minMs))
                                                        .font(NexusFont.body(14))
                                                        .foregroundStyle(NexusColors.textPrimary)
                                                        .fontDesign(.monospaced)
                                                }

                                                Spacer()

                                                VStack(alignment: .trailing, spacing: NexusSpacing.xs) {
                                                    Text("Max")
                                                        .font(NexusFont.caption(12))
                                                        .foregroundStyle(NexusColors.textSecondary)
                                                    Text(String(format: "%.2f ms", latency.maxMs))
                                                        .font(NexusFont.body(14))
                                                        .foregroundStyle(NexusColors.textPrimary)
                                                        .fontDesign(.monospaced)
                                                }
                                            }

                                            Divider()
                                                .background(NexusColors.border)

                                            HStack {
                                                Text("Sample Count")
                                                    .font(NexusFont.caption(12))
                                                    .foregroundStyle(NexusColors.textSecondary)

                                                Spacer()

                                                NexusBadge(
                                                    text: "\(latency.sampleCount)",
                                                    color: NexusColors.cyan
                                                )
                                            }
                                        }
                                    }
                                    .padding(.horizontal, NexusSpacing.lg)
                                }
                            }

                            // Last Updated Time
                            VStack(spacing: NexusSpacing.xs) {
                                Text("Last Updated")
                                    .font(NexusFont.caption(12))
                                    .foregroundStyle(NexusColors.textMuted)

                                Text(formattedRefreshTime(lastRefreshTime))
                                    .font(NexusFont.caption(12))
                                    .foregroundStyle(NexusColors.textSecondary)
                                    .fontDesign(.monospaced)
                            }
                            .padding(.vertical, NexusSpacing.lg)
                            .frame(maxWidth: .infinity)
                        }
                    }
                    .refreshable {
                        await refreshData()
                    }
                } else {
                    ScrollView {
                        EmptyStateView(
                            icon: "heart.slash",
                            title: "No Data Available",
                            message: "Unable to load health metrics"
                        )
                        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
                    }
                }
            }

            if showError {
                ErrorBannerView(
                    message: errorMessage,
                    dismissAction: { showError = false }
                )
            }
        }
        .navigationTitle("Health & Performance")
        .onAppear {
            Task {
                await loadData()
                startAutoRefresh()
            }
        }
        .onDisappear {
            stopAutoRefresh()
        }
    }

    // MARK: - Data Loading

    private func loadData() async {
        isLoading = true
        defer { isLoading = false }

        do {
            async let health = APIClient.shared.fetchHealthOverview()
            async let latency = APIClient.shared.fetchLatencyStats(hours: 1)

            healthOverview = try await health
            latencyStats = try await latency
            lastRefreshTime = Date()
            showError = false
        } catch {
            errorMessage = "Failed to load health metrics: \(error.localizedDescription)"
            showError = true
        }
    }

    private func refreshData() async {
        await loadData()
    }

    // MARK: - Auto Refresh

    private func startAutoRefresh() {
        stopAutoRefresh()
        refreshTimer = Timer.scheduledTimer(withTimeInterval: 30.0, repeats: true) { _ in
            Task {
                await loadData()
            }
        }
    }

    private func stopAutoRefresh() {
        refreshTimer?.invalidate()
        refreshTimer = nil
    }

    // MARK: - Helpers

    private func formattedRefreshTime(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "HH:mm:ss"
        return formatter.string(from: date)
    }
}

// MARK: - Status Indicator

private struct StatusIndicatorView: View {
    let status: String
    let isOperational: Bool

    var body: some View {
        NexusCard {
            HStack(spacing: NexusSpacing.md) {
                Circle()
                    .fill(isOperational ? NexusColors.success : NexusColors.error)
                    .frame(width: 12, height: 12)

                Text(isOperational ? "All Systems Operational" : "Issues Detected")
                    .font(NexusFont.body(14))
                    .foregroundStyle(NexusColors.textPrimary)

                Spacer()

                Image(systemName: isOperational ? "checkmark.seal.fill" : "exclamationmark.triangle.fill")
                    .foregroundStyle(isOperational ? NexusColors.success : NexusColors.error)
                    .font(.system(size: 18))
            }
            .padding(NexusSpacing.md)
        }
    }
}

// MARK: - Latency Percentile Row

private struct LatencyPercentileRow: View {
    let label: String
    let value: String
    let color: Color

    var body: some View {
        HStack {
            HStack(spacing: NexusSpacing.sm) {
                Circle()
                    .fill(color)
                    .frame(width: 8, height: 8)

                Text(label)
                    .font(NexusFont.caption(12))
                    .foregroundStyle(NexusColors.textSecondary)
            }

            Spacer()

            Text(value)
                .font(NexusFont.body(14))
                .foregroundStyle(NexusColors.textPrimary)
                .fontDesign(.monospaced)
        }
    }
}

// MARK: - Loading View

private struct LoadingView: View {
    var body: some View {
        VStack(spacing: NexusSpacing.lg) {
            SkeletonView()
                .frame(height: 80)

            VStack(spacing: NexusSpacing.md) {
                SkeletonView()
                    .frame(height: 60)

                HStack(spacing: NexusSpacing.md) {
                    SkeletonView()
                    SkeletonView()
                }
                .frame(height: 100)
            }
            .padding(.horizontal, NexusSpacing.lg)

            Spacer()
        }
        .padding(.top, NexusSpacing.lg)
    }
}

// MARK: - Error Banner

private struct ErrorBannerView: View {
    let message: String
    let dismissAction: () -> Void

    var body: some View {
        VStack {
            HStack(spacing: NexusSpacing.sm) {
                Image(systemName: "exclamationmark.circle.fill")
                    .foregroundStyle(NexusColors.error)

                Text(message)
                    .font(NexusFont.body(14))
                    .foregroundStyle(NexusColors.textPrimary)
                    .lineLimit(2)

                Spacer()

                Button(action: dismissAction) {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundStyle(NexusColors.textMuted)
                }
            }
            .padding(NexusSpacing.md)
            .background(NexusColors.error.opacity(0.1))
            .cornerRadius(NexusRadius.sm)
            .padding(NexusSpacing.lg)

            Spacer()
        }
    }
}

// MARK: - Preview

#Preview {
    NavigationStack {
        OwnerHealthView()
    }
}
