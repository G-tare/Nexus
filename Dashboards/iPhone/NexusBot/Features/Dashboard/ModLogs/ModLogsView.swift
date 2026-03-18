import SwiftUI

// MARK: - Log Mode

enum LogMode: String, CaseIterable {
    case manual = "Staff Actions"
    case automod = "Automod"
}

struct ModLogsView: View {
    let guildId: String

    @State private var logMode: LogMode = .manual

    // Manual mod logs state
    @State private var manualCases: [String?: [ModCase]] = [:]
    @State private var manualTotals: [String?: Int] = [:]
    @State private var manualFilter: String?
    @State private var manualLoading = true
    @State private var manualError: String?
    @State private var manualPage: [String?: Int] = [:]
    @State private var manualHasMore: [String?: Bool] = [:]

    // Automod logs state
    @State private var automodEntries: [String?: [AutomodLog]] = [:]
    @State private var automodTotals: [String?: Int] = [:]
    @State private var automodFilter: String?
    @State private var automodLoading = true
    @State private var automodError: String?
    @State private var automodPage: [String?: Int] = [:]
    @State private var automodHasMore: [String?: Bool] = [:]

    // Detail sheet
    @State private var selectedCase: ModCase?
    @State private var selectedAutomodLog: AutomodLog?

    // Load triggers
    @State private var manualLoadId = UUID()
    @State private var automodLoadId = UUID()

    private let manualFilters = ["warn", "mute", "kick", "ban", "tempban", "note"]
    private let automodFilters = ["delete", "warn", "mute", "kick", "ban"]

    var body: some View {
        ZStack {
            NexusColors.background.ignoresSafeArea()

            VStack(spacing: 0) {
                // Mode toggle
                modeToggle

                // Filter bar
                filterBar

                // Stats bar
                statsBar

                // Content
                if logMode == .manual {
                    manualContent
                } else {
                    automodContent
                }
            }
        }
        .sheet(item: $selectedCase) { modCase in
            ModCaseDetailView(modCase: modCase)
                .presentationDetents([.medium])
                .presentationDragIndicator(.visible)
        }
        .sheet(item: $selectedAutomodLog) { log in
            AutomodLogDetailView(log: log)
                .presentationDetents([.medium])
                .presentationDragIndicator(.visible)
        }
        .task(id: manualLoadId) {
            await loadManualCases(replacing: true)
        }
        .task(id: automodLoadId) {
            await loadAutomodLogs(replacing: true)
        }
    }

    // MARK: - Mode Toggle

    private var modeToggle: some View {
        HStack(spacing: 0) {
            ForEach(LogMode.allCases, id: \.self) { mode in
                Button {
                    withAnimation(.easeInOut(duration: 0.2)) {
                        logMode = mode
                    }
                } label: {
                    Text(mode.rawValue)
                        .font(NexusFont.caption(13))
                        .fontWeight(.semibold)
                        .foregroundStyle(logMode == mode ? NexusColors.background : NexusColors.textSecondary)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, NexusSpacing.sm + 2)
                        .background(logMode == mode ? NexusColors.cyan : Color.clear)
                        .clipShape(RoundedRectangle(cornerRadius: NexusRadius.md))
                }
            }
        }
        .padding(3)
        .background(NexusColors.cardBackground)
        .clipShape(RoundedRectangle(cornerRadius: NexusRadius.md + 2))
        .padding(.horizontal, NexusSpacing.lg)
        .padding(.top, NexusSpacing.md)
        .padding(.bottom, NexusSpacing.sm)
    }

    // MARK: - Filter Bar

    private var filterBar: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: NexusSpacing.sm) {
                if logMode == .manual {
                    filterChip(label: "All", filter: nil, isSelected: manualFilter == nil) {
                        switchManualFilter(nil)
                    }
                    ForEach(manualFilters, id: \.self) { action in
                        filterChip(label: action.capitalized, filter: action, isSelected: manualFilter == action) {
                            switchManualFilter(action)
                        }
                    }
                } else {
                    filterChip(label: "All", filter: nil, isSelected: automodFilter == nil) {
                        switchAutomodFilter(nil)
                    }
                    ForEach(automodFilters, id: \.self) { action in
                        filterChip(label: action.capitalized, filter: action, isSelected: automodFilter == action) {
                            switchAutomodFilter(action)
                        }
                    }
                }
            }
            .padding(.horizontal, NexusSpacing.lg)
            .padding(.vertical, NexusSpacing.sm)
        }
    }

    // MARK: - Stats Bar

    private var statsBar: some View {
        HStack {
            let total = logMode == .manual
                ? (manualTotals[manualFilter] ?? 0)
                : (automodTotals[automodFilter] ?? 0)
            Text("\(total) total \(logMode == .manual ? "cases" : "actions")")
                .font(NexusFont.caption(12))
                .foregroundStyle(NexusColors.textSecondary)
            Spacer()
        }
        .padding(.horizontal, NexusSpacing.lg)
        .padding(.bottom, NexusSpacing.sm)
    }

    // MARK: - Manual Content

    @ViewBuilder
    private var manualContent: some View {
        let cases = manualCases[manualFilter] ?? []
        let isFirstLoad = manualLoading && cases.isEmpty && manualCases[manualFilter] == nil

        if isFirstLoad {
            ScrollView {
                LazyVStack(spacing: NexusSpacing.sm) {
                    ForEach(0..<8, id: \.self) { _ in
                        SkeletonView(height: 72)
                            .padding(.horizontal, NexusSpacing.lg)
                    }
                }
                .padding(.bottom, 100)
            }
        } else if let error = manualError, cases.isEmpty {
            errorView(error: error) {
                manualError = nil
                manualLoadId = UUID()
            }
        } else if cases.isEmpty {
            ScrollView {
                EmptyStateView(
                    icon: "checkmark.shield",
                    title: "No Cases",
                    message: "No moderation actions have been taken yet."
                )
                .padding(.bottom, 100)
            }
        } else {
            ScrollView {
                LazyVStack(spacing: NexusSpacing.sm) {
                    ForEach(Array(cases.enumerated()), id: \.element.id) { _, modCase in
                        Button {
                            selectedCase = modCase
                        } label: {
                            ModCaseRow(
                                caseNumber: modCase.caseNumber,
                                actionType: modCase.action,
                                targetUsername: modCase.username ?? modCase.userId,
                                moderatorUsername: modCase.moderatorUsername ?? modCase.moderatorId,
                                reason: modCase.reason,
                                timestamp: modCase.createdDate
                            )
                        }
                        .buttonStyle(.plain)
                        .padding(.horizontal, NexusSpacing.lg)
                    }

                    if manualHasMore[manualFilter] ?? false {
                        ProgressView()
                            .tint(NexusColors.cyan)
                            .padding(NexusSpacing.xl)
                            .onAppear {
                                Task { await loadMoreManual() }
                            }
                    }
                }
                .padding(.bottom, 100)
            }
            .refreshable {
                manualCases[manualFilter] = nil
                manualError = nil
                manualPage[manualFilter] = 1
                manualHasMore[manualFilter] = true
                await loadManualCases(replacing: true)
            }
        }
    }

    // MARK: - Automod Content

    @ViewBuilder
    private var automodContent: some View {
        let entries = automodEntries[automodFilter] ?? []
        let isFirstLoad = automodLoading && entries.isEmpty && automodEntries[automodFilter] == nil

        if isFirstLoad {
            ScrollView {
                LazyVStack(spacing: NexusSpacing.sm) {
                    ForEach(0..<8, id: \.self) { _ in
                        SkeletonView(height: 72)
                            .padding(.horizontal, NexusSpacing.lg)
                    }
                }
                .padding(.bottom, 100)
            }
        } else if let error = automodError, entries.isEmpty {
            errorView(error: error) {
                automodError = nil
                automodLoadId = UUID()
            }
        } else if entries.isEmpty {
            ScrollView {
                EmptyStateView(
                    icon: "shield.checkered",
                    title: "No Automod Actions",
                    message: "No automod actions have been recorded yet."
                )
                .padding(.bottom, 100)
            }
        } else {
            ScrollView {
                LazyVStack(spacing: NexusSpacing.sm) {
                    ForEach(Array(entries.enumerated()), id: \.element.id) { _, log in
                        Button {
                            selectedAutomodLog = log
                        } label: {
                            AutomodLogRow(log: log)
                        }
                        .buttonStyle(.plain)
                        .padding(.horizontal, NexusSpacing.lg)
                    }

                    if automodHasMore[automodFilter] ?? false {
                        ProgressView()
                            .tint(NexusColors.cyan)
                            .padding(NexusSpacing.xl)
                            .onAppear {
                                Task { await loadMoreAutomod() }
                            }
                    }
                }
                .padding(.bottom, 100)
            }
            .refreshable {
                automodEntries[automodFilter] = nil
                automodError = nil
                automodPage[automodFilter] = 1
                automodHasMore[automodFilter] = true
                await loadAutomodLogs(replacing: true)
            }
        }
    }

    // MARK: - Shared Components

    private func filterChip(label: String, filter: String?, isSelected: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(label)
                .font(NexusFont.caption(12))
                .fontWeight(.medium)
                .foregroundStyle(isSelected ? NexusColors.background : NexusColors.textSecondary)
                .padding(.horizontal, NexusSpacing.md)
                .padding(.vertical, NexusSpacing.sm)
                .background(isSelected ? NexusColors.cyan : NexusColors.cardBackground)
                .clipShape(RoundedRectangle(cornerRadius: NexusRadius.full))
        }
    }

    private func errorView(error: String, retry: @escaping () -> Void) -> some View {
        ScrollView {
            VStack(spacing: NexusSpacing.md) {
                EmptyStateView(
                    icon: "exclamationmark.triangle",
                    title: "Failed to Load",
                    message: error
                )
                Button {
                    retry()
                } label: {
                    Text("Retry")
                        .font(NexusFont.body(14))
                        .fontWeight(.medium)
                        .foregroundStyle(NexusColors.background)
                        .padding(.horizontal, NexusSpacing.xl)
                        .padding(.vertical, NexusSpacing.sm)
                        .background(NexusColors.cyan)
                        .clipShape(RoundedRectangle(cornerRadius: NexusRadius.md))
                }
            }
            .padding(.bottom, 100)
        }
    }

    // MARK: - Filter Switching (cached)

    private func switchManualFilter(_ filter: String?) {
        manualFilter = filter
        // If we already have cached data, don't re-fetch
        if manualCases[filter] != nil { return }
        manualLoading = true
        manualError = nil
        manualPage[filter] = 1
        manualHasMore[filter] = true
        manualLoadId = UUID()
    }

    private func switchAutomodFilter(_ filter: String?) {
        automodFilter = filter
        if automodEntries[filter] != nil { return }
        automodLoading = true
        automodError = nil
        automodPage[filter] = 1
        automodHasMore[filter] = true
        automodLoadId = UUID()
    }

    // MARK: - Data Loading (Manual)

    @MainActor
    private func loadManualCases(replacing: Bool = false) async {
        // Skip if already cached
        if replacing && manualCases[manualFilter] != nil && manualCases[manualFilter]?.isEmpty == false {
            manualLoading = false
            return
        }

        manualLoading = true
        manualError = nil
        let currentFilter = manualFilter
        let currentPage = manualPage[currentFilter] ?? 1

        for attempt in 1...3 {
            do {
                try Task.checkCancellation()
                let response = try await APIClient.shared.fetchModLogs(
                    guildId, page: currentPage, limit: 25, action: currentFilter
                )

                if replacing {
                    manualCases[currentFilter] = response.cases
                } else {
                    var existing = manualCases[currentFilter] ?? []
                    existing.append(contentsOf: response.cases)
                    manualCases[currentFilter] = existing
                }
                manualTotals[currentFilter] = response.total
                manualHasMore[currentFilter] = response.cases.count >= 25
                manualLoading = false
                return
            } catch is CancellationError {
                manualLoading = false
                return
            } catch {
                let nsError = error as NSError
                if nsError.domain == NSURLErrorDomain && nsError.code == NSURLErrorCancelled && attempt < 3 {
                    try? await Task.sleep(nanoseconds: UInt64(attempt) * 300_000_000)
                    continue
                }
                manualError = error.localizedDescription
                break
            }
        }
        manualLoading = false
    }

    private func loadMoreManual() async {
        let currentFilter = manualFilter
        let nextPage = (manualPage[currentFilter] ?? 1) + 1
        manualPage[currentFilter] = nextPage

        do {
            let response = try await APIClient.shared.fetchModLogs(
                guildId, page: nextPage, limit: 25, action: currentFilter
            )
            var existing = manualCases[currentFilter] ?? []
            existing.append(contentsOf: response.cases)
            manualCases[currentFilter] = existing
            manualHasMore[currentFilter] = response.cases.count >= 25
        } catch is CancellationError {
            manualPage[currentFilter] = nextPage - 1
        } catch {
            manualPage[currentFilter] = nextPage - 1
        }
    }

    // MARK: - Data Loading (Automod)

    @MainActor
    private func loadAutomodLogs(replacing: Bool = false) async {
        if replacing && automodEntries[automodFilter] != nil && automodEntries[automodFilter]?.isEmpty == false {
            automodLoading = false
            return
        }

        automodLoading = true
        automodError = nil
        let currentFilter = automodFilter
        let currentPage = automodPage[currentFilter] ?? 1

        for attempt in 1...3 {
            do {
                try Task.checkCancellation()
                let response = try await APIClient.shared.fetchAutomodLogs(
                    guildId, page: currentPage, limit: 25, action: currentFilter
                )

                if replacing {
                    automodEntries[currentFilter] = response.logs
                } else {
                    var existing = automodEntries[currentFilter] ?? []
                    existing.append(contentsOf: response.logs)
                    automodEntries[currentFilter] = existing
                }
                automodTotals[currentFilter] = response.total
                automodHasMore[currentFilter] = response.logs.count >= 25
                automodLoading = false
                return
            } catch is CancellationError {
                automodLoading = false
                return
            } catch {
                let nsError = error as NSError
                if nsError.domain == NSURLErrorDomain && nsError.code == NSURLErrorCancelled && attempt < 3 {
                    try? await Task.sleep(nanoseconds: UInt64(attempt) * 300_000_000)
                    continue
                }
                automodError = error.localizedDescription
                break
            }
        }
        automodLoading = false
    }

    private func loadMoreAutomod() async {
        let currentFilter = automodFilter
        let nextPage = (automodPage[currentFilter] ?? 1) + 1
        automodPage[currentFilter] = nextPage

        do {
            let response = try await APIClient.shared.fetchAutomodLogs(
                guildId, page: nextPage, limit: 25, action: currentFilter
            )
            var existing = automodEntries[currentFilter] ?? []
            existing.append(contentsOf: response.logs)
            automodEntries[currentFilter] = existing
            automodHasMore[currentFilter] = response.logs.count >= 25
        } catch is CancellationError {
            automodPage[currentFilter] = nextPage - 1
        } catch {
            automodPage[currentFilter] = nextPage - 1
        }
    }
}

// MARK: - Automod Log Row

struct AutomodLogRow: View {
    let log: AutomodLog

    var body: some View {
        HStack(spacing: NexusSpacing.md) {
            // Action icon
            Circle()
                .fill(actionColor.opacity(0.15))
                .frame(width: 40, height: 40)
                .overlay {
                    Image(systemName: actionIcon)
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(actionColor)
                }

            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(log.username ?? log.targetId)
                        .font(NexusFont.body(14))
                        .fontWeight(.semibold)
                        .foregroundStyle(NexusColors.textPrimary)
                        .lineLimit(1)

                    Spacer()

                    Text(log.createdDate, style: .relative)
                        .font(NexusFont.caption(11))
                        .foregroundStyle(NexusColors.textSecondary)
                }

                HStack(spacing: NexusSpacing.sm) {
                    NexusBadge(text: log.action.capitalized, color: actionColor)
                    Text(log.violationLabel)
                        .font(NexusFont.caption(11))
                        .foregroundStyle(NexusColors.textSecondary)
                        .lineLimit(1)
                }

                if let reason = log.reason, !reason.isEmpty {
                    Text(reason)
                        .font(NexusFont.caption(12))
                        .foregroundStyle(NexusColors.textSecondary)
                        .lineLimit(1)
                }
            }
        }
        .padding(NexusSpacing.md)
        .background(NexusColors.cardBackground)
        .clipShape(RoundedRectangle(cornerRadius: NexusRadius.md))
    }

    private var actionColor: Color {
        switch log.action.lowercased() {
        case "ban": return NexusColors.error
        case "kick": return NexusColors.warning
        case "mute": return NexusColors.purple
        case "warn": return Color(hex: "F59E0B")
        case "delete": return NexusColors.textSecondary
        default: return NexusColors.textSecondary
        }
    }

    private var actionIcon: String {
        switch log.action.lowercased() {
        case "ban": return "xmark.shield"
        case "kick": return "person.badge.minus"
        case "mute": return "speaker.slash"
        case "warn": return "exclamationmark.triangle"
        case "delete": return "trash"
        default: return "shield"
        }
    }
}

// MARK: - Automod Log Detail Sheet

struct AutomodLogDetailView: View {
    let log: AutomodLog

    var body: some View {
        ZStack {
            NexusColors.background.ignoresSafeArea()

            ScrollView {
                VStack(alignment: .leading, spacing: NexusSpacing.xl) {
                    // Header
                    HStack {
                        Text("Automod Action")
                            .font(NexusFont.heading(22))
                            .foregroundStyle(NexusColors.textPrimary)
                        Spacer()
                        NexusBadge(text: log.action.capitalized, color: badgeColor)
                    }

                    // Details grid
                    VStack(spacing: NexusSpacing.md) {
                        detailRow("User", value: log.username ?? log.targetId)
                        detailRow("Action", value: log.action.capitalized)
                        detailRow("Violation", value: log.violationLabel)
                        detailRow("Date", value: log.createdDate.formatted(date: .abbreviated, time: .shortened))
                    }

                    // Reason
                    if let reason = log.reason, !reason.isEmpty {
                        sectionBlock(title: "REASON", content: reason)
                    }

                    // Message Content
                    if let content = log.messageContent, !content.isEmpty {
                        sectionBlock(title: "MESSAGE CONTENT", content: content)
                    }
                }
                .padding(NexusSpacing.xl)
            }
        }
    }

    private var badgeColor: Color {
        switch log.action.lowercased() {
        case "ban": return NexusColors.error
        case "kick": return NexusColors.warning
        case "mute": return NexusColors.purple
        case "warn": return Color(hex: "F59E0B")
        default: return NexusColors.textSecondary
        }
    }

    private func detailRow(_ label: String, value: String) -> some View {
        HStack {
            Text(label)
                .font(NexusFont.caption(13))
                .foregroundStyle(NexusColors.textSecondary)
                .frame(width: 80, alignment: .leading)
            Text(value)
                .font(NexusFont.body(14))
                .foregroundStyle(NexusColors.textPrimary)
            Spacer()
        }
        .padding(.horizontal, NexusSpacing.md)
        .padding(.vertical, NexusSpacing.sm)
        .background(NexusColors.cardBackground)
        .clipShape(RoundedRectangle(cornerRadius: NexusRadius.sm))
    }

    private func sectionBlock(title: String, content: String) -> some View {
        VStack(alignment: .leading, spacing: NexusSpacing.sm) {
            Text(title)
                .font(NexusFont.caption(11))
                .fontWeight(.bold)
                .foregroundStyle(NexusColors.textSecondary)
                .tracking(1)

            Text(content)
                .font(NexusFont.body(14))
                .foregroundStyle(NexusColors.textPrimary)
                .padding(NexusSpacing.md)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(NexusColors.cardBackground)
                .clipShape(RoundedRectangle(cornerRadius: NexusRadius.md))
        }
    }
}

// MARK: - Case Detail Sheet

struct ModCaseDetailView: View {
    let modCase: ModCase

    @State private var isEditing = false
    @State private var editedReason: String = ""
    @State private var saving = false
    @State private var currentReason: String?
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ZStack {
            NexusColors.background.ignoresSafeArea()

            ScrollView {
                VStack(alignment: .leading, spacing: NexusSpacing.xl) {
                    // Header
                    HStack {
                        Text("Case #\(modCase.caseNumber)")
                            .font(NexusFont.heading(22))
                            .foregroundStyle(NexusColors.textPrimary)
                        Spacer()
                        NexusBadge(text: modCase.action, color: actionColor)
                    }

                    // Details grid
                    VStack(spacing: NexusSpacing.md) {
                        detailRow("Target", value: modCase.username ?? modCase.userId)
                        detailRow("Moderator", value: modCase.moderatorUsername ?? modCase.moderatorId)
                        detailRow("Action", value: modCase.action.capitalized)
                        if let duration = modCase.durationDisplay {
                            detailRow("Duration", value: duration)
                        }
                        detailRow("Date", value: modCase.createdDate.formatted(date: .abbreviated, time: .shortened))
                    }

                    // Reason (editable)
                    VStack(alignment: .leading, spacing: NexusSpacing.sm) {
                        HStack {
                            Text("REASON")
                                .font(NexusFont.caption(11))
                                .fontWeight(.bold)
                                .foregroundStyle(NexusColors.textSecondary)
                                .tracking(1)
                            Spacer()
                            if !isEditing {
                                Button {
                                    editedReason = displayedReason
                                    isEditing = true
                                } label: {
                                    Text("Edit")
                                        .font(NexusFont.caption(12))
                                        .foregroundStyle(NexusColors.cyan)
                                }
                            }
                        }

                        if isEditing {
                            VStack(spacing: NexusSpacing.sm) {
                                TextEditor(text: $editedReason)
                                    .font(NexusFont.body(14))
                                    .foregroundStyle(NexusColors.textPrimary)
                                    .scrollContentBackground(.hidden)
                                    .frame(minHeight: 80)
                                    .padding(NexusSpacing.sm)
                                    .background(NexusColors.cardBackground)
                                    .clipShape(RoundedRectangle(cornerRadius: NexusRadius.md))
                                    .overlay(
                                        RoundedRectangle(cornerRadius: NexusRadius.md)
                                            .stroke(NexusColors.cyan.opacity(0.3), lineWidth: 1)
                                    )

                                HStack(spacing: NexusSpacing.sm) {
                                    Button {
                                        isEditing = false
                                    } label: {
                                        Text("Cancel")
                                            .font(NexusFont.caption(13))
                                            .fontWeight(.medium)
                                            .foregroundStyle(NexusColors.textSecondary)
                                            .padding(.horizontal, NexusSpacing.lg)
                                            .padding(.vertical, NexusSpacing.sm)
                                            .background(NexusColors.cardBackground)
                                            .clipShape(RoundedRectangle(cornerRadius: NexusRadius.md))
                                    }

                                    Button {
                                        Task { await saveReason() }
                                    } label: {
                                        HStack(spacing: NexusSpacing.xs) {
                                            if saving {
                                                ProgressView()
                                                    .tint(NexusColors.background)
                                                    .scaleEffect(0.7)
                                            }
                                            Text("Save")
                                                .font(NexusFont.caption(13))
                                                .fontWeight(.semibold)
                                        }
                                        .foregroundStyle(NexusColors.background)
                                        .padding(.horizontal, NexusSpacing.lg)
                                        .padding(.vertical, NexusSpacing.sm)
                                        .background(NexusColors.cyan)
                                        .clipShape(RoundedRectangle(cornerRadius: NexusRadius.md))
                                    }
                                    .disabled(saving || editedReason.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                                    .opacity(saving || editedReason.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? 0.5 : 1)
                                }
                            }
                        } else {
                            Text(displayedReason)
                                .font(NexusFont.body(14))
                                .foregroundStyle(NexusColors.textPrimary)
                                .padding(NexusSpacing.md)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .background(NexusColors.cardBackground)
                                .clipShape(RoundedRectangle(cornerRadius: NexusRadius.md))
                        }
                    }
                }
                .padding(NexusSpacing.xl)
            }
        }
        .onAppear {
            currentReason = modCase.reason
        }
    }

    private var displayedReason: String {
        currentReason ?? modCase.reason ?? "No reason provided"
    }

    @MainActor
    private func saveReason() async {
        let trimmed = editedReason.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        saving = true
        do {
            let _ = try await APIClient.shared.editModCase(
                modCase.guildId,
                caseNumber: modCase.caseNumber,
                reason: trimmed
            )
            currentReason = trimmed
            isEditing = false
        } catch {
            // Silently fail — user can retry
        }
        saving = false
    }

    private var actionColor: Color {
        switch modCase.action.lowercased() {
        case "ban", "tempban": return NexusColors.error
        case "kick", "softban": return NexusColors.warning
        case "mute": return NexusColors.purple
        case "warn": return Color(hex: "F59E0B")
        default: return NexusColors.textSecondary
        }
    }

    private func detailRow(_ label: String, value: String) -> some View {
        HStack {
            Text(label)
                .font(NexusFont.caption(13))
                .foregroundStyle(NexusColors.textSecondary)
                .frame(width: 80, alignment: .leading)
            Text(value)
                .font(NexusFont.body(14))
                .foregroundStyle(NexusColors.textPrimary)
            Spacer()
        }
        .padding(.horizontal, NexusSpacing.md)
        .padding(.vertical, NexusSpacing.sm)
        .background(NexusColors.cardBackground)
        .clipShape(RoundedRectangle(cornerRadius: NexusRadius.sm))
    }
}
