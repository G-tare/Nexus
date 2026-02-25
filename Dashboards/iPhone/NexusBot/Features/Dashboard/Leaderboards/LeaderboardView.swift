import SwiftUI

struct LeaderboardView: View {
    let guildId: String
    @State private var selectedType: LeaderboardType = .level
    @State private var entries: [LeaderboardEntry] = []
    @State private var isLoading = true
    @State private var page = 1
    @State private var hasMore = true
    @State private var loadId = UUID()

    var body: some View {
        ZStack {
            NexusColors.background.ignoresSafeArea()

            VStack(spacing: 0) {
                // Type selector
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: NexusSpacing.sm) {
                        ForEach(LeaderboardType.allCases, id: \.rawValue) { type in
                            LeaderboardTypeChip(
                                type: type,
                                isSelected: selectedType == type
                            ) {
                                if selectedType != type {
                                    selectedType = type
                                    entries = []
                                    page = 1
                                    hasMore = true
                                    loadId = UUID()
                                }
                            }
                        }
                    }
                    .padding(.horizontal, NexusSpacing.lg)
                    .padding(.vertical, NexusSpacing.md)
                }

                // Leaderboard list
                ScrollView {
                    LazyVStack(spacing: 0) {
                        if isLoading && entries.isEmpty {
                            ForEach(0..<10, id: \.self) { _ in
                                SkeletonView(height: 52)
                                    .padding(.horizontal, NexusSpacing.lg)
                                    .padding(.vertical, NexusSpacing.xs)
                            }
                        } else if entries.isEmpty {
                            EmptyStateView(
                                icon: "trophy",
                                title: "No Data Yet",
                                message: "The leaderboard is empty. Members will appear here as they interact with the server."
                            )
                        } else {
                            // Top 3 podium
                            if entries.count >= 3 {
                                PodiumView(
                                    entries: Array(entries.prefix(3)),
                                    type: selectedType
                                )
                                .padding(.horizontal, NexusSpacing.lg)
                                .padding(.bottom, NexusSpacing.lg)
                            }

                            // Remaining entries
                            let startIndex = entries.count >= 3 ? 3 : 0
                            ForEach(Array(entries.dropFirst(startIndex))) { entry in
                                LeaderboardRow(
                                    rank: entry.rank,
                                    username: entry.username ?? "Unknown",
                                    avatarUrl: entry.avatarUrl,
                                    value: entry.displayValue(for: selectedType),
                                    label: entry.displayLabel(for: selectedType)
                                )
                            }

                            // Load more
                            if hasMore {
                                ProgressView()
                                    .tint(NexusColors.cyan)
                                    .padding(NexusSpacing.xl)
                                    .onAppear {
                                        Task { await loadMore() }
                                    }
                            }
                        }
                    }
                    .padding(.bottom, 100)
                }
                .refreshable {
                    // Don't clear entries — only replace when new data arrives
                    page = 1
                    hasMore = true
                    await loadLeaderboard(replacing: true)
                }
            }
        }
        .task(id: loadId) { await loadLeaderboard(replacing: true) }
    }

    private func loadLeaderboard(replacing: Bool = false) async {
        isLoading = true
        // Retry up to 2 times for cancelled/transient errors
        for attempt in 1...3 {
            do {
                try Task.checkCancellation()
                let newEntries = try await APIClient.shared.fetchLeaderboard(guildId, type: selectedType, page: page)
                if replacing {
                    entries = newEntries
                } else {
                    entries = newEntries
                }
                hasMore = newEntries.count >= 25
                isLoading = false
                return
            } catch is CancellationError {
                // SwiftUI cancelled the task — don't wipe data, just stop
                return
            } catch {
                let nsError = error as NSError
                if nsError.domain == NSURLErrorDomain && nsError.code == NSURLErrorCancelled {
                    // URLSession cancelled — retry after brief delay
                    if attempt < 3 {
                        try? await Task.sleep(nanoseconds: UInt64(attempt) * 300_000_000)
                        continue
                    }
                }
                print("Failed to load leaderboard: \(error)")
                break
            }
        }
        isLoading = false
    }

    private func loadMore() async {
        page += 1
        do {
            let newEntries = try await APIClient.shared.fetchLeaderboard(guildId, type: selectedType, page: page)
            entries.append(contentsOf: newEntries)
            hasMore = newEntries.count >= 25
        } catch is CancellationError {
            page -= 1
        } catch {
            print("Failed to load more: \(error)")
            page -= 1
        }
    }
}

// MARK: - Type Chip

struct LeaderboardTypeChip: View {
    let type: LeaderboardType
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: NexusSpacing.xs) {
                Image(systemName: type.icon)
                    .font(.system(size: 12))
                Text(type.displayName)
                    .font(NexusFont.caption(12))
                    .fontWeight(.medium)
            }
            .foregroundStyle(isSelected ? NexusColors.background : NexusColors.textSecondary)
            .padding(.horizontal, NexusSpacing.md)
            .padding(.vertical, NexusSpacing.sm)
            .background(isSelected ? NexusColors.cyan : NexusColors.cardBackground)
            .clipShape(RoundedRectangle(cornerRadius: NexusRadius.full))
        }
    }
}

// MARK: - Podium

struct PodiumView: View {
    let entries: [LeaderboardEntry]
    let type: LeaderboardType

    var body: some View {
        HStack(alignment: .bottom, spacing: NexusSpacing.md) {
            if entries.count > 1 {
                podiumEntry(entries[1], place: 2, height: 80, color: Color(hex: "C0C0C0"))
            }
            if entries.count > 0 {
                podiumEntry(entries[0], place: 1, height: 100, color: Color(hex: "FFD700"))
            }
            if entries.count > 2 {
                podiumEntry(entries[2], place: 3, height: 65, color: Color(hex: "CD7F32"))
            }
        }
    }

    private func podiumEntry(_ entry: LeaderboardEntry, place: Int, height: CGFloat, color: Color) -> some View {
        VStack(spacing: NexusSpacing.sm) {
            AsyncImage(url: URL(string: entry.avatarUrl ?? "")) { image in
                image.resizable().scaledToFill()
            } placeholder: {
                Circle().fill(NexusColors.surfaceElevated)
            }
            .frame(width: place == 1 ? 56 : 44, height: place == 1 ? 56 : 44)
            .clipShape(Circle())
            .overlay(
                Circle().stroke(color, lineWidth: 2)
            )
            .shadow(color: color.opacity(0.4), radius: 6)

            Text(entry.username ?? "???")
                .font(NexusFont.caption(11))
                .foregroundStyle(NexusColors.textPrimary)
                .lineLimit(1)

            Text(entry.displayValue(for: type))
                .font(NexusFont.mono(12))
                .foregroundStyle(color)

            // Podium bar
            RoundedRectangle(cornerRadius: NexusRadius.sm)
                .fill(
                    LinearGradient(
                        colors: [color.opacity(0.3), color.opacity(0.1)],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                )
                .frame(height: height)
                .overlay(
                    Text("#\(place)")
                        .font(NexusFont.heading(16))
                        .foregroundStyle(color)
                )
        }
        .frame(maxWidth: .infinity)
    }
}
