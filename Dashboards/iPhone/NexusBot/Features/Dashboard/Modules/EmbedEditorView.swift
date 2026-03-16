import SwiftUI

// MARK: - Embed Config Model

/// Represents a full Discord embed configuration stored in module config.
/// All fields are optional — only set fields appear in the embed.
struct EmbedConfig {
    var enabled: Bool = true
    var color: String = ""
    var title: String = ""
    var titleUrl: String = ""
    var description: String = ""
    var authorName: String = ""
    var authorIconUrl: String = ""
    var authorUrl: String = ""
    var thumbnailUrl: String = ""
    var imageUrl: String = ""
    var footerText: String = ""
    var footerIconUrl: String = ""
    var fields: [[String: Any]] = []  // [{name, value, inline}]

    /// Read from a nested config dictionary
    static func from(config: [String: AnyCodable], prefix: String) -> EmbedConfig {
        var ec = EmbedConfig()
        let dict: [String: Any]

        if prefix.isEmpty {
            dict = config.mapValues { $0.value }
        } else {
            dict = (config[prefix]?.value as? [String: Any]) ?? [:]
        }

        ec.enabled = dict["useEmbed"] as? Bool ?? dict["enabled"] as? Bool ?? true
        ec.color = dict["embedColor"] as? String ?? dict["color"] as? String ?? ""
        ec.title = dict["embedTitle"] as? String ?? dict["title"] as? String ?? ""
        ec.titleUrl = dict["embedTitleUrl"] as? String ?? dict["titleUrl"] as? String ?? ""
        ec.description = dict["embedDescription"] as? String ?? dict["description"] as? String ?? ""
        ec.authorName = dict["embedAuthorName"] as? String ?? dict["authorName"] as? String ?? ""
        ec.authorIconUrl = dict["embedAuthorIconUrl"] as? String ?? dict["authorIconUrl"] as? String ?? ""
        ec.authorUrl = dict["embedAuthorUrl"] as? String ?? dict["authorUrl"] as? String ?? ""
        ec.thumbnailUrl = dict["embedThumbnailUrl"] as? String ?? dict["thumbnailUrl"] as? String ?? ""
        ec.imageUrl = dict["embedImageUrl"] as? String ?? dict["imageUrl"] as? String ?? ""
        ec.footerText = dict["embedFooterText"] as? String ?? dict["footerText"] as? String ?? ""
        ec.footerIconUrl = dict["embedFooterIconUrl"] as? String ?? dict["footerIconUrl"] as? String ?? ""
        if let f = dict["embedFields"] as? [[String: Any]] ?? dict["fields"] as? [[String: Any]] {
            ec.fields = f
        }
        return ec
    }

    /// Write back to config dictionary
    func write(to config: inout [String: AnyCodable], prefix: String) {
        if prefix.isEmpty {
            config["useEmbed"] = AnyCodable(enabled)
            config["embedColor"] = AnyCodable(color)
            config["embedTitle"] = AnyCodable(title)
            config["embedTitleUrl"] = AnyCodable(titleUrl)
            config["embedDescription"] = AnyCodable(description)
            config["embedAuthorName"] = AnyCodable(authorName)
            config["embedAuthorIconUrl"] = AnyCodable(authorIconUrl)
            config["embedAuthorUrl"] = AnyCodable(authorUrl)
            config["embedThumbnailUrl"] = AnyCodable(thumbnailUrl)
            config["embedImageUrl"] = AnyCodable(imageUrl)
            config["embedFooterText"] = AnyCodable(footerText)
            config["embedFooterIconUrl"] = AnyCodable(footerIconUrl)
            if !fields.isEmpty {
                config["embedFields"] = AnyCodable(fields)
            }
        } else {
            var dict = (config[prefix]?.value as? [String: Any]) ?? [:]
            dict["useEmbed"] = enabled
            dict["embedColor"] = color
            dict["embedTitle"] = title
            dict["embedTitleUrl"] = titleUrl
            dict["embedDescription"] = description
            dict["embedAuthorName"] = authorName
            dict["embedAuthorIconUrl"] = authorIconUrl
            dict["embedAuthorUrl"] = authorUrl
            dict["embedThumbnailUrl"] = thumbnailUrl
            dict["embedImageUrl"] = imageUrl
            dict["embedFooterText"] = footerText
            dict["embedFooterIconUrl"] = footerIconUrl
            if !fields.isEmpty {
                dict["embedFields"] = fields
            }
            config[prefix] = AnyCodable(dict)
        }
    }
}

// MARK: - Embed Editor View

/// Full Discord embed editor with live preview — like Dyno's dashboard.
/// Supports title, description, color, author, image, thumbnail, footer, and fields.
struct EmbedEditorView: View {
    let sectionTitle: String
    let configPrefix: String  // e.g., "welcome" — reads from config["welcome"]["embedColor"] etc.
    @Binding var config: [String: AnyCodable]

    @State private var embed = EmbedConfig()
    @State private var showPreview = true
    @State private var showColorPicker = false
    @State private var expandAuthor = false
    @State private var expandImages = false
    @State private var expandFooter = false
    @State private var expandFields = false

    var body: some View {
        VStack(alignment: .leading, spacing: NexusSpacing.lg) {
            // Section header
            HStack(spacing: NexusSpacing.sm) {
                Image(systemName: "rectangle.3.group.bubble.fill")
                    .font(.system(size: 13))
                    .foregroundStyle(NexusColors.purple)
                Text("Embed Editor")
                    .font(NexusFont.heading(14))
                    .foregroundStyle(NexusColors.textSecondary)
                Spacer()
                Button {
                    withAnimation(.easeInOut(duration: 0.2)) { showPreview.toggle() }
                } label: {
                    HStack(spacing: 4) {
                        Image(systemName: showPreview ? "eye.fill" : "eye.slash")
                            .font(.system(size: 12))
                        Text(showPreview ? "Preview" : "Show Preview")
                            .font(NexusFont.caption(11))
                    }
                    .foregroundStyle(NexusColors.cyan)
                }
            }
            .padding(.leading, NexusSpacing.xs)

            // Live preview
            if showPreview {
                embedPreview
                    .transition(.opacity.combined(with: .scale(scale: 0.95)))
            }

            // Editor form
            VStack(spacing: 1) {
                // Enable toggle
                embedToggle

                // Color
                colorRow

                // Title
                embedTextField("Title", text: $embed.title, placeholder: "Embed title")
                embedTextField("Title URL", text: $embed.titleUrl, placeholder: "https://…")

                // Description
                embedTextArea("Description", text: $embed.description, placeholder: "Embed description — supports {user}, {server}, {memberCount}, etc.")
            }
            .background(NexusColors.cardBackground)
            .clipShape(RoundedRectangle(cornerRadius: NexusRadius.md))

            // Author section (collapsible)
            collapsibleSection("Author", icon: "person.crop.circle", expanded: $expandAuthor) {
                embedTextField("Name", text: $embed.authorName, placeholder: "Author name")
                embedTextField("Icon URL", text: $embed.authorIconUrl, placeholder: "https://…")
                embedTextField("URL", text: $embed.authorUrl, placeholder: "https://…")
            }

            // Images section (collapsible)
            collapsibleSection("Images", icon: "photo", expanded: $expandImages) {
                embedTextField("Thumbnail URL", text: $embed.thumbnailUrl, placeholder: "https://… (small, top-right)")
                embedTextField("Image URL", text: $embed.imageUrl, placeholder: "https://… (large, bottom)")
            }

            // Footer section (collapsible)
            collapsibleSection("Footer", icon: "text.below.photo", expanded: $expandFooter) {
                embedTextField("Text", text: $embed.footerText, placeholder: "Footer text")
                embedTextField("Icon URL", text: $embed.footerIconUrl, placeholder: "https://…")
            }

            // Fields section (collapsible)
            collapsibleSection("Fields", icon: "list.bullet.rectangle", expanded: $expandFields) {
                fieldsEditor
            }
        }
        .onAppear { loadEmbed() }
        .onChange(of: embed.enabled) { _, _ in saveEmbed() }
        .onChange(of: embed.color) { _, _ in saveEmbed() }
        .onChange(of: embed.title) { _, _ in saveEmbed() }
        .onChange(of: embed.titleUrl) { _, _ in saveEmbed() }
        .onChange(of: embed.description) { _, _ in saveEmbed() }
        .onChange(of: embed.authorName) { _, _ in saveEmbed() }
        .onChange(of: embed.authorIconUrl) { _, _ in saveEmbed() }
        .onChange(of: embed.authorUrl) { _, _ in saveEmbed() }
        .onChange(of: embed.thumbnailUrl) { _, _ in saveEmbed() }
        .onChange(of: embed.imageUrl) { _, _ in saveEmbed() }
        .onChange(of: embed.footerText) { _, _ in saveEmbed() }
        .onChange(of: embed.footerIconUrl) { _, _ in saveEmbed() }
    }

    // MARK: - Toggle

    private var embedToggle: some View {
        HStack {
            Text("Use Embed")
                .font(NexusFont.body(14))
                .foregroundStyle(NexusColors.textPrimary)
            Spacer()
            Toggle("", isOn: $embed.enabled)
                .tint(NexusColors.cyan)
                .labelsHidden()
        }
        .padding(.horizontal, NexusSpacing.md)
        .padding(.vertical, NexusSpacing.sm + 2)
    }

    // MARK: - Color Row

    private var colorRow: some View {
        HStack {
            Text("Color")
                .font(NexusFont.body(14))
                .foregroundStyle(NexusColors.textPrimary)
            Spacer()
            Button {
                showColorPicker = true
            } label: {
                HStack(spacing: NexusSpacing.sm) {
                    RoundedRectangle(cornerRadius: 4)
                        .fill(embedColor)
                        .frame(width: 24, height: 24)
                        .overlay(
                            RoundedRectangle(cornerRadius: 4)
                                .strokeBorder(NexusColors.border, lineWidth: 1)
                        )
                    Text(embed.color.isEmpty ? "Default" : embed.color.uppercased())
                        .font(NexusFont.mono(13))
                        .foregroundStyle(NexusColors.cyan)
                }
            }
        }
        .padding(.horizontal, NexusSpacing.md)
        .padding(.vertical, NexusSpacing.sm + 2)
        .sheet(isPresented: $showColorPicker) {
            ColorPickerSheet(
                currentHex: embed.color,
                presets: [
                    ("Default", "#5865F2"), ("Red", "#E74C3C"), ("Orange", "#E67E22"),
                    ("Yellow", "#F1C40F"), ("Green", "#2ECC71"), ("Teal", "#1ABC9C"),
                    ("Blue", "#3498DB"), ("Purple", "#9B59B6"), ("Pink", "#E91E63"),
                    ("Dark Red", "#992D22"), ("Dark Green", "#1F8B4C"), ("Dark Blue", "#206694"),
                    ("Dark Purple", "#71368A"), ("Blurple", "#5865F2"), ("Greyple", "#99AAB5"),
                    ("Dark Theme", "#2C2F33"), ("Fuchsia", "#EB459E"), ("Cyan", "#00FFFF"),
                    ("White", "#FFFFFF"), ("Black", "#000000"),
                ],
                onSelect: { hex in
                    embed.color = hex
                    showColorPicker = false
                },
                onClear: {
                    embed.color = ""
                    showColorPicker = false
                }
            )
        }
    }

    // MARK: - Text Field Row

    private func embedTextField(_ label: String, text: Binding<String>, placeholder: String) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(label)
                .font(NexusFont.caption(11))
                .foregroundStyle(NexusColors.textMuted)
            TextField(placeholder, text: text)
                .font(NexusFont.body(14))
                .foregroundStyle(NexusColors.textPrimary)
        }
        .padding(.horizontal, NexusSpacing.md)
        .padding(.vertical, NexusSpacing.sm)
    }

    // MARK: - Text Area Row

    private func embedTextArea(_ label: String, text: Binding<String>, placeholder: String) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(label)
                .font(NexusFont.caption(11))
                .foregroundStyle(NexusColors.textMuted)
            TextField(placeholder, text: text, axis: .vertical)
                .font(NexusFont.body(14))
                .foregroundStyle(NexusColors.textPrimary)
                .lineLimit(3...8)
        }
        .padding(.horizontal, NexusSpacing.md)
        .padding(.vertical, NexusSpacing.sm)
    }

    // MARK: - Collapsible Section

    private func collapsibleSection<Content: View>(_ title: String, icon: String, expanded: Binding<Bool>, @ViewBuilder content: () -> Content) -> some View {
        VStack(spacing: 0) {
            Button {
                withAnimation(.easeInOut(duration: 0.2)) { expanded.wrappedValue.toggle() }
            } label: {
                HStack(spacing: NexusSpacing.sm) {
                    Image(systemName: icon)
                        .font(.system(size: 13))
                        .foregroundStyle(NexusColors.textSecondary)
                    Text(title)
                        .font(NexusFont.heading(13))
                        .foregroundStyle(NexusColors.textSecondary)
                    Spacer()
                    Image(systemName: expanded.wrappedValue ? "chevron.up" : "chevron.down")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(NexusColors.textMuted)
                }
                .padding(.horizontal, NexusSpacing.md)
                .padding(.vertical, NexusSpacing.sm + 4)
                .background(NexusColors.cardBackground)
            }

            if expanded.wrappedValue {
                VStack(spacing: 1) {
                    content()
                }
                .background(NexusColors.cardBackground)
                .transition(.opacity)
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: NexusRadius.md))
    }

    // MARK: - Fields Editor

    private var fieldsEditor: some View {
        VStack(spacing: NexusSpacing.sm) {
            ForEach(embed.fields.indices, id: \.self) { index in
                fieldRow(index: index)
            }

            Button {
                embed.fields.append(["name": "Field", "value": "Value", "inline": false])
                saveEmbed()
            } label: {
                HStack(spacing: NexusSpacing.sm) {
                    Image(systemName: "plus.circle.fill")
                        .foregroundStyle(NexusColors.cyan)
                    Text("Add Field")
                        .font(NexusFont.body(13))
                        .foregroundStyle(NexusColors.cyan)
                }
                .padding(.horizontal, NexusSpacing.md)
                .padding(.vertical, NexusSpacing.sm)
            }
        }
        .padding(.vertical, NexusSpacing.sm)
    }

    private func fieldRow(index: Int) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text("Field \(index + 1)")
                    .font(NexusFont.caption(11))
                    .foregroundStyle(NexusColors.textMuted)
                Spacer()
                Button {
                    embed.fields.remove(at: index)
                    saveEmbed()
                } label: {
                    Image(systemName: "trash")
                        .font(.system(size: 12))
                        .foregroundStyle(NexusColors.error)
                }
            }

            TextField("Name", text: fieldBinding(index: index, key: "name"))
                .font(NexusFont.body(13))
                .foregroundStyle(NexusColors.textPrimary)
                .padding(NexusSpacing.sm)
                .background(NexusColors.surfaceElevated)
                .clipShape(RoundedRectangle(cornerRadius: NexusRadius.sm))

            TextField("Value", text: fieldBinding(index: index, key: "value"))
                .font(NexusFont.body(13))
                .foregroundStyle(NexusColors.textPrimary)
                .padding(NexusSpacing.sm)
                .background(NexusColors.surfaceElevated)
                .clipShape(RoundedRectangle(cornerRadius: NexusRadius.sm))

            Toggle("Inline", isOn: fieldInlineBinding(index: index))
                .font(NexusFont.body(13))
                .foregroundStyle(NexusColors.textPrimary)
                .tint(NexusColors.cyan)
        }
        .padding(.horizontal, NexusSpacing.md)
        .padding(.vertical, NexusSpacing.sm)
        .background(NexusColors.surfaceElevated.opacity(0.5))
        .clipShape(RoundedRectangle(cornerRadius: NexusRadius.sm))
        .padding(.horizontal, NexusSpacing.sm)
    }

    private func fieldBinding(index: Int, key: String) -> Binding<String> {
        Binding(
            get: { embed.fields.indices.contains(index) ? (embed.fields[index][key] as? String ?? "") : "" },
            set: { newValue in
                if embed.fields.indices.contains(index) {
                    embed.fields[index][key] = newValue
                    saveEmbed()
                }
            }
        )
    }

    private func fieldInlineBinding(index: Int) -> Binding<Bool> {
        Binding(
            get: { embed.fields.indices.contains(index) ? (embed.fields[index]["inline"] as? Bool ?? false) : false },
            set: { newValue in
                if embed.fields.indices.contains(index) {
                    embed.fields[index]["inline"] = newValue
                    saveEmbed()
                }
            }
        )
    }

    // MARK: - Live Preview

    private var embedColor: Color {
        let hex = embed.color.isEmpty ? "5865F2" : embed.color.replacingOccurrences(of: "#", with: "")
        return Color(hex: hex)
    }

    private var embedPreview: some View {
        HStack(spacing: 0) {
            // Left color bar
            RoundedRectangle(cornerRadius: 3)
                .fill(embedColor)
                .frame(width: 4)

            // Embed body
            VStack(alignment: .leading, spacing: NexusSpacing.sm) {
                // Author
                if !embed.authorName.isEmpty {
                    HStack(spacing: 6) {
                        if !embed.authorIconUrl.isEmpty {
                            AsyncImage(url: URL(string: embed.authorIconUrl)) { image in
                                image.resizable()
                            } placeholder: {
                                Circle().fill(NexusColors.surfaceElevated)
                            }
                            .frame(width: 20, height: 20)
                            .clipShape(Circle())
                        }
                        Text(embed.authorName)
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(Color.white)
                    }
                }

                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: 6) {
                        // Title
                        if !embed.title.isEmpty {
                            Text(embed.title)
                                .font(.system(size: 15, weight: .bold))
                                .foregroundStyle(embed.titleUrl.isEmpty ? Color.white : Color(hex: "00AAFF"))
                        }

                        // Description
                        if !embed.description.isEmpty {
                            Text(embed.description)
                                .font(.system(size: 13))
                                .foregroundStyle(Color(hex: "DCDDDE"))
                                .lineLimit(6)
                        }

                        // Fields
                        if !embed.fields.isEmpty {
                            fieldsPreview
                        }
                    }

                    Spacer(minLength: 0)

                    // Thumbnail
                    if !embed.thumbnailUrl.isEmpty {
                        AsyncImage(url: URL(string: embed.thumbnailUrl)) { image in
                            image.resizable().aspectRatio(contentMode: .fill)
                        } placeholder: {
                            RoundedRectangle(cornerRadius: 4)
                                .fill(NexusColors.surfaceElevated)
                        }
                        .frame(width: 60, height: 60)
                        .clipShape(RoundedRectangle(cornerRadius: 4))
                    }
                }

                // Image
                if !embed.imageUrl.isEmpty {
                    AsyncImage(url: URL(string: embed.imageUrl)) { image in
                        image.resizable().aspectRatio(contentMode: .fit)
                    } placeholder: {
                        RoundedRectangle(cornerRadius: 4)
                            .fill(NexusColors.surfaceElevated)
                            .frame(height: 120)
                    }
                    .clipShape(RoundedRectangle(cornerRadius: 4))
                }

                // Footer
                if !embed.footerText.isEmpty {
                    HStack(spacing: 6) {
                        if !embed.footerIconUrl.isEmpty {
                            AsyncImage(url: URL(string: embed.footerIconUrl)) { image in
                                image.resizable()
                            } placeholder: {
                                Circle().fill(NexusColors.surfaceElevated)
                            }
                            .frame(width: 16, height: 16)
                            .clipShape(Circle())
                        }
                        Text(embed.footerText)
                            .font(.system(size: 11))
                            .foregroundStyle(Color(hex: "72767D"))
                    }
                }
            }
            .padding(NexusSpacing.md)
        }
        .background(Color(hex: "2F3136"))
        .clipShape(RoundedRectangle(cornerRadius: NexusRadius.sm))

        // "Embed Preview" label
        .overlay(alignment: .topTrailing) {
            Text("PREVIEW")
                .font(NexusFont.caption(9))
                .foregroundStyle(NexusColors.textMuted)
                .padding(.horizontal, 6)
                .padding(.vertical, 2)
                .background(NexusColors.background.opacity(0.8))
                .clipShape(RoundedRectangle(cornerRadius: 4))
                .padding(6)
        }
    }

    // MARK: - Fields Preview

    private var fieldsPreview: some View {
        let inlineFields = embed.fields.enumerated().map { (index: $0.offset, field: $0.element) }

        return VStack(alignment: .leading, spacing: 4) {
            ForEach(inlineFields, id: \.index) { item in
                let name = item.field["name"] as? String ?? ""
                let value = item.field["value"] as? String ?? ""

                VStack(alignment: .leading, spacing: 2) {
                    Text(name)
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(Color.white)
                    Text(value)
                        .font(.system(size: 12))
                        .foregroundStyle(Color(hex: "DCDDDE"))
                }
            }
        }
        .padding(.top, 4)
    }

    // MARK: - Load / Save

    private func loadEmbed() {
        embed = EmbedConfig.from(config: config, prefix: configPrefix)
    }

    private func saveEmbed() {
        embed.write(to: &config, prefix: configPrefix)
    }
}
