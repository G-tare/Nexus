import SwiftUI

// MARK: - Color Palette

enum NexusColors {
    // Backgrounds
    static let background = Color(hex: "0A0A0F")
    static let cardBackground = Color(hex: "12121A")
    static let cardBackgroundLight = Color(hex: "1A1A2E")
    static let surfaceElevated = Color(hex: "16162A")

    // Accents
    static let cyan = Color(hex: "00F0FF")
    static let purple = Color(hex: "A855F7")
    static let pink = Color(hex: "F472B6")

    // Semantic
    static let success = Color(hex: "22C55E")
    static let warning = Color(hex: "F59E0B")
    static let error = Color(hex: "EF4444")

    // Text
    static let textPrimary = Color.white
    static let textSecondary = Color(hex: "8B8BA3")
    static let textMuted = Color(hex: "555570")

    // Borders
    static let border = Color(hex: "2A2A40")
    static let borderGlow = cyan.opacity(0.3)
    static let borderPurpleGlow = purple.opacity(0.3)

    // Gradients
    static let cyanGradient = LinearGradient(
        colors: [cyan, cyan.opacity(0.6)],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
    )

    static let purpleGradient = LinearGradient(
        colors: [purple, purple.opacity(0.6)],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
    )

    static let backgroundGradient = LinearGradient(
        colors: [background, Color(hex: "0D0D1A")],
        startPoint: .top,
        endPoint: .bottom
    )

    static let cardGradient = LinearGradient(
        colors: [cardBackground, cardBackground.opacity(0.8)],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
    )

    static let heroGradient = LinearGradient(
        colors: [cyan.opacity(0.15), purple.opacity(0.15), Color.clear],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
    )
}

// MARK: - Typography

enum NexusFont {
    static func title(_ size: CGFloat = 28) -> Font {
        .system(size: size, weight: .bold, design: .default)
    }

    static func heading(_ size: CGFloat = 20) -> Font {
        .system(size: size, weight: .semibold, design: .default)
    }

    static func body(_ size: CGFloat = 16) -> Font {
        .system(size: size, weight: .regular, design: .default)
    }

    static func caption(_ size: CGFloat = 13) -> Font {
        .system(size: size, weight: .medium, design: .default)
    }

    static func mono(_ size: CGFloat = 16) -> Font {
        .system(size: size, weight: .medium, design: .monospaced)
    }

    static func stat(_ size: CGFloat = 24) -> Font {
        .system(size: size, weight: .bold, design: .monospaced)
    }
}

// MARK: - Spacing

enum NexusSpacing {
    static let xs: CGFloat = 4
    static let sm: CGFloat = 8
    static let md: CGFloat = 12
    static let lg: CGFloat = 16
    static let xl: CGFloat = 24
    static let xxl: CGFloat = 32
}

// MARK: - Corner Radius

enum NexusRadius {
    static let sm: CGFloat = 8
    static let md: CGFloat = 12
    static let lg: CGFloat = 16
    static let xl: CGFloat = 20
    static let full: CGFloat = 100
}

// MARK: - Color Extension

extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch hex.count {
        case 3:
            (a, r, g, b) = (255, (int >> 8) * 17, (int >> 4 & 0xF) * 17, (int & 0xF) * 17)
        case 6:
            (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8:
            (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default:
            (a, r, g, b) = (255, 0, 0, 0)
        }
        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue: Double(b) / 255,
            opacity: Double(a) / 255
        )
    }
}
