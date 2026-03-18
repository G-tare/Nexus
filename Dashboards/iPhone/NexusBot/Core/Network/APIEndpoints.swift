import Foundation

// MARK: - Typed API Endpoint Helpers

extension APIClient {

    // MARK: - Auth

    func fetchMe() async throws -> AuthResponse {
        try await request("/auth/me")
    }

    // MARK: - Guilds

    /// Check which guild IDs the bot is active in
    func checkGuilds(_ guildIds: [String]) async throws -> [String] {
        struct Body: Encodable { let guildIds: [String] }
        struct Response: Decodable { let activeGuildIds: [String] }
        let response: Response = try await request(
            "/guilds/check",
            method: "POST",
            body: Body(guildIds: guildIds)
        )
        return response.activeGuildIds
    }

    func fetchGuild(_ guildId: String) async throws -> GuildDetail {
        try await request("/guilds/\(guildId)")
    }

    func fetchActivity(_ guildId: String, period: String = "7d") async throws -> ActivityResponse {
        try await request("/guilds/\(guildId)/activity?period=\(period)")
    }

    func fetchGuildStats(_ guildId: String) async throws -> GuildStats {
        try await request("/guilds/\(guildId)/stats")
    }

    func updateGuildSettings(_ guildId: String, settings: GuildSettings) async throws {
        try await send("/guilds/\(guildId)/settings", method: "PATCH", body: settings)
    }

    /// Fetch all roles for a guild (from Discord via bot token)
    func fetchGuildRoles(_ guildId: String) async throws -> [DiscordRole] {
        let response: RolesResponse = try await request("/guilds/\(guildId)/roles")
        return response.roles
    }

    /// Fetch all channels for a guild (from Discord via bot token)
    func fetchGuildChannels(_ guildId: String) async throws -> [DiscordChannel] {
        let response: ChannelsResponse = try await request("/guilds/\(guildId)/channels")
        return response.channels
    }

    /// Search guild members by username
    func searchGuildMembers(_ guildId: String, query: String = "") async throws -> [DiscordMember] {
        let encoded = query.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? query
        let response: MembersResponse = try await request("/guilds/\(guildId)/members/search?q=\(encoded)")
        return response.members
    }

    // MARK: - Modules

    func fetchModules(_ guildId: String) async throws -> [String: ModuleConfig] {
        try await request("/modules/\(guildId)")
    }

    func fetchModule(_ guildId: String, name: String) async throws -> ModuleConfig {
        try await request("/modules/\(guildId)/\(name)")
    }

    func toggleModule(_ guildId: String, name: String, enabled: Bool) async throws -> ToggleResponse {
        struct Body: Encodable { let enabled: Bool }
        return try await request(
            "/modules/\(guildId)/\(name)/toggle",
            method: "PATCH",
            body: Body(enabled: enabled)
        )
    }

    func updateModuleConfig(_ guildId: String, name: String, config: [String: AnyCodable]) async throws {
        struct Body: Encodable { let config: [String: AnyCodable] }
        try await send("/modules/\(guildId)/\(name)/config", method: "PUT", body: Body(config: config))
    }

    // MARK: - Users & Leaderboards

    func fetchUserDetail(_ guildId: String, userId: String) async throws -> UserDetailResponse {
        try await request("/users/\(guildId)/\(userId)")
    }

    func fetchLeaderboard(_ guildId: String, type: LeaderboardType, page: Int = 1, limit: Int = 25) async throws -> [LeaderboardEntry] {
        struct Response: Codable {
            let leaderboard: [LeaderboardEntry]
            let page: Int
            let limit: Int
        }
        let response: Response = try await request(
            "/users/\(guildId)/leaderboard/\(type.rawValue)?page=\(page)&limit=\(limit)"
        )
        // Add rank numbers
        return response.leaderboard.enumerated().map { index, entry in
            var ranked = entry
            ranked.rank = (response.page - 1) * response.limit + index + 1
            return ranked
        }
    }

    // MARK: - Mod Logs

    func fetchModLogs(_ guildId: String, page: Int = 1, limit: Int = 25, action: String? = nil) async throws -> ModLogResponse {
        var endpoint = "/guilds/\(guildId)/modlogs?page=\(page)&limit=\(limit)"
        if let action { endpoint += "&action=\(action)" }
        return try await request(endpoint)
    }

    func editModCase(_ guildId: String, caseNumber: Int, reason: String) async throws -> EditCaseResponse {
        return try await request(
            "/guilds/\(guildId)/modlogs/\(caseNumber)",
            method: "PATCH",
            body: ["reason": reason]
        )
    }

    // MARK: - Automod Logs

    func fetchAutomodLogs(_ guildId: String, page: Int = 1, limit: Int = 25, action: String? = nil) async throws -> AutomodLogResponse {
        var endpoint = "/guilds/\(guildId)/automodlogs?page=\(page)&limit=\(limit)"
        if let action { endpoint += "&action=\(action)" }
        return try await request(endpoint)
    }

    // MARK: - Permissions

    func fetchPermissions(_ guildId: String) async throws -> [String: [Permission]] {
        // API returns { "commandName": [{ targetType, targetId, allowed }] }
        // Permission decoder leaves `command` empty — we populate it from the dict key
        var result: [String: [Permission]] = try await request("/permissions/\(guildId)")
        for (commandName, _) in result {
            for i in result[commandName]!.indices {
                result[commandName]![i].command = commandName
            }
        }
        return result
    }

    func setPermission(_ guildId: String, command: String, targetType: String, targetId: String, allowed: Bool) async throws {
        struct Body: Encodable {
            let command: String
            let targetType: String
            let targetId: String
            let allowed: Bool
        }
        try await send(
            "/permissions/\(guildId)",
            method: "POST",
            body: Body(command: command, targetType: targetType, targetId: targetId, allowed: allowed)
        )
    }

    func removePermission(_ guildId: String, command: String, targetId: String) async throws {
        struct Body: Encodable {
            let command: String
            let targetId: String
        }
        try await send(
            "/permissions/\(guildId)",
            method: "DELETE",
            body: Body(command: command, targetId: targetId)
        )
    }

    // MARK: - Owner

    func fetchOwnerStats() async throws -> OwnerStats {
        try await request("/owner/stats")
    }

    func fetchOwnerGuilds(page: Int = 1, limit: Int = 25) async throws -> OwnerGuildsResponse {
        try await request("/owner/guilds?page=\(page)&limit=\(limit)")
    }

    func updatePremium(_ guildId: String, tier: String, expiresAt: String? = nil) async throws {
        struct Body: Encodable {
            let tier: String
            let expiresAt: String?
        }
        try await send("/owner/guilds/\(guildId)/premium", method: "PATCH", body: Body(tier: tier, expiresAt: expiresAt))
    }

    // MARK: - Owner Server Management

    func fetchOwnerServerSearch(query: String = "", tier: String = "", status: String = "", sort: String = "name", order: String = "asc", page: Int = 1) async throws -> ServerSearchResponse {
        var endpoint = "/owner/servers/search?page=\(page)&limit=25&sort=\(sort)&order=\(order)"
        if !query.isEmpty { endpoint += "&q=\(query.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? query)" }
        if !tier.isEmpty { endpoint += "&tier=\(tier)" }
        if !status.isEmpty { endpoint += "&status=\(status)" }
        return try await request(endpoint)
    }

    func fetchOwnerServerDetail(_ guildId: String) async throws -> ServerDetailResponse {
        try await request("/owner/servers/\(guildId)/detail")
    }

    func updateOwnerServerConfig(_ guildId: String, config: ServerConfigUpdate) async throws {
        try await send("/owner/servers/\(guildId)/config", method: "PATCH", body: config)
    }

    func leaveServer(_ guildId: String) async throws {
        try await send("/owner/servers/\(guildId)/leave", method: "POST", body: EmptyBody())
    }

    func resetServerConfig(_ guildId: String) async throws {
        try await send("/owner/servers/\(guildId)/reset-config", method: "POST", body: EmptyBody())
    }

    func fetchAnnouncements(page: Int = 1) async throws -> AnnouncementsResponse {
        try await request("/owner/servers/announcements?page=\(page)&limit=25")
    }

    func createAnnouncement(title: String, message: String, type: String) async throws -> AnnouncementCreateResponse {
        struct Body: Encodable { let title: String; let message: String; let type: String }
        return try await request("/owner/servers/announcements", method: "POST", body: Body(title: title, message: message, type: type))
    }

    func deleteAnnouncement(_ id: Int) async throws {
        try await send("/owner/servers/announcements/\(id)", method: "DELETE", body: EmptyBody())
    }

    // MARK: - Tickets

    func fetchTickets(
        status: String? = nil,
        category: String? = nil,
        search: String? = nil,
        page: Int = 1,
        limit: Int = 20
    ) async throws -> TicketsListResponse {
        var endpoint = "/owner/tickets?page=\(page)&limit=\(limit)"
        if let status { endpoint += "&status=\(status)" }
        if let category { endpoint += "&category=\(category)" }
        if let search {
            let encoded = search.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? search
            endpoint += "&search=\(encoded)"
        }
        return try await request(endpoint)
    }

    func fetchTicket(_ ticketId: Int) async throws -> TicketDetailResponse {
        try await request("/owner/tickets/\(ticketId)")
    }

    func fetchTicketStats() async throws -> TicketStats {
        try await request("/owner/tickets/stats")
    }

    func claimTicket(_ ticketId: Int) async throws {
        try await send("/owner/tickets/\(ticketId)/claim", method: "PATCH", body: EmptyBody())
    }

    func closeTicket(_ ticketId: Int, reason: String? = nil) async throws {
        struct Body: Encodable { let reason: String? }
        try await send("/owner/tickets/\(ticketId)/close", method: "PATCH", body: Body(reason: reason))
    }

    func reopenTicket(_ ticketId: Int) async throws {
        try await send("/owner/tickets/\(ticketId)/reopen", method: "PATCH", body: EmptyBody())
    }

    func markTicketAsRead(_ ticketId: Int) async throws {
        try await send("/owner/tickets/\(ticketId)/read", method: "PATCH", body: EmptyBody())
    }

    func replyToTicket(_ ticketId: Int, message: String) async throws {
        struct Body: Encodable { let message: String }
        try await send("/owner/tickets/\(ticketId)/reply", method: "POST", body: Body(message: message))
    }

    func fetchBannedUsers() async throws -> BannedUsersResponse {
        try await request("/owner/tickets/bans/list")
    }

    func banUserFromTickets(_ userId: String, reason: String) async throws {
        struct Body: Encodable { let userId: String; let reason: String }
        try await send("/owner/tickets/bans", method: "POST", body: Body(userId: userId, reason: reason))
    }

    func unbanUserFromTickets(_ userId: String) async throws {
        try await send("/owner/tickets/bans/\(userId)", method: "DELETE", body: EmptyBody())
    }

    // MARK: - Staff Management

    func fetchStaff() async throws -> StaffListResponse {
        try await request("/owner/staff")
    }

    func fetchStaffActivity(limit: Int = 20) async throws -> StaffActivityResponse {
        try await request("/owner/staff/activity?limit=\(limit)")
    }

    func addStaffMember(discordId: String, role: String = "support") async throws -> StaffMember {
        struct Body: Encodable { let discordId: String; let role: String }
        return try await request("/owner/staff", method: "POST", body: Body(discordId: discordId, role: role))
    }

    func updateStaffRole(_ staffId: Int, role: String) async throws {
        struct Body: Encodable { let role: String }
        try await send("/owner/staff/\(staffId)", method: "PATCH", body: Body(role: role))
    }

    func removeStaffMember(_ staffId: Int) async throws {
        try await send("/owner/staff/\(staffId)", method: "DELETE", body: EmptyBody())
    }

    // MARK: - Command Analytics

    /// Converts a relative range like "7d", "30d" to an ISO date string
    private func rangeToISO(_ range: String) -> String {
        let now = Date()
        var days = 30 // default
        if range.hasSuffix("d"), let num = Int(range.dropLast()) {
            days = num
        } else if range.hasSuffix("h"), let num = Int(range.dropLast()) {
            days = max(1, num / 24)
        }
        let from = Calendar.current.date(byAdding: .day, value: -days, to: now) ?? now
        return ISO8601DateFormatter().string(from: from)
    }

    func fetchCommandStats(range: String = "7d") async throws -> CommandStatsResponse {
        let fromISO = rangeToISO(range)
        return try await request("/owner/commands/top?from=\(fromISO)")
    }

    func fetchModuleStats(range: String = "7d") async throws -> ModuleStatsResponse {
        let fromISO = rangeToISO(range)
        return try await request("/owner/commands/modules?from=\(fromISO)")
    }

    func fetchUserActivityStats() async throws -> UserActivityStats {
        try await request("/owner/commands/users")
    }

    // MARK: - Health & Performance

    func fetchHealthOverview() async throws -> HealthOverview {
        try await request("/owner/health/overview")
    }

    func fetchLatencyStats(hours: Int = 24) async throws -> LatencyResponse {
        try await request("/owner/health/latency?hours=\(hours)")
    }

    // MARK: - Revenue

    func fetchRevenueOverview() async throws -> RevenueOverview {
        try await request("/owner/revenue/overview")
    }

    func fetchExpiringSubscriptions(days: Int = 30) async throws -> ExpiringSubsResponse {
        try await request("/owner/revenue/expiring?days=\(days)")
    }

    // MARK: - Global Module Toggles

    func fetchGlobalToggles() async throws -> GlobalTogglesResponse {
        try await request("/owner/toggles")
    }

    func toggleGlobalModule(_ moduleName: String, enabled: Bool, reason: String? = nil, reasonDetail: String? = nil) async throws {
        struct Body: Encodable { let enabled: Bool; let reason: String?; let reasonDetail: String? }
        try await send("/owner/toggles/\(moduleName)", method: "PATCH", body: Body(enabled: enabled, reason: reason, reasonDetail: reasonDetail))
    }

    func fetchServerBans(limit: Int = 100) async throws -> ServerBansResponse {
        try await request("/owner/server-bans?limit=\(limit)")
    }

    // MARK: - Moderation

    func fetchModerationOverview() async throws -> ModerationOverview {
        try await request("/owner/moderation/overview")
    }

    func fetchBlockedUsers(limit: Int = 50) async throws -> BlockedUsersResponse {
        try await request("/owner/moderation/blocklist?limit=\(limit)")
    }

    func blockUser(userId: String, reason: String, expiresAt: String? = nil) async throws {
        struct Body: Encodable { let userId: String; let reason: String; let expiresAt: String? }
        try await send("/owner/moderation/blocklist", method: "POST", body: Body(userId: userId, reason: reason, expiresAt: expiresAt))
    }

    func unblockUser(_ userId: String) async throws {
        try await send("/owner/moderation/blocklist/\(userId)", method: "DELETE", body: EmptyBody())
    }

    // MARK: - Alerts

    func fetchAlertRules() async throws -> AlertRulesResponse {
        try await request("/owner/alerts")
    }

    func fetchAlertHistory(limit: Int = 20) async throws -> AlertHistoryResponse {
        try await request("/owner/alerts/history?limit=\(limit)")
    }

    func createAlertRule(name: String, metricType: String, operator op: String, threshold: Double, webhookUrl: String?, discordChannelId: String?) async throws {
        struct Body: Encodable { let name: String; let metricType: String; let `operator`: String; let threshold: Double; let webhookUrl: String?; let discordChannelId: String? }
        try await send("/owner/alerts", method: "POST", body: Body(name: name, metricType: metricType, operator: op, threshold: threshold, webhookUrl: webhookUrl, discordChannelId: discordChannelId))
    }

    func toggleAlertRule(_ id: Int, enabled: Bool) async throws {
        struct Body: Encodable { let enabled: Bool }
        try await send("/owner/alerts/\(id)", method: "PATCH", body: Body(enabled: enabled))
    }

    func deleteAlertRule(_ id: Int) async throws {
        try await send("/owner/alerts/\(id)", method: "DELETE", body: EmptyBody())
    }

    // MARK: - Infrastructure

    func fetchDatabaseInfo() async throws -> DatabaseInfo {
        try await request("/owner/infrastructure/db")
    }

    func fetchSystemInfo() async throws -> SystemInfo {
        try await request("/owner/infrastructure/system")
    }
}

// MARK: - Owner Models

struct OwnerStats: Codable {
    let totalGuilds: Int
    let premiumBreakdown: [PremiumBreakdown]
    let timestamp: String

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        totalGuilds = try c.decodeFlexibleInt(forKey: .totalGuilds)
        premiumBreakdown = try c.decode([PremiumBreakdown].self, forKey: .premiumBreakdown)
        timestamp = try c.decode(String.self, forKey: .timestamp)
    }
    private enum CodingKeys: String, CodingKey { case totalGuilds, premiumBreakdown, timestamp }
}

struct PremiumBreakdown: Codable, Identifiable {
    var id: String { tier }
    let tier: String
    let count: Int

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        tier = (try? c.decode(String.self, forKey: .tier)) ?? "free"
        count = try c.decodeFlexibleInt(forKey: .count)
    }
    private enum CodingKeys: String, CodingKey { case tier, count }
}

struct OwnerGuildsResponse: Codable {
    let guilds: [Guild]
    let page: Int
    let limit: Int
}

// MARK: - Server Management Models

struct ServerSearchResponse: Codable {
    let servers: [Guild]
    let pagination: PaginationInfo
}

struct PaginationInfo: Codable {
    let page: Int
    let limit: Int
    let total: Int
    let totalPages: Int
}

struct ServerDetailResponse: Codable {
    let server: Guild
    let moduleStats: ModuleStatsInfo
    let usageStats: UsageStatsInfo
    let subscription: SubscriptionInfo?
}

struct ModuleStatsInfo: Codable {
    let enabledCount: Int
}

struct UsageStatsInfo: Codable {
    let commands30d: Int
    let uniqueUsers30d: Int
}

struct SubscriptionInfo: Codable {
    let id: Int?
    let guildId: String?
    let tier: String?
    let purchaseDate: String?
    let expiryDate: String?
    let autoRenew: Bool?
    let status: String?

    /// Alias for backwards compat
    var expiresAt: String? { expiryDate }
}

struct ServerConfigUpdate: Encodable {
    var locale: String?
    var timezone: String?
    var premiumTier: String?
    var premiumExpiresAt: String?

    enum CodingKeys: String, CodingKey {
        case locale, timezone
        case premiumTier = "premium_tier"
        case premiumExpiresAt = "premium_expires_at"
    }
}

struct EmptyBody: Encodable {}

struct Announcement: Codable, Identifiable {
    let id: Int
    let title: String
    let message: String
    let type: String
    let authorId: String
    let createdAt: String

    enum CodingKeys: String, CodingKey {
        case id, title, message, type, authorId, createdAt
    }
}

struct AnnouncementsResponse: Codable {
    let announcements: [Announcement]
    let pagination: PaginationInfo
}

struct AnnouncementCreateResponse: Codable {
    let announcement: Announcement
}

// MARK: - Staff Models

struct StaffMember: Codable, Identifiable {
    let id: Int
    let discordId: String
    let username: String
    let avatarHash: String?
    let role: String
    let permissions: [String: Bool]?
    let addedBy: String?
    let addedAt: String?
    let removedAt: String?

    enum CodingKeys: String, CodingKey {
        case id, discordId, username, avatarHash, role, permissions, addedBy, addedAt, removedAt
    }

    var isActive: Bool { removedAt == nil }

    var avatarURL: URL? {
        guard let hash = avatarHash else { return nil }
        return URL(string: "https://cdn.discordapp.com/avatars/\(discordId)/\(hash).png?size=128")
    }
}

struct StaffActivity: Codable, Identifiable {
    var id: String { "\(staffId)-\(createdAt)" }
    let staffId: String
    let staffName: String
    let ticketId: Int
    let ticketSubject: String?
    let ticketCategory: String?
    let actionType: String
    let createdAt: String

    enum CodingKeys: String, CodingKey {
        case staffId, staffName, ticketId, ticketSubject, ticketCategory, actionType, createdAt
    }

    var createdDate: Date? {
        ISO8601DateFormatter().date(from: createdAt)
    }
}

struct StaffListResponse: Codable {
    let staff: [StaffMember]
}

struct StaffActivityResponse: Codable {
    let activity: [StaffActivity]
}

// MARK: - Command Analytics Models

struct CommandStat: Codable, Identifiable {
    var id: String { "\(commandName)-\(subcommandName ?? "")-\(moduleName)" }
    let commandName: String
    let subcommandName: String?
    let moduleName: String
    let totalUses: Int
    let successCount: Int
    let errorCount: Int
    let avgMs: Double
    let uniqueUsers: Int
    let uniqueGuilds: Int

    enum CodingKeys: String, CodingKey {
        case commandName, subcommandName, moduleName, totalUses, successCount, errorCount, avgMs, uniqueUsers, uniqueGuilds
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        commandName = try c.decode(String.self, forKey: .commandName)
        subcommandName = try c.decodeIfPresent(String.self, forKey: .subcommandName)
        moduleName = try c.decode(String.self, forKey: .moduleName)
        totalUses = try c.decodeFlexibleInt(forKey: .totalUses)
        successCount = try c.decodeFlexibleInt(forKey: .successCount)
        errorCount = try c.decodeFlexibleInt(forKey: .errorCount)
        avgMs = try c.decodeFlexibleDouble(forKey: .avgMs)
        uniqueUsers = try c.decodeFlexibleInt(forKey: .uniqueUsers)
        uniqueGuilds = try c.decodeFlexibleInt(forKey: .uniqueGuilds)
    }
}

struct ModuleAnalyticsStat: Codable, Identifiable {
    var id: String { moduleName }
    let moduleName: String
    let totalUses: Int
    let successCount: Int
    let errorCount: Int
    let uniqueCommands: Int
    let uniqueUsers: Int
    let uniqueGuilds: Int
    let avgMs: Double

    enum CodingKeys: String, CodingKey {
        case moduleName, totalUses, successCount, errorCount, uniqueCommands, uniqueUsers, uniqueGuilds, avgMs
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        moduleName = try c.decode(String.self, forKey: .moduleName)
        totalUses = try c.decodeFlexibleInt(forKey: .totalUses)
        successCount = try c.decodeFlexibleInt(forKey: .successCount)
        errorCount = try c.decodeFlexibleInt(forKey: .errorCount)
        uniqueCommands = try c.decodeFlexibleInt(forKey: .uniqueCommands)
        uniqueUsers = try c.decodeFlexibleInt(forKey: .uniqueUsers)
        uniqueGuilds = try c.decodeFlexibleInt(forKey: .uniqueGuilds)
        avgMs = try c.decodeFlexibleDouble(forKey: .avgMs)
    }
}

struct UserActivityStats: Codable {
    let dau: Int
    let wau: Int
    let mau: Int
    let dailyActiveGuilds: Int
    let weeklyActiveGuilds: Int
    let monthlyActiveGuilds: Int
    let commands24h: Int
    let commands7d: Int
    let commands30d: Int

    enum CodingKeys: String, CodingKey {
        case dau, wau, mau, dailyActiveGuilds, weeklyActiveGuilds, monthlyActiveGuilds, commands24h, commands7d, commands30d
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        dau = try c.decodeFlexibleInt(forKey: .dau)
        wau = try c.decodeFlexibleInt(forKey: .wau)
        mau = try c.decodeFlexibleInt(forKey: .mau)
        dailyActiveGuilds = try c.decodeFlexibleInt(forKey: .dailyActiveGuilds)
        weeklyActiveGuilds = try c.decodeFlexibleInt(forKey: .weeklyActiveGuilds)
        monthlyActiveGuilds = try c.decodeFlexibleInt(forKey: .monthlyActiveGuilds)
        commands24h = try c.decodeFlexibleInt(forKey: .commands24h)
        commands7d = try c.decodeFlexibleInt(forKey: .commands7d)
        commands30d = try c.decodeFlexibleInt(forKey: .commands30d)
    }
}

struct CommandStatsResponse: Codable {
    let commands: [CommandStat]
}

struct ModuleStatsResponse: Codable {
    let modules: [ModuleAnalyticsStat]
}

// MARK: - Health Models

struct HealthOverview: Codable {
    let uptime: Double
    let uptimeFormatted: String
    let memory: HealthMemory
    let database: HealthDatabase
    let commands: HealthCommands

    enum CodingKeys: String, CodingKey {
        case uptime, uptimeFormatted, memory, database, commands
    }
}

struct HealthMemory: Codable {
    let heapUsedMB: Double
    let rssMB: Double
    let heapTotal: Double?
    let rss: Double?

    enum CodingKeys: String, CodingKey {
        case heapUsedMB, rssMB, heapTotal, rss
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        heapUsedMB = try c.decodeFlexibleDouble(forKey: .heapUsedMB)
        rssMB = try c.decodeFlexibleDouble(forKey: .rssMB)
        heapTotal = try? c.decodeFlexibleDouble(forKey: .heapTotal)
        rss = try? c.decodeFlexibleDouble(forKey: .rss)
    }
}

struct HealthDatabase: Codable {
    let latencyMs: Double
    let status: String

    enum CodingKeys: String, CodingKey {
        case latencyMs, status
    }
}

struct HealthCommands: Codable {
    let commands1h: Int
    let commands24h: Int
    let errors1h: Int
    let errors24h: Int
    let avgMs1h: Double

    enum CodingKeys: String, CodingKey {
        case commands1h, commands24h, errors1h, errors24h, avgMs1h
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        commands1h = (try? c.decodeFlexibleInt(forKey: .commands1h)) ?? 0
        commands24h = (try? c.decodeFlexibleInt(forKey: .commands24h)) ?? 0
        errors1h = (try? c.decodeFlexibleInt(forKey: .errors1h)) ?? 0
        errors24h = (try? c.decodeFlexibleInt(forKey: .errors24h)) ?? 0
        // PostgreSQL AVG() returns NULL when no rows match the filter
        if let val = try? c.decodeFlexibleDouble(forKey: .avgMs1h) {
            avgMs1h = val
        } else {
            avgMs1h = 0
        }
    }
}

struct LatencySummary: Codable {
    let avgMs: Double
    let p50: Double
    let p95: Double
    let p99: Double
    let minMs: Double
    let maxMs: Double
    let sampleCount: Int

    enum CodingKeys: String, CodingKey {
        case avgMs, p50, p95, p99, minMs, maxMs, sampleCount
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        // All latency fields can be NULL when no commands exist
        avgMs = (try? c.decodeFlexibleDouble(forKey: .avgMs)) ?? 0
        p50 = (try? c.decodeFlexibleDouble(forKey: .p50)) ?? 0
        p95 = (try? c.decodeFlexibleDouble(forKey: .p95)) ?? 0
        p99 = (try? c.decodeFlexibleDouble(forKey: .p99)) ?? 0
        minMs = (try? c.decodeFlexibleDouble(forKey: .minMs)) ?? 0
        maxMs = (try? c.decodeFlexibleDouble(forKey: .maxMs)) ?? 0
        sampleCount = (try? c.decodeFlexibleInt(forKey: .sampleCount)) ?? 0
    }
}

struct LatencyResponse: Codable {
    let summary: LatencySummary
}

// MARK: - Revenue Models

struct TierCount: Codable, Identifiable {
    var id: String { tier }
    let tier: String
    let count: Int

    enum CodingKeys: String, CodingKey {
        case tier, count
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        // Backend aliases as "tier" but may also appear as "premiumTier" after preprocessing
        tier = (try? c.decode(String.self, forKey: .tier)) ?? "free"
        count = (try? c.decodeFlexibleInt(forKey: .count)) ?? 0
    }
}

struct SubBreakdown: Codable, Identifiable {
    var id: String { tier }
    let tier: String
    let activeCount: Int
    let totalRevenue: Double
    let avgAmount: Double

    enum CodingKeys: String, CodingKey {
        case tier, activeCount, totalRevenue, avgAmount
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        tier = (try? c.decode(String.self, forKey: .tier)) ?? "unknown"
        activeCount = (try? c.decodeFlexibleInt(forKey: .activeCount)) ?? 0
        totalRevenue = (try? c.decodeFlexibleDouble(forKey: .totalRevenue)) ?? 0
        avgAmount = (try? c.decodeFlexibleDouble(forKey: .avgAmount)) ?? 0
    }
}

struct ExpiringSubscription: Codable, Identifiable {
    var id: String { guildId }
    let guildId: String
    let tier: String
    let amount: Double
    let expiryDate: String
    let status: String
    let guildName: String?
    let memberCount: Int?

    enum CodingKeys: String, CodingKey {
        case guildId, tier, amount, expiryDate, status, guildName, memberCount
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        guildId = try c.decode(String.self, forKey: .guildId)
        tier = (try? c.decode(String.self, forKey: .tier)) ?? "free"
        amount = (try? c.decodeFlexibleDouble(forKey: .amount)) ?? 0
        expiryDate = (try? c.decode(String.self, forKey: .expiryDate)) ?? ""
        status = (try? c.decode(String.self, forKey: .status)) ?? "unknown"
        guildName = try? c.decode(String.self, forKey: .guildName)
        memberCount = try? c.decodeFlexibleIntIfPresent(forKey: .memberCount)
    }
}

struct RevenueOverview: Codable {
    let tiers: [TierCount]
    let subscriptions: [SubBreakdown]?
    let totalPremiumServers: Int?

    enum CodingKeys: String, CodingKey {
        case tiers, subscriptions, totalPremiumServers
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        tiers = (try? c.decode([TierCount].self, forKey: .tiers)) ?? []
        subscriptions = try? c.decode([SubBreakdown].self, forKey: .subscriptions)
        totalPremiumServers = try? c.decodeFlexibleIntIfPresent(forKey: .totalPremiumServers)
    }
}

struct ExpiringSubsResponse: Codable {
    let expiring: [ExpiringSubscription]?

    enum CodingKeys: String, CodingKey {
        case expiring
    }

    // Backend sends { expiring: [...] } not { subscriptions: [...] }
    var subscriptions: [ExpiringSubscription] {
        expiring ?? []
    }
}

// MARK: - Global Module Toggle Models

struct GlobalToggle: Codable, Identifiable {
    var id: String { moduleName }
    let moduleName: String
    var enabled: Bool
    let reason: String?
    let reasonDetail: String?
    let disabledBy: String?
    let updatedAt: String?

    enum CodingKeys: String, CodingKey {
        case moduleName, enabled, reason, reasonDetail, disabledBy, updatedAt
    }

    /// Memberwise init for creating default toggle entries for modules not yet in the DB
    init(moduleName: String, enabled: Bool, reason: String?, reasonDetail: String?, disabledBy: String?, updatedAt: String?) {
        self.moduleName = moduleName
        self.enabled = enabled
        self.reason = reason
        self.reasonDetail = reasonDetail
        self.disabledBy = disabledBy
        self.updatedAt = updatedAt
    }
}

struct ServerModuleBan: Codable, Identifiable {
    let id: Int
    let guildId: String
    let moduleName: String
    let reason: String?
    let reasonDetail: String?
    let bannedBy: String?
    let createdAt: String?

    enum CodingKeys: String, CodingKey {
        case id, guildId, moduleName, reason, reasonDetail, bannedBy, createdAt
    }
}

struct GlobalTogglesResponse: Codable {
    let toggles: [GlobalToggle]
}

struct ServerBansResponse: Codable {
    let bans: [ServerModuleBan]
}

// MARK: - Moderation Models

struct BlockedUser: Codable, Identifiable {
    var id: String { userId }
    let userId: String
    let reason: String
    let blockedBy: String?
    let expiresAt: String?
    let createdAt: String?

    enum CodingKeys: String, CodingKey {
        case userId, reason, blockedBy, expiresAt, createdAt
    }

    var createdDate: Date? {
        guard let createdAt else { return nil }
        return ISO8601DateFormatter().date(from: createdAt)
    }
}

struct ModerationOverview: Codable {
    let blockedUsers: Int
    let appeals: ModerationAppeals?
    let serverBans: Int

    enum CodingKeys: String, CodingKey {
        case blockedUsers, appeals, serverBans
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        blockedUsers = try c.decodeFlexibleInt(forKey: .blockedUsers)
        appeals = try c.decodeIfPresent(ModerationAppeals.self, forKey: .appeals)
        serverBans = try c.decodeFlexibleInt(forKey: .serverBans)
    }
}

struct ModerationAppeals: Codable {
    let totalAppeals: Int
    let openAppeals: Int
    let totalBugs: Int
    let openBugs: Int

    enum CodingKeys: String, CodingKey {
        case totalAppeals, openAppeals, totalBugs, openBugs
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        totalAppeals = try c.decodeFlexibleInt(forKey: .totalAppeals)
        openAppeals = try c.decodeFlexibleInt(forKey: .openAppeals)
        totalBugs = try c.decodeFlexibleInt(forKey: .totalBugs)
        openBugs = try c.decodeFlexibleInt(forKey: .openBugs)
    }
}

struct BlockedUsersResponse: Codable {
    let users: [BlockedUser]
}

// MARK: - Alert Models

struct AlertRule: Codable, Identifiable {
    let id: Int
    let name: String
    let metricType: String
    let `operator`: String
    let threshold: Double
    let webhookUrl: String?
    let discordChannelId: String?
    var enabled: Bool
    let createdAt: String?

    enum CodingKeys: String, CodingKey {
        case id, name, metricType, `operator`, threshold, webhookUrl, discordChannelId, enabled, createdAt
    }
}

struct AlertHistoryItem: Codable, Identifiable {
    let id: Int
    let ruleId: Int
    let triggeredAt: String
    let value: Double
    let message: String?
    let resolved: Bool
    let ruleName: String?
    let metricType: String?

    enum CodingKeys: String, CodingKey {
        case id, ruleId, triggeredAt, value, message, resolved, ruleName, metricType
    }

    var triggeredDate: Date? {
        ISO8601DateFormatter().date(from: triggeredAt)
    }
}

struct AlertRulesResponse: Codable {
    let rules: [AlertRule]
}

struct AlertHistoryResponse: Codable {
    let history: [AlertHistoryItem]
}

// MARK: - Infrastructure Models

struct DatabaseInfo: Codable {
    let database: DatabaseDetails
    let tables: [TableInfo]
}

struct DatabaseDetails: Codable {
    let sizeBytes: Int?
    let sizeMB: Double
    let activeConnections: Int

    enum CodingKeys: String, CodingKey {
        case sizeBytes, sizeMB, activeConnections
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        sizeBytes = try c.decodeFlexibleIntIfPresent(forKey: .sizeBytes)
        sizeMB = try c.decodeFlexibleDouble(forKey: .sizeMB)
        activeConnections = try c.decodeFlexibleInt(forKey: .activeConnections)
    }
}

struct TableInfo: Codable, Identifiable {
    var id: String { name }
    let name: String
    let sizeMB: Double
    let rowCount: Int

    enum CodingKeys: String, CodingKey {
        case name, sizeMB, rowCount
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        name = try c.decode(String.self, forKey: .name)
        sizeMB = try c.decodeFlexibleDouble(forKey: .sizeMB)
        rowCount = try c.decodeFlexibleInt(forKey: .rowCount)
    }
}

struct SystemInfo: Codable {
    let nodeVersion: String
    let platform: String
    let arch: String
    let pid: Int
    let uptime: Double
    let memory: SystemMemory
    let env: String

    enum CodingKeys: String, CodingKey {
        case nodeVersion, platform, arch, pid, uptime, memory, env
    }
}

struct SystemMemory: Codable {
    let heapUsedMB: Double
    let heapTotalMB: Double
    let rssMB: Double

    enum CodingKeys: String, CodingKey {
        case heapUsedMB, heapTotalMB, rssMB
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        heapUsedMB = try c.decodeFlexibleDouble(forKey: .heapUsedMB)
        heapTotalMB = try c.decodeFlexibleDouble(forKey: .heapTotalMB)
        rssMB = try c.decodeFlexibleDouble(forKey: .rssMB)
    }
}
