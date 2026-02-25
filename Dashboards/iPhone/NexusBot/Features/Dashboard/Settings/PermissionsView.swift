import SwiftUI

struct PermissionsView: View {
    let guildId: String
    @State private var permissions: [String: [Permission]] = [:]
    @State private var isLoading = true
    @State private var searchText = ""
    @State private var showAddSheet = false
    @State private var deletingRule: (command: String, targetId: String)?

    private var filteredCommands: [String] {
        let sorted = permissions.keys.sorted()
        if searchText.isEmpty { return sorted }
        return sorted.filter { $0.localizedCaseInsensitiveContains(searchText) }
    }

    var body: some View {
        ZStack {
            NexusColors.background.ignoresSafeArea()

            ScrollView {
                VStack(alignment: .leading, spacing: NexusSpacing.xl) {
                    // Search bar
                    HStack(spacing: NexusSpacing.sm) {
                        Image(systemName: "magnifyingglass")
                            .foregroundStyle(NexusColors.textMuted)
                        TextField("Search commands...", text: $searchText)
                            .font(NexusFont.body(14))
                            .foregroundStyle(NexusColors.textPrimary)
                    }
                    .padding(NexusSpacing.md)
                    .background(NexusColors.cardBackground)
                    .clipShape(RoundedRectangle(cornerRadius: NexusRadius.md))

                    if isLoading {
                        ForEach(0..<5, id: \.self) { _ in
                            SkeletonView(height: 72)
                        }
                    } else if permissions.isEmpty && searchText.isEmpty {
                        EmptyStateView(
                            icon: "lock.open.fill",
                            title: "Default Permissions",
                            message: "All commands are using their default permission settings. Tap + to add a permission override."
                        )
                    } else if filteredCommands.isEmpty {
                        EmptyStateView(
                            icon: "magnifyingglass",
                            title: "No Results",
                            message: "No commands match your search."
                        )
                    } else {
                        ForEach(filteredCommands, id: \.self) { command in
                            if let rules = permissions[command] {
                                commandPermissionCard(command: command, rules: rules)
                            }
                        }
                    }
                }
                .padding(.horizontal, NexusSpacing.lg)
                .padding(.top, NexusSpacing.lg)
                .padding(.bottom, 100)
            }
            .refreshable { await loadPermissions() }
        }
        .navigationTitle("Permissions")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    showAddSheet = true
                } label: {
                    Image(systemName: "plus.circle.fill")
                        .foregroundStyle(NexusColors.cyan)
                }
            }
        }
        .sheet(isPresented: $showAddSheet) {
            AddPermissionSheet(guildId: guildId) {
                await loadPermissions()
            }
        }
        .task { await loadPermissions() }
    }

    // MARK: - Command Permission Card

    private func commandPermissionCard(command: String, rules: [Permission]) -> some View {
        NexusCard {
            VStack(alignment: .leading, spacing: NexusSpacing.md) {
                HStack(spacing: NexusSpacing.sm) {
                    Image(systemName: "terminal.fill")
                        .font(.system(size: 12))
                        .foregroundStyle(NexusColors.cyan)
                    Text("/\(command)")
                        .font(NexusFont.mono(14))
                        .foregroundStyle(NexusColors.cyan)
                    Spacer()
                    NexusBadge(
                        text: "\(rules.count) rule\(rules.count == 1 ? "" : "s")",
                        color: NexusColors.textSecondary
                    )
                }

                ForEach(rules) { rule in
                    HStack(spacing: NexusSpacing.sm) {
                        Image(systemName: rule.allowed ? "checkmark.circle.fill" : "xmark.circle.fill")
                            .font(.system(size: 14))
                            .foregroundStyle(rule.allowed ? NexusColors.success : NexusColors.error)

                        Image(systemName: targetTypeIcon(rule.targetType))
                            .font(.system(size: 11))
                            .foregroundStyle(NexusColors.textMuted)

                        Text(rule.targetType.capitalized)
                            .font(NexusFont.caption(12))
                            .foregroundStyle(NexusColors.textSecondary)

                        Text(rule.targetId)
                            .font(NexusFont.mono(11))
                            .foregroundStyle(NexusColors.textMuted)
                            .lineLimit(1)

                        Spacer()

                        Text(rule.allowed ? "Allow" : "Deny")
                            .font(NexusFont.caption(11))
                            .fontWeight(.semibold)
                            .foregroundStyle(rule.allowed ? NexusColors.success : NexusColors.error)

                        // Delete button
                        Button {
                            Task {
                                try? await APIClient.shared.removePermission(guildId, command: command, targetId: rule.targetId)
                                await loadPermissions()
                            }
                        } label: {
                            Image(systemName: "trash")
                                .font(.system(size: 12))
                                .foregroundStyle(NexusColors.error.opacity(0.7))
                        }
                    }

                    if rule.id != rules.last?.id {
                        Divider().background(NexusColors.border)
                    }
                }
            }
        }
    }

    private func targetTypeIcon(_ type: String) -> String {
        switch type.lowercased() {
        case "role": return "person.badge.shield.checkmark.fill"
        case "user": return "person.fill"
        case "channel": return "number"
        default: return "questionmark.circle"
        }
    }

    private func loadPermissions() async {
        isLoading = true
        permissions = (try? await APIClient.shared.fetchPermissions(guildId)) ?? [:]
        isLoading = false
    }
}

// MARK: - Add Permission Sheet

struct AddPermissionSheet: View {
    let guildId: String
    let onSaved: () async -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var command = ""
    @State private var targetType = "role"
    @State private var targetId = ""
    @State private var allowed = true
    @State private var isSaving = false
    @State private var errorMessage: String?

    let targetTypes = [
        ("role", "Role", "person.badge.shield.checkmark.fill"),
        ("user", "User", "person.fill"),
        ("channel", "Channel", "number"),
    ]

    var body: some View {
        NavigationStack {
            ZStack {
                NexusColors.background.ignoresSafeArea()

                ScrollView {
                    VStack(alignment: .leading, spacing: NexusSpacing.xl) {
                        // Command
                        ConfigSection(title: "Command", icon: "terminal.fill") {
                            VStack(alignment: .leading, spacing: 4) {
                                Text("Command name (without /)")
                                    .font(NexusFont.caption(12))
                                    .foregroundStyle(NexusColors.textSecondary)
                                TextField("e.g. ban, kick, mute", text: $command)
                                    .font(NexusFont.mono(14))
                                    .foregroundStyle(NexusColors.textPrimary)
                                    .padding(NexusSpacing.sm)
                                    .background(NexusColors.surfaceElevated)
                                    .clipShape(RoundedRectangle(cornerRadius: NexusRadius.sm))
                            }
                            .padding(.horizontal, NexusSpacing.md)
                            .padding(.vertical, NexusSpacing.sm)
                        }

                        // Target Type
                        ConfigSection(title: "Target Type", icon: "scope") {
                            ForEach(targetTypes, id: \.0) { type in
                                Button {
                                    targetType = type.0
                                } label: {
                                    HStack(spacing: NexusSpacing.md) {
                                        Image(systemName: type.2)
                                            .font(.system(size: 14))
                                            .foregroundStyle(targetType == type.0 ? NexusColors.cyan : NexusColors.textMuted)
                                            .frame(width: 24)
                                        Text(type.1)
                                            .font(NexusFont.body(14))
                                            .foregroundStyle(NexusColors.textPrimary)
                                        Spacer()
                                        if targetType == type.0 {
                                            Image(systemName: "checkmark.circle.fill")
                                                .foregroundStyle(NexusColors.cyan)
                                        }
                                    }
                                    .padding(.horizontal, NexusSpacing.md)
                                    .padding(.vertical, NexusSpacing.sm + 2)
                                }
                            }
                        }

                        // Target ID
                        ConfigSection(title: "Target ID", icon: "number") {
                            VStack(alignment: .leading, spacing: 4) {
                                Text("Discord \(targetType) ID")
                                    .font(NexusFont.caption(12))
                                    .foregroundStyle(NexusColors.textSecondary)
                                TextField("e.g. 123456789012345678", text: $targetId)
                                    .font(NexusFont.mono(14))
                                    .foregroundStyle(NexusColors.textPrimary)
                                    .keyboardType(.numberPad)
                                    .padding(NexusSpacing.sm)
                                    .background(NexusColors.surfaceElevated)
                                    .clipShape(RoundedRectangle(cornerRadius: NexusRadius.sm))
                            }
                            .padding(.horizontal, NexusSpacing.md)
                            .padding(.vertical, NexusSpacing.sm)
                        }

                        // Allow / Deny
                        ConfigSection(title: "Permission", icon: "shield.fill") {
                            HStack(spacing: NexusSpacing.md) {
                                Button {
                                    allowed = true
                                } label: {
                                    HStack(spacing: NexusSpacing.sm) {
                                        Image(systemName: "checkmark.circle.fill")
                                            .foregroundStyle(allowed ? NexusColors.success : NexusColors.textMuted)
                                        Text("Allow")
                                            .font(NexusFont.body(14))
                                            .foregroundStyle(allowed ? NexusColors.success : NexusColors.textSecondary)
                                    }
                                    .frame(maxWidth: .infinity)
                                    .padding(.vertical, NexusSpacing.md)
                                    .background(allowed ? NexusColors.success.opacity(0.1) : Color.clear)
                                    .clipShape(RoundedRectangle(cornerRadius: NexusRadius.sm))
                                    .overlay(
                                        RoundedRectangle(cornerRadius: NexusRadius.sm)
                                            .stroke(allowed ? NexusColors.success.opacity(0.3) : NexusColors.border, lineWidth: 1)
                                    )
                                }

                                Button {
                                    allowed = false
                                } label: {
                                    HStack(spacing: NexusSpacing.sm) {
                                        Image(systemName: "xmark.circle.fill")
                                            .foregroundStyle(!allowed ? NexusColors.error : NexusColors.textMuted)
                                        Text("Deny")
                                            .font(NexusFont.body(14))
                                            .foregroundStyle(!allowed ? NexusColors.error : NexusColors.textSecondary)
                                    }
                                    .frame(maxWidth: .infinity)
                                    .padding(.vertical, NexusSpacing.md)
                                    .background(!allowed ? NexusColors.error.opacity(0.1) : Color.clear)
                                    .clipShape(RoundedRectangle(cornerRadius: NexusRadius.sm))
                                    .overlay(
                                        RoundedRectangle(cornerRadius: NexusRadius.sm)
                                            .stroke(!allowed ? NexusColors.error.opacity(0.3) : NexusColors.border, lineWidth: 1)
                                    )
                                }
                            }
                            .padding(.horizontal, NexusSpacing.md)
                            .padding(.vertical, NexusSpacing.sm)
                        }

                        if let error = errorMessage {
                            Text(error)
                                .font(NexusFont.caption(12))
                                .foregroundStyle(NexusColors.error)
                                .padding(.horizontal, NexusSpacing.md)
                        }

                        // Save
                        NexusButton(
                            title: "Add Permission",
                            icon: "plus.circle.fill",
                            style: .primary,
                            isLoading: isSaving
                        ) {
                            Task { await save() }
                        }
                        .frame(maxWidth: .infinity)
                        .disabled(command.isEmpty || targetId.isEmpty)
                    }
                    .padding(.horizontal, NexusSpacing.lg)
                    .padding(.top, NexusSpacing.lg)
                    .padding(.bottom, 60)
                }
            }
            .navigationTitle("Add Permission")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") { dismiss() }
                        .foregroundStyle(NexusColors.textSecondary)
                }
            }
        }
        .presentationDetents([.large])
    }

    private func save() async {
        guard !command.isEmpty, !targetId.isEmpty else {
            errorMessage = "Please fill in all fields"
            return
        }

        isSaving = true
        errorMessage = nil

        do {
            try await APIClient.shared.setPermission(
                guildId,
                command: command,
                targetType: targetType,
                targetId: targetId,
                allowed: allowed
            )
            await onSaved()
            dismiss()
        } catch {
            errorMessage = "Failed to save: \(error.localizedDescription)"
        }

        isSaving = false
    }
}
