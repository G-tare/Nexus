import Foundation

struct GuildMember: Codable, Identifiable {
    let id: Int
    let guildId: String
    let userId: String

    // Leveling
    let xp: Int
    let level: Int
    let totalXp: Int
    let prestige: Int

    // Currency
    let coins: Int
    let gems: Int
    let eventTokens: Int

    // Activity
    let totalMessages: Int
    let totalVoiceMinutes: Int
    let dailyMessages: Int

    // Streaks
    let dailyStreak: Int

    // Invites
    let inviteCount: Int
    let inviteFakeCount: Int
    let inviteLeaveCount: Int

    // Reputation
    let reputation: Int

    // Moderation
    let warnCount: Int
    let isMuted: Bool

    // Meta
    let joinedAt: String?
    let lastActiveAt: String?
}

struct UserProfile: Codable {
    let id: String
    let username: String
    let globalName: String?
    let avatarUrl: String?
    let locale: String?
    let timezone: String?
    let birthday: String?
    let afkMessage: String?
    let afkSince: String?
}

struct UserDetailResponse: Codable {
    let user: UserProfile?
    let member: GuildMember?
}

struct LeaderboardEntry: Codable, Identifiable {
    var id: Int { _id ?? rank }
    let _id: Int?
    let userId: String
    let username: String?
    let avatarUrl: String?

    // Values — different fields populated based on leaderboard type
    let level: Int?
    let totalXp: Int?
    let totalMessages: Int?
    let coins: Int?
    let totalVoiceMinutes: Int?
    let inviteCount: Int?
    let reputation: Int?

    // Computed rank (set by the list position)
    var rank: Int = 0

    enum CodingKeys: String, CodingKey {
        case _id = "id"
        case userId, username, avatarUrl
        case level, totalXp, totalMessages, coins
        case totalVoiceMinutes, inviteCount, reputation
    }

    func displayValue(for type: LeaderboardType) -> String {
        switch type {
        case .level: return "Lv. \(level ?? 0)"
        case .xp: return formatNumber(totalXp ?? 0)
        case .messages: return formatNumber(totalMessages ?? 0)
        case .coins: return formatNumber(coins ?? 0)
        case .voice: return formatMinutes(totalVoiceMinutes ?? 0)
        case .invites: return "\(inviteCount ?? 0)"
        case .reputation: return "\(reputation ?? 0)"
        }
    }

    func displayLabel(for type: LeaderboardType) -> String {
        switch type {
        case .level: return "\(formatNumber(totalXp ?? 0)) XP"
        case .xp: return "Level \(level ?? 0)"
        case .messages: return "messages"
        case .coins: return "coins"
        case .voice: return "in voice"
        case .invites: return "invites"
        case .reputation: return "rep"
        }
    }
}

enum LeaderboardType: String, CaseIterable {
    case level, xp, messages, coins, voice, invites, reputation

    var displayName: String {
        switch self {
        case .level: return "Level"
        case .xp: return "XP"
        case .messages: return "Messages"
        case .coins: return "Coins"
        case .voice: return "Voice"
        case .invites: return "Invites"
        case .reputation: return "Rep"
        }
    }

    var icon: String {
        switch self {
        case .level: return "arrow.up.circle.fill"
        case .xp: return "sparkles"
        case .messages: return "message.fill"
        case .coins: return "dollarsign.circle.fill"
        case .voice: return "waveform"
        case .invites: return "link"
        case .reputation: return "star.fill"
        }
    }
}

// MARK: - Helpers

func formatNumber(_ n: Int) -> String {
    if n >= 1_000_000 { return String(format: "%.1fM", Double(n) / 1_000_000) }
    if n >= 1_000 { return String(format: "%.1fK", Double(n) / 1_000) }
    return "\(n)"
}

func formatMinutes(_ mins: Int) -> String {
    let hours = mins / 60
    let remaining = mins % 60
    if hours > 0 { return "\(hours)h \(remaining)m" }
    return "\(remaining)m"
}
