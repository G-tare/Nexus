import SwiftUI

struct ContentView: View {
    @EnvironmentObject var authManager: AuthManager
    @State private var showSplash = true

    var body: some View {
        ZStack {
            // Main content — only render the heavy views once splash is ready to dismiss
            // This prevents NavigationStack/TabView init from blocking the first frame
            if !showSplash {
                Group {
                    if authManager.isAuthenticated {
                        ServerSelectorView()
                    } else {
                        LoginView()
                    }
                }
                .transition(.opacity)
            }

            // Splash screen overlay — renders IMMEDIATELY (lightweight view)
            if showSplash {
                SplashView()
                    .zIndex(1)
            }
        }
        .animation(.easeOut(duration: 0.35), value: showSplash)
        .animation(.easeInOut(duration: 0.3), value: authManager.isAuthenticated)
        .task {
            // If not authenticated, dismiss splash quickly — just show login
            guard authManager.isAuthenticated else {
                try? await Task.sleep(nanoseconds: 300_000_000) // 300ms
                showSplash = false
                return
            }

            // If guilds already loaded from cache, dismiss fast
            if authManager.guildsLoaded {
                try? await Task.sleep(nanoseconds: 400_000_000) // 400ms
                showSplash = false
                return
            }

            // Wait for guild data (cache restore or API fetch)
            // Max wait 6 seconds — then show whatever we have
            let maxWait: UInt64 = 6_000_000_000 // 6 seconds
            let start = DispatchTime.now().uptimeNanoseconds

            while !authManager.guildsLoaded {
                let elapsed = DispatchTime.now().uptimeNanoseconds - start
                if elapsed >= maxWait { break }
                try? await Task.sleep(nanoseconds: 50_000_000) // 50ms
            }

            // Small grace period for smooth transition
            try? await Task.sleep(nanoseconds: 200_000_000) // 200ms
            showSplash = false
        }
    }
}

// MARK: - Branded Splash Screen

struct SplashView: View {
    @State private var pulse = false

    var body: some View {
        ZStack {
            NexusColors.background
                .ignoresSafeArea()

            VStack(spacing: 24) {
                // Animated logo
                ZStack {
                    // Outer glow ring
                    Circle()
                        .stroke(
                            LinearGradient(
                                colors: [NexusColors.cyan, NexusColors.purple],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            ),
                            lineWidth: 3
                        )
                        .frame(width: 90, height: 90)
                        .scaleEffect(pulse ? 1.1 : 1.0)
                        .opacity(pulse ? 0.6 : 1.0)

                    // Inner icon
                    Image(systemName: "bolt.shield.fill")
                        .font(.system(size: 36, weight: .semibold))
                        .foregroundStyle(
                            LinearGradient(
                                colors: [NexusColors.cyan, NexusColors.purple],
                                startPoint: .top,
                                endPoint: .bottom
                            )
                        )
                }

                VStack(spacing: 8) {
                    Text("NEXUS BOT")
                        .font(.system(size: 22, weight: .heavy, design: .rounded))
                        .foregroundStyle(
                            LinearGradient(
                                colors: [NexusColors.cyan, NexusColors.purple],
                                startPoint: .leading,
                                endPoint: .trailing
                            )
                        )
                        .tracking(4)

                    Text("Loading your servers...")
                        .font(NexusFont.body(14))
                        .foregroundStyle(NexusColors.textMuted)
                }

                // Loading bar
                ProgressView()
                    .progressViewStyle(.circular)
                    .tint(NexusColors.cyan)
                    .scaleEffect(0.8)
            }
        }
        .onAppear {
            withAnimation(.easeInOut(duration: 1.2).repeatForever(autoreverses: true)) {
                pulse = true
            }
        }
    }
}
