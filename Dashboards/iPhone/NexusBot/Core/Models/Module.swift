import Foundation
import SwiftUI

struct ModuleConfig: Codable {
    let enabled: Bool
    let config: [String: AnyCodable]?
}

struct ModuleInfo: Identifiable {
    let id: String          // module key name
    let displayName: String
    let icon: String        // SF Symbol
    let category: ModuleCategory
    var isEnabled: Bool
    var config: [String: AnyCodable]?
}

enum ModuleCategory: String, CaseIterable, Codable {
    case moderation = "Moderation"
    case protection = "Protection"
    case engagement = "Engagement"
    case economy = "Economy"
    case fun = "Fun"
    case social = "Social"
    case music = "Music"
    case utility = "Utility"
    case entertainment = "Entertainment"

    var color: Color {
        switch self {
        case .moderation: return NexusColors.error
        case .protection: return NexusColors.warning
        case .engagement: return NexusColors.cyan
        case .economy: return Color(hex: "FFD700")
        case .fun: return NexusColors.pink
        case .social: return NexusColors.purple
        case .music: return Color(hex: "1DB954")
        case .utility: return NexusColors.textSecondary
        case .entertainment: return NexusColors.pink
        }
    }

    var icon: String {
        switch self {
        case .moderation: return "shield.fill"
        case .protection: return "lock.shield.fill"
        case .engagement: return "sparkles"
        case .economy: return "dollarsign.circle.fill"
        case .fun: return "gamecontroller.fill"
        case .social: return "person.2.fill"
        case .music: return "music.note"
        case .utility: return "wrench.and.screwdriver.fill"
        case .entertainment: return "theatermasks.fill"
        }
    }
}

// Module registry — maps API names to display info
enum ModuleRegistry {
    static let modules: [(key: String, name: String, icon: String, category: ModuleCategory)] = [
        // Core
        ("core", "Core", "diamond.fill", .utility),

        // Moderation
        ("moderation", "Moderation", "shield.fill", .moderation),
        ("automod", "Auto Moderation", "eye.fill", .moderation),
        ("logging", "Logging", "doc.text.fill", .moderation),

        // Protection
        ("antiraid", "Anti-Raid", "lock.shield.fill", .protection),

        // Engagement
        ("leveling", "Leveling", "arrow.up.circle.fill", .engagement),
        ("reputation", "Reputation", "star.fill", .engagement),
        ("welcome", "Welcome", "hand.wave.fill", .engagement),
        ("autoroles", "Auto Roles", "person.badge.plus", .engagement),
        ("suggestions", "Suggestions", "lightbulb.fill", .engagement),
        ("polls", "Polls", "chart.bar.fill", .engagement),
        ("forms", "Forms", "doc.plaintext.fill", .engagement),
        ("birthdays", "Birthdays", "gift.fill", .engagement),
        ("invitetracker", "Invite Tracker", "link", .engagement),
        ("activitytracking", "Activity Tracking", "chart.xyaxis.line", .engagement),
        ("messagetracking", "Message Tracking", "message.fill", .engagement),

        // Economy
        ("currency", "Currency & Economy", "dollarsign.circle.fill", .economy),
        ("shop", "Shop", "cart.fill", .economy),
        ("casino", "Casino", "dice.fill", .economy),
        ("donationtracking", "Donation Tracking", "heart.fill", .economy),

        // Fun
        ("fun", "Fun", "gamecontroller.fill", .fun),
        ("giveaways", "Giveaways", "gift.fill", .fun),
        ("raffles", "Raffles", "ticket.fill", .fun),
        ("images", "Images", "photo.fill", .fun),
        ("soundboard", "Soundboard", "speaker.wave.3.fill", .fun),
        ("counting", "Counting", "number.circle.fill", .fun),

        // Social
        ("profile", "Profile", "person.crop.circle.fill", .social),
        ("family", "Family", "figure.2.and.child.holdinghands", .social),
        ("confessions", "Confessions", "eye.slash.fill", .social),
        ("userphone", "Userphone", "phone.fill", .social),
        ("voicephone", "Voice Phone", "phone.arrow.up.right.fill", .social),
        ("afk", "AFK", "moon.fill", .social),

        // Music
        ("music", "Music", "music.note", .music),

        // Utility
        ("tickets", "Tickets", "ticket.fill", .utility),
        ("reminders", "Reminders", "bell.fill", .utility),
        ("translation", "Translation", "globe", .utility),
        ("scheduledmessages", "Scheduled Messages", "clock.fill", .utility),
        ("customcommands", "Custom Commands", "terminal.fill", .utility),
        ("stickymessages", "Sticky Messages", "pin.fill", .utility),
        ("timers", "Timers", "timer", .utility),
        ("backup", "Backup", "externaldrive.fill", .utility),
        ("statschannels", "Stats Channels", "number.square.fill", .utility),
        ("tempvoice", "Temp Voice", "waveform", .utility),
        ("utilities", "Utilities", "wrench.and.screwdriver.fill", .utility),
        ("autosetup", "Auto Setup", "wand.and.stars", .utility),

        // Entertainment
        ("colorroles", "Color Roles", "paintpalette.fill", .entertainment),
        ("reactionroles", "Reaction Roles", "hand.thumbsup.fill", .entertainment),
        ("quoteboard", "Quote Board", "quote.bubble.fill", .entertainment),
        ("leaderboards", "Leaderboards", "trophy.fill", .entertainment),
        ("aichatbot", "AI Chatbot", "brain.fill", .entertainment),
    ]

    static func info(for key: String) -> (name: String, icon: String, category: ModuleCategory)? {
        guard let entry = modules.first(where: { $0.key == key }) else { return nil }
        return (entry.name, entry.icon, entry.category)
    }
}

// MARK: - AnyCodable (for dynamic module configs)

struct AnyCodable: Codable {
    let value: Any

    init(_ value: Any) {
        self.value = value
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if container.decodeNil() {
            value = NSNull()
        } else if let bool = try? container.decode(Bool.self) {
            value = bool
        } else if let int = try? container.decode(Int.self) {
            value = int
        } else if let double = try? container.decode(Double.self) {
            value = double
        } else if let string = try? container.decode(String.self) {
            value = string
        } else if let array = try? container.decode([AnyCodable].self) {
            value = array.map { $0.value }
        } else if let dict = try? container.decode([String: AnyCodable].self) {
            value = dict.mapValues { $0.value }
        } else {
            value = NSNull()
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch value {
        case is NSNull:
            try container.encodeNil()
        case let bool as Bool:
            try container.encode(bool)
        case let int as Int:
            try container.encode(int)
        case let double as Double:
            try container.encode(double)
        case let string as String:
            try container.encode(string)
        case let array as [Any]:
            try container.encode(array.map { AnyCodable($0) })
        case let dict as [String: Any]:
            try container.encode(dict.mapValues { AnyCodable($0) })
        default:
            try container.encodeNil()
        }
    }
}
