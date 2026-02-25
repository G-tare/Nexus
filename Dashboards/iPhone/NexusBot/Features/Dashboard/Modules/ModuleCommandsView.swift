import SwiftUI

/// Lists all commands for a given module, each navigable to a per-command permission editor
struct ModuleCommandsView: View {
    let guildId: String
    let moduleKey: String
    let moduleName: String
    let moduleColor: Color

    @EnvironmentObject var guildCache: GuildDataCache
    @State private var searchText = ""

    private var commands: [CommandDef] {
        CommandRegistry.forModule(moduleKey)
    }

    private var filteredCommands: [CommandDef] {
        if searchText.isEmpty { return commands }
        return commands.filter {
            $0.name.localizedCaseInsensitiveContains(searchText) ||
            $0.description.localizedCaseInsensitiveContains(searchText)
        }
    }

    var body: some View {
        ZStack {
            NexusColors.background.ignoresSafeArea()

            ScrollView {
                VStack(alignment: .leading, spacing: NexusSpacing.lg) {
                    // Header stat
                    NexusCard(glowColor: moduleColor) {
                        HStack(spacing: NexusSpacing.lg) {
                            VStack(alignment: .leading, spacing: NexusSpacing.xs) {
                                Text("\(commands.count)")
                                    .font(NexusFont.heading(28))
                                    .foregroundStyle(moduleColor)
                                Text("Commands")
                                    .font(NexusFont.caption(12))
                                    .foregroundStyle(NexusColors.textSecondary)
                            }

                            Divider()
                                .frame(height: 36)
                                .background(NexusColors.border)

                            VStack(alignment: .leading, spacing: NexusSpacing.xs) {
                                Text("\(totalRuleCount)")
                                    .font(NexusFont.heading(28))
                                    .foregroundStyle(NexusColors.cyan)
                                Text("Permission Rules")
                                    .font(NexusFont.caption(12))
                                    .foregroundStyle(NexusColors.textSecondary)
                            }

                            Spacer()
                        }
                    }

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

                    // Commands list — instant from cache, no loading spinner needed
                    if filteredCommands.isEmpty {
                        EmptyStateView(
                            icon: "magnifyingglass",
                            title: "No Commands Found",
                            message: searchText.isEmpty
                                ? "This module has no registered commands."
                                : "No commands match your search."
                        )
                    } else {
                        ForEach(filteredCommands) { cmd in
                            NavigationLink {
                                CommandPermissionView(
                                    guildId: guildId,
                                    command: cmd,
                                    moduleColor: moduleColor
                                )
                                .environmentObject(guildCache)
                            } label: {
                                commandRow(cmd)
                            }
                        }
                    }
                }
                .padding(.horizontal, NexusSpacing.lg)
                .padding(.top, NexusSpacing.lg)
                .padding(.bottom, 100)
            }
            .refreshable {
                await guildCache.refreshPermissions()
            }
        }
        .navigationTitle("\(moduleName) Commands")
        .navigationBarTitleDisplayMode(.inline)
    }

    // MARK: - Command Row

    private func commandRow(_ cmd: CommandDef) -> some View {
        NexusCard {
            HStack(spacing: NexusSpacing.md) {
                Image(systemName: "terminal.fill")
                    .font(.system(size: 14))
                    .foregroundStyle(moduleColor)
                    .frame(width: 36, height: 36)
                    .background(moduleColor.opacity(0.1))
                    .clipShape(RoundedRectangle(cornerRadius: NexusRadius.sm))

                VStack(alignment: .leading, spacing: 3) {
                    Text("/\(cmd.name)")
                        .font(NexusFont.mono(14))
                        .foregroundStyle(NexusColors.textPrimary)
                    Text(cmd.description)
                        .font(NexusFont.caption(12))
                        .foregroundStyle(NexusColors.textMuted)
                        .lineLimit(1)
                }

                Spacer()

                // Rule count badge — read from cache instantly
                let ruleCount = guildCache.permissions[cmd.name]?.count ?? 0
                if ruleCount > 0 {
                    NexusBadge(
                        text: "\(ruleCount) rule\(ruleCount == 1 ? "" : "s")",
                        color: NexusColors.cyan
                    )
                }

                Image(systemName: "chevron.right")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(NexusColors.textMuted)
            }
        }
    }

    // MARK: - Helpers

    private var totalRuleCount: Int {
        let moduleCommandNames = Set(commands.map { $0.name })
        return guildCache.permissions
            .filter { moduleCommandNames.contains($0.key) }
            .values.reduce(0) { $0 + $1.count }
    }
}
