import Foundation
import AuthenticationServices
import Security

// MARK: - Auth Manager

@MainActor
final class AuthManager: ObservableObject {
    static let shared = AuthManager()

    @Published var isAuthenticated = false
    @Published var currentUser: AuthUser?
    @Published var isLoading = false
    @Published var loginError: String?

    /// All guilds the user can manage (has Manage Guild or Admin perms)
    @Published var guilds: [Guild] = []

    /// IDs of guilds the bot is active in
    @Published var botGuildIds: Set<String> = []

    /// Whether guild data has been loaded at least once
    @Published var guildsLoaded = false

    /// Strong reference to keep the auth session alive during OAuth flow
    private nonisolated(unsafe) var activeAuthSession: ASWebAuthenticationSession?
    private let keychainKey = "com.nexusbot.jwt"

    // MARK: - Local Cache Keys
    private let cacheUserKey = "com.nexusbot.cachedUser"
    private let cacheGuildsKey = "com.nexusbot.cachedGuilds"
    private let cacheBotGuildIdsKey = "com.nexusbot.cachedBotGuildIds"

    var token: String? {
        get { KeychainHelper.read(key: keychainKey) }
        set {
            if let newValue {
                KeychainHelper.save(key: keychainKey, value: newValue)
            } else {
                KeychainHelper.delete(key: keychainKey)
            }
        }
    }

    private init() {
        // Check for existing token on launch
        if token != nil {
            isAuthenticated = true
            // Restore cached data immediately so UI is instant
            restoreFromCache()
            // Immediately start background refresh — don't wait for .task on views
            Task { [weak self] in
                await self?.loadGuildsInternal(ownerHint: nil)
            }
        }
    }

    // MARK: - Discord OAuth Login (does everything in one shot)

    func login() async {
        isLoading = true
        loginError = nil
        defer { isLoading = false }

        do {
            // Step 1: Get OAuth URL from our API
            struct LoginResponse: Codable { let url: String }
            let response: LoginResponse = try await APIClient.shared.request(
                "/auth/login?platform=ios",
                authenticated: false
            )

            // Step 2: Open OAuth flow in system browser sheet
            guard let authURL = URL(string: response.url) else {
                loginError = "Invalid OAuth URL from server"
                return
            }

            let callbackURL: URL = try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<URL, Error>) in
                let authSession = ASWebAuthenticationSession(
                    url: authURL,
                    callbackURLScheme: "nexusbot"
                ) { url, error in
                    if let error {
                        continuation.resume(throwing: error)
                    } else if let url {
                        continuation.resume(returning: url)
                    } else {
                        continuation.resume(throwing: APIError.unknown("No callback URL"))
                    }
                }
                authSession.prefersEphemeralWebBrowserSession = false
                authSession.presentationContextProvider = WebAuthContextProvider.shared
                self.activeAuthSession = authSession

                if !authSession.start() {
                    continuation.resume(throwing: APIError.unknown("Failed to start auth session"))
                }
            }

            self.activeAuthSession = nil

            // Step 3: Extract token + isOwner from callback URL
            guard let components = URLComponents(url: callbackURL, resolvingAgainstBaseURL: false),
                  let token = components.queryItems?.first(where: { $0.name == "token" })?.value else {
                throw APIError.unknown("No token in callback")
            }

            let isOwner = components.queryItems?.first(where: { $0.name == "isOwner" })?.value == "true"

            self.token = token

            // Step 4: Fetch guilds immediately (before showing server selector)
            // This makes the transition seamless — no loading screen after login
            await loadGuildsInternal(ownerHint: isOwner)

            // Step 5: NOW flip authenticated — server selector appears with data ready
            self.isAuthenticated = true

        } catch {
            // Don't show error if user just cancelled the auth sheet
            if (error as NSError).domain == ASWebAuthenticationSessionErrorDomain,
               (error as NSError).code == ASWebAuthenticationSessionError.canceledLogin.rawValue {
                return
            }
            loginError = error.localizedDescription
        }
    }

    // MARK: - Load Guilds (used by login and pull-to-refresh)

    func loadGuilds() async {
        await loadGuildsInternal(ownerHint: nil)
    }

    private func loadGuildsInternal(ownerHint: Bool?) async {
        // Race the actual load against a 15-second timeout.
        // If Discord is being slow (common after fresh install), we don't want
        // the user staring at a loading screen for 2+ minutes.
        await withTaskGroup(of: Void.self) { group in
            group.addTask { @MainActor [weak self] in
                await self?.performGuildLoad(ownerHint: ownerHint)
            }
            group.addTask { @MainActor [weak self] in
                try? await Task.sleep(nanoseconds: 15_000_000_000) // 15 seconds max
                guard let self, !self.guildsLoaded else { return }
                print("[Auth] Guild load timed out after 15s — showing whatever we have")
                self.guildsLoaded = true
            }
            // Whichever finishes first wins — cancel the other
            await group.next()
            group.cancelAll()
        }
    }

    private func performGuildLoad(ownerHint: Bool?) async {
        do {
            let response = try await APIClient.shared.fetchMe()

            var user = response.user
            if let ownerHint {
                user = AuthUser(
                    id: user.id,
                    username: user.username,
                    avatar: user.avatar,
                    isOwner: ownerHint
                )
            }
            currentUser = user

            let manageable = response.guilds.filter { guild in
                guard let perms = guild.permissions, let permInt = UInt64(perms) else {
                    return guild.owner ?? false
                }
                let manageGuild: UInt64 = 0x20
                let administrator: UInt64 = 0x8
                return (permInt & manageGuild) != 0 || (permInt & administrator) != 0 || (guild.owner ?? false)
            }

            guilds = manageable

            if !manageable.isEmpty {
                let ids = manageable.map { $0.id }
                print("[Auth] Checking \(ids.count) guild IDs with bot: \(ids)")
                let activeIds = try await APIClient.shared.checkGuilds(ids)
                print("[Auth] Bot active in \(activeIds.count) guilds: \(activeIds)")
                botGuildIds = Set(activeIds)
            } else {
                print("[Auth] No manageable guilds found — skipping bot check")
                botGuildIds = []
            }

            guildsLoaded = true
            saveToCache()
        } catch {
            print("[Auth] Failed to load guilds: \(error)")
            guildsLoaded = true
        }
    }

    // MARK: - Logout

    func logout() {
        token = nil
        isAuthenticated = false
        currentUser = nil
        guilds = []
        botGuildIds = []
        guildsLoaded = false
        clearCache()
    }

    // MARK: - Local Cache (UserDefaults)

    private func saveToCache() {
        let encoder = JSONEncoder()

        if let user = currentUser, let data = try? encoder.encode(user) {
            UserDefaults.standard.set(data, forKey: cacheUserKey)
        }

        if let data = try? encoder.encode(guilds) {
            UserDefaults.standard.set(data, forKey: cacheGuildsKey)
        }

        UserDefaults.standard.set(Array(botGuildIds), forKey: cacheBotGuildIdsKey)
    }

    private func restoreFromCache() {
        let decoder = JSONDecoder()

        if let data = UserDefaults.standard.data(forKey: cacheUserKey),
           let user = try? decoder.decode(AuthUser.self, from: data) {
            currentUser = user
        }

        if let data = UserDefaults.standard.data(forKey: cacheGuildsKey),
           let cached = try? decoder.decode([Guild].self, from: data) {
            guilds = cached
        }

        if let ids = UserDefaults.standard.stringArray(forKey: cacheBotGuildIdsKey) {
            botGuildIds = Set(ids)
        }

        // If we have cached data, show it immediately
        if !guilds.isEmpty {
            guildsLoaded = true
        }
    }

    private func clearCache() {
        UserDefaults.standard.removeObject(forKey: cacheUserKey)
        UserDefaults.standard.removeObject(forKey: cacheGuildsKey)
        UserDefaults.standard.removeObject(forKey: cacheBotGuildIdsKey)
    }
}

// MARK: - Web Auth Context Provider

class WebAuthContextProvider: NSObject, ASWebAuthenticationPresentationContextProviding {
    static let shared = WebAuthContextProvider()

    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        guard let scene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
              let window = scene.windows.first else {
            return ASPresentationAnchor()
        }
        return window
    }
}

// MARK: - Keychain Helper

enum KeychainHelper {
    static func save(key: String, value: String) {
        guard let data = value.data(using: .utf8) else { return }

        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key,
        ]
        SecItemDelete(query as CFDictionary)

        let addQuery: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key,
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
        ]
        SecItemAdd(addQuery as CFDictionary, nil)
    }

    static func read(key: String) -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]

        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)

        guard status == errSecSuccess, let data = result as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    static func delete(key: String) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key,
        ]
        SecItemDelete(query as CFDictionary)
    }
}
