import Foundation

struct ModCase: Codable, Identifiable {
    let id: Int
    let guildId: String
    let userId: String
    let moderatorId: String
    let action: String
    let reason: String?
    let duration: Int?
    let caseNumber: Int
    let createdAt: String

    // Display names (populated by API join or client-side)
    let username: String?
    let moderatorUsername: String?

    var createdDate: Date {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter.date(from: createdAt) ?? Date()
    }

    var durationDisplay: String? {
        guard let duration else { return nil }
        let hours = duration / 3600
        let minutes = (duration % 3600) / 60
        if hours > 24 {
            return "\(hours / 24)d"
        } else if hours > 0 {
            return "\(hours)h \(minutes)m"
        } else {
            return "\(minutes)m"
        }
    }
}

struct ModLogResponse: Codable {
    let cases: [ModCase]
    let page: Int
    let limit: Int
    let total: Int
}

// MARK: - Automod Logs

struct AutomodLog: Codable, Identifiable {
    let id: Int
    let guildId: String
    let targetId: String
    let action: String
    let violationType: String
    let reason: String?
    let messageContent: String?
    let channelId: String?
    let duration: Int?
    let createdAt: String

    // Display name (populated by API join)
    let username: String?

    var createdDate: Date {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter.date(from: createdAt) ?? Date()
    }

    var violationLabel: String {
        switch violationType {
        case "word_filter": return "Word Filter"
        case "anti_invite": return "Anti-Invite"
        case "anti_link": return "Anti-Link"
        case "spam_rate": return "Spam Rate"
        case "spam_duplicates": return "Duplicate Spam"
        case "emoji_spam": return "Emoji Spam"
        case "caps_spam": return "Caps Spam"
        case "mention_spam": return "Mention Spam"
        default: return violationType.replacingOccurrences(of: "_", with: " ").capitalized
        }
    }
}

struct AutomodLogResponse: Codable {
    let logs: [AutomodLog]
    let page: Int
    let limit: Int
    let total: Int
}

// MARK: - Permissions

struct Permission: Codable, Identifiable {
    var id: String { "\(command)_\(targetId)" }
    var command: String
    let targetType: String  // "role", "user", "channel"
    let targetId: String
    let allowed: Bool

    // Client-side resolved name (not from API — excluded from coding)
    var resolvedName: String?

    // API returns permissions grouped by command key — the rule objects
    // only contain targetType, targetId, allowed. The command is populated
    // from the dictionary key after decoding.
    enum CodingKeys: String, CodingKey {
        case targetType, targetId, allowed
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        self.targetType = try container.decode(String.self, forKey: .targetType)
        self.targetId = try container.decode(String.self, forKey: .targetId)
        self.allowed = try container.decode(Bool.self, forKey: .allowed)
        // Command is populated later from the dictionary key
        self.command = ""
        self.resolvedName = nil
    }

    init(command: String, targetType: String, targetId: String, allowed: Bool) {
        self.command = command
        self.targetType = targetType
        self.targetId = targetId
        self.allowed = allowed
        self.resolvedName = nil
    }
}
