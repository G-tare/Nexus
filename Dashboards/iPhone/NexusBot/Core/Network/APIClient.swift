import Foundation

// MARK: - API Configuration

enum APIConfig {
    // Change this to your actual API URL
    static var baseURL: String {
        #if DEBUG
        return "http://10.0.0.98:3001/api"
        #else
        return "https://api.nexusbot.app/api"
        #endif
    }
}

// MARK: - API Errors

enum APIError: LocalizedError {
    case invalidURL
    case unauthorized
    case forbidden
    case notFound
    case serverError(Int)
    case decodingError(Error)
    case networkError(Error)
    case unknown(String)

    var errorDescription: String? {
        switch self {
        case .invalidURL: return "Invalid URL"
        case .unauthorized: return "Session expired. Please log in again."
        case .forbidden: return "You don't have permission to do this."
        case .notFound: return "Not found."
        case .serverError(let code): return "Server error (\(code))"
        case .decodingError(let err): return "Data error: \(err.localizedDescription)"
        case .networkError(let err): return "Network error: \(err.localizedDescription)"
        case .unknown(let msg): return msg
        }
    }
}

// MARK: - API Client

@MainActor
final class APIClient: ObservableObject {
    static let shared = APIClient()

    private let session: URLSession
    private let decoder: JSONDecoder

    private init() {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 15
        config.timeoutIntervalForResource = 30
        self.session = URLSession(configuration: config)

        self.decoder = JSONDecoder()
    }

    // MARK: - Core Request

    func request<T: Decodable>(
        _ endpoint: String,
        method: String = "GET",
        body: (any Encodable)? = nil,
        authenticated: Bool = true
    ) async throws -> T {
        guard let url = URL(string: "\(APIConfig.baseURL)\(endpoint)") else {
            throw APIError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        if authenticated {
            guard let token = AuthManager.shared.token else {
                throw APIError.unauthorized
            }
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        if let body {
            let encoder = JSONEncoder()
            encoder.keyEncodingStrategy = .convertToSnakeCase
            request.httpBody = try encoder.encode(body)
        }

        do {
            let (data, response) = try await session.data(for: request)

            guard let httpResponse = response as? HTTPURLResponse else {
                throw APIError.unknown("Invalid response")
            }

            switch httpResponse.statusCode {
            case 200...299:
                do {
                    // PostgreSQL returns COUNT/SUM/AVG aggregates as strings.
                    // Preprocess JSON to convert string-encoded numbers to actual numbers.
                    let processedData = Self.preprocessJSON(data)
                    return try decoder.decode(T.self, from: processedData)
                } catch {
                    throw APIError.decodingError(error)
                }
            case 401:
                AuthManager.shared.logout()
                throw APIError.unauthorized
            case 403:
                throw APIError.forbidden
            case 404:
                throw APIError.notFound
            default:
                // Try to extract error message
                if let errorResponse = try? decoder.decode(ErrorResponse.self, from: data) {
                    throw APIError.unknown(errorResponse.error)
                }
                throw APIError.serverError(httpResponse.statusCode)
            }
        } catch let error as APIError {
            throw error
        } catch {
            throw APIError.networkError(error)
        }
    }

    // MARK: - Fire-and-forget request (for toggles, etc.)

    func send(
        _ endpoint: String,
        method: String = "PATCH",
        body: (any Encodable)? = nil
    ) async throws {
        let _: SuccessResponse = try await request(endpoint, method: method, body: body)
    }

    // MARK: - JSON Preprocessing

    /// Preprocesses JSON data before decoding:
    /// Converts all snake_case dictionary keys to camelCase so models don't need
    /// explicit CodingKeys with raw values. Handles both raw DB rows (snake_case)
    /// and JS objects (already camelCase — passed through unchanged).
    /// NOTE: Does NOT convert string values to numbers. Models that receive
    /// PostgreSQL aggregate strings use decodeFlexibleInt/Double instead.
    static func preprocessJSON(_ data: Data) -> Data {
        guard let json = try? JSONSerialization.jsonObject(with: data, options: .fragmentsAllowed) else {
            return data
        }
        let fixed = convertKeys(json)
        guard let result = try? JSONSerialization.data(withJSONObject: fixed, options: []) else {
            return data
        }
        return result
    }

    private static func convertKeys(_ obj: Any) -> Any {
        if let dict = obj as? [String: Any] {
            var result = [String: Any]()
            for (key, value) in dict {
                result[snakeToCamel(key)] = convertKeys(value)
            }
            return result
        }
        if let array = obj as? [Any] {
            return array.map { convertKeys($0) }
        }
        return obj
    }

    /// Converts a snake_case string to camelCase.
    /// Keys already in camelCase (no underscores) pass through unchanged.
    private static func snakeToCamel(_ str: String) -> String {
        guard str.contains("_") else { return str }
        let parts = str.split(separator: "_", omittingEmptySubsequences: false)
        guard let first = parts.first else { return str }
        let rest = parts.dropFirst().map { segment -> String in
            guard let firstChar = segment.first else { return String(segment) }
            return firstChar.uppercased() + segment.dropFirst()
        }
        return String(first) + rest.joined()
    }
}

// MARK: - Response Types

struct SuccessResponse: Codable {
    let success: Bool
}

struct ErrorResponse: Codable {
    let error: String
}

// MARK: - Flexible Decoding Helpers

/// PostgreSQL COUNT(*) returns bigint which pg driver serializes as a String.
/// This extension decodes both Int and String-encoded numbers.
extension KeyedDecodingContainer {
    func decodeFlexibleInt(forKey key: Key) throws -> Int {
        if let intVal = try? decode(Int.self, forKey: key) {
            return intVal
        }
        let stringVal = try decode(String.self, forKey: key)
        guard let parsed = Int(stringVal) else {
            throw DecodingError.dataCorruptedError(forKey: key, in: self, debugDescription: "Cannot parse '\(stringVal)' as Int")
        }
        return parsed
    }

    func decodeFlexibleDouble(forKey key: Key) throws -> Double {
        if let dblVal = try? decode(Double.self, forKey: key) {
            return dblVal
        }
        let stringVal = try decode(String.self, forKey: key)
        guard let parsed = Double(stringVal) else {
            throw DecodingError.dataCorruptedError(forKey: key, in: self, debugDescription: "Cannot parse '\(stringVal)' as Double")
        }
        return parsed
    }

    func decodeFlexibleIntIfPresent(forKey key: Key) throws -> Int? {
        guard contains(key) else { return nil }
        if let val = try? decode(Int.self, forKey: key) { return val }
        if let str = try? decode(String.self, forKey: key) { return Int(str) }
        return nil
    }
}

struct ToggleResponse: Codable {
    let success: Bool
    let enabled: Bool
}

// MARK: - Guild Data Cache

/// In-memory cache for guild-scoped data (roles, members, permissions).
/// Created once when entering a server dashboard and shared across all child views
/// via @EnvironmentObject. Eliminates redundant API calls — data is fetched once
/// and refreshed on demand, not on every navigation push.
@MainActor
final class GuildDataCache: ObservableObject {
    let guildId: String

    /// All roles for this guild (fetched once, refreshed on pull-to-refresh)
    @Published var roles: [DiscordRole] = []

    /// All channels for this guild
    @Published var channels: [DiscordChannel] = []

    /// Initial member list (first 50, no search query)
    @Published var initialMembers: [DiscordMember] = []

    /// All permission rules keyed by command name
    @Published var permissions: [String: [Permission]] = [:]

    /// Module configs keyed by module name (shared between overview + module list)
    @Published var modules: [String: ModuleConfig] = [:]

    /// Loading states
    @Published var rolesLoaded = false
    @Published var channelsLoaded = false
    @Published var membersLoaded = false
    @Published var permissionsLoaded = false
    @Published var modulesLoaded = false

    /// Whether the last load attempt failed (for retry UI)
    @Published var rolesError = false
    @Published var channelsError = false
    @Published var membersError = false

    /// Lookup dictionaries for instant name resolution
    var roleLookup: [String: String] {
        Dictionary(uniqueKeysWithValues: roles.map { ($0.id, $0.name) })
    }

    /// Channel lookup: channelId → name
    var channelLookup: [String: String] {
        Dictionary(uniqueKeysWithValues: channels.map { ($0.id, $0.name) })
    }

    /// User lookup: userId → displayName
    var memberLookup: [String: String] {
        Dictionary(uniqueKeysWithValues: initialMembers.map { ($0.id, $0.displayName) })
    }

    /// Text channels only (for channel pickers)
    var textChannels: [DiscordChannel] {
        channels.filter { $0.isText }
    }

    /// Voice channels only (for voice channel pickers)
    var voiceChannels: [DiscordChannel] {
        channels.filter { $0.isVoice }
    }

    init(guildId: String) {
        self.guildId = guildId
    }

    /// Pre-load ALL data in parallel (called once on dashboard entry)
    func preload() async {
        async let r: () = loadRoles()
        async let ch: () = loadChannels()
        async let m: () = loadMembers()
        async let p: () = loadPermissions()
        async let mod: () = loadModules()
        _ = await (r, ch, m, p, mod)

        // Auto-retry once after 3 seconds if roles, channels, or members came back empty
        // (likely a transient TLS/network issue)
        if roles.isEmpty || initialMembers.isEmpty || channels.isEmpty {
            try? await Task.sleep(nanoseconds: 3_000_000_000)
            if roles.isEmpty { await loadRoles() }
            if channels.isEmpty { await loadChannels() }
            if initialMembers.isEmpty { await loadMembers() }
        }
    }

    func loadRoles() async {
        rolesError = false
        let fetched = (try? await APIClient.shared.fetchGuildRoles(guildId)) ?? []
        roles = fetched
        rolesLoaded = true
        if fetched.isEmpty { rolesError = true }
    }

    func loadChannels() async {
        channelsError = false
        let fetched = (try? await APIClient.shared.fetchGuildChannels(guildId)) ?? []
        channels = fetched
        channelsLoaded = true
        if fetched.isEmpty { channelsError = true }
    }

    func loadMembers() async {
        membersError = false
        let fetched = (try? await APIClient.shared.searchGuildMembers(guildId, query: "")) ?? []
        initialMembers = fetched
        membersLoaded = true
        if fetched.isEmpty { membersError = true }
    }

    /// Search members — returns results directly
    func searchMembers(query: String) async -> [DiscordMember] {
        if query.isEmpty && membersLoaded && !initialMembers.isEmpty {
            return initialMembers
        }
        let fetched = (try? await APIClient.shared.searchGuildMembers(guildId, query: query)) ?? []
        if query.isEmpty && !fetched.isEmpty {
            initialMembers = fetched
            membersLoaded = true
            membersError = false
        }
        return fetched
    }

    func loadPermissions() async {
        let fetched = (try? await APIClient.shared.fetchPermissions(guildId)) ?? [:]
        permissions = fetched
        permissionsLoaded = true
    }

    /// Get permissions for a specific command (instant, from cache)
    /// Resolves BOTH role names and user names from cached data
    func permissionsForCommand(_ commandName: String) -> [Permission] {
        var rules = permissions[commandName] ?? []
        let rLookup = roleLookup
        let mLookup = memberLookup
        for i in rules.indices {
            if rules[i].targetType == "role" {
                rules[i].resolvedName = rLookup[rules[i].targetId]
            } else if rules[i].targetType == "user" {
                rules[i].resolvedName = mLookup[rules[i].targetId]
            }
        }
        return rules
    }

    /// Refresh permissions after a change (add/remove)
    func refreshPermissions() async {
        await loadPermissions()
    }

    func loadModules() async {
        let fetched = (try? await APIClient.shared.fetchModules(guildId)) ?? [:]
        modules = fetched
        modulesLoaded = true
    }

    /// Toggle a module and immediately update local cache
    func setModuleEnabled(_ moduleKey: String, enabled: Bool) async {
        let _ = try? await APIClient.shared.toggleModule(guildId, name: moduleKey, enabled: enabled)
        modules[moduleKey] = ModuleConfig(enabled: enabled, config: modules[moduleKey]?.config)
    }

    /// Refresh everything
    func refreshAll() async {
        await preload()
    }

    // MARK: - Background Sync

    private var syncTask: Task<Void, Never>?

    /// Start periodic background sync to keep data fresh across dashboards.
    /// Polls the server every `interval` seconds for module config changes.
    func startPeriodicSync(interval: TimeInterval = 15) {
        stopPeriodicSync()
        syncTask = Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: UInt64(interval * 1_000_000_000))
                guard !Task.isCancelled, let self = self else { break }
                // Silently refresh modules in background
                let fresh = (try? await APIClient.shared.fetchModules(self.guildId)) ?? [:]
                if !fresh.isEmpty {
                    self.modules = fresh
                }
            }
        }
    }

    /// Stop periodic background sync.
    func stopPeriodicSync() {
        syncTask?.cancel()
        syncTask = nil
    }
}
