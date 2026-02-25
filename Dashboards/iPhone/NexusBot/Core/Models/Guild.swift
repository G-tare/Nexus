import Foundation

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

    var iconURL: URL? {
        guard let icon else { return nil }
        return URL(string: "https://cdn.discordapp.com/icons/\(id)/\(icon).png?size=128")
    }

    var initial: String {
        String(name.prefix(1)).uppercased()
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
