import SwiftUI

// MARK: - Config Channel Picker

/// Searchable channel picker that replaces raw Channel ID text fields.
/// Shows channel name with type icon, stores the channel ID in config.
struct ConfigChannelPicker: View {
    let label: String
    let key: String
    @Binding var config: [String: AnyCodable]
    var nested: Bool = false
    var voiceOnly: Bool = false
    @EnvironmentObject var guildCache: GuildDataCache
    @State private var showPicker = false

    private var currentId: String {
        if nested {
            let parts = key.split(separator: ".")
            if parts.count == 2, let parent = config[String(parts[0])]?.value as? [String: Any] {
                return parent[String(parts[1])] as? String ?? ""
            }
            return ""
        }
        return config[key]?.value as? String ?? ""
    }

    private var currentName: String {
        guard !currentId.isEmpty else { return "" }
        return guildCache.channelLookup[currentId] ?? "Unknown Channel"
    }

    private var availableChannels: [DiscordChannel] {
        voiceOnly ? guildCache.voiceChannels : guildCache.textChannels
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label)
                .font(NexusFont.caption(12))
                .foregroundStyle(NexusColors.textSecondary)

            Button {
                showPicker = true
            } label: {
                HStack(spacing: NexusSpacing.sm) {
                    if currentId.isEmpty {
                        Image(systemName: "number")
                            .font(.system(size: 14))
                            .foregroundStyle(NexusColors.textMuted)
                        Text("Select channel…")
                            .font(NexusFont.body(14))
                            .foregroundStyle(NexusColors.textMuted)
                    } else {
                        Image(systemName: channelIcon)
                            .font(.system(size: 14))
                            .foregroundStyle(NexusColors.cyan)
                        Text("# \(currentName)")
                            .font(NexusFont.body(14))
                            .foregroundStyle(NexusColors.textPrimary)
                    }
                    Spacer()
                    Image(systemName: "chevron.right")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(NexusColors.textMuted)
                }
                .padding(NexusSpacing.sm + 2)
                .background(NexusColors.surfaceElevated)
                .clipShape(RoundedRectangle(cornerRadius: NexusRadius.sm))
            }
        }
        .padding(.horizontal, NexusSpacing.md)
        .padding(.vertical, NexusSpacing.sm)
        .sheet(isPresented: $showPicker) {
            ChannelPickerSheet(
                channels: availableChannels,
                selectedId: currentId,
                onSelect: { channelId in
                    setValue(channelId)
                    showPicker = false
                },
                onClear: {
                    setValue("")
                    showPicker = false
                }
            )
        }
    }

    private var channelIcon: String {
        if let ch = guildCache.channels.first(where: { $0.id == currentId }) {
            return ch.typeIcon
        }
        return voiceOnly ? "speaker.wave.2" : "number"
    }

    private func setValue(_ newValue: String) {
        if nested {
            let parts = key.split(separator: ".")
            if parts.count == 2 {
                var parent = (config[String(parts[0])]?.value as? [String: Any]) ?? [:]
                parent[String(parts[1])] = newValue
                config[String(parts[0])] = AnyCodable(parent)
            }
        } else {
            config[key] = AnyCodable(newValue)
        }
    }
}

// MARK: - Channel Picker Sheet

struct ChannelPickerSheet: View {
    let channels: [DiscordChannel]
    let selectedId: String
    let onSelect: (String) -> Void
    let onClear: () -> Void
    @State private var searchText = ""
    @Environment(\.dismiss) private var dismiss

    private var filteredChannels: [DiscordChannel] {
        if searchText.isEmpty { return channels }
        return channels.filter { $0.name.localizedCaseInsensitiveContains(searchText) }
    }

    // Group channels by category
    private var groupedChannels: [(category: String, channels: [DiscordChannel])] {
        let allChannels = channels
        var groups: [(category: String, channels: [DiscordChannel])] = []
        let categorized = Dictionary(grouping: filteredChannels.filter { !$0.isCategory }) { ch -> String in
            if let parentId = ch.parentId,
               let cat = allChannels.first(where: { $0.id == parentId && $0.isCategory }) {
                return cat.name.uppercased()
            }
            return "NO CATEGORY"
        }
        let sortedKeys = categorized.keys.sorted { a, b in
            if a == "NO CATEGORY" { return false }
            if b == "NO CATEGORY" { return true }
            return a < b
        }
        for key in sortedKeys {
            if let chans = categorized[key] {
                groups.append((category: key, channels: chans.sorted { $0.position < $1.position }))
            }
        }
        return groups
    }

    var body: some View {
        NavigationStack {
            ZStack {
                NexusColors.background.ignoresSafeArea()

                ScrollView {
                    VStack(spacing: 0) {
                        // Search bar
                        HStack(spacing: NexusSpacing.sm) {
                            Image(systemName: "magnifyingglass")
                                .foregroundStyle(NexusColors.textMuted)
                            TextField("Search channels…", text: $searchText)
                                .font(NexusFont.body(14))
                                .foregroundStyle(NexusColors.textPrimary)
                        }
                        .padding(NexusSpacing.md)
                        .background(NexusColors.cardBackground)
                        .clipShape(RoundedRectangle(cornerRadius: NexusRadius.md))
                        .padding(.horizontal, NexusSpacing.lg)
                        .padding(.vertical, NexusSpacing.md)

                        // Clear selection button
                        if !selectedId.isEmpty {
                            Button {
                                onClear()
                            } label: {
                                HStack(spacing: NexusSpacing.sm) {
                                    Image(systemName: "xmark.circle.fill")
                                        .foregroundStyle(NexusColors.error)
                                    Text("Clear Selection")
                                        .font(NexusFont.body(14))
                                        .foregroundStyle(NexusColors.error)
                                    Spacer()
                                }
                                .padding(.horizontal, NexusSpacing.lg)
                                .padding(.vertical, NexusSpacing.sm)
                            }
                        }

                        // Grouped channel list
                        ForEach(groupedChannels, id: \.category) { group in
                            VStack(alignment: .leading, spacing: 0) {
                                Text(group.category)
                                    .font(NexusFont.caption(11))
                                    .foregroundStyle(NexusColors.textMuted)
                                    .padding(.horizontal, NexusSpacing.lg)
                                    .padding(.top, NexusSpacing.md)
                                    .padding(.bottom, NexusSpacing.xs)

                                VStack(spacing: 1) {
                                    ForEach(group.channels) { channel in
                                        Button {
                                            onSelect(channel.id)
                                        } label: {
                                            HStack(spacing: NexusSpacing.sm) {
                                                Image(systemName: channel.typeIcon)
                                                    .font(.system(size: 14))
                                                    .foregroundStyle(NexusColors.textSecondary)
                                                    .frame(width: 24)
                                                Text(channel.name)
                                                    .font(NexusFont.body(14))
                                                    .foregroundStyle(NexusColors.textPrimary)
                                                Spacer()
                                                if channel.id == selectedId {
                                                    Image(systemName: "checkmark.circle.fill")
                                                        .foregroundStyle(NexusColors.cyan)
                                                }
                                            }
                                            .padding(.horizontal, NexusSpacing.md)
                                            .padding(.vertical, NexusSpacing.sm + 4)
                                        }
                                    }
                                }
                                .background(NexusColors.cardBackground)
                                .clipShape(RoundedRectangle(cornerRadius: NexusRadius.md))
                                .padding(.horizontal, NexusSpacing.lg)
                            }
                        }

                        if filteredChannels.isEmpty {
                            VStack(spacing: NexusSpacing.md) {
                                Image(systemName: "magnifyingglass")
                                    .font(.system(size: 32))
                                    .foregroundStyle(NexusColors.textMuted)
                                Text("No channels found")
                                    .font(NexusFont.body(14))
                                    .foregroundStyle(NexusColors.textSecondary)
                            }
                            .frame(maxWidth: .infinity)
                            .padding(.top, NexusSpacing.xxl)
                        }
                    }
                    .padding(.bottom, 40)
                }
            }
            .navigationTitle("Select Channel")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                        .foregroundStyle(NexusColors.textSecondary)
                }
            }
        }
        .presentationDetents([.large])
    }
}

// MARK: - Config Role Picker

/// Searchable role picker that replaces raw Role ID text fields.
/// Shows role name with color dot, stores the role ID in config.
struct ConfigRolePicker: View {
    let label: String
    let key: String
    @Binding var config: [String: AnyCodable]
    var nested: Bool = false
    @EnvironmentObject var guildCache: GuildDataCache
    @State private var showPicker = false

    private var currentId: String {
        if nested {
            let parts = key.split(separator: ".")
            if parts.count == 2, let parent = config[String(parts[0])]?.value as? [String: Any] {
                return parent[String(parts[1])] as? String ?? ""
            }
            return ""
        }
        return config[key]?.value as? String ?? ""
    }

    private var currentName: String {
        guard !currentId.isEmpty else { return "" }
        return guildCache.roleLookup[currentId] ?? "Unknown Role"
    }

    private var currentColor: Color {
        guard !currentId.isEmpty,
              let role = guildCache.roles.first(where: { $0.id == currentId }),
              role.color != 0 else { return NexusColors.textSecondary }
        return Color(hex: String(format: "%06X", role.color))
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label)
                .font(NexusFont.caption(12))
                .foregroundStyle(NexusColors.textSecondary)

            Button {
                showPicker = true
            } label: {
                HStack(spacing: NexusSpacing.sm) {
                    if currentId.isEmpty {
                        Image(systemName: "at")
                            .font(.system(size: 14))
                            .foregroundStyle(NexusColors.textMuted)
                        Text("Select role…")
                            .font(NexusFont.body(14))
                            .foregroundStyle(NexusColors.textMuted)
                    } else {
                        Circle()
                            .fill(currentColor)
                            .frame(width: 12, height: 12)
                        Text("@\(currentName)")
                            .font(NexusFont.body(14))
                            .foregroundStyle(NexusColors.textPrimary)
                    }
                    Spacer()
                    Image(systemName: "chevron.right")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(NexusColors.textMuted)
                }
                .padding(NexusSpacing.sm + 2)
                .background(NexusColors.surfaceElevated)
                .clipShape(RoundedRectangle(cornerRadius: NexusRadius.sm))
            }
        }
        .padding(.horizontal, NexusSpacing.md)
        .padding(.vertical, NexusSpacing.sm)
        .sheet(isPresented: $showPicker) {
            RolePickerConfigSheet(
                roles: guildCache.roles.filter { !$0.managed },
                selectedId: currentId,
                onSelect: { roleId in
                    setValue(roleId)
                    showPicker = false
                },
                onClear: {
                    setValue("")
                    showPicker = false
                }
            )
        }
    }

    private func setValue(_ newValue: String) {
        if nested {
            let parts = key.split(separator: ".")
            if parts.count == 2 {
                var parent = (config[String(parts[0])]?.value as? [String: Any]) ?? [:]
                parent[String(parts[1])] = newValue
                config[String(parts[0])] = AnyCodable(parent)
            }
        } else {
            config[key] = AnyCodable(newValue)
        }
    }
}

// MARK: - Role Picker Config Sheet (single-select for config)

struct RolePickerConfigSheet: View {
    let roles: [DiscordRole]
    let selectedId: String
    let onSelect: (String) -> Void
    let onClear: () -> Void
    @State private var searchText = ""
    @Environment(\.dismiss) private var dismiss

    private var filteredRoles: [DiscordRole] {
        if searchText.isEmpty { return roles }
        return roles.filter { $0.name.localizedCaseInsensitiveContains(searchText) }
    }

    var body: some View {
        NavigationStack {
            ZStack {
                NexusColors.background.ignoresSafeArea()

                ScrollView {
                    VStack(spacing: 0) {
                        // Search bar
                        HStack(spacing: NexusSpacing.sm) {
                            Image(systemName: "magnifyingglass")
                                .foregroundStyle(NexusColors.textMuted)
                            TextField("Search roles…", text: $searchText)
                                .font(NexusFont.body(14))
                                .foregroundStyle(NexusColors.textPrimary)
                        }
                        .padding(NexusSpacing.md)
                        .background(NexusColors.cardBackground)
                        .clipShape(RoundedRectangle(cornerRadius: NexusRadius.md))
                        .padding(.horizontal, NexusSpacing.lg)
                        .padding(.vertical, NexusSpacing.md)

                        // Clear selection
                        if !selectedId.isEmpty {
                            Button {
                                onClear()
                            } label: {
                                HStack(spacing: NexusSpacing.sm) {
                                    Image(systemName: "xmark.circle.fill")
                                        .foregroundStyle(NexusColors.error)
                                    Text("Clear Selection")
                                        .font(NexusFont.body(14))
                                        .foregroundStyle(NexusColors.error)
                                    Spacer()
                                }
                                .padding(.horizontal, NexusSpacing.lg)
                                .padding(.vertical, NexusSpacing.sm)
                            }
                        }

                        // Role list
                        VStack(spacing: 1) {
                            ForEach(filteredRoles) { role in
                                Button {
                                    onSelect(role.id)
                                } label: {
                                    HStack(spacing: NexusSpacing.sm) {
                                        Circle()
                                            .fill(role.color != 0 ? Color(hex: String(format: "%06X", role.color)) : NexusColors.textSecondary)
                                            .frame(width: 12, height: 12)
                                        Text(role.name)
                                            .font(NexusFont.body(14))
                                            .foregroundStyle(NexusColors.textPrimary)
                                        Spacer()
                                        if role.id == selectedId {
                                            Image(systemName: "checkmark.circle.fill")
                                                .foregroundStyle(NexusColors.cyan)
                                        }
                                    }
                                    .padding(.horizontal, NexusSpacing.md)
                                    .padding(.vertical, NexusSpacing.sm + 4)
                                }
                            }
                        }
                        .background(NexusColors.cardBackground)
                        .clipShape(RoundedRectangle(cornerRadius: NexusRadius.md))
                        .padding(.horizontal, NexusSpacing.lg)

                        if filteredRoles.isEmpty {
                            VStack(spacing: NexusSpacing.md) {
                                Image(systemName: "magnifyingglass")
                                    .font(.system(size: 32))
                                    .foregroundStyle(NexusColors.textMuted)
                                Text("No roles found")
                                    .font(NexusFont.body(14))
                                    .foregroundStyle(NexusColors.textSecondary)
                            }
                            .frame(maxWidth: .infinity)
                            .padding(.top, NexusSpacing.xxl)
                        }
                    }
                    .padding(.bottom, 40)
                }
            }
            .navigationTitle("Select Role")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                        .foregroundStyle(NexusColors.textSecondary)
                }
            }
        }
        .presentationDetents([.large])
    }
}

// MARK: - Config Color Picker

/// Hex color picker for embed colors. Shows a color swatch + hex value.
/// Tap to open a grid of preset colors + custom hex input.
struct ConfigColorPicker: View {
    let label: String
    let key: String
    @Binding var config: [String: AnyCodable]
    var nested: Bool = false
    var defaultColor: String = ""
    @State private var showPicker = false

    private static let presetColors: [(name: String, hex: String)] = [
        ("Default", "#1F8B4C"), ("Red", "#E74C3C"), ("Orange", "#E67E22"),
        ("Yellow", "#F1C40F"), ("Green", "#2ECC71"), ("Teal", "#1ABC9C"),
        ("Blue", "#3498DB"), ("Purple", "#9B59B6"), ("Pink", "#E91E63"),
        ("Dark Red", "#992D22"), ("Dark Green", "#1F8B4C"), ("Dark Blue", "#206694"),
        ("Dark Purple", "#71368A"), ("Blurple", "#5865F2"), ("Greyple", "#99AAB5"),
        ("Dark Theme", "#2C2F33"), ("Fuchsia", "#EB459E"), ("Cyan", "#00FFFF"),
        ("White", "#FFFFFF"), ("Black", "#000000"),
    ]

    private var currentValue: String {
        if nested {
            let parts = key.split(separator: ".")
            if parts.count == 2, let parent = config[String(parts[0])]?.value as? [String: Any] {
                return parent[String(parts[1])] as? String ?? ""
            }
            return ""
        }
        return config[key]?.value as? String ?? ""
    }

    private var displayColor: Color {
        let hex = currentValue.isEmpty ? "#5865F2" : currentValue
        return Color(hex: hex.replacingOccurrences(of: "#", with: ""))
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label)
                .font(NexusFont.caption(12))
                .foregroundStyle(NexusColors.textSecondary)

            Button {
                showPicker = true
            } label: {
                HStack(spacing: NexusSpacing.sm) {
                    RoundedRectangle(cornerRadius: 4)
                        .fill(displayColor)
                        .frame(width: 28, height: 28)
                        .overlay(
                            RoundedRectangle(cornerRadius: 4)
                                .strokeBorder(NexusColors.border, lineWidth: 1)
                        )
                    Text(currentValue.isEmpty ? "No color set" : currentValue.uppercased())
                        .font(NexusFont.mono(14))
                        .foregroundStyle(currentValue.isEmpty ? NexusColors.textMuted : NexusColors.textPrimary)
                    Spacer()
                    Image(systemName: "chevron.right")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(NexusColors.textMuted)
                }
                .padding(NexusSpacing.sm + 2)
                .background(NexusColors.surfaceElevated)
                .clipShape(RoundedRectangle(cornerRadius: NexusRadius.sm))
            }
        }
        .padding(.horizontal, NexusSpacing.md)
        .padding(.vertical, NexusSpacing.sm)
        .sheet(isPresented: $showPicker) {
            ColorPickerSheet(
                currentHex: currentValue,
                presets: Self.presetColors,
                onSelect: { hex in
                    setValue(hex)
                    showPicker = false
                },
                onClear: {
                    setValue("")
                    showPicker = false
                }
            )
        }
    }

    private func setValue(_ newValue: String) {
        if nested {
            let parts = key.split(separator: ".")
            if parts.count == 2 {
                var parent = (config[String(parts[0])]?.value as? [String: Any]) ?? [:]
                parent[String(parts[1])] = newValue
                config[String(parts[0])] = AnyCodable(parent)
            }
        } else {
            config[key] = AnyCodable(newValue)
        }
    }
}

// MARK: - Color Picker Sheet

struct ColorPickerSheet: View {
    let currentHex: String
    let presets: [(name: String, hex: String)]
    let onSelect: (String) -> Void
    let onClear: () -> Void
    @State private var customHex = ""
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ZStack {
                NexusColors.background.ignoresSafeArea()

                ScrollView {
                    VStack(alignment: .leading, spacing: NexusSpacing.xl) {
                        // Custom hex input
                        VStack(alignment: .leading, spacing: NexusSpacing.sm) {
                            Text("Custom Hex")
                                .font(NexusFont.heading(14))
                                .foregroundStyle(NexusColors.textSecondary)
                                .padding(.leading, NexusSpacing.xs)

                            HStack(spacing: NexusSpacing.sm) {
                                RoundedRectangle(cornerRadius: 4)
                                    .fill(Color(hex: customHex.replacingOccurrences(of: "#", with: "")))
                                    .frame(width: 36, height: 36)
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 4)
                                            .strokeBorder(NexusColors.border, lineWidth: 1)
                                    )
                                TextField("#FFFFFF", text: $customHex)
                                    .font(NexusFont.mono(16))
                                    .foregroundStyle(NexusColors.textPrimary)
                                    .textInputAutocapitalization(.characters)
                                    .autocorrectionDisabled()
                                Button("Apply") {
                                    let hex = customHex.hasPrefix("#") ? customHex : "#\(customHex)"
                                    onSelect(hex)
                                }
                                .font(NexusFont.heading(14))
                                .foregroundStyle(NexusColors.cyan)
                                .disabled(customHex.replacingOccurrences(of: "#", with: "").count < 3)
                            }
                            .padding(NexusSpacing.md)
                            .background(NexusColors.cardBackground)
                            .clipShape(RoundedRectangle(cornerRadius: NexusRadius.md))
                        }

                        // Clear selection
                        if !currentHex.isEmpty {
                            Button {
                                onClear()
                            } label: {
                                HStack(spacing: NexusSpacing.sm) {
                                    Image(systemName: "xmark.circle.fill")
                                        .foregroundStyle(NexusColors.error)
                                    Text("Clear Color")
                                        .font(NexusFont.body(14))
                                        .foregroundStyle(NexusColors.error)
                                    Spacer()
                                }
                            }
                        }

                        // Preset grid
                        VStack(alignment: .leading, spacing: NexusSpacing.sm) {
                            Text("Presets")
                                .font(NexusFont.heading(14))
                                .foregroundStyle(NexusColors.textSecondary)
                                .padding(.leading, NexusSpacing.xs)

                            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: NexusSpacing.sm), count: 5), spacing: NexusSpacing.sm) {
                                ForEach(presets, id: \.hex) { preset in
                                    Button {
                                        onSelect(preset.hex)
                                    } label: {
                                        VStack(spacing: 4) {
                                            RoundedRectangle(cornerRadius: 8)
                                                .fill(Color(hex: preset.hex.replacingOccurrences(of: "#", with: "")))
                                                .frame(height: 44)
                                                .overlay(
                                                    RoundedRectangle(cornerRadius: 8)
                                                        .strokeBorder(
                                                            currentHex.lowercased() == preset.hex.lowercased()
                                                                ? NexusColors.cyan : NexusColors.border,
                                                            lineWidth: currentHex.lowercased() == preset.hex.lowercased() ? 2 : 1
                                                        )
                                                )
                                            Text(preset.name)
                                                .font(NexusFont.caption(10))
                                                .foregroundStyle(NexusColors.textMuted)
                                                .lineLimit(1)
                                        }
                                    }
                                }
                            }
                        }
                    }
                    .padding(.horizontal, NexusSpacing.lg)
                    .padding(.top, NexusSpacing.lg)
                    .padding(.bottom, 40)
                }
            }
            .navigationTitle("Pick Color")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                        .foregroundStyle(NexusColors.textSecondary)
                }
            }
        }
        .presentationDetents([.large])
        .onAppear {
            customHex = currentHex
        }
    }
}
