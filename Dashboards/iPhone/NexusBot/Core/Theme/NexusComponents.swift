import SwiftUI

// MARK: - Neon Card

struct NexusCard<Content: View>: View {
    var glowColor: Color = NexusColors.cyan
    var glowIntensity: CGFloat = 0.15
    @ViewBuilder var content: () -> Content

    var body: some View {
        content()
            .padding(NexusSpacing.lg)
            .background(NexusColors.cardBackground)
            .clipShape(RoundedRectangle(cornerRadius: NexusRadius.lg))
            .overlay(
                RoundedRectangle(cornerRadius: NexusRadius.lg)
                    .stroke(glowColor.opacity(0.2), lineWidth: 1)
            )
            .shadow(color: glowColor.opacity(glowIntensity), radius: 8, x: 0, y: 2)
    }
}

// MARK: - Stat Card

struct StatCard: View {
    let title: String
    let value: String
    let icon: String
    var accentColor: Color = NexusColors.cyan

    /// Compatibility: accept subtitle (ignored for display) and color/iconColor aliases
    init(title: String, value: String, subtitle: String? = nil, icon: String, color: Color) {
        self.title = title; self.value = value; self.icon = icon; self.accentColor = color
    }
    init(title: String, value: String, subtitle: String? = nil, icon: String, iconColor: Color) {
        self.title = title; self.value = value; self.icon = icon; self.accentColor = iconColor
    }
    init(title: String, value: String, icon: String, accentColor: Color = NexusColors.cyan) {
        self.title = title; self.value = value; self.icon = icon; self.accentColor = accentColor
    }

    var body: some View {
        NexusCard(glowColor: accentColor) {
            VStack(alignment: .leading, spacing: NexusSpacing.sm) {
                HStack {
                    Image(systemName: icon)
                        .font(.system(size: 14))
                        .foregroundStyle(accentColor)
                    Spacer()
                }
                Spacer()
                Text(value)
                    .font(NexusFont.stat(22))
                    .foregroundStyle(NexusColors.textPrimary)
                Text(title)
                    .font(NexusFont.caption())
                    .foregroundStyle(NexusColors.textSecondary)
            }
        }
        .frame(height: 110)
    }
}

// MARK: - Neon Button

struct NexusButton: View {
    let title: String
    var icon: String? = nil
    var style: ButtonVariant = .primary
    var isLoading: Bool = false
    let action: () -> Void

    enum ButtonVariant {
        case primary, secondary, destructive, ghost
    }

    private var backgroundColor: Color {
        switch style {
        case .primary: return NexusColors.cyan
        case .secondary: return NexusColors.purple
        case .destructive: return NexusColors.error
        case .ghost: return .clear
        }
    }

    private var foregroundColor: Color {
        switch style {
        case .ghost: return NexusColors.cyan
        default: return NexusColors.background
        }
    }

    var body: some View {
        Button(action: action) {
            HStack(spacing: NexusSpacing.sm) {
                if isLoading {
                    ProgressView()
                        .tint(foregroundColor)
                        .scaleEffect(0.8)
                } else {
                    if let icon {
                        Image(systemName: icon)
                            .font(.system(size: 14, weight: .semibold))
                    }
                    Text(title)
                        .font(NexusFont.caption(14))
                        .fontWeight(.semibold)
                }
            }
            .foregroundStyle(foregroundColor)
            .padding(.horizontal, NexusSpacing.xl)
            .padding(.vertical, NexusSpacing.md)
            .background(backgroundColor)
            .clipShape(RoundedRectangle(cornerRadius: NexusRadius.md))
            .shadow(color: backgroundColor.opacity(style == .ghost ? 0 : 0.3), radius: 6, x: 0, y: 2)
        }
        .disabled(isLoading)
    }
}

// MARK: - Module Toggle Row

struct ModuleToggleRow: View {
    let name: String
    let icon: String
    let category: String
    @Binding var isEnabled: Bool
    var onToggle: ((Bool) -> Void)? = nil

    var body: some View {
        HStack(spacing: NexusSpacing.md) {
            Image(systemName: icon)
                .font(.system(size: 18))
                .foregroundStyle(isEnabled ? NexusColors.cyan : NexusColors.textMuted)
                .frame(width: 36, height: 36)
                .background(
                    (isEnabled ? NexusColors.cyan : NexusColors.textMuted).opacity(0.1)
                )
                .clipShape(RoundedRectangle(cornerRadius: NexusRadius.sm))

            VStack(alignment: .leading, spacing: 2) {
                Text(name)
                    .font(NexusFont.body(15))
                    .foregroundStyle(NexusColors.textPrimary)
                Text(category)
                    .font(NexusFont.caption(12))
                    .foregroundStyle(NexusColors.textSecondary)
            }

            Spacer()

            Toggle("", isOn: $isEnabled)
                .tint(NexusColors.cyan)
                .labelsHidden()
                .onChange(of: isEnabled) { _, newValue in
                    onToggle?(newValue)
                }
        }
        .padding(NexusSpacing.md)
        .background(NexusColors.cardBackground)
        .clipShape(RoundedRectangle(cornerRadius: NexusRadius.md))
    }
}

// MARK: - Leaderboard Row

struct LeaderboardRow: View {
    let rank: Int
    let username: String
    let avatarUrl: String?
    let value: String
    let label: String

    private var rankColor: Color {
        switch rank {
        case 1: return Color(hex: "FFD700")
        case 2: return Color(hex: "C0C0C0")
        case 3: return Color(hex: "CD7F32")
        default: return NexusColors.textSecondary
        }
    }

    var body: some View {
        HStack(spacing: NexusSpacing.md) {
            Text("#\(rank)")
                .font(NexusFont.mono(14))
                .foregroundStyle(rankColor)
                .frame(width: 36)

            AsyncImage(url: URL(string: avatarUrl ?? "")) { image in
                image.resizable().scaledToFill()
            } placeholder: {
                Circle().fill(NexusColors.surfaceElevated)
            }
            .frame(width: 36, height: 36)
            .clipShape(Circle())

            VStack(alignment: .leading, spacing: 2) {
                Text(username)
                    .font(NexusFont.body(14))
                    .foregroundStyle(NexusColors.textPrimary)
                    .lineLimit(1)
                Text(label)
                    .font(NexusFont.caption(11))
                    .foregroundStyle(NexusColors.textSecondary)
            }

            Spacer()

            Text(value)
                .font(NexusFont.mono(15))
                .foregroundStyle(NexusColors.cyan)
        }
        .padding(.horizontal, NexusSpacing.md)
        .padding(.vertical, NexusSpacing.sm)
    }
}

// MARK: - Mod Case Row

struct ModCaseRow: View {
    let caseNumber: Int
    let actionType: String
    let targetUsername: String
    let moderatorUsername: String
    let reason: String?
    let timestamp: Date

    private var actionColor: Color {
        switch actionType.lowercased() {
        case "ban", "tempban": return NexusColors.error
        case "kick", "softban": return NexusColors.warning
        case "mute": return NexusColors.purple
        case "warn": return Color(hex: "F59E0B")
        case "note": return NexusColors.textSecondary
        default: return NexusColors.cyan
        }
    }

    private var actionIcon: String {
        switch actionType.lowercased() {
        case "ban", "tempban": return "hammer.fill"
        case "kick", "softban": return "figure.walk"
        case "mute": return "speaker.slash.fill"
        case "warn": return "exclamationmark.triangle.fill"
        case "note": return "note.text"
        case "unban": return "arrow.uturn.backward"
        case "unmute": return "speaker.wave.2.fill"
        default: return "gearshape.fill"
        }
    }

    var body: some View {
        HStack(spacing: NexusSpacing.md) {
            Image(systemName: actionIcon)
                .font(.system(size: 14))
                .foregroundStyle(actionColor)
                .frame(width: 32, height: 32)
                .background(actionColor.opacity(0.15))
                .clipShape(RoundedRectangle(cornerRadius: NexusRadius.sm))

            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: NexusSpacing.xs) {
                    Text("#\(caseNumber)")
                        .font(NexusFont.mono(12))
                        .foregroundStyle(NexusColors.textMuted)
                    Text(actionType.uppercased())
                        .font(NexusFont.caption(11))
                        .fontWeight(.bold)
                        .foregroundStyle(actionColor)
                    Text("@\(targetUsername)")
                        .font(NexusFont.body(13))
                        .foregroundStyle(NexusColors.textPrimary)
                        .lineLimit(1)
                }
                if let reason, !reason.isEmpty {
                    Text(reason)
                        .font(NexusFont.caption(12))
                        .foregroundStyle(NexusColors.textSecondary)
                        .lineLimit(2)
                }
                Text(timestamp, style: .relative)
                    .font(NexusFont.caption(11))
                    .foregroundStyle(NexusColors.textMuted)
            }

            Spacer()
        }
        .padding(NexusSpacing.md)
        .background(NexusColors.cardBackground)
        .clipShape(RoundedRectangle(cornerRadius: NexusRadius.md))
    }
}

// MARK: - Section Header

struct NexusSectionHeader: View {
    let title: String
    var subtitle: String? = nil
    var action: String? = nil
    var onAction: (() -> Void)? = nil

    var body: some View {
        HStack {
            Text(title.uppercased())
                .font(NexusFont.caption(12))
                .fontWeight(.bold)
                .foregroundStyle(NexusColors.textSecondary)
                .tracking(1.2)

            Spacer()

            if let action {
                Button(action: { onAction?() }) {
                    Text(action)
                        .font(NexusFont.caption(12))
                        .foregroundStyle(NexusColors.cyan)
                }
            }
        }
        .padding(.horizontal, NexusSpacing.xs)
    }
}

// MARK: - Loading Skeleton

struct SkeletonView: View {
    var width: CGFloat? = nil
    var height: CGFloat = 16

    @State private var shimmer = false

    var body: some View {
        RoundedRectangle(cornerRadius: NexusRadius.sm)
            .fill(NexusColors.surfaceElevated)
            .frame(width: width, height: height)
            .overlay(
                RoundedRectangle(cornerRadius: NexusRadius.sm)
                    .fill(
                        LinearGradient(
                            colors: [.clear, NexusColors.border.opacity(0.3), .clear],
                            startPoint: .leading,
                            endPoint: .trailing
                        )
                    )
                    .offset(x: shimmer ? 200 : -200)
            )
            .clipShape(RoundedRectangle(cornerRadius: NexusRadius.sm))
            .onAppear {
                withAnimation(.linear(duration: 1.5).repeatForever(autoreverses: false)) {
                    shimmer = true
                }
            }
    }
}

// MARK: - Empty State

struct EmptyStateView: View {
    let icon: String
    let title: String
    let message: String

    /// Default init
    init(icon: String, title: String, message: String) {
        self.icon = icon; self.title = title; self.message = message
    }

    /// Compatibility: subtitle instead of message
    init(icon: String = "tray", title: String, subtitle: String) {
        self.icon = icon; self.title = title; self.message = subtitle
    }

    /// Compatibility: description + optional action
    init(icon: String, title: String, description: String, action: (() -> Void)? = nil, actionLabel: String? = nil) {
        self.icon = icon; self.title = title; self.message = description
    }

    /// Compatibility: title + subtitle + explicit iconName
    init(title: String, subtitle: String, iconName: String) {
        self.icon = iconName; self.title = title; self.message = subtitle
    }

    /// Compatibility: with action
    init(title: String, subtitle: String, actionTitle: String, action: @escaping () -> Void) {
        self.icon = "tray"; self.title = title; self.message = subtitle
    }

    var body: some View {
        VStack(spacing: NexusSpacing.lg) {
            Image(systemName: icon)
                .font(.system(size: 48))
                .foregroundStyle(NexusColors.textMuted)
            Text(title)
                .font(NexusFont.heading(18))
                .foregroundStyle(NexusColors.textPrimary)
            Text(message)
                .font(NexusFont.body(14))
                .foregroundStyle(NexusColors.textSecondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity, alignment: .top)
        .padding(NexusSpacing.xxl)
    }
}

// MARK: - Badge

enum NexusBadgeStyle {
    case primary, secondary, highlight, success, destructive
}

struct NexusBadge: View {
    let text: String
    var color: Color = NexusColors.cyan

    var body: some View {
        Text(text.uppercased())
            .font(NexusFont.caption(10))
            .fontWeight(.bold)
            .foregroundStyle(color)
            .padding(.horizontal, NexusSpacing.sm)
            .padding(.vertical, NexusSpacing.xs)
            .background(color.opacity(0.15))
            .clipShape(RoundedRectangle(cornerRadius: NexusRadius.sm))
    }

    /// Compatibility: (text:, backgroundColor:, textColor:)
    init(text: String, backgroundColor: Color, textColor: Color = .white) {
        self.text = text
        self.color = textColor
    }

    /// Compatibility: (text:, backgroundColor:)
    init(text: String, backgroundColor: Color) {
        self.text = text
        self.color = backgroundColor
    }

    /// Compatibility: (text:, style:)
    init(text: String, style: NexusBadgeStyle) {
        self.text = text
        switch style {
        case .primary: self.color = NexusColors.cyan
        case .secondary: self.color = NexusColors.textSecondary
        case .highlight: self.color = NexusColors.purple
        case .success: self.color = NexusColors.success
        case .destructive: self.color = NexusColors.error
        }
    }

    /// Default init
    init(text: String, color: Color = NexusColors.cyan) {
        self.text = text
        self.color = color
    }
}
