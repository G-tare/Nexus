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
        self.decoder.keyDecodingStrategy = .convertFromSnakeCase
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
                    return try decoder.decode(T.self, from: data)
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
}

// MARK: - Response Types

struct SuccessResponse: Codable {
    let success: Bool
}

struct ErrorResponse: Codable {
    let error: String
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

    /// Initial member list (first 50, no search query)
    @Published var initialMembers: [DiscordMember] = []

    /// All permission rules keyed by command name
    @Published var permissions: [String: [Permission]] = [:]

    /// Module configs keyed by module name (shared between overview + module list)
    @Published var modules: [String: ModuleConfig] = [:]

    /// Loading states
    @Published var rolesLoaded = false
    @Published var membersLoaded = false
    @Published var permissionsLoaded = false
    @Published var modulesLoaded = false

    /// Whether the last load attempt failed (for retry UI)
    @Published var rolesError = false
    @Published var membersError = false

    /// Lookup dictionaries for instant name resolution
    var roleLookup: [String: String] {
        Dictionary(uniqueKeysWithValues: roles.map { ($0.id, $0.name) })
    }

    /// User lookup: userId → displayName
    var memberLookup: [String: String] {
        Dictionary(uniqueKeysWithValues: initialMembers.map { ($0.id, $0.displayName) })
    }

    init(guildId: String) {
        self.guildId = guildId
    }

    /// Pre-load ALL data in parallel (called once on dashboard entry)
    func preload() async {
        async let r: () = loadRoles()
        async let m: () = loadMembers()
        async let p: () = loadPermissions()
        async let mod: () = loadModules()
        _ = await (r, m, p, mod)

        // Auto-retry once after 3 seconds if roles or members came back empty
        // (likely a transient TLS/network issue)
        if roles.isEmpty || initialMembers.isEmpty {
            try? await Task.sleep(nanoseconds: 3_000_000_000)
            if roles.isEmpty {
                await loadRoles()
            }
            if initialMembers.isEmpty {
                await loadMembers()
            }
        }
    }

    func loadRoles() async {
        rolesError = false
        let fetched = (try? await APIClient.shared.fetchGuildRoles(guildId)) ?? []
        roles = fetched
        rolesLoaded = true
        if fetched.isEmpty { rolesError = true }
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
}
