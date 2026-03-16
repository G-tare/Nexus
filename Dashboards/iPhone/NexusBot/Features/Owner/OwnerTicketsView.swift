import SwiftUI
import PhotosUI

struct OwnerTicketsView: View {
    @State private var allTickets: [BotTicket] = []  // All fetched tickets (for local filtering)
    @State private var selectedTicket: BotTicket?
    @State private var messages: [BotTicketMessage] = []
    @State private var stats: TicketStats?
    @State private var bannedUsers: [TicketBan] = []

    // Filters and search
    @State private var statusFilter: String = "all"
    @State private var searchText: String = ""
    @State private var currentPage = 1
    @State private var totalPages = 1

    // Loading and error states
    @State private var isInitialLoading = true  // Only true on first load
    @State private var isRefreshing = false       // Background refresh (no spinner)
    @State private var isLoadingDetails = false
    @State private var errorMessage: String?

    // Banned users inline tab
    @State private var showBannedTab = false

    // Reply functionality
    @State private var replyText: String = ""
    @State private var isReplying = false
    @State private var selectedPhotoItem: PhotosPickerItem?
    @State private var attachmentData: Data?
    @State private var attachmentName: String?

    // Close reason modal
    @State private var showCloseReason = false
    @State private var closeReason: String = ""

    let statusOptions = ["all", "open", "claimed", "closed"]

    /// Locally filtered tickets based on current status filter
    var filteredTickets: [BotTicket] {
        if statusFilter == "all" {
            return allTickets
        }
        return allTickets.filter { $0.status.lowercased() == statusFilter }
    }

    var body: some View {
        ZStack {
            NexusColors.background.ignoresSafeArea()

            if isInitialLoading {
                ScrollView {
                    VStack(spacing: NexusSpacing.lg) {
                        ProgressView()
                            .tint(NexusColors.cyan)
                        Text("Loading tickets...")
                            .font(NexusFont.body(14))
                            .foregroundStyle(NexusColors.textSecondary)
                    }
                    .frame(maxWidth: .infinity, alignment: .top)
                    .padding(.vertical, NexusSpacing.xl)
                }
            } else {
                VStack(spacing: 0) {
                    // Header with stats — 3-column grid (no horizontal scroll)
                    HStack(spacing: NexusSpacing.sm) {
                        StatCard(
                            title: "Open",
                            value: "\(stats?.openCount ?? 0)",
                            icon: "checkmark.circle",
                            accentColor: NexusColors.success
                        )

                        StatCard(
                            title: "Claimed",
                            value: "\(stats?.claimedCount ?? 0)",
                            icon: "person.fill",
                            accentColor: NexusColors.warning
                        )

                        StatCard(
                            title: "Closed",
                            value: "\(stats?.closedCount ?? 0)",
                            icon: "xmark.circle.fill",
                            accentColor: NexusColors.textMuted
                        )
                    }
                    .padding(.horizontal, NexusSpacing.lg)
                    .padding(.top, NexusSpacing.lg)
                    .padding(.bottom, NexusSpacing.md)

                    // Filters and search
                    VStack(spacing: NexusSpacing.md) {
                        // Search bar
                        HStack(spacing: NexusSpacing.sm) {
                            Image(systemName: "magnifyingglass")
                                .foregroundStyle(NexusColors.textMuted)
                            TextField("Search tickets...", text: $searchText)
                                .font(NexusFont.body(14))
                                .foregroundStyle(NexusColors.textPrimary)
                                .onChange(of: searchText) { _, _ in
                                    currentPage = 1
                                    Task { await fetchTicketsBackground() }
                                }
                        }
                        .padding(NexusSpacing.md)
                        .background(NexusColors.cardBackground)
                        .clipShape(RoundedRectangle(cornerRadius: NexusRadius.md))

                        // Status filter + Banned Users tab (all inline)
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: NexusSpacing.sm) {
                                ForEach(statusOptions, id: \.self) { status in
                                    Button(action: {
                                        showBannedTab = false
                                        statusFilter = status
                                        // No API reload — filter locally
                                    }) {
                                        Text(status.capitalized)
                                            .font(NexusFont.caption(12))
                                            .fontWeight(.semibold)
                                            .foregroundStyle(
                                                !showBannedTab && statusFilter == status
                                                    ? NexusColors.background
                                                    : NexusColors.textSecondary
                                            )
                                            .padding(.horizontal, NexusSpacing.md)
                                            .padding(.vertical, NexusSpacing.sm)
                                            .background(
                                                !showBannedTab && statusFilter == status
                                                    ? NexusColors.cyan
                                                    : NexusColors.cardBackground
                                            )
                                            .clipShape(RoundedRectangle(cornerRadius: NexusRadius.sm))
                                    }
                                }

                                // Banned Users as an inline filter tab
                                Button(action: {
                                    showBannedTab.toggle()
                                    if showBannedTab {
                                        Task { await loadBannedUsers() }
                                    }
                                }) {
                                    HStack(spacing: NexusSpacing.xs) {
                                        Image(systemName: "xmark.shield")
                                            .font(.system(size: 12, weight: .semibold))
                                        Text("Bans")
                                            .font(NexusFont.caption(12))
                                            .fontWeight(.semibold)
                                    }
                                    .foregroundStyle(
                                        showBannedTab ? NexusColors.background : NexusColors.error
                                    )
                                    .padding(.horizontal, NexusSpacing.md)
                                    .padding(.vertical, NexusSpacing.sm)
                                    .background(
                                        showBannedTab
                                            ? NexusColors.error
                                            : NexusColors.error.opacity(0.15)
                                    )
                                    .clipShape(RoundedRectangle(cornerRadius: NexusRadius.sm))
                                }
                            }
                        }
                    }
                    .padding(.horizontal, NexusSpacing.lg)
                    .padding(.bottom, NexusSpacing.md)

                    Divider()
                        .background(NexusColors.border)

                    // Content area
                    if selectedTicket != nil {
                        ticketDetail
                    } else if showBannedTab {
                        bannedUsersInlineView
                    } else {
                        ticketsList
                    }
                }
            }
        }
        .navigationTitle("Tickets")
        .navigationBarTitleDisplayMode(.inline)
        .sheet(isPresented: $showCloseReason) {
            closeReasonSheet
        }
        .task { await loadData() }
    }

    // MARK: - Tickets List

    private var ticketsList: some View {
        VStack {
            if filteredTickets.isEmpty {
                ScrollView {
                    EmptyStateView(
                        icon: "envelope.open",
                        title: "No Tickets",
                        message: searchText.isEmpty ? "No \(statusFilter == "all" ? "" : statusFilter + " ")tickets found." : "No tickets match your search."
                    )
                    .frame(maxWidth: .infinity, alignment: .top)
                    .padding(.vertical, NexusSpacing.lg)
                }
            } else {
                ScrollView {
                    LazyVStack(spacing: NexusSpacing.sm) {
                        ForEach(filteredTickets) { ticket in
                            ticketRow(ticket)
                                .onTapGesture { selectTicket(ticket) }
                        }

                        // Pagination
                        if totalPages > 1 {
                            HStack(spacing: NexusSpacing.md) {
                                if currentPage > 1 {
                                    Button(action: { previousPage() }) {
                                        Label("Previous", systemImage: "chevron.left")
                                            .font(NexusFont.caption(12))
                                            .foregroundStyle(NexusColors.cyan)
                                    }
                                }

                                Spacer()

                                Text("Page \(currentPage) of \(totalPages)")
                                    .font(NexusFont.caption(12))
                                    .foregroundStyle(NexusColors.textSecondary)

                                Spacer()

                                if currentPage < totalPages {
                                    Button(action: { nextPage() }) {
                                        Label("Next", systemImage: "chevron.right")
                                            .font(NexusFont.caption(12))
                                            .foregroundStyle(NexusColors.cyan)
                                    }
                                }
                            }
                            .padding(NexusSpacing.md)
                        }
                    }
                    .padding(NexusSpacing.lg)
                }
            }
        }
    }

    private func ticketRow(_ ticket: BotTicket) -> some View {
        VStack(alignment: .leading, spacing: NexusSpacing.sm) {
            HStack(spacing: NexusSpacing.md) {
                // Status badge
                Image(systemName: ticket.statusIcon)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(ticket.statusColor)
                    .frame(width: 32, height: 32)
                    .background(ticket.statusColor.opacity(0.15))
                    .clipShape(Circle())

                // Ticket info
                VStack(alignment: .leading, spacing: NexusSpacing.xs) {
                    HStack(spacing: NexusSpacing.sm) {
                        Text(ticket.subject)
                            .font(NexusFont.body(14))
                            .foregroundStyle(NexusColors.textPrimary)
                            .lineLimit(1)

                        if let unreadCount = ticket.unreadCount, unreadCount > 0 {
                            NexusBadge(text: "\(unreadCount)", color: NexusColors.cyan)
                        }

                        Spacer()
                    }

                    HStack(spacing: NexusSpacing.sm) {
                        Image(systemName: ticket.categoryIcon)
                            .font(.system(size: 10))
                            .foregroundStyle(NexusColors.textSecondary)

                        Text(ticket.category.capitalized)
                            .font(NexusFont.caption(11))
                            .foregroundStyle(NexusColors.textSecondary)

                        Divider()
                            .frame(height: 10)

                        Text("@\(ticket.username)")
                            .font(NexusFont.caption(11))
                            .foregroundStyle(NexusColors.textMuted)
                            .lineLimit(1)

                        Spacer()

                        if let date = ticket.createdDate {
                            Text(date, style: .relative)
                                .font(NexusFont.caption(10))
                                .foregroundStyle(NexusColors.textMuted)
                        }
                    }
                }

                Image(systemName: "chevron.right")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(NexusColors.textMuted)
            }
        }
        .padding(NexusSpacing.md)
        .background(NexusColors.cardBackground)
        .clipShape(RoundedRectangle(cornerRadius: NexusRadius.md))
    }

    // MARK: - Ticket Detail (DM Style)

    private var ticketDetail: some View {
        guard let ticket = selectedTicket else { return AnyView(EmptyView()) }

        return AnyView(
            VStack(spacing: 0) {
                // Ticket header
                HStack(spacing: NexusSpacing.md) {
                    Button(action: { selectedTicket = nil }) {
                        Image(systemName: "chevron.left")
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundStyle(NexusColors.cyan)
                    }

                    VStack(alignment: .leading, spacing: NexusSpacing.xs) {
                        Text(ticket.subject)
                            .font(NexusFont.body(14))
                            .foregroundStyle(NexusColors.textPrimary)
                            .lineLimit(1)

                        HStack(spacing: NexusSpacing.sm) {
                            NexusBadge(text: ticket.status.uppercased(), color: ticket.statusColor)
                            NexusBadge(text: ticket.category.uppercased(), color: NexusColors.purple)
                            Text("@\(ticket.username)")
                                .font(NexusFont.caption(11))
                                .foregroundStyle(NexusColors.textMuted)
                        }
                    }

                    Spacer()

                    // Quick actions in header
                    if ticket.status == "open" {
                        Button(action: { claimTicket(ticket) }) {
                            Image(systemName: "person.fill.badge.plus")
                                .font(.system(size: 16))
                                .foregroundStyle(NexusColors.cyan)
                        }
                    }

                    if ticket.status != "closed" {
                        Button(action: { showCloseReason = true }) {
                            Image(systemName: "xmark.circle")
                                .font(.system(size: 16))
                                .foregroundStyle(NexusColors.error)
                        }
                    } else {
                        Button(action: { reopenTicket(ticket) }) {
                            Image(systemName: "arrow.uturn.backward")
                                .font(.system(size: 16))
                                .foregroundStyle(NexusColors.warning)
                        }
                    }
                }
                .padding(.horizontal, NexusSpacing.lg)
                .padding(.vertical, NexusSpacing.md)
                .background(NexusColors.cardBackground)

                Divider().background(NexusColors.border)

                // Messages list — DM style
                if isLoadingDetails {
                    ScrollView {
                        VStack(spacing: NexusSpacing.lg) {
                            ProgressView()
                                .tint(NexusColors.cyan)
                            Text("Loading messages...")
                                .font(NexusFont.body(14))
                                .foregroundStyle(NexusColors.textSecondary)
                        }
                        .frame(maxWidth: .infinity, alignment: .top)
                        .padding(.vertical, NexusSpacing.xl)
                    }
                } else if messages.isEmpty {
                    ScrollView {
                        EmptyStateView(
                            icon: "bubble.left.and.bubble.right",
                            title: "No Messages",
                            message: "No messages yet."
                        )
                        .frame(maxWidth: .infinity, alignment: .top)
                        .padding(.vertical, NexusSpacing.lg)
                    }
                } else {
                    ScrollViewReader { proxy in
                        ScrollView {
                            LazyVStack(spacing: NexusSpacing.sm) {
                                ForEach(messages) { msg in
                                    messageBubble(msg)
                                        .id(msg.id)
                                }
                            }
                            .padding(.horizontal, NexusSpacing.lg)
                            .padding(.vertical, NexusSpacing.md)
                        }
                        .onAppear {
                            if let lastMsg = messages.last {
                                proxy.scrollTo(lastMsg.id, anchor: .bottom)
                            }
                        }
                    }
                }

                Divider().background(NexusColors.border)

                // Reply input — compact, at bottom
                HStack(spacing: NexusSpacing.sm) {
                    TextField("Reply...", text: $replyText, axis: .vertical)
                        .font(NexusFont.body(14))
                        .foregroundStyle(NexusColors.textPrimary)
                        .lineLimit(1...4)

                    PhotosPicker(
                        selection: $selectedPhotoItem,
                        matching: .images,
                        photoLibrary: .shared()
                    ) {
                        Image(systemName: "paperclip")
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundStyle(NexusColors.textMuted)
                    }
                    .onChange(of: selectedPhotoItem) { _, newValue in
                        Task {
                            if let data = try? await newValue?.loadTransferable(type: Data.self) {
                                attachmentData = data
                                attachmentName = "attachment.jpg"
                            }
                        }
                    }

                    Button(action: { sendReply(ticket) }) {
                        Image(systemName: "paperplane.fill")
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundStyle(
                                replyText.trimmingCharacters(in: .whitespaces).isEmpty && attachmentData == nil
                                    ? NexusColors.textMuted
                                    : NexusColors.cyan
                            )
                    }
                    .disabled(
                        replyText.trimmingCharacters(in: .whitespaces).isEmpty && attachmentData == nil
                    )
                }
                .padding(NexusSpacing.md)
                .background(NexusColors.cardBackground)
            }
        )
    }

    /// DM-style message bubble — user messages left-aligned, staff messages right-aligned
    private func messageBubble(_ message: BotTicketMessage) -> some View {
        HStack(alignment: .bottom, spacing: NexusSpacing.sm) {
            if message.isStaffMessage {
                Spacer(minLength: 60)
            }

            VStack(alignment: message.isStaffMessage ? .trailing : .leading, spacing: NexusSpacing.xs) {
                // Author name + badge
                HStack(spacing: NexusSpacing.xs) {
                    if message.isStaffMessage {
                        NexusBadge(text: "STAFF", color: NexusColors.cyan)
                    }
                    Text(message.authorName)
                        .font(NexusFont.caption(11))
                        .foregroundStyle(NexusColors.textMuted)
                }

                // Message bubble
                VStack(alignment: .leading, spacing: NexusSpacing.sm) {
                    Text(message.message)
                        .font(NexusFont.body(14))
                        .foregroundStyle(NexusColors.textPrimary)
                        .textSelection(.enabled)

                    // Attachments
                    if let attachments = message.attachments, !attachments.isEmpty {
                        ForEach(attachments) { attachment in
                            if attachment.isImage {
                                AsyncImage(url: URL(string: attachment.url)) { image in
                                    image.resizable()
                                        .scaledToFit()
                                        .frame(maxWidth: 200)
                                        .clipShape(RoundedRectangle(cornerRadius: NexusRadius.sm))
                                } placeholder: {
                                    RoundedRectangle(cornerRadius: NexusRadius.sm)
                                        .fill(NexusColors.surfaceElevated)
                                        .frame(width: 150, height: 100)
                                }
                            } else {
                                HStack(spacing: NexusSpacing.sm) {
                                    Image(systemName: attachment.isPDF ? "doc.fill" : "paperclip")
                                        .font(.system(size: 12))
                                    Text(attachment.displayName)
                                        .font(NexusFont.caption(12))
                                        .lineLimit(1)
                                }
                                .padding(NexusSpacing.sm)
                                .background(NexusColors.surfaceElevated)
                                .clipShape(RoundedRectangle(cornerRadius: NexusRadius.sm))
                            }
                        }
                    }
                }
                .padding(NexusSpacing.md)
                .background(
                    message.isStaffMessage
                        ? NexusColors.cyan.opacity(0.12)
                        : NexusColors.cardBackground
                )
                .clipShape(RoundedRectangle(cornerRadius: NexusRadius.md))

                // Timestamp
                if let date = message.createdDate {
                    Text(date, style: .relative)
                        .font(NexusFont.caption(10))
                        .foregroundStyle(NexusColors.textMuted)
                }
            }

            if !message.isStaffMessage {
                Spacer(minLength: 60)
            }
        }
    }

    // MARK: - Banned Users Inline View

    private var bannedUsersInlineView: some View {
        VStack {
            if bannedUsers.isEmpty {
                ScrollView {
                    EmptyStateView(
                        icon: "checkmark.shield.fill",
                        title: "No Bans",
                        message: "No users are currently banned from tickets."
                    )
                    .frame(maxWidth: .infinity, alignment: .top)
                    .padding(.vertical, NexusSpacing.lg)
                }
            } else {
                ScrollView {
                    LazyVStack(spacing: NexusSpacing.sm) {
                        ForEach(bannedUsers) { ban in
                            bannedUserRow(ban)
                        }
                    }
                    .padding(NexusSpacing.lg)
                }
            }
        }
        .task { await loadBannedUsers() }
    }

    private func bannedUserRow(_ ban: TicketBan) -> some View {
        HStack(spacing: NexusSpacing.md) {
            VStack(alignment: .leading, spacing: NexusSpacing.xs) {
                Text(ban.username)
                    .font(NexusFont.body(14))
                    .foregroundStyle(NexusColors.textPrimary)

                Text(ban.reason)
                    .font(NexusFont.caption(12))
                    .foregroundStyle(NexusColors.textSecondary)
                    .lineLimit(2)

                if let date = ban.createdDate {
                    Text(date, style: .relative)
                        .font(NexusFont.caption(10))
                        .foregroundStyle(NexusColors.textMuted)
                }
            }

            Spacer()

            Button(action: { unbanUser(ban) }) {
                Image(systemName: "xmark.circle.fill")
                    .font(.system(size: 18))
                    .foregroundStyle(NexusColors.error)
            }
        }
        .padding(NexusSpacing.md)
        .background(NexusColors.cardBackground)
        .clipShape(RoundedRectangle(cornerRadius: NexusRadius.md))
    }

    // MARK: - Close Reason Sheet

    private var closeReasonSheet: some View {
        VStack(spacing: NexusSpacing.lg) {
            HStack {
                Text("Close Ticket")
                    .font(NexusFont.heading(18))
                    .foregroundStyle(NexusColors.textPrimary)
                Spacer()
                Button(action: { showCloseReason = false }) {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 16))
                        .foregroundStyle(NexusColors.textMuted)
                }
            }
            .padding(NexusSpacing.lg)

            VStack(alignment: .leading, spacing: NexusSpacing.sm) {
                Text("Reason (optional)")
                    .font(NexusFont.caption(12))
                    .foregroundStyle(NexusColors.textSecondary)

                TextEditor(text: $closeReason)
                    .font(NexusFont.body(14))
                    .foregroundStyle(NexusColors.textPrimary)
                    .padding(NexusSpacing.md)
                    .background(NexusColors.cardBackground)
                    .clipShape(RoundedRectangle(cornerRadius: NexusRadius.md))
                    .frame(height: 100)
            }
            .padding(NexusSpacing.lg)

            HStack(spacing: NexusSpacing.md) {
                Button(action: { showCloseReason = false }) {
                    Text("Cancel")
                        .font(NexusFont.caption(14))
                        .foregroundStyle(NexusColors.textPrimary)
                        .frame(maxWidth: .infinity)
                        .padding(NexusSpacing.md)
                        .background(NexusColors.cardBackground)
                        .clipShape(RoundedRectangle(cornerRadius: NexusRadius.md))
                }

                if let ticket = selectedTicket {
                    Button(action: { closeTicket(ticket) }) {
                        Text("Close")
                            .font(NexusFont.caption(14))
                            .fontWeight(.semibold)
                            .foregroundStyle(NexusColors.background)
                            .frame(maxWidth: .infinity)
                            .padding(NexusSpacing.md)
                            .background(NexusColors.error)
                            .clipShape(RoundedRectangle(cornerRadius: NexusRadius.md))
                    }
                }
            }
            .padding(NexusSpacing.lg)

            Spacer()
        }
        .background(NexusColors.background)
    }

    // MARK: - Actions

    private func selectTicket(_ ticket: BotTicket) {
        selectedTicket = ticket
        isLoadingDetails = true
        Task {
            await loadTicketDetail(ticket)
        }
    }

    private func nextPage() {
        if currentPage < totalPages {
            currentPage += 1
            Task { await fetchTicketsBackground() }
        }
    }

    private func previousPage() {
        if currentPage > 1 {
            currentPage -= 1
            Task { await fetchTicketsBackground() }
        }
    }

    private func claimTicket(_ ticket: BotTicket) {
        Task {
            do {
                try await APIClient.shared.claimTicket(ticket.id)
                selectedTicket?.status = "claimed"
                await fetchTicketsBackground()
            } catch {
                errorMessage = error.localizedDescription
            }
        }
    }

    private func closeTicket(_ ticket: BotTicket) {
        Task {
            do {
                try await APIClient.shared.closeTicket(ticket.id, reason: closeReason.isEmpty ? nil : closeReason)
                selectedTicket?.status = "closed"
                closeReason = ""
                showCloseReason = false
                await fetchTicketsBackground()
            } catch {
                errorMessage = error.localizedDescription
            }
        }
    }

    private func reopenTicket(_ ticket: BotTicket) {
        Task {
            do {
                try await APIClient.shared.reopenTicket(ticket.id)
                selectedTicket?.status = "open"
                await fetchTicketsBackground()
            } catch {
                errorMessage = error.localizedDescription
            }
        }
    }

    private func sendReply(_ ticket: BotTicket) {
        let message = replyText.trimmingCharacters(in: .whitespaces)
        guard !message.isEmpty || attachmentData != nil else { return }

        Task {
            isReplying = true
            do {
                try await APIClient.shared.replyToTicket(ticket.id, message: message)
                replyText = ""
                attachmentData = nil
                attachmentName = nil
                await loadTicketDetail(ticket)
            } catch {
                errorMessage = error.localizedDescription
            }
            isReplying = false
        }
    }

    private func showBanConfirm(_ ticket: BotTicket) {
        Task {
            do {
                try await APIClient.shared.banUserFromTickets(ticket.userId, reason: "Abusive ticket behavior")
                await loadBannedUsers()
            } catch {
                errorMessage = error.localizedDescription
            }
        }
    }

    private func unbanUser(_ ban: TicketBan) {
        Task {
            do {
                try await APIClient.shared.unbanUserFromTickets(ban.userId)
                await loadBannedUsers()
            } catch {
                errorMessage = error.localizedDescription
            }
        }
    }

    // MARK: - Data Loading

    /// Initial load — shows full-page spinner
    private func loadData() async {
        isInitialLoading = true

        async let ticketsTask = APIClient.shared.fetchTickets(
            search: searchText.isEmpty ? nil : searchText,
            page: currentPage,
            limit: 50  // Fetch more so we can filter locally
        )
        async let statsTask = APIClient.shared.fetchTicketStats()

        do {
            let ticketsResponse = try await ticketsTask
            allTickets = ticketsResponse.tickets
            totalPages = ticketsResponse.pagination.totalPages
            stats = try await statsTask
        } catch {
            errorMessage = error.localizedDescription
        }

        isInitialLoading = false
    }

    /// Background refresh — no spinner, just updates data
    private func fetchTicketsBackground() async {
        isRefreshing = true

        do {
            let ticketsResponse = try await APIClient.shared.fetchTickets(
                search: searchText.isEmpty ? nil : searchText,
                page: currentPage,
                limit: 50
            )
            allTickets = ticketsResponse.tickets
            totalPages = ticketsResponse.pagination.totalPages

            let newStats = try await APIClient.shared.fetchTicketStats()
            stats = newStats
        } catch {
            errorMessage = error.localizedDescription
        }

        isRefreshing = false
    }

    private func loadTicketDetail(_ ticket: BotTicket) async {
        defer { isLoadingDetails = false }

        do {
            let response = try await APIClient.shared.fetchTicket(ticket.id)
            messages = response.messages
            try await APIClient.shared.markTicketAsRead(ticket.id)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func loadBannedUsers() async {
        do {
            let response = try await APIClient.shared.fetchBannedUsers()
            bannedUsers = response.bans
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

#Preview {
    NavigationStack {
        OwnerTicketsView()
    }
}
