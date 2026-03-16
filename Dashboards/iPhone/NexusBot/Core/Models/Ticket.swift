import Foundation
import SwiftUI

// MARK: - Ticket Model

struct BotTicket: Codable, Identifiable {
    let id: Int
    let guildId: String?
    let userId: String
    let username: String
    let category: String
    let subcategory: String?
    var status: String // "open", "claimed", "closed"
    let subject: String
    let message: String?
    let claimedBy: String?
    let closedBy: String?
    let closedReason: String?
    let createdAt: String
    let updatedAt: String
    let closedAt: String?
    var unreadCount: Int?

    enum CodingKeys: String, CodingKey {
        case id, guildId, userId, username, category, subcategory, status, subject, message, claimedBy, closedBy, closedReason, createdAt, updatedAt, closedAt, unreadCount
    }

    var statusColor: Color {
        switch status.lowercased() {
        case "open": return NexusColors.success
        case "claimed": return NexusColors.warning
        case "closed": return NexusColors.textMuted
        default: return NexusColors.textSecondary
        }
    }

    var statusIcon: String {
        switch status.lowercased() {
        case "open": return "checkmark.circle"
        case "claimed": return "person.fill"
        case "closed": return "xmark.circle.fill"
        default: return "circle.fill"
        }
    }

    var createdDate: Date? {
        ISO8601DateFormatter().date(from: createdAt)
    }

    var updatedDate: Date? {
        ISO8601DateFormatter().date(from: updatedAt)
    }

    var categoryIcon: String {
        switch category.lowercased() {
        case "help": return "questionmark.circle.fill"
        case "appeal": return "scale.3d"
        case "suggestion": return "lightbulb.fill"
        case "bug": return "ant.fill"
        case "feedback": return "bubble.left.fill"
        default: return "envelope.fill"
        }
    }
}

// MARK: - Ticket Message

struct BotTicketMessage: Codable, Identifiable {
    let id: Int
    let ticketId: Int
    let authorType: String // "user", "staff"
    let authorId: String
    let authorName: String
    let message: String
    let dmMessageId: String?
    let attachments: [TicketAttachment]?
    let createdAt: String

    enum CodingKeys: String, CodingKey {
        case id, ticketId, authorType, authorId, authorName, message, dmMessageId, attachments, createdAt
    }

    var isStaffMessage: Bool {
        authorType.lowercased() == "staff"
    }

    var createdDate: Date? {
        ISO8601DateFormatter().date(from: createdAt)
    }
}

// MARK: - Ticket Attachment

struct TicketAttachment: Codable, Identifiable {
    let id: String
    let url: String
    let filename: String
    let contentType: String

    enum CodingKeys: String, CodingKey {
        case url, filename, contentType
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        url = try container.decode(String.self, forKey: .url)
        filename = try container.decode(String.self, forKey: .filename)
        contentType = try container.decode(String.self, forKey: .contentType)
        id = url // Use URL as unique identifier
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(url, forKey: .url)
        try container.encode(filename, forKey: .filename)
        try container.encode(contentType, forKey: .contentType)
    }

    var isImage: Bool {
        contentType.hasPrefix("image/")
    }

    var isPDF: Bool {
        contentType == "application/pdf"
    }

    var displayName: String {
        filename.count > 30 ? String(filename.prefix(27)) + "..." : filename
    }
}

// MARK: - Ticket Stats

struct TicketStats: Codable {
    let openCount: Int
    let claimedCount: Int
    let closedCount: Int

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        openCount = try container.decodeFlexibleInt(forKey: .openCount)
        claimedCount = try container.decodeFlexibleInt(forKey: .claimedCount)
        closedCount = try container.decodeFlexibleInt(forKey: .closedCount)
    }

    private enum CodingKeys: String, CodingKey {
        case openCount, claimedCount, closedCount
    }
}

// MARK: - Ticket Ban

struct TicketBan: Codable, Identifiable {
    let userId: String
    let username: String
    let reason: String
    let bannedBy: String
    let createdAt: String

    var id: String { userId }

    enum CodingKeys: String, CodingKey {
        case userId, username, reason, bannedBy, createdAt
    }

    var createdDate: Date? {
        ISO8601DateFormatter().date(from: createdAt)
    }
}

// MARK: - API Response Types

struct TicketsListResponse: Codable {
    let tickets: [BotTicket]
    let pagination: PaginationInfo
}

struct TicketDetailResponse: Codable {
    let ticket: BotTicket
    let messages: [BotTicketMessage]
}

struct BannedUsersResponse: Codable {
    let bans: [TicketBan]
}

// MARK: - Request Bodies

struct CreateTicketReplyRequest: Encodable {
    let message: String
}

struct BanUserRequest: Encodable {
    let userId: String
    let reason: String
}

struct UnbanUserRequest: Encodable {
    let userId: String
}
