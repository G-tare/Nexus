import SwiftUI

struct ModuleListView: View {
    let guildId: String
    @EnvironmentObject var guildCache: GuildDataCache
    @State private var isLoading = true
    @State private var searchText = ""
    @State private var selectedCategory: ModuleCategory?

    private var allModules: [ModuleInfo] {
        ModuleRegistry.modules.map { entry in
            let config = guildCache.modules[entry.key]
            return ModuleInfo(
                id: entry.key,
                displayName: entry.name,
                icon: entry.icon,
                category: entry.category,
                isEnabled: config?.enabled ?? true,
                config: config?.config
            )
        }
    }

    private var filteredModules: [ModuleInfo] {
        var result = allModules
        if let category = selectedCategory {
            result = result.filter { $0.category == category }
        }
        if !searchText.isEmpty {
            result = result.filter {
                $0.displayName.localizedCaseInsensitiveContains(searchText) ||
                $0.category.rawValue.localizedCaseInsensitiveContains(searchText)
            }
        }
        return result
    }

    private var groupedModules: [(ModuleCategory, [ModuleInfo])] {
        Dictionary(grouping: filteredModules, by: \.category)
            .sorted { $0.key.rawValue < $1.key.rawValue }
    }

    var body: some View {
        ZStack {
            NexusColors.background.ignoresSafeArea()

            VStack(spacing: 0) {
                // Search bar
                HStack(spacing: NexusSpacing.sm) {
                    Image(systemName: "magnifyingglass")
                        .foregroundStyle(NexusColors.textMuted)
                    TextField("Search modules...", text: $searchText)
                        .font(NexusFont.body(14))
                        .foregroundStyle(NexusColors.textPrimary)
                }
                .padding(NexusSpacing.md)
                .background(NexusColors.cardBackground)
                .clipShape(RoundedRectangle(cornerRadius: NexusRadius.md))
                .padding(.horizontal, NexusSpacing.lg)
                .padding(.top, NexusSpacing.sm)

                // Category filter chips
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: NexusSpacing.sm) {
                        CategoryChip(
                            name: "All",
                            isSelected: selectedCategory == nil,
                            color: NexusColors.cyan
                        ) {
                            selectedCategory = nil
                        }

                        ForEach(ModuleCategory.allCases, id: \.rawValue) { category in
                            let count = allModules.filter { $0.category == category }.count
                            if count > 0 {
                                CategoryChip(
                                    name: category.rawValue,
                                    isSelected: selectedCategory == category,
                                    color: category.color
                                ) {
                                    selectedCategory = selectedCategory == category ? nil : category
                                }
                            }
                        }
                    }
                    .padding(.horizontal, NexusSpacing.lg)
                    .padding(.vertical, NexusSpacing.md)
                }

                // Module list
                ScrollView {
                    LazyVStack(spacing: NexusSpacing.lg, pinnedViews: .sectionHeaders) {
                        ForEach(groupedModules, id: \.0) { category, categoryModules in
                            Section {
                                VStack(spacing: NexusSpacing.sm) {
                                    ForEach(categoryModules) { module in
                                        NavigationLink {
                                            ModuleConfigView(
                                                guildId: guildId,
                                                moduleKey: module.id,
                                                moduleName: module.displayName,
                                                moduleIcon: module.icon,
                                                category: module.category
                                            )
                                            .environmentObject(guildCache)
                                        } label: {
                                            moduleRow(module)
                                        }
                                    }
                                }
                            } header: {
                                HStack(spacing: NexusSpacing.sm) {
                                    Image(systemName: category.icon)
                                        .font(.system(size: 12))
                                        .foregroundStyle(category.color)
                                    Text(category.rawValue.uppercased())
                                        .font(NexusFont.caption(11))
                                        .fontWeight(.bold)
                                        .foregroundStyle(NexusColors.textSecondary)
                                        .tracking(1)
                                    Spacer()
                                    Text("\(categoryModules.count)")
                                        .font(NexusFont.mono(11))
                                        .foregroundStyle(NexusColors.textMuted)
                                }
                                .padding(.horizontal, NexusSpacing.lg)
                                .padding(.vertical, NexusSpacing.sm)
                                .background(NexusColors.background)
                            }
                        }
                    }
                    .padding(.bottom, 100)
                }
            }
        }
        .task { await loadModules() }
    }

    @ViewBuilder
    private func moduleRow(_ module: ModuleInfo) -> some View {
        HStack(spacing: NexusSpacing.md) {
            Image(systemName: module.icon)
                .font(.system(size: 16))
                .foregroundStyle(module.isEnabled ? module.category.color : NexusColors.textMuted)
                .frame(width: 36, height: 36)
                .background(
                    (module.isEnabled ? module.category.color : NexusColors.textMuted).opacity(0.1)
                )
                .clipShape(RoundedRectangle(cornerRadius: NexusRadius.sm))

            VStack(alignment: .leading, spacing: 2) {
                Text(module.displayName)
                    .font(NexusFont.body(14))
                    .foregroundStyle(NexusColors.textPrimary)
            }

            Spacer()

            Circle()
                .fill(module.isEnabled ? NexusColors.success : NexusColors.textMuted)
                .frame(width: 8, height: 8)

            Image(systemName: "chevron.right")
                .font(.system(size: 12))
                .foregroundStyle(NexusColors.textMuted)
        }
        .padding(NexusSpacing.md)
        .background(NexusColors.cardBackground)
        .clipShape(RoundedRectangle(cornerRadius: NexusRadius.md))
        .padding(.horizontal, NexusSpacing.lg)
    }

    private func loadModules() async {
        isLoading = true
        if !guildCache.modulesLoaded {
            await guildCache.loadModules()
        }
        isLoading = false
    }
}

// MARK: - Category Chip

struct CategoryChip: View {
    let name: String
    let isSelected: Bool
    let color: Color
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(name)
                .font(NexusFont.caption(12))
                .fontWeight(.medium)
                .foregroundStyle(isSelected ? NexusColors.background : NexusColors.textSecondary)
                .padding(.horizontal, NexusSpacing.md)
                .padding(.vertical, NexusSpacing.sm)
                .background(isSelected ? color : NexusColors.cardBackground)
                .clipShape(RoundedRectangle(cornerRadius: NexusRadius.full))
                .overlay(
                    RoundedRectangle(cornerRadius: NexusRadius.full)
                        .stroke(isSelected ? color : NexusColors.border, lineWidth: 1)
                )
        }
    }
}
