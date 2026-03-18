import SwiftUI

/// Per-command permission editor: allowed/denied roles, allowed/denied users
/// Rule: User ID overrides role. If a user's role is allowed but their ID is denied → denied.
struct CommandPermissionView: View {
    let guildId: String
    let command: CommandDef
    let moduleColor: Color

    @EnvironmentObject var guildCache: GuildDataCache

    // Picker sheets
    @State private var showRolePicker: PermissionPickerConfig?

    // Computed permission groups — from cache, resolved with role names
    private var rules: [Permission] {
        guildCache.permissionsForCommand(command.id)
    }

    private var allowedRoles: [Permission] {
        rules.filter { $0.targetType == "role" && $0.allowed }
    }
    private var deniedRoles: [Permission] {
        rules.filter { $0.targetType == "role" && !$0.allowed }
    }
    private var allowedUsers: [Permission] {
        rules.filter { $0.targetType == "user" && $0.allowed }
    }
    private var deniedUsers: [Permission] {
        rules.filter { $0.targetType == "user" && !$0.allowed }
    }
    private var channelRules: [Permission] {
        rules.filter { $0.targetType == "channel" }
    }

    var body: some View {
        ZStack {
            NexusColors.background.ignoresSafeArea()

            ScrollView {
                VStack(alignment: .leading, spacing: NexusSpacing.xl) {
                    // Command header
                    commandHeader

                    // Default access level
                    defaultAccessBadge

                    // Priority info banner
                    priorityBanner

                    // Allowed Roles — with + button
                    permissionSection(
                        title: "Allowed Roles",
                        icon: "checkmark.shield.fill",
                        color: NexusColors.success,
                        items: allowedRoles,
                        emptyText: "No roles explicitly allowed",
                        onAdd: { showRolePicker = .init(targetType: "role", allowed: true) }
                    )

                    // Denied Roles — with + button
                    permissionSection(
                        title: "Denied Roles",
                        icon: "xmark.shield.fill",
                        color: NexusColors.error,
                        items: deniedRoles,
                        emptyText: "No roles explicitly denied",
                        onAdd: { showRolePicker = .init(targetType: "role", allowed: false) }
                    )

                    // Allowed Users — with + button
                    permissionSection(
                        title: "Allowed Users",
                        icon: "person.fill.checkmark",
                        color: NexusColors.success,
                        items: allowedUsers,
                        emptyText: "No users explicitly allowed",
                        onAdd: { showRolePicker = .init(targetType: "user", allowed: true) }
                    )

                    // Denied Users — with + button
                    permissionSection(
                        title: "Denied Users",
                        icon: "person.fill.xmark",
                        color: NexusColors.error,
                        items: deniedUsers,
                        emptyText: "No users explicitly denied",
                        onAdd: { showRolePicker = .init(targetType: "user", allowed: false) }
                    )

                    // Channel Overrides
                    if !channelRules.isEmpty {
                        permissionSection(
                            title: "Channel Overrides",
                            icon: "number",
                            color: NexusColors.warning,
                            items: channelRules,
                            emptyText: "",
                            onAdd: nil
                        )
                    }

                    // Subcommands
                    if !command.subcommands.isEmpty {
                        subcommandsSection
                    }
                }
                .padding(.horizontal, NexusSpacing.lg)
                .padding(.top, NexusSpacing.lg)
                .padding(.bottom, 100)
            }
            .refreshable {
                await guildCache.refreshAll()
            }
        }
        .navigationTitle("/\(command.name)")
        .navigationBarTitleDisplayMode(.inline)
        .sheet(item: $showRolePicker) { config in
            Group {
                if config.targetType == "role" {
                    RolePickerSheet(
                        guildId: guildId,
                        commandName: command.id,
                        allowed: config.allowed,
                        existingIds: Set(rules.filter { $0.targetType == "role" }.map(\.targetId))
                    ) {
                        await guildCache.refreshPermissions()
                    }
                } else {
                    MemberPickerSheet(
                        guildId: guildId,
                        commandName: command.id,
                        allowed: config.allowed,
                        existingIds: Set(rules.filter { $0.targetType == "user" }.map(\.targetId))
                    ) {
                        await guildCache.refreshPermissions()
                    }
                }
            }
            .environmentObject(guildCache)
        }
    }

    // MARK: - Command Header

    private var commandHeader: some View {
        NexusCard(glowColor: moduleColor) {
            VStack(alignment: .leading, spacing: NexusSpacing.md) {
                HStack(spacing: NexusSpacing.md) {
                    Image(systemName: "terminal.fill")
                        .font(.system(size: 20))
                        .foregroundStyle(moduleColor)
                        .frame(width: 44, height: 44)
                        .background(moduleColor.opacity(0.1))
                        .clipShape(RoundedRectangle(cornerRadius: NexusRadius.md))

                    VStack(alignment: .leading, spacing: 3) {
                        Text("/\(command.name)")
                            .font(NexusFont.heading(18))
                            .foregroundStyle(NexusColors.textPrimary)
                        Text(command.description)
                            .font(NexusFont.body(13))
                            .foregroundStyle(NexusColors.textSecondary)
                    }
                }

                // Stats row
                HStack(spacing: NexusSpacing.lg) {
                    statPill(count: allowedRoles.count + allowedUsers.count, label: "Allowed", color: NexusColors.success)
                    statPill(count: deniedRoles.count + deniedUsers.count, label: "Denied", color: NexusColors.error)
                    if !command.subcommands.isEmpty {
                        statPill(count: command.subcommands.count, label: "Subcommands", color: NexusColors.textSecondary)
                    }
                }
            }
        }
    }

    private func statPill(count: Int, label: String, color: Color) -> some View {
        HStack(spacing: 4) {
            Text("\(count)")
                .font(NexusFont.heading(14))
                .foregroundStyle(color)
            Text(label)
                .font(NexusFont.caption(11))
                .foregroundStyle(NexusColors.textMuted)
        }
    }

    // MARK: - Default Access Badge

    private var defaultAccessBadge: some View {
        let color = accessColor(command.defaultAccess)
        return HStack(spacing: NexusSpacing.sm) {
            Circle()
                .fill(color)
                .frame(width: 8, height: 8)
            Text("Default: \(command.defaultAccess.rawValue)")
                .font(NexusFont.heading(13))
                .foregroundStyle(color)
            Spacer()
            Text("Custom rules work alongside this default")
                .font(NexusFont.caption(11))
                .foregroundStyle(NexusColors.textMuted)
        }
        .padding(NexusSpacing.md)
        .background(color.opacity(0.08))
        .clipShape(RoundedRectangle(cornerRadius: NexusRadius.md))
        .overlay(
            RoundedRectangle(cornerRadius: NexusRadius.md)
                .stroke(color.opacity(0.2), lineWidth: 1)
        )
    }

    private func accessColor(_ access: DefaultAccess) -> Color {
        switch access {
        case .everyone: return NexusColors.success
        case .staffOnly: return NexusColors.warning
        case .adminOnly: return NexusColors.error
        case .ownerOnly: return NexusColors.purple
        }
    }

    // MARK: - Priority Banner

    private var priorityBanner: some View {
        VStack(alignment: .leading, spacing: NexusSpacing.sm) {
            HStack(spacing: NexusSpacing.sm) {
                Image(systemName: "info.circle.fill")
                    .font(.system(size: 14))
                    .foregroundStyle(NexusColors.warning)
                Text("How permissions work")
                    .font(NexusFont.heading(13))
                    .foregroundStyle(NexusColors.warning)
            }
            Text("Rules are additive — adding a deny rule won't remove the default access for other users. User ID overrides Role: if someone has an allowed role but their ID is denied, they cannot use this command.")
                .font(NexusFont.caption(12))
                .foregroundStyle(NexusColors.textSecondary)
        }
        .padding(NexusSpacing.md)
        .background(NexusColors.warning.opacity(0.08))
        .clipShape(RoundedRectangle(cornerRadius: NexusRadius.md))
        .overlay(
            RoundedRectangle(cornerRadius: NexusRadius.md)
                .stroke(NexusColors.warning.opacity(0.2), lineWidth: 1)
        )
    }

    // MARK: - Permission Section (with inline + button)

    private func permissionSection(title: String, icon: String, color: Color, items: [Permission], emptyText: String, onAdd: (() -> Void)?) -> some View {
        VStack(alignment: .leading, spacing: NexusSpacing.sm) {
            HStack(spacing: NexusSpacing.sm) {
                Image(systemName: icon)
                    .font(.system(size: 13))
                    .foregroundStyle(color)
                Text(title)
                    .font(NexusFont.heading(14))
                    .foregroundStyle(NexusColors.textSecondary)

                Spacer()

                NexusBadge(text: "\(items.count)", color: color)

                // + button right next to the section header
                if let onAdd {
                    Button(action: onAdd) {
                        Image(systemName: "plus.circle.fill")
                            .font(.system(size: 20))
                            .foregroundStyle(color)
                    }
                }
            }
            .padding(.leading, NexusSpacing.xs)

            VStack(spacing: 1) {
                if items.isEmpty {
                    HStack {
                        Text(emptyText)
                            .font(NexusFont.caption(13))
                            .foregroundStyle(NexusColors.textMuted)
                        Spacer()
                    }
                    .padding(.horizontal, NexusSpacing.md)
                    .padding(.vertical, NexusSpacing.md)
                } else {
                    ForEach(items) { rule in
                        permissionRow(rule: rule, color: color)

                        if rule.id != items.last?.id {
                            Divider()
                                .background(NexusColors.border)
                                .padding(.horizontal, NexusSpacing.md)
                        }
                    }
                }
            }
            .background(NexusColors.cardBackground)
            .clipShape(RoundedRectangle(cornerRadius: NexusRadius.md))
        }
    }

    private func permissionRow(rule: Permission, color: Color) -> some View {
        HStack(spacing: NexusSpacing.sm) {
            Image(systemName: rule.allowed ? "checkmark.circle.fill" : "xmark.circle.fill")
                .font(.system(size: 14))
                .foregroundStyle(color)

            Image(systemName: targetIcon(rule.targetType))
                .font(.system(size: 12))
                .foregroundStyle(NexusColors.textMuted)
                .frame(width: 20)

            VStack(alignment: .leading, spacing: 2) {
                // Show the resolved name if available, otherwise show ID
                Text(rule.resolvedName ?? rule.targetId)
                    .font(NexusFont.body(13))
                    .foregroundStyle(NexusColors.textPrimary)
                    .lineLimit(1)
                if rule.resolvedName != nil {
                    Text(rule.targetId)
                        .font(NexusFont.mono(10))
                        .foregroundStyle(NexusColors.textMuted)
                        .lineLimit(1)
                }
            }

            Spacer()

            // Delete
            Button {
                Task {
                    try? await APIClient.shared.removePermission(guildId, command: command.id, targetId: rule.targetId)
                    await guildCache.refreshPermissions()
                }
            } label: {
                Image(systemName: "trash")
                    .font(.system(size: 12))
                    .foregroundStyle(NexusColors.error.opacity(0.7))
                    .padding(8)
            }
        }
        .padding(.horizontal, NexusSpacing.md)
        .padding(.vertical, NexusSpacing.sm)
    }

    // MARK: - Subcommands

    private var subcommandsSection: some View {
        VStack(alignment: .leading, spacing: NexusSpacing.sm) {
            HStack(spacing: NexusSpacing.sm) {
                Image(systemName: "arrow.turn.down.right")
                    .font(.system(size: 13))
                    .foregroundStyle(NexusColors.purple)
                Text("Subcommands")
                    .font(NexusFont.heading(14))
                    .foregroundStyle(NexusColors.textSecondary)
            }
            .padding(.leading, NexusSpacing.xs)

            VStack(spacing: 1) {
                ForEach(command.subcommands, id: \.self) { sub in
                    HStack(spacing: NexusSpacing.sm) {
                        Image(systemName: "chevron.right")
                            .font(.system(size: 10))
                            .foregroundStyle(NexusColors.textMuted)
                        Text("/\(command.name) \(sub)")
                            .font(NexusFont.mono(13))
                            .foregroundStyle(NexusColors.textPrimary)
                        Spacer()
                    }
                    .padding(.horizontal, NexusSpacing.md)
                    .padding(.vertical, NexusSpacing.sm + 2)

                    if sub != command.subcommands.last {
                        Divider()
                            .background(NexusColors.border)
                            .padding(.horizontal, NexusSpacing.md)
                    }
                }
            }
            .background(NexusColors.cardBackground)
            .clipShape(RoundedRectangle(cornerRadius: NexusRadius.md))
        }
    }

    // MARK: - Helpers

    private func targetIcon(_ type: String) -> String {
        switch type.lowercased() {
        case "role": return "person.badge.shield.checkmark.fill"
        case "user": return "person.fill"
        case "channel": return "number"
        default: return "questionmark.circle"
        }
    }
}

// MARK: - Picker Config (identifies which section's + was tapped)

struct PermissionPickerConfig: Identifiable {
    let id = UUID()
    let targetType: String  // "role" or "user"
    let allowed: Bool
}

// MARK: - Role Picker Sheet (uses cached roles — opens instantly)

struct RolePickerSheet: View {
    let guildId: String
    let commandName: String
    let allowed: Bool
    let existingIds: Set<String>
    let onSaved: () async -> Void

    @EnvironmentObject var guildCache: GuildDataCache
    @Environment(\.dismiss) private var dismiss
    @State private var selectedRoles: Set<String> = []
    @State private var isSaving = false
    @State private var searchText = ""

    private var filteredRoles: [DiscordRole] {
        let available = guildCache.roles.filter { !existingIds.contains($0.id) && !$0.managed }
        if searchText.isEmpty { return available }
        return available.filter { $0.name.localizedCaseInsensitiveContains(searchText) }
    }

    var body: some View {
        NavigationStack {
            ZStack {
                NexusColors.background.ignoresSafeArea()

                VStack(spacing: 0) {
                    // Search bar
                    HStack(spacing: NexusSpacing.sm) {
                        Image(systemName: "magnifyingglass")
                            .foregroundStyle(NexusColors.textMuted)
                        TextField("Search roles...", text: $searchText)
                            .font(NexusFont.body(14))
                            .foregroundStyle(NexusColors.textPrimary)
                    }
                    .padding(NexusSpacing.md)
                    .background(NexusColors.cardBackground)
                    .clipShape(RoundedRectangle(cornerRadius: NexusRadius.md))
                    .padding(.horizontal, NexusSpacing.lg)
                    .padding(.top, NexusSpacing.md)

                    if !guildCache.rolesLoaded {
                        Spacer()
                        ProgressView()
                            .tint(NexusColors.cyan)
                        Spacer()
                    } else if filteredRoles.isEmpty && guildCache.rolesError {
                        Spacer()
                        VStack(spacing: NexusSpacing.md) {
                            Image(systemName: "wifi.exclamationmark")
                                .font(.system(size: 28))
                                .foregroundStyle(NexusColors.warning)
                            Text("Couldn't load roles")
                                .font(NexusFont.body(14))
                                .foregroundStyle(NexusColors.textSecondary)
                            Text("Network issue — tap to retry")
                                .font(NexusFont.caption(12))
                                .foregroundStyle(NexusColors.textMuted)
                            Button {
                                Task { await guildCache.loadRoles() }
                            } label: {
                                HStack(spacing: NexusSpacing.sm) {
                                    Image(systemName: "arrow.clockwise")
                                    Text("Retry")
                                }
                                .font(NexusFont.heading(14))
                                .foregroundStyle(.white)
                                .padding(.horizontal, 20)
                                .padding(.vertical, 10)
                                .background(NexusColors.cyan)
                                .clipShape(RoundedRectangle(cornerRadius: NexusRadius.sm))
                            }
                        }
                        Spacer()
                    } else if filteredRoles.isEmpty {
                        Spacer()
                        Text(searchText.isEmpty ? "No roles available" : "No roles match your search")
                            .font(NexusFont.body(14))
                            .foregroundStyle(NexusColors.textMuted)
                        Spacer()
                    } else {
                        ScrollView {
                            LazyVStack(spacing: 2) {
                                ForEach(filteredRoles) { role in
                                    roleRow(role)
                                }
                            }
                            .padding(.horizontal, NexusSpacing.lg)
                            .padding(.top, NexusSpacing.md)
                            .padding(.bottom, 80)
                        }
                    }

                    // Bottom save bar
                    if !selectedRoles.isEmpty {
                        saveBar
                    }
                }
            }
            .navigationTitle(allowed ? "Allow Roles" : "Deny Roles")
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

    private func roleRow(_ role: DiscordRole) -> some View {
        let isSelected = selectedRoles.contains(role.id)
        return Button {
            if isSelected {
                selectedRoles.remove(role.id)
            } else {
                selectedRoles.insert(role.id)
            }
        } label: {
            HStack(spacing: NexusSpacing.md) {
                Circle()
                    .fill(role.color != 0 ? Color(hex: role.color) : NexusColors.textMuted)
                    .frame(width: 12, height: 12)

                Text(role.name)
                    .font(NexusFont.body(15))
                    .foregroundStyle(NexusColors.textPrimary)

                Spacer()

                Image(systemName: isSelected ? "checkmark.circle.fill" : "circle")
                    .font(.system(size: 22))
                    .foregroundStyle(isSelected ? (allowed ? NexusColors.success : NexusColors.error) : NexusColors.textMuted)
            }
            .padding(.horizontal, NexusSpacing.md)
            .padding(.vertical, 12)
            .background(isSelected ? (allowed ? NexusColors.success : NexusColors.error).opacity(0.08) : NexusColors.cardBackground)
            .clipShape(RoundedRectangle(cornerRadius: NexusRadius.md))
        }
    }

    private var saveBar: some View {
        VStack(spacing: 0) {
            Divider().background(NexusColors.border)
            HStack {
                Text("\(selectedRoles.count) role\(selectedRoles.count == 1 ? "" : "s") selected")
                    .font(NexusFont.body(14))
                    .foregroundStyle(NexusColors.textSecondary)

                Spacer()

                Button {
                    Task { await saveSelections() }
                } label: {
                    HStack(spacing: NexusSpacing.sm) {
                        if isSaving {
                            ProgressView().tint(.white).scaleEffect(0.7)
                        }
                        Text(allowed ? "Allow" : "Deny")
                            .font(NexusFont.heading(14))
                    }
                    .foregroundStyle(.white)
                    .padding(.horizontal, 20)
                    .padding(.vertical, 10)
                    .background(allowed ? NexusColors.success : NexusColors.error)
                    .clipShape(RoundedRectangle(cornerRadius: NexusRadius.sm))
                }
                .disabled(isSaving)
            }
            .padding(.horizontal, NexusSpacing.lg)
            .padding(.vertical, 12)
            .background(NexusColors.background)
        }
    }

    private func saveSelections() async {
        isSaving = true
        for roleId in selectedRoles {
            try? await APIClient.shared.setPermission(
                guildId,
                command: commandName,
                targetType: "role",
                targetId: roleId,
                allowed: allowed
            )
        }
        await onSaved()
        isSaving = false
        dismiss()
    }
}

// MARK: - Member Picker Sheet (uses cached members — opens instantly, searches via cache)

struct MemberPickerSheet: View {
    let guildId: String
    let commandName: String
    let allowed: Bool
    let existingIds: Set<String>
    let onSaved: () async -> Void

    @EnvironmentObject var guildCache: GuildDataCache
    @Environment(\.dismiss) private var dismiss
    @State private var displayedMembers: [DiscordMember] = []
    @State private var selectedMembers: Set<String> = []
    @State private var isSaving = false
    @State private var searchText = ""
    @State private var searchTask: Task<Void, Never>?
    @State private var isSearching = false

    var body: some View {
        NavigationStack {
            ZStack {
                NexusColors.background.ignoresSafeArea()

                VStack(spacing: 0) {
                    // Search bar
                    HStack(spacing: NexusSpacing.sm) {
                        Image(systemName: "magnifyingglass")
                            .foregroundStyle(NexusColors.textMuted)
                        TextField("Search members...", text: $searchText)
                            .font(NexusFont.body(14))
                            .foregroundStyle(NexusColors.textPrimary)
                            .onChange(of: searchText) { _, newValue in
                                searchTask?.cancel()
                                searchTask = Task {
                                    try? await Task.sleep(nanoseconds: 300_000_000)
                                    if !Task.isCancelled {
                                        isSearching = true
                                        let results = await guildCache.searchMembers(query: newValue)
                                        if !Task.isCancelled {
                                            displayedMembers = results.filter { !existingIds.contains($0.id) }
                                            isSearching = false
                                        }
                                    }
                                }
                            }
                    }
                    .padding(NexusSpacing.md)
                    .background(NexusColors.cardBackground)
                    .clipShape(RoundedRectangle(cornerRadius: NexusRadius.md))
                    .padding(.horizontal, NexusSpacing.lg)
                    .padding(.top, NexusSpacing.md)

                    if !guildCache.membersLoaded && displayedMembers.isEmpty {
                        Spacer()
                        ProgressView()
                            .tint(NexusColors.cyan)
                        Spacer()
                    } else if displayedMembers.isEmpty && guildCache.membersError && searchText.isEmpty {
                        Spacer()
                        VStack(spacing: NexusSpacing.md) {
                            Image(systemName: "wifi.exclamationmark")
                                .font(.system(size: 28))
                                .foregroundStyle(NexusColors.warning)
                            Text("Couldn't load members")
                                .font(NexusFont.body(14))
                                .foregroundStyle(NexusColors.textSecondary)
                            Text("Network issue — tap to retry")
                                .font(NexusFont.caption(12))
                                .foregroundStyle(NexusColors.textMuted)
                            Button {
                                Task {
                                    await guildCache.loadMembers()
                                    displayedMembers = guildCache.initialMembers.filter { !existingIds.contains($0.id) }
                                }
                            } label: {
                                HStack(spacing: NexusSpacing.sm) {
                                    Image(systemName: "arrow.clockwise")
                                    Text("Retry")
                                }
                                .font(NexusFont.heading(14))
                                .foregroundStyle(.white)
                                .padding(.horizontal, 20)
                                .padding(.vertical, 10)
                                .background(NexusColors.cyan)
                                .clipShape(RoundedRectangle(cornerRadius: NexusRadius.sm))
                            }
                        }
                        Spacer()
                    } else if displayedMembers.isEmpty {
                        Spacer()
                        Text(searchText.isEmpty ? "No members found" : "No results for \"\(searchText)\"")
                            .font(NexusFont.body(14))
                            .foregroundStyle(NexusColors.textMuted)
                        Spacer()
                    } else {
                        ScrollView {
                            LazyVStack(spacing: 2) {
                                ForEach(displayedMembers) { member in
                                    memberRow(member)
                                }
                            }
                            .padding(.horizontal, NexusSpacing.lg)
                            .padding(.top, NexusSpacing.md)
                            .padding(.bottom, 80)
                        }
                    }

                    // Bottom save bar
                    if !selectedMembers.isEmpty {
                        saveBar
                    }
                }
            }
            .navigationTitle(allowed ? "Allow Users" : "Deny Users")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") { dismiss() }
                        .foregroundStyle(NexusColors.textSecondary)
                }
            }
        }
        .presentationDetents([.large])
        .onAppear {
            // Immediately show cached members — no loading needed
            displayedMembers = guildCache.initialMembers.filter { !existingIds.contains($0.id) }
        }
    }

    private func memberRow(_ member: DiscordMember) -> some View {
        let isSelected = selectedMembers.contains(member.id)
        return Button {
            if isSelected {
                selectedMembers.remove(member.id)
            } else {
                selectedMembers.insert(member.id)
            }
        } label: {
            HStack(spacing: NexusSpacing.md) {
                if let avatarURL = member.avatarURL {
                    AsyncImage(url: avatarURL) { image in
                        image.resizable().scaledToFill()
                    } placeholder: {
                        Circle().fill(NexusColors.surfaceElevated)
                    }
                    .frame(width: 32, height: 32)
                    .clipShape(Circle())
                } else {
                    Circle()
                        .fill(NexusColors.surfaceElevated)
                        .frame(width: 32, height: 32)
                        .overlay(
                            Text(String(member.displayName.prefix(1)).uppercased())
                                .font(NexusFont.caption(12))
                                .foregroundStyle(NexusColors.textMuted)
                        )
                }

                VStack(alignment: .leading, spacing: 2) {
                    Text(member.displayName)
                        .font(NexusFont.body(14))
                        .foregroundStyle(NexusColors.textPrimary)
                    if member.displayName != member.username {
                        Text("@\(member.username)")
                            .font(NexusFont.caption(11))
                            .foregroundStyle(NexusColors.textMuted)
                    }
                }

                Spacer()

                Image(systemName: isSelected ? "checkmark.circle.fill" : "circle")
                    .font(.system(size: 22))
                    .foregroundStyle(isSelected ? (allowed ? NexusColors.success : NexusColors.error) : NexusColors.textMuted)
            }
            .padding(.horizontal, NexusSpacing.md)
            .padding(.vertical, 10)
            .background(isSelected ? (allowed ? NexusColors.success : NexusColors.error).opacity(0.08) : NexusColors.cardBackground)
            .clipShape(RoundedRectangle(cornerRadius: NexusRadius.md))
        }
    }

    private var saveBar: some View {
        VStack(spacing: 0) {
            Divider().background(NexusColors.border)
            HStack {
                Text("\(selectedMembers.count) user\(selectedMembers.count == 1 ? "" : "s") selected")
                    .font(NexusFont.body(14))
                    .foregroundStyle(NexusColors.textSecondary)

                Spacer()

                Button {
                    Task { await saveSelections() }
                } label: {
                    HStack(spacing: NexusSpacing.sm) {
                        if isSaving {
                            ProgressView().tint(.white).scaleEffect(0.7)
                        }
                        Text(allowed ? "Allow" : "Deny")
                            .font(NexusFont.heading(14))
                    }
                    .foregroundStyle(.white)
                    .padding(.horizontal, 20)
                    .padding(.vertical, 10)
                    .background(allowed ? NexusColors.success : NexusColors.error)
                    .clipShape(RoundedRectangle(cornerRadius: NexusRadius.sm))
                }
                .disabled(isSaving)
            }
            .padding(.horizontal, NexusSpacing.lg)
            .padding(.vertical, 12)
            .background(NexusColors.background)
        }
    }

    private func saveSelections() async {
        isSaving = true
        for memberId in selectedMembers {
            try? await APIClient.shared.setPermission(
                guildId,
                command: commandName,
                targetType: "user",
                targetId: memberId,
                allowed: allowed
            )
        }
        await onSaved()
        isSaving = false
        dismiss()
    }
}

// MARK: - Color Extension for Discord role colors

extension Color {
    init(hex: Int) {
        self.init(
            red: Double((hex >> 16) & 0xFF) / 255.0,
            green: Double((hex >> 8) & 0xFF) / 255.0,
            blue: Double(hex & 0xFF) / 255.0
        )
    }
}
