import SwiftUI
import Charts

struct AnalyticsView: View {
    let guildId: String
    @State private var stats: GuildStats?
    @State private var activityPoints: [ActivityPoint] = []
    @State private var selectedPeriod: TimePeriod = .week
    @State private var isLoading = true

    enum TimePeriod: String, CaseIterable {
        case day = "24h"
        case week = "7d"
        case month = "30d"

        var displayName: String { rawValue }
        var apiValue: String { rawValue }
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
                    // MARK: - Stats Overview
                    if let stats {
                        LazyVGrid(columns: statsColumns, spacing: NexusSpacing.md) {
                            StatCard(title: "Total Members", value: formatNumber(stats.totalMembers), icon: "person.2.fill", accentColor: NexusColors.cyan)
                            StatCard(title: "Total Messages", value: formatNumber(stats.totalMessages), icon: "message.fill", accentColor: NexusColors.purple)
                            StatCard(title: "Voice Hours", value: formatMinutes(stats.totalVoiceMinutes), icon: "waveform", accentColor: NexusColors.pink)
                            StatCard(title: "Avg Level", value: String(format: "%.1f", stats.averageLevel), icon: "arrow.up.circle.fill", accentColor: NexusColors.success)
                        }
                    } else {
                        LazyVGrid(columns: statsColumns, spacing: NexusSpacing.md) {
                            ForEach(0..<4, id: \.self) { _ in SkeletonView(height: 110) }
                        }
                    }

                    // MARK: - Time Period Selector
                    HStack(spacing: NexusSpacing.sm) {
                        ForEach(TimePeriod.allCases, id: \.rawValue) { period in
                            Button {
                                withAnimation(.spring(duration: 0.2)) { selectedPeriod = period }
                                Task { await loadActivity() }
                            } label: {
                                Text(period.displayName)
                                    .font(NexusFont.caption(13))
                                    .fontWeight(.semibold)
                                    .foregroundStyle(selectedPeriod == period ? NexusColors.background : NexusColors.textSecondary)
                                    .padding(.horizontal, NexusSpacing.lg)
                                    .padding(.vertical, NexusSpacing.sm)
                                    .background(selectedPeriod == period ? NexusColors.cyan : NexusColors.cardBackground)
                                    .clipShape(RoundedRectangle(cornerRadius: NexusRadius.full))
                            }
                        }
                        Spacer()
                    }

                    // MARK: - Messages Chart
                    NexusSectionHeader(title: "Messages")

                    if activityPoints.isEmpty && !isLoading {
                        NexusCard {
                            VStack(spacing: NexusSpacing.md) {
                                Image(systemName: "chart.line.downtrend.xyaxis")
                                    .font(.system(size: 28))
                                    .foregroundStyle(NexusColors.textMuted)
                                Text("No activity data yet")
                                    .font(NexusFont.body(14))
                                    .foregroundStyle(NexusColors.textSecondary)
                                Text("Activity data will appear as members send messages and join voice channels.")
                                    .font(NexusFont.caption(12))
                                    .foregroundStyle(NexusColors.textMuted)
                                    .multilineTextAlignment(.center)
                            }
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, NexusSpacing.xl)
                        }
                    } else {
                        NexusCard(glowColor: NexusColors.cyan, glowIntensity: 0.08) {
                            Chart(activityPoints) { point in
                                AreaMark(
                                    x: .value("Time", point.label),
                                    y: .value("Messages", point.messages)
                                )
                                .foregroundStyle(
                                    LinearGradient(
                                        colors: [NexusColors.cyan.opacity(0.3), NexusColors.cyan.opacity(0.02)],
                                        startPoint: .top,
                                        endPoint: .bottom
                                    )
                                )

                                LineMark(
                                    x: .value("Time", point.label),
                                    y: .value("Messages", point.messages)
                                )
                                .foregroundStyle(NexusColors.cyan)
                                .lineStyle(StrokeStyle(lineWidth: 2))
                            }
                            .chartYAxis {
                                AxisMarks(position: .leading) { _ in
                                    AxisValueLabel()
                                        .foregroundStyle(NexusColors.textMuted)
                                    AxisGridLine()
                                        .foregroundStyle(NexusColors.border.opacity(0.3))
                                }
                            }
                            .chartXAxis {
                                AxisMarks { _ in
                                    AxisValueLabel()
                                        .foregroundStyle(NexusColors.textMuted)
                                }
                            }
                            .frame(height: 200)
                        }

                        // MARK: - Voice Activity Chart
                        NexusSectionHeader(title: "Voice Activity")

                        NexusCard(glowColor: NexusColors.purple, glowIntensity: 0.08) {
                            Chart(activityPoints) { point in
                                BarMark(
                                    x: .value("Time", point.label),
                                    y: .value("Minutes", point.voice)
                                )
                                .foregroundStyle(
                                    LinearGradient(
                                        colors: [NexusColors.purple, NexusColors.purple.opacity(0.5)],
                                        startPoint: .top,
                                        endPoint: .bottom
                                    )
                                )
                                .cornerRadius(3)
                            }
                            .chartYAxis {
                                AxisMarks(position: .leading) { _ in
                                    AxisValueLabel()
                                        .foregroundStyle(NexusColors.textMuted)
                                    AxisGridLine()
                                        .foregroundStyle(NexusColors.border.opacity(0.3))
                                }
                            }
                            .chartXAxis {
                                AxisMarks { _ in
                                    AxisValueLabel()
                                        .foregroundStyle(NexusColors.textMuted)
                                }
                            }
                            .frame(height: 180)
                        }
                    }

                    // MARK: - Totals for Period
                    NexusSectionHeader(title: "Period Totals")

                    if let stats {
                        let periodMessages = activityPoints.reduce(0) { $0 + $1.messages }
                        let periodVoice = activityPoints.reduce(0) { $0 + $1.voice }
                        let periodReactions = activityPoints.reduce(0) { $0 + $1.reactions }

                        NexusCard {
                            VStack(spacing: NexusSpacing.md) {
                                highlightRow(icon: "crown.fill", label: "Highest Level", value: "Lv. \(stats.highestLevel)", color: Color(hex: "FFD700"))
                                Divider().background(NexusColors.border)
                                highlightRow(icon: "message.fill", label: "Messages (\(selectedPeriod.displayName))", value: formatNumber(periodMessages), color: NexusColors.cyan)
                                Divider().background(NexusColors.border)
                                highlightRow(icon: "waveform", label: "Voice (\(selectedPeriod.displayName))", value: formatMinutes(periodVoice), color: NexusColors.purple)
                                Divider().background(NexusColors.border)
                                highlightRow(icon: "hand.thumbsup.fill", label: "Reactions (\(selectedPeriod.displayName))", value: formatNumber(periodReactions), color: NexusColors.pink)
                            }
                        }
                    }
                }
                .padding(.horizontal, NexusSpacing.lg)
                .padding(.top, NexusSpacing.lg)
                .padding(.bottom, 60)
            }
            .refreshable {
                await loadAll()
            }
        }
        .task { await loadAll() }
    }

    private func loadAll() async {
        // Only show skeleton on first load, not on refresh
        let isFirstLoad = stats == nil
        if isFirstLoad { isLoading = true }

        async let statsTask = APIClient.shared.fetchGuildStats(guildId)
        async let activityTask: () = loadActivity()

        // Only replace stats if we got new data (don't nil out on refresh failure)
        if let newStats = try? await statsTask {
            stats = newStats
        }
        await activityTask
        isLoading = false
    }

    private func loadActivity() async {
        do {
            let response = try await APIClient.shared.fetchActivity(
                guildId,
                period: selectedPeriod.apiValue
            )
            let newPoints = response.points.enumerated().map { index, point in
                ActivityPoint(
                    index: index,
                    label: point.label,
                    messages: point.messages,
                    voice: point.voiceMinutes,
                    reactions: point.reactions
                )
            }
            // Only update if we got data; keep old data on empty response during refresh
            if !newPoints.isEmpty || stats == nil {
                activityPoints = newPoints
            }
        } catch {
            print("[Analytics] Failed to load activity: \(error)")
            // Don't clear existing data on refresh failure
            if stats == nil {
                activityPoints = []
            }
        }
    }

    private func highlightRow(icon: String, label: String, value: String, color: Color) -> some View {
        HStack(spacing: NexusSpacing.md) {
            Image(systemName: icon)
                .font(.system(size: 14))
                .foregroundStyle(color)
                .frame(width: 28, height: 28)
                .background(color.opacity(0.12))
                .clipShape(RoundedRectangle(cornerRadius: 6))
            Text(label)
                .font(NexusFont.body(14))
                .foregroundStyle(NexusColors.textSecondary)
            Spacer()
            Text(value)
                .font(NexusFont.mono(15))
                .foregroundStyle(NexusColors.textPrimary)
        }
    }
}

// MARK: - Data Models

struct ActivityPoint: Identifiable {
    let id = UUID()
    let index: Int
    let label: String
    let messages: Int
    let voice: Int
    let reactions: Int

    init(index: Int, label: String, messages: Int, voice: Int, reactions: Int = 0) {
        self.index = index
        self.label = label
        self.messages = messages
        self.voice = voice
        self.reactions = reactions
    }
}

// API Response models
struct ActivityResponse: Codable {
    let points: [ActivityDataPoint]
    let period: String
}

struct ActivityDataPoint: Codable {
    let label: String
    let messages: Int
    let voiceMinutes: Int
    let reactions: Int
}
