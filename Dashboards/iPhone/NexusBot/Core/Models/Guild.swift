import Foundation
import SwiftUI

struct Guild: Codable, Identifiable {
    let id: String
    let name: String
    let icon: String?
    let owner: Bool?
    let permissions: String?

    // From guilds table (when fetched via API)
    let ownerId: String?
    let premiumTier: String?
    let premiumExpiresAt: String?
    let locale: String?
    let timezone: String?
    let isActive: Bool?
    let memberCount: Int?

    var iconURL: URL? {
        guard let icon else { return nil }
        return URL(string: "https://cdn.discordapp.com/icons/\(id)/\(icon).png?size=128")
    }

    var initial: String {
        String(name.prefix(1)).uppercased()
    }

    /// Custom decoder: Discord API sends `permissions` as a number, but our model uses String?.
    /// Also handles `memberCount` which may come as a string from PostgreSQL aggregates.
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        name = try c.decode(String.self, forKey: .name)
        icon = try c.decodeIfPresent(String.self, forKey: .icon)
        owner = try c.decodeIfPresent(Bool.self, forKey: .owner)

        // Discord sends permissions as Int or String depending on API version
        if let strVal = try? c.decodeIfPresent(String.self, forKey: .permissions) {
            permissions = strVal
        } else if let intVal = try? c.decodeIfPresent(Int.self, forKey: .permissions) {
            permissions = String(intVal)
        } else {
            permissions = nil
        }

        ownerId = try c.decodeIfPresent(String.self, forKey: .ownerId)
        premiumTier = try c.decodeIfPresent(String.self, forKey: .premiumTier)
        premiumExpiresAt = try c.decodeIfPresent(String.self, forKey: .premiumExpiresAt)
        locale = try c.decodeIfPresent(String.self, forKey: .locale)
        timezone = try c.decodeIfPresent(String.self, forKey: .timezone)
        isActive = try c.decodeIfPresent(Bool.self, forKey: .isActive)
        memberCount = try c.decodeFlexibleIntIfPresent(forKey: .memberCount)
    }

    private enum CodingKeys: String, CodingKey {
        case id, name, icon, owner, permissions, ownerId, premiumTier, premiumExpiresAt, locale, timezone, isActive, memberCount
    }
}

enum PremiumTier: String, Codable, CaseIterable {
    case free
    case pro
    case plus
    case premium

    var displayName: String {
        rawValue.capitalized
    }

    var color: Color {
        switch self {
        case .free: return NexusColors.textSecondary
        case .pro: return NexusColors.purple
        case .plus: return NexusColors.cyan
        case .premium: return Color(hex: "FFD700")
        }
    }

    var icon: String {
        switch self {
        case .free: return "circle.fill"
        case .pro: return "star.fill"
        case .plus: return "bolt.fill"
        case .premium: return "crown.fill"
        }
    }
}

struct GuildDetail: Codable {
    let guild: Guild
    let modules: [String: ModuleConfig]
}

struct GuildStats: Codable {
    let totalMembers: Int
    let totalMessages: Int
    let totalVoiceMinutes: Int
    let averageLevel: Double
    let highestLevel: Int
}

struct GuildSettings: Codable {
    var locale: String?
    var timezone: String?
}

struct AuthResponse: Codable {
    let user: AuthUser
    let guilds: [Guild]
}

struct AuthUser: Codable, Identifiable {
    let id: String
    let username: String
    let avatar: String?
    let isOwner: Bool

    var avatarURL: URL? {
        guard let avatar else { return nil }
        return URL(string: "https://cdn.discordapp.com/avatars/\(id)/\(avatar).png?size=128")
    }
}

// MARK: - Discord Role (from bot API)

struct DiscordRole: Codable, Identifiable, Hashable {
    let id: String
    let name: String
    let color: Int        // 0 = default, otherwise RGB int
    let position: Int
    let managed: Bool

    var displayColor: String {
        guard color != 0 else { return "" }
        return String(format: "#%06X", color)
    }
}

struct RolesResponse: Codable {
    let roles: [DiscordRole]
}

// MARK: - Discord Member (from bot API)

struct DiscordMember: Codable, Identifiable, Hashable {
    let id: String
    let username: String
    let displayName: String
    let avatar: String?   // full URL or nil

    var avatarURL: URL? {
        guard let avatar else { return nil }
        return URL(string: avatar)
    }
}

struct MembersResponse: Codable {
    let members: [DiscordMember]
}

// MARK: - Discord Channel (from bot API)

struct DiscordChannel: Codable, Identifiable, Hashable {
    let id: String
    let name: String
    let type: Int         // 0=text, 2=voice, 4=category, 5=announcement, 13=stage, 15=forum
    let position: Int
    let parentId: String?

    var isText: Bool { type == 0 || type == 5 || type == 15 }
    var isVoice: Bool { type == 2 || type == 13 }
    var isCategory: Bool { type == 4 }

    var typeIcon: String {
        switch type {
        case 0: return "number"            // text
        case 2: return "speaker.wave.2"    // voice
        case 4: return "folder"            // category
        case 5: return "megaphone"         // announcement
        case 13: return "mic.fill"         // stage
        case 15: return "text.bubble"      // forum
        default: return "number"
        }
    }

    var typeName: String {
        switch type {
        case 0: return "Text"
        case 2: return "Voice"
        case 4: return "Category"
        case 5: return "Announcement"
        case 13: return "Stage"
        case 15: return "Forum"
        default: return "Channel"
        }
    }
}

struct ChannelsResponse: Codable {
    let channels: [DiscordChannel]
}
