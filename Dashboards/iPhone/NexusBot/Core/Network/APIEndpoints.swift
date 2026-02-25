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
}

// MARK: - Owner Models

struct OwnerStats: Codable {
    let totalGuilds: Int
    let premiumBreakdown: [PremiumBreakdown]
    let timestamp: String
}

struct PremiumBreakdown: Codable, Identifiable {
    var id: String { tier }
    let tier: String
    let count: Int
}

struct OwnerGuildsResponse: Codable {
    let guilds: [Guild]
    let page: Int
    let limit: Int
}
