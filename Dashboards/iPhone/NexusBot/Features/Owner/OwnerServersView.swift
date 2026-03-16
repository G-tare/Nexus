import SwiftUI

// MARK: - Owner Servers View
struct OwnerServersView: View {
    @State private var searchQuery: String = ""
    @State private var selectedTier: ServerTierFilter = .all
    @State private var sortBy: SortOption = .name
    @State private var currentPage: Int = 1
    @State private var isLoading: Bool = true
    @State private var servers: [Guild] = []
    @State private var pagination: PaginationInfo?
    @State private var error: String?
    @State private var isRefreshing: Bool = false

    enum ServerTierFilter: String, CaseIterable {
        case all = "All"
        case free = "Free"
        case pro = "Pro"
        case plus = "Plus"
        case premium = "Premium"

        var filterValue: String? {
            self == .all ? nil : self.rawValue.lowercased()
        }
    }

    enum SortOption: String, CaseIterable {
        case name = "Name"
        case members = "Members"

        var sortValue: String {
            self == .name ? "name" : "members"
        }
    }

    var body: some View {
        ZStack {
            NexusColors.background.ignoresSafeArea()

            VStack(spacing: 0) {
                // Header
                VStack(spacing: NexusSpacing.md) {
                    Text("Your Servers")
                        .font(NexusFont.title(28))
                        .foregroundStyle(NexusColors.textPrimary)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.horizontal, NexusSpacing.lg)

                    // Search Bar
                    HStack(spacing: NexusSpacing.sm) {
                        Image(systemName: "magnifyingglass")
                            .foregroundStyle(NexusColors.textSecondary)

                        TextField("Search servers...", text: $searchQuery)
                            .font(NexusFont.body(16))
                            .foregroundStyle(NexusColors.textPrimary)
                            .onChange(of: searchQuery) {
                                currentPage = 1
                                loadServers()
                            }

                        if !searchQuery.isEmpty {
                            Button(action: {
                                searchQuery = ""
                            }) {
                                Image(systemName: "xmark.circle.fill")
                                    .foregroundStyle(NexusColors.textSecondary)
                            }
                        }
                    }
                    .padding(NexusSpacing.sm)
                    .background(NexusColors.cardBackground)
                    .cornerRadius(NexusRadius.md)
                    .padding(.horizontal, NexusSpacing.lg)
                }
                .padding(.vertical, NexusSpacing.lg)
                .background(NexusColors.background)

                // Tier Filter Pills
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: NexusSpacing.sm) {
                        ForEach(ServerTierFilter.allCases, id: \.self) { tier in
                            Button(action: {
                                selectedTier = tier
                                currentPage = 1
                                loadServers()
                            }) {
                                Text(tier.rawValue)
                                    .font(NexusFont.body(14))
                                    .foregroundStyle(selectedTier == tier ? NexusColors.background : NexusColors.textSecondary)
                                    .padding(.horizontal, NexusSpacing.md)
                                    .padding(.vertical, NexusSpacing.xs)
                                    .background(selectedTier == tier ? NexusColors.cyan : NexusColors.cardBackground)
                                    .cornerRadius(NexusRadius.sm)
                            }
                        }
                        Spacer()
                    }
                    .padding(.horizontal, NexusSpacing.lg)
                }
                .padding(.vertical, NexusSpacing.sm)

                // Sort Options
                HStack(spacing: NexusSpacing.md) {
                    Text("Sort:")
                        .font(NexusFont.body(14))
                        .foregroundStyle(NexusColors.textSecondary)
                        .padding(.leading, NexusSpacing.lg)

                    Picker("Sort", selection: $sortBy) {
                        ForEach(SortOption.allCases, id: \.self) { option in
                            Text(option.rawValue).tag(option)
                        }
                    }
                    .pickerStyle(.segmented)
                    .onChange(of: sortBy) {
                        currentPage = 1
                        loadServers()
                    }

                    Spacer()
                }
                .padding(.horizontal, NexusSpacing.lg)
                .padding(.vertical, NexusSpacing.sm)

                Divider()
                    .background(NexusColors.border)

                // Content
                if isLoading && servers.isEmpty {
                    ScrollView {
                        VStack(spacing: NexusSpacing.md) {
                            ForEach(0..<3, id: \.self) { _ in
                                SkeletonView()
                                    .frame(height: 80)
                                    .padding(.horizontal, NexusSpacing.lg)
                            }
                        }
                        .padding(.vertical, NexusSpacing.lg)
                    }
                } else if let error = error {
                    ScrollView {
                        EmptyStateView(
                            icon: "exclamationmark.circle",
                            title: "Error Loading Servers",
                            message: error
                        )
                        .frame(maxWidth: .infinity, alignment: .top)
                        .padding(.vertical, NexusSpacing.lg)
                    }
                } else if servers.isEmpty {
                    ScrollView {
                        EmptyStateView(
                            icon: "server.rack",
                            title: "No Servers Found",
                            message: "You don't manage any servers yet."
                        )
                        .frame(maxWidth: .infinity, alignment: .top)
                        .padding(.vertical, NexusSpacing.lg)
                    }
                } else {
                    ScrollView(showsIndicators: false) {
                        VStack(spacing: NexusSpacing.sm) {
                            ForEach(servers, id: \.id) { server in
                                NavigationLink(destination: OwnerServerDetailView(guildId: server.id)) {
                                    ServerListItemView(server: server)
                                }
                            }

                            // Pagination Controls
                            if let pagination = pagination, pagination.totalPages > 1 {
                                HStack(spacing: NexusSpacing.md) {
                                    Button(action: {
                                        if currentPage > 1 {
                                            currentPage -= 1
                                            loadServers()
                                        }
                                    }) {
                                        HStack(spacing: NexusSpacing.xs) {
                                            Image(systemName: "chevron.left")
                                            Text("Previous")
                                        }
                                        .font(NexusFont.body(14))
                                        .foregroundStyle(currentPage <= 1 ? NexusColors.textMuted : NexusColors.textPrimary)
                                    }
                                    .disabled(currentPage <= 1)

                                    Spacer()

                                    Text("Page \(currentPage) of \(pagination.totalPages)")
                                        .font(NexusFont.body(14))
                                        .foregroundStyle(NexusColors.textSecondary)

                                    Spacer()

                                    Button(action: {
                                        if currentPage < pagination.totalPages {
                                            currentPage += 1
                                            loadServers()
                                        }
                                    }) {
                                        HStack(spacing: NexusSpacing.xs) {
                                            Text("Next")
                                            Image(systemName: "chevron.right")
                                        }
                                        .font(NexusFont.body(14))
                                        .foregroundStyle(currentPage >= pagination.totalPages ? NexusColors.textMuted : NexusColors.textPrimary)
                                    }
                                    .disabled(currentPage >= pagination.totalPages)
                                }
                                .padding(.horizontal, NexusSpacing.lg)
                                .padding(.vertical, NexusSpacing.md)
                            }
                        }
                        .padding(.vertical, NexusSpacing.lg)
                    }
                    .refreshable {
                        isRefreshing = true
                        await refreshServers()
                        isRefreshing = false
                    }
                }
            }
        }
        .onAppear {
            loadServers()
        }
    }

    private func loadServers() {
        isLoading = true
        error = nil

        Task {
            do {
                let response = try await APIClient.shared.fetchOwnerServerSearch(
                    query: searchQuery,
                    tier: selectedTier.filterValue ?? "",
                    status: "",
                    sort: sortBy.sortValue,
                    order: "asc",
                    page: currentPage
                )

                await MainActor.run {
                    self.servers = response.servers
                    self.pagination = response.pagination
                    self.isLoading = false
                }
            } catch {
                await MainActor.run {
                    self.error = error.localizedDescription
                    self.isLoading = false
                }
            }
        }
    }

    private func refreshServers() async {
        currentPage = 1
        loadServers()
    }
}

// MARK: - Server List Item View
struct ServerListItemView: View {
    let server: Guild

    var body: some View {
        NexusCard {
            HStack(spacing: NexusSpacing.md) {
                // Server Icon
                ZStack {
                    Circle()
                        .fill(NexusColors.cardBackground)

                    if let iconURL = server.iconURL {
                        AsyncImage(url: iconURL) { phase in
                            switch phase {
                            case .success(let image):
                                image
                                    .resizable()
                                    .scaledToFit()
                            case .empty:
                                ProgressView()
                                    .tint(NexusColors.cyan)
                            default:
                                Text(server.initial)
                                    .font(NexusFont.heading(16))
                                    .foregroundStyle(NexusColors.cyan)
                            }
                        }
                    } else {
                        Text(server.initial)
                            .font(NexusFont.heading(16))
                            .foregroundStyle(NexusColors.cyan)
                    }
                }
                .frame(width: 48, height: 48)
                .clipShape(Circle())

                // Server Info
                VStack(alignment: .leading, spacing: NexusSpacing.xs) {
                    HStack(spacing: NexusSpacing.sm) {
                        Text(server.name)
                            .font(NexusFont.heading(16))
                            .foregroundStyle(NexusColors.textPrimary)
                            .lineLimit(1)

                        if let tier = server.premiumTier, !tier.isEmpty {
                            NexusBadge(
                                text: tier.uppercased(),
                                backgroundColor: tier.lowercased() == "premium" ? Color(hex: "FFD700") : NexusColors.purple,
                                textColor: tier.lowercased() == "premium" ? .black : NexusColors.textPrimary
                            )
                        }
                    }

                    HStack(spacing: NexusSpacing.md) {
                        VStack(alignment: .leading, spacing: NexusSpacing.xs) {
                            Text("ID")
                                .font(NexusFont.caption(12))
                                .foregroundStyle(NexusColors.textMuted)

                            Text(server.id)
                                .font(NexusFont.mono(12))
                                .foregroundStyle(NexusColors.textSecondary)
                                .lineLimit(1)
                        }

                        Divider()
                            .background(NexusColors.border)

                        if let memberCount = server.memberCount {
                            VStack(alignment: .leading, spacing: NexusSpacing.xs) {
                                Text("Members")
                                    .font(NexusFont.caption(12))
                                    .foregroundStyle(NexusColors.textMuted)

                                HStack(spacing: NexusSpacing.xs) {
                                    Image(systemName: "person.fill")
                                        .font(.system(size: 12))
                                    Text("\(memberCount)")
                                        .font(NexusFont.body(14))
                                }
                                .foregroundStyle(NexusColors.textSecondary)
                            }
                        }

                        Spacer()
                    }
                }

                Image(systemName: "chevron.right")
                    .foregroundStyle(NexusColors.textSecondary)
                    .font(.system(size: 14, weight: .semibold))
            }
            .padding(NexusSpacing.md)
        }
        .padding(.horizontal, NexusSpacing.lg)
    }
}

// MARK: - Owner Server Detail View
struct OwnerServerDetailView: View {
    let guildId: String
    @Environment(\.presentationMode) var presentationMode

    @State private var server: Guild?
    @State private var moduleStats: ModuleStatsInfo?
    @State private var usageStats: UsageStatsInfo?
    @State private var subscription: SubscriptionInfo?
    @State private var isLoading: Bool = true
    @State private var error: String?
    @State private var showLeaveConfirmation: Bool = false
    @State private var showResetConfirmation: Bool = false

    var body: some View {
        ZStack {
            NexusColors.background.ignoresSafeArea()

            VStack(spacing: 0) {
                // Header
                HStack {
                    Button(action: {
                        presentationMode.wrappedValue.dismiss()
                    }) {
                        HStack(spacing: NexusSpacing.xs) {
                            Image(systemName: "chevron.left")
                            Text("Back")
                        }
                        .font(NexusFont.body(16))
                        .foregroundStyle(NexusColors.cyan)
                    }

                    Spacer()

                    Text("Server Details")
                        .font(NexusFont.title(20))
                        .foregroundStyle(NexusColors.textPrimary)

                    Spacer()

                    Color.clear.frame(width: 44, height: 44)
                }
                .padding(NexusSpacing.lg)
                .background(NexusColors.background)

                Divider()
                    .background(NexusColors.border)

                // Content
                if isLoading {
                    ScrollView {
                        VStack(spacing: NexusSpacing.md) {
                            ForEach(0..<4, id: \.self) { _ in
                                SkeletonView()
                                    .frame(height: 100)
                                    .padding(.horizontal, NexusSpacing.lg)
                            }
                        }
                        .padding(.vertical, NexusSpacing.lg)
                    }
                } else if let error = error {
                    ScrollView {
                        EmptyStateView(
                            icon: "exclamationmark.circle",
                            title: "Error Loading Server",
                            message: error
                        )
                        .frame(maxWidth: .infinity, alignment: .top)
                        .padding(.vertical, NexusSpacing.lg)
                    }
                } else if let server = server {
                    ScrollView(showsIndicators: false) {
                        VStack(spacing: NexusSpacing.lg) {
                            // Server Header Card
                            NexusCard {
                                VStack(alignment: .leading, spacing: NexusSpacing.md) {
                                    HStack(spacing: NexusSpacing.md) {
                                        // Server Icon
                                        ZStack {
                                            Circle()
                                                .fill(NexusColors.cardBackground)

                                            if let iconURL = server.iconURL {
                                                AsyncImage(url: iconURL) { phase in
                                                    switch phase {
                                                    case .success(let image):
                                                        image
                                                            .resizable()
                                                            .scaledToFit()
                                                    case .empty:
                                                        ProgressView()
                                                            .tint(NexusColors.cyan)
                                                    default:
                                                        Text(server.initial)
                                                            .font(NexusFont.heading(20))
                                                            .foregroundStyle(NexusColors.cyan)
                                                    }
                                                }
                                            } else {
                                                Text(server.initial)
                                                    .font(NexusFont.heading(20))
                                                    .foregroundStyle(NexusColors.cyan)
                                            }
                                        }
                                        .frame(width: 64, height: 64)
                                        .clipShape(Circle())

                                        VStack(alignment: .leading, spacing: NexusSpacing.xs) {
                                            HStack(spacing: NexusSpacing.sm) {
                                                Text(server.name)
                                                    .font(NexusFont.heading(18))
                                                    .foregroundStyle(NexusColors.textPrimary)

                                                if let tier = server.premiumTier, !tier.isEmpty {
                                                    NexusBadge(
                                                        text: tier.uppercased(),
                                                        backgroundColor: tier.lowercased() == "premium" ? Color(hex: "FFD700") : NexusColors.purple,
                                                        textColor: tier.lowercased() == "premium" ? .black : NexusColors.textPrimary
                                                    )
                                                }
                                            }

                                            Text(server.id)
                                                .font(NexusFont.mono(12))
                                                .foregroundStyle(NexusColors.textSecondary)
                                        }

                                        Spacer()
                                    }

                                    Divider()
                                        .background(NexusColors.border)

                                    if let memberCount = server.memberCount {
                                        HStack(spacing: NexusSpacing.md) {
                                            StatCard(
                                                title: "Members",
                                                value: "\(memberCount)",
                                                icon: "person.fill"
                                            )

                                            Spacer()
                                        }
                                    }
                                }
                                .padding(NexusSpacing.md)
                            }
                            .padding(.horizontal, NexusSpacing.lg)

                            // Module Stats Section
                            if let moduleStats = moduleStats {
                                VStack(alignment: .leading, spacing: NexusSpacing.md) {
                                    NexusSectionHeader(title: "Module Stats")
                                        .padding(.horizontal, NexusSpacing.lg)

                                    NexusCard {
                                        HStack(spacing: NexusSpacing.lg) {
                                            StatCard(
                                                title: "Enabled Modules",
                                                value: "\(moduleStats.enabledCount)",
                                                icon: "cube.fill"
                                            )

                                            Spacer()
                                        }
                                        .padding(NexusSpacing.md)
                                    }
                                    .padding(.horizontal, NexusSpacing.lg)
                                }
                            }

                            // Usage Stats Section
                            if let usageStats = usageStats {
                                VStack(alignment: .leading, spacing: NexusSpacing.md) {
                                    NexusSectionHeader(title: "30-Day Usage")
                                        .padding(.horizontal, NexusSpacing.lg)

                                    NexusCard {
                                        VStack(spacing: NexusSpacing.md) {
                                            HStack(spacing: NexusSpacing.lg) {
                                                StatCard(
                                                    title: "Commands",
                                                    value: "\(usageStats.commands30d)",
                                                    icon: "command"
                                                )

                                                Spacer()
                                            }

                                            Divider()
                                                .background(NexusColors.border)

                                            HStack(spacing: NexusSpacing.lg) {
                                                StatCard(
                                                    title: "Unique Users",
                                                    value: "\(usageStats.uniqueUsers30d)",
                                                    icon: "person.2.fill"
                                                )

                                                Spacer()
                                            }
                                        }
                                        .padding(NexusSpacing.md)
                                    }
                                    .padding(.horizontal, NexusSpacing.lg)
                                }
                            }

                            // Subscription Info Section
                            if let subscription = subscription {
                                VStack(alignment: .leading, spacing: NexusSpacing.md) {
                                    NexusSectionHeader(title: "Subscription")
                                        .padding(.horizontal, NexusSpacing.lg)

                                    NexusCard {
                                        VStack(alignment: .leading, spacing: NexusSpacing.sm) {
                                            HStack {
                                                Text("Status")
                                                    .font(NexusFont.body(14))
                                                    .foregroundStyle(NexusColors.textSecondary)

                                                Spacer()

                                                NexusBadge(
                                                    text: subscription.isActive ? "ACTIVE" : "INACTIVE",
                                                    backgroundColor: subscription.isActive ? NexusColors.success : NexusColors.error,
                                                    textColor: .white
                                                )
                                            }

                                            if let expiresAt = subscription.expiresAt {
                                                Divider()
                                                    .background(NexusColors.border)

                                                HStack {
                                                    Text("Expires")
                                                        .font(NexusFont.body(14))
                                                        .foregroundStyle(NexusColors.textSecondary)

                                                    Spacer()

                                                    Text(expiresAt)
                                                        .font(NexusFont.body(14))
                                                        .foregroundStyle(NexusColors.textPrimary)
                                                }
                                            }
                                        }
                                        .padding(NexusSpacing.md)
                                    }
                                    .padding(.horizontal, NexusSpacing.lg)
                                }
                            }

                            // Action Buttons
                            VStack(spacing: NexusSpacing.sm) {
                                NexusSectionHeader(title: "Actions")
                                    .padding(.horizontal, NexusSpacing.lg)

                                Button(action: {
                                    showResetConfirmation = true
                                }) {
                                    HStack(spacing: NexusSpacing.sm) {
                                        Image(systemName: "arrow.clockwise")
                                        Text("Reset Configuration")
                                    }
                                    .frame(maxWidth: .infinity)
                                    .padding(NexusSpacing.md)
                                    .font(NexusFont.body(16))
                                    .foregroundStyle(NexusColors.textPrimary)
                                    .background(NexusColors.cardBackground)
                                    .cornerRadius(NexusRadius.md)
                                    .overlay(
                                        RoundedRectangle(cornerRadius: NexusRadius.md)
                                            .stroke(NexusColors.border, lineWidth: 1)
                                    )
                                }
                                .padding(.horizontal, NexusSpacing.lg)

                                Button(action: {
                                    showLeaveConfirmation = true
                                }) {
                                    HStack(spacing: NexusSpacing.sm) {
                                        Image(systemName: "xmark")
                                        Text("Leave Server")
                                    }
                                    .frame(maxWidth: .infinity)
                                    .padding(NexusSpacing.md)
                                    .font(NexusFont.body(16))
                                    .foregroundStyle(.white)
                                    .background(NexusColors.error)
                                    .cornerRadius(NexusRadius.md)
                                }
                                .padding(.horizontal, NexusSpacing.lg)
                            }

                            Spacer()
                                .frame(height: NexusSpacing.lg)
                        }
                        .padding(.vertical, NexusSpacing.lg)
                    }
                } else {
                    ScrollView {
                        EmptyStateView(
                            icon: "server.rack",
                            title: "No Server Found",
                            message: "Could not load server details."
                        )
                        .frame(maxWidth: .infinity, alignment: .top)
                        .padding(.vertical, NexusSpacing.lg)
                    }
                }
            }
        }
        .alert("Leave Server", isPresented: $showLeaveConfirmation) {
            Button("Cancel", role: .cancel) { }
            Button("Leave", role: .destructive) {
                leaveServer()
            }
        } message: {
            Text("Are you sure you want to leave this server? This action cannot be undone.")
        }
        .alert("Reset Configuration", isPresented: $showResetConfirmation) {
            Button("Cancel", role: .cancel) { }
            Button("Reset", role: .destructive) {
                resetConfiguration()
            }
        } message: {
            Text("Are you sure you want to reset the server configuration? All settings will be reverted to defaults.")
        }
        .onAppear {
            loadServerDetail()
        }
        .navigationBarBackButtonHidden(true)
    }

    private func loadServerDetail() {
        isLoading = true
        error = nil

        Task {
            do {
                let response = try await APIClient.shared.fetchOwnerServerDetail(guildId)

                await MainActor.run {
                    self.server = response.server
                    self.moduleStats = response.moduleStats
                    self.usageStats = response.usageStats
                    self.subscription = response.subscription
                    self.isLoading = false
                }
            } catch {
                await MainActor.run {
                    self.error = error.localizedDescription
                    self.isLoading = false
                }
            }
        }
    }

    private func leaveServer() {
        Task {
            do {
                try await APIClient.shared.leaveServer(guildId)
                await MainActor.run {
                    presentationMode.wrappedValue.dismiss()
                }
            } catch {
                await MainActor.run {
                    self.error = "Failed to leave server: \(error.localizedDescription)"
                }
            }
        }
    }

    private func resetConfiguration() {
        Task {
            do {
                try await APIClient.shared.resetServerConfig(guildId)
                await MainActor.run {
                    error = nil
                }
                loadServerDetail()
            } catch {
                await MainActor.run {
                    self.error = "Failed to reset configuration: \(error.localizedDescription)"
                }
            }
        }
    }
}

// MARK: - Extensions for Server List
extension SubscriptionInfo {
    /// Compatibility: check if subscription is active
    var isActive: Bool {
        status == "active"
    }
}

extension PaginationInfo {
    /// Compatibility aliases
    var currentPage: Int { page }
    var pageSize: Int { limit }
    var totalCount: Int { total }
}

// MARK: - Preview
#Preview {
    NavigationView {
        OwnerServersView()
    }
}
