import SwiftUI

struct OwnerModerationView: View {
    @StateObject private var viewModel = ModerationViewModel()
    @State private var showAddBlockSheet = false
    @State private var selectedBlockedUser: BlockedUser?
    @State private var showUnblockConfirmation = false

    var body: some View {
        ZStack {
            NexusColors.background
                .ignoresSafeArea()

            VStack(spacing: 0) {
                if viewModel.isLoading && viewModel.overview == nil {
                    loadingView
                } else {
                    ScrollView {
                        VStack(spacing: NexusSpacing.lg) {
                            // Overview Stats
                            overviewStatsSection
                                .padding(.horizontal, NexusSpacing.lg)
                                .padding(.top, NexusSpacing.lg)

                            // Blocked Users Section
                            blockedUsersSection
                                .padding(.horizontal, NexusSpacing.lg)

                            Spacer(minLength: NexusSpacing.lg)
                        }
                    }
                    .refreshable {
                        await viewModel.refreshData()
                    }
                }
            }
            .navigationTitle("Moderation")
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button(action: { showAddBlockSheet = true }) {
                        Image(systemName: "plus.circle.fill")
                            .foregroundStyle(NexusColors.cyan)
                            .font(.system(size: 18, weight: .semibold))
                    }
                }
            }
            .sheet(isPresented: $showAddBlockSheet) {
                AddBlockUserSheet(isPresented: $showAddBlockSheet, viewModel: viewModel)
            }
            .alert("Unblock User", isPresented: $showUnblockConfirmation, presenting: selectedBlockedUser) { user in
                Button("Cancel", role: .cancel) { }
                Button("Unblock", role: .destructive) {
                    Task {
                        await viewModel.unblockUser(user.userId)
                        selectedBlockedUser = nil
                    }
                }
            } message: { user in
                Text("Are you sure you want to unblock \(user.userId)?")
            }
        }
        .onAppear {
            viewModel.loadInitialData()
        }
    }

    // MARK: - Subviews

    @ViewBuilder
    private var loadingView: some View {
        ScrollView {
            VStack(spacing: NexusSpacing.lg) {
                VStack(spacing: NexusSpacing.md) {
                    HStack(spacing: NexusSpacing.md) {
                        SkeletonView()
                            .frame(height: 80)
                        SkeletonView()
                            .frame(height: 80)
                    }
                    HStack(spacing: NexusSpacing.md) {
                        SkeletonView()
                            .frame(height: 80)
                        SkeletonView()
                            .frame(height: 80)
                    }
                }

                VStack(spacing: NexusSpacing.sm) {
                    ForEach(0..<3, id: \.self) { _ in
                        SkeletonView()
                            .frame(height: 60)
                    }
                }

                Spacer()
            }
            .padding(.horizontal, NexusSpacing.lg)
            .padding(.top, NexusSpacing.lg)
        }
    }

    @ViewBuilder
    private var overviewStatsSection: some View {
        if let overview = viewModel.overview {
            VStack(spacing: NexusSpacing.md) {
                HStack(spacing: NexusSpacing.md) {
                    StatCard(
                        title: "Blocked Users",
                        value: "\(overview.blockedUsers)",
                        icon: "nosign",
                        color: NexusColors.error
                    )

                    StatCard(
                        title: "Open Appeals",
                        value: "\(overview.appeals?.openAppeals ?? 0)",
                        icon: "exclamationmark.circle",
                        color: NexusColors.warning
                    )
                }

                HStack(spacing: NexusSpacing.md) {
                    StatCard(
                        title: "Server Bans",
                        value: "\(overview.serverBans)",
                        icon: "xmark.shield",
                        color: NexusColors.purple
                    )

                    StatCard(
                        title: "Total Appeals",
                        value: "\(overview.appeals?.totalAppeals ?? 0)",
                        icon: "doc.text",
                        color: NexusColors.cyan
                    )
                }
            }
        }
    }

    @ViewBuilder
    private var blockedUsersSection: some View {
        VStack(alignment: .leading, spacing: NexusSpacing.md) {
            NexusSectionHeader(
                title: "Blocked Users",
                subtitle: "Manage blocked user accounts"
            )

            if viewModel.isLoadingBlockedUsers {
                VStack(spacing: NexusSpacing.sm) {
                    ForEach(0..<4, id: \.self) { _ in
                        SkeletonView()
                            .frame(height: 100)
                    }
                }
            } else if viewModel.blockedUsers.isEmpty {
                EmptyStateView(
                    icon: "checkmark.shield",
                    title: "No Blocked Users",
                    subtitle: "All users can access the platform"
                )
                .frame(maxWidth: .infinity, alignment: .top)
            } else {
                VStack(spacing: NexusSpacing.sm) {
                    ForEach(viewModel.blockedUsers, id: \.userId) { user in
                        blockedUserRow(user)
                    }
                }
            }
        }
    }

    @ViewBuilder
    private func blockedUserRow(_ user: BlockedUser) -> some View {
        NexusCard {
            VStack(alignment: .leading, spacing: NexusSpacing.sm) {
                // User ID and Reason
                HStack(alignment: .top, spacing: NexusSpacing.md) {
                    VStack(alignment: .leading, spacing: NexusSpacing.xs) {
                        Text(user.userId)
                            .font(NexusFont.body(14))
                            .foregroundStyle(NexusColors.textPrimary)
                            .lineLimit(1)

                        Text(user.reason)
                            .font(NexusFont.caption(12))
                            .foregroundStyle(NexusColors.textSecondary)
                            .lineLimit(2)
                    }

                    Spacer()

                    VStack(alignment: .trailing, spacing: NexusSpacing.xs) {
                        NexusBadge(
                            text: "Blocked",
                            backgroundColor: NexusColors.error.opacity(0.2),
                            textColor: NexusColors.error
                        )

                        if let expiresAt = user.expiresAt, !expiresAt.isEmpty {
                            NexusBadge(
                                text: "Expires",
                                backgroundColor: NexusColors.warning.opacity(0.2),
                                textColor: NexusColors.warning
                            )
                        }
                    }
                }

                // Metadata
                VStack(alignment: .leading, spacing: NexusSpacing.xs) {
                    metadataRow(
                        label: "Blocked By",
                        value: user.blockedBy ?? "Unknown",
                        icon: "person.fill"
                    )

                    if let createdAt = user.createdAt, !createdAt.isEmpty {
                        metadataRow(
                            label: "Created",
                            value: formatDateString(createdAt),
                            icon: "calendar"
                        )
                    }

                    if let expiresAt = user.expiresAt, !expiresAt.isEmpty {
                        metadataRow(
                            label: "Expires",
                            value: formatDateString(expiresAt),
                            icon: "clock"
                        )
                    }
                }

                // Unblock Button
                HStack(spacing: NexusSpacing.sm) {
                    NexusButton(
                        title: "Unblock",
                        style: .secondary,
                        action: {
                            selectedBlockedUser = user
                            showUnblockConfirmation = true
                        }
                    )

                    Spacer()
                }
            }
            .padding(NexusSpacing.md)
        }
    }

    @ViewBuilder
    private func metadataRow(label: String, value: String, icon: String) -> some View {
        HStack(spacing: NexusSpacing.sm) {
            Image(systemName: icon)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(NexusColors.textMuted)
                .frame(width: 16)

            Text(label)
                .font(NexusFont.caption(12))
                .foregroundStyle(NexusColors.textMuted)

            Spacer()

            Text(value)
                .font(NexusFont.mono(14))
                .foregroundStyle(NexusColors.textSecondary)
                .lineLimit(1)
        }
    }

    // MARK: - Helpers

    private func formatDateString(_ isoString: String) -> String {
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = iso.date(from: isoString) {
            let formatter = DateFormatter()
            formatter.dateFormat = "MMM d, yyyy"
            return formatter.string(from: date)
        }
        // Fallback: try without fractional seconds
        iso.formatOptions = [.withInternetDateTime]
        if let date = iso.date(from: isoString) {
            let formatter = DateFormatter()
            formatter.dateFormat = "MMM d, yyyy"
            return formatter.string(from: date)
        }
        return isoString
    }
}

// MARK: - Add Block User Sheet

struct AddBlockUserSheet: View {
    @Binding var isPresented: Bool
    let viewModel: ModerationViewModel

    @State private var userId = ""
    @State private var reason = ""
    @State private var expiryDate = Date().addingTimeInterval(86400 * 7) // 7 days default
    @State private var setExpiryDate = false
    @State private var isSubmitting = false

    var body: some View {
        NavigationStack {
            ZStack {
                NexusColors.background
                    .ignoresSafeArea()

                ScrollView {
                    VStack(alignment: .leading, spacing: NexusSpacing.lg) {
                        VStack(alignment: .leading, spacing: NexusSpacing.sm) {
                            Text("User ID")
                                .font(NexusFont.heading(18))
                                .foregroundStyle(NexusColors.textPrimary)

                            TextField("Enter user ID", text: $userId)
                                .textFieldStyle(.roundedBorder)
                                .font(NexusFont.body(14))
                                .foregroundStyle(NexusColors.textPrimary)
                        }

                        VStack(alignment: .leading, spacing: NexusSpacing.sm) {
                            Text("Reason")
                                .font(NexusFont.heading(18))
                                .foregroundStyle(NexusColors.textPrimary)

                            TextField("Describe the block reason", text: $reason, axis: .vertical)
                                .textFieldStyle(.roundedBorder)
                                .font(NexusFont.body(14))
                                .foregroundStyle(NexusColors.textPrimary)
                                .lineLimit(3...6)
                        }

                        VStack(alignment: .leading, spacing: NexusSpacing.sm) {
                            Toggle("Set Expiry Date", isOn: $setExpiryDate)
                                .font(NexusFont.body(14))
                                .tint(NexusColors.cyan)

                            if setExpiryDate {
                                DatePicker(
                                    "Expires at",
                                    selection: $expiryDate,
                                    in: Date()...,
                                    displayedComponents: [.date, .hourAndMinute]
                                )
                                .font(NexusFont.body(14))
                                .tint(NexusColors.cyan)
                            }
                        }

                        Spacer(minLength: NexusSpacing.lg)

                        NexusButton(
                            title: isSubmitting ? "Blocking..." : "Block User",
                            isLoading: isSubmitting,
                            action: {
                                Task {
                                    await submitBlock()
                                }
                            }
                        )
                        .disabled(userId.isEmpty || reason.isEmpty || isSubmitting)
                    }
                    .padding(NexusSpacing.lg)
                }
            }
            .navigationTitle("Block User")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") {
                        isPresented = false
                    }
                    .foregroundStyle(NexusColors.cyan)
                }
            }
        }
    }

    private func submitBlock() async {
        isSubmitting = true

        let expiresAt = setExpiryDate ? expiryDate : nil

        await viewModel.blockUser(
            userId: userId.trimmingCharacters(in: .whitespaces),
            reason: reason.trimmingCharacters(in: .whitespaces),
            expiresAt: expiresAt
        )

        isSubmitting = false
        isPresented = false
    }
}

// MARK: - View Model

@MainActor
class ModerationViewModel: ObservableObject {
    @Published var overview: ModerationOverview?
    @Published var blockedUsers: [BlockedUser] = []
    @Published var isLoading = false
    @Published var isLoadingBlockedUsers = false
    @Published var errorMessage: String?

    func loadInitialData() {
        Task {
            await refreshData()
        }
    }

    func refreshData() async {
        isLoading = true

        do {
            async let overviewTask = APIClient.shared.fetchModerationOverview()
            async let usersTask = APIClient.shared.fetchBlockedUsers(limit: 50)

            let (newOverview, usersResponse) = try await (overviewTask, usersTask)

            self.overview = newOverview
            self.blockedUsers = usersResponse.users
            self.errorMessage = nil
        } catch {
            self.errorMessage = error.localizedDescription
        }

        isLoading = false
    }

    func blockUser(userId: String, reason: String, expiresAt: Date?) async {
        do {
            let expiresAtString: String? = expiresAt.map { date in
                ISO8601DateFormatter().string(from: date)
            }
            try await APIClient.shared.blockUser(
                userId: userId,
                reason: reason,
                expiresAt: expiresAtString
            )

            await refreshData()
        } catch {
            self.errorMessage = error.localizedDescription
        }
    }

    func unblockUser(_ userId: String) async {
        do {
            try await APIClient.shared.unblockUser(userId)
            await refreshData()
        } catch {
            self.errorMessage = error.localizedDescription
        }
    }
}

// MARK: - Models

#Preview {
    NavigationStack {
        OwnerModerationView()
    }
}
