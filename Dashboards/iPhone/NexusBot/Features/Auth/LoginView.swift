import SwiftUI

struct LoginView: View {
    @EnvironmentObject var authManager: AuthManager
    @State private var showPulse = false

    var body: some View {
        ZStack {
            // Background
            NexusColors.background
                .ignoresSafeArea()

            // Gradient orbs
            Circle()
                .fill(NexusColors.cyan.opacity(0.08))
                .frame(width: 300, height: 300)
                .blur(radius: 80)
                .offset(x: -80, y: -200)

            Circle()
                .fill(NexusColors.purple.opacity(0.08))
                .frame(width: 250, height: 250)
                .blur(radius: 60)
                .offset(x: 100, y: 150)

            VStack(spacing: NexusSpacing.xxl) {
                Spacer()

                // Logo area
                VStack(spacing: NexusSpacing.lg) {
                    ZStack {
                        // Glow ring
                        Circle()
                            .stroke(NexusColors.cyan.opacity(showPulse ? 0.4 : 0.1), lineWidth: 2)
                            .frame(width: 120, height: 120)
                            .scaleEffect(showPulse ? 1.2 : 1.0)

                        // Icon
                        Image(systemName: "bolt.shield.fill")
                            .font(.system(size: 48))
                            .foregroundStyle(
                                LinearGradient(
                                    colors: [NexusColors.cyan, NexusColors.purple],
                                    startPoint: .topLeading,
                                    endPoint: .bottomTrailing
                                )
                            )
                    }
                    .onAppear {
                        withAnimation(.easeInOut(duration: 2).repeatForever(autoreverses: true)) {
                            showPulse = true
                        }
                    }

                    Text("NEXUS")
                        .font(NexusFont.title(36))
                        .foregroundStyle(NexusColors.textPrimary)
                        .tracking(8)

                    Text("Discord Bot Dashboard")
                        .font(NexusFont.body(15))
                        .foregroundStyle(NexusColors.textSecondary)
                }

                Spacer()

                // Login button
                VStack(spacing: NexusSpacing.lg) {
                    Button {
                        Task { await authManager.login() }
                    } label: {
                        HStack(spacing: NexusSpacing.md) {
                            if authManager.isLoading {
                                ProgressView()
                                    .tint(.white)
                                    .scaleEffect(0.9)
                            } else {
                                Image(systemName: "arrow.right.circle.fill")
                                    .font(.system(size: 20))
                            }
                            Text("Sign in with Discord")
                                .font(NexusFont.heading(16))
                        }
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, NexusSpacing.lg)
                        .background(
                            LinearGradient(
                                colors: [Color(hex: "5865F2"), Color(hex: "4752C4")],
                                startPoint: .leading,
                                endPoint: .trailing
                            )
                        )
                        .clipShape(RoundedRectangle(cornerRadius: NexusRadius.lg))
                        .shadow(color: Color(hex: "5865F2").opacity(0.4), radius: 12, x: 0, y: 4)
                    }
                    .disabled(authManager.isLoading)

                    Text("Authenticate securely through Discord")
                        .font(NexusFont.caption(12))
                        .foregroundStyle(NexusColors.textMuted)

                    if let error = authManager.loginError {
                        Text(error)
                            .font(NexusFont.caption(12))
                            .foregroundStyle(NexusColors.error)
                            .multilineTextAlignment(.center)
                            .padding(.top, NexusSpacing.sm)
                    }
                }
                .padding(.horizontal, NexusSpacing.xxl)
                .padding(.bottom, 60)
            }
        }
    }
}
