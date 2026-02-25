import SwiftUI

struct ServerSelectorView: View {
    @EnvironmentObject var authManager: AuthManager

    // Bot invite URL (same as landing page)
    private let inviteURL = "https://discord.com/oauth2/authorize?client_id=1475529392963981333&permissions=8&scope=bot%20applications.commands"

    /// Servers the bot IS in (user has manage perms)
    private var botGuilds: [Guild] {
        authManager.guilds.filter { authManager.botGuildIds.contains($0.id) }
    }

    /// Servers the bot is NOT in (user has manage perms, could add bot)
    private var addableGuilds: [Guild] {
        authManager.guilds.filter { !authManager.botGuildIds.contains($0.id) }
    }

    var body: some View {
        NavigationStack {
            ZStack {
                NexusColors.background.ignoresSafeArea()

                ScrollView {
                    VStack(alignment: .leading, spacing: NexusSpacing.xl) {
                        // MARK: - Top Bar
                        topBar

                        // MARK: - Title
                        VStack(alignment: .leading, spacing: NexusSpacing.xs) {
                            Text("Select a ")
                                .font(NexusFont.title(28))
                                .foregroundStyle(NexusColors.textPrimary)
                            + Text("Server")
                                .font(NexusFont.title(28))
                                .foregroundStyle(NexusColors.cyan)

                            Text("Choose a server to manage its settings and modules")
                                .font(NexusFont.body(14))
                                .foregroundStyle(NexusColors.textSecondary)
                        }
                        .padding(.horizontal, NexusSpacing.lg)

                        if !authManager.guildsLoaded {
                            loadingState
                        } else {
                            // MARK: - Servers with Nexus
                            serverSection(
                                title: "Servers with",
                                highlight: "Nexus Bot",
                                count: botGuilds.count,
                                icon: "checkmark.shield.fill",
                                iconColor: NexusColors.success
                            )

                            if botGuilds.isEmpty {
                                NexusCard {
                                    HStack(spacing: NexusSpacing.md) {
                                        Image(systemName: "info.circle.fill")
                                            .foregroundStyle(NexusColors.textMuted)
                                        Text("Nexus Bot isn't in any of your servers yet")
                                            .font(NexusFont.body(14))
                                            .foregroundStyle(NexusColors.textSecondary)
                                    }
                                }
                                .padding(.horizontal, NexusSpacing.lg)
                            } else {
                                LazyVStack(spacing: NexusSpacing.md) {
                                    ForEach(botGuilds) { guild in
                                        NavigationLink {
                                            ServerDashboardView(guild: guild)
                                        } label: {
                                            ActiveServerCard(guild: guild)
                                        }
                                    }
                                }
                                .padding(.horizontal, NexusSpacing.lg)
                            }

                            // MARK: - Add to More Servers
                            if !addableGuilds.isEmpty {
                                serverSection(
                                    title: "Add Nexus to",
                                    highlight: "More Servers",
                                    count: addableGuilds.count,
                                    icon: "plus.circle.fill",
                                    iconColor: NexusColors.cyan
                                )
                                .padding(.top, NexusSpacing.lg)

                                LazyVStack(spacing: NexusSpacing.md) {
                                    ForEach(addableGuilds) { guild in
                                        AddableServerCard(guild: guild, inviteURL: inviteURL)
                                    }
                                }
                                .padding(.horizontal, NexusSpacing.lg)
                            }
                        }
                    }
                    .padding(.top, NexusSpacing.lg)
                    .padding(.bottom, 60)
                }
                .refreshable {
                    await authManager.loadGuilds()
                }
            }
            .navigationBarHidden(true)
        }
    }

    // MARK: - Top Bar

    private var topBar: some View {
        HStack(spacing: NexusSpacing.md) {
            if let user = authManager.currentUser {
                // User avatar + name
                AsyncImage(url: user.avatarURL) { image in
                    image.resizable().scaledToFill()
                } placeholder: {
                    Circle().fill(NexusColors.surfaceElevated)
                }
                .frame(width: 36, height: 36)
                .clipShape(Circle())
                .overlay(Circle().stroke(NexusColors.cyan.opacity(0.3), lineWidth: 1))

                Text(user.username)
                    .font(NexusFont.body(15))
                    .foregroundStyle(NexusColors.textPrimary)

                Spacer()

                // Owner dashboard button — ONLY if user is owner
                if user.isOwner {
                    NavigationLink {
                        OwnerDashboardView()
                    } label: {
                        HStack(spacing: NexusSpacing.xs) {
                            Image(systemName: "crown.fill")
                                .font(.system(size: 12))
                            Text("Owner")
                                .font(NexusFont.caption(12))
                                .fontWeight(.semibold)
                        }
                        .foregroundStyle(NexusColors.background)
                        .padding(.horizontal, NexusSpacing.md)
                        .padding(.vertical, NexusSpacing.sm)
                        .background(NexusColors.purple)
                        .clipShape(RoundedRectangle(cornerRadius: NexusRadius.sm))
                    }
                }

                // Logout
                Button {
                    authManager.logout()
                } label: {
                    Image(systemName: "rectangle.portrait.and.arrow.right")
                        .font(.system(size: 16))
                        .foregroundStyle(NexusColors.textSecondary)
                        .frame(width: 36, height: 36)
                        .background(NexusColors.cardBackground)
                        .clipShape(RoundedRectangle(cornerRadius: NexusRadius.sm))
                }
            }
        }
        .padding(.horizontal, NexusSpacing.lg)
    }

    // MARK: - Section Header

    private func serverSection(title: String, highlight: String, count: Int, icon: String, iconColor: Color) -> some View {
        HStack(spacing: NexusSpacing.sm) {
            Image(systemName: icon)
                .font(.system(size: 14))
                .foregroundStyle(iconColor)

            (Text(title + " ")
                .foregroundStyle(NexusColors.textPrimary) +
            Text(highlight)
                .foregroundStyle(NexusColors.cyan))
                .font(NexusFont.heading(17))

            Text("\(count)")
                .font(NexusFont.mono(12))
                .foregroundStyle(NexusColors.cyan)
                .padding(.horizontal, NexusSpacing.sm)
                .padding(.vertical, 2)
                .background(NexusColors.cyan.opacity(0.15))
                .clipShape(RoundedRectangle(cornerRadius: NexusRadius.sm))

            Spacer()
        }
        .padding(.horizontal, NexusSpacing.lg)
    }

    // MARK: - Loading State

    private var loadingState: some View {
        VStack(spacing: NexusSpacing.md) {
            ForEach(0..<4, id: \.self) { _ in
                SkeletonView(height: 80)
            }
        }
        .padding(.horizontal, NexusSpacing.lg)
    }

    // Guild loading is handled by AuthManager — pre-loaded during login,
    // refreshable via pull-to-refresh which calls authManager.loadGuilds()
}

// MARK: - Active Server Card (bot is in this server)

struct ActiveServerCard: View {
    let guild: Guild

    var body: some View {
        HStack(spacing: NexusSpacing.md) {
            // Server icon
            serverIcon
                .frame(width: 48, height: 48)

            VStack(alignment: .leading, spacing: NexusSpacing.xs) {
                Text(guild.name)
                    .font(NexusFont.body(15))
                    .foregroundStyle(NexusColors.textPrimary)
                    .lineLimit(1)

                HStack(spacing: NexusSpacing.xs) {
                    Text(guild.owner == true ? "Owner" : "Admin")
                        .font(NexusFont.caption(12))
                        .foregroundStyle(NexusColors.textSecondary)
                }
            }

            Spacer()

            // Bot active indicator
            HStack(spacing: NexusSpacing.xs) {
                Circle()
                    .fill(NexusColors.success)
                    .frame(width: 6, height: 6)
                Text("Active")
                    .font(NexusFont.caption(11))
                    .foregroundStyle(NexusColors.success)
            }

            Image(systemName: "chevron.right")
                .font(.system(size: 12))
                .foregroundStyle(NexusColors.textMuted)
        }
        .padding(NexusSpacing.md)
        .background(NexusColors.cardBackground)
        .clipShape(RoundedRectangle(cornerRadius: NexusRadius.lg))
        .overlay(
            RoundedRectangle(cornerRadius: NexusRadius.lg)
                .stroke(NexusColors.success.opacity(0.15), lineWidth: 1)
        )
    }

    @ViewBuilder
    private var serverIcon: some View {
        if let iconURL = guild.iconURL {
            AsyncImage(url: iconURL) { image in
                image.resizable().scaledToFill()
            } placeholder: {
                initialPlaceholder
            }
            .clipShape(RoundedRectangle(cornerRadius: NexusRadius.md))
        } else {
            initialPlaceholder
        }
    }

    private var initialPlaceholder: some View {
        Text(guild.initial)
            .font(NexusFont.heading(18))
            .foregroundStyle(NexusColors.purple)
            .frame(width: 48, height: 48)
            .background(NexusColors.surfaceElevated)
            .clipShape(RoundedRectangle(cornerRadius: NexusRadius.md))
    }
}

// MARK: - Addable Server Card (bot NOT in this server)

struct AddableServerCard: View {
    let guild: Guild
    let inviteURL: String

    var body: some View {
        VStack(spacing: NexusSpacing.md) {
            HStack(spacing: NexusSpacing.md) {
                // Server icon
                serverIcon
                    .frame(width: 44, height: 44)

                VStack(alignment: .leading, spacing: NexusSpacing.xs) {
                    Text(guild.name)
                        .font(NexusFont.body(14))
                        .foregroundStyle(NexusColors.textPrimary)
                        .lineLimit(1)
                    Text(guild.owner == true ? "Owner" : "Admin")
                        .font(NexusFont.caption(12))
                        .foregroundStyle(NexusColors.textMuted)
                }

                Spacer()

                // Inactive indicator
                Circle()
                    .fill(NexusColors.textMuted)
                    .frame(width: 6, height: 6)
            }

            // Add bot button
            Link(destination: URL(string: "\(inviteURL)&guild_id=\(guild.id)")!) {
                HStack(spacing: NexusSpacing.sm) {
                    Image(systemName: "plus")
                        .font(.system(size: 12, weight: .bold))
                    Text("Add Nexus Bot")
                        .font(NexusFont.caption(13))
                        .fontWeight(.semibold)
                    Image(systemName: "arrow.right")
                        .font(.system(size: 10))
                }
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity)
                .padding(.vertical, NexusSpacing.sm)
                .background(
                    LinearGradient(
                        colors: [NexusColors.cyan, NexusColors.purple],
                        startPoint: .leading,
                        endPoint: .trailing
                    )
                )
                .clipShape(RoundedRectangle(cornerRadius: NexusRadius.sm))
            }
        }
        .padding(NexusSpacing.md)
        .background(NexusColors.cardBackground)
        .clipShape(RoundedRectangle(cornerRadius: NexusRadius.lg))
        .overlay(
            RoundedRectangle(cornerRadius: NexusRadius.lg)
                .stroke(NexusColors.border, lineWidth: 1)
        )
    }

    @ViewBuilder
    private var serverIcon: some View {
        if let iconURL = guild.iconURL {
            AsyncImage(url: iconURL) { image in
                image.resizable().scaledToFill()
            } placeholder: {
                initialPlaceholder
            }
            .clipShape(RoundedRectangle(cornerRadius: NexusRadius.sm))
        } else {
            initialPlaceholder
        }
    }

    private var initialPlaceholder: some View {
        Text(guild.initial)
            .font(NexusFont.heading(16))
            .foregroundStyle(NexusColors.textMuted)
            .frame(width: 44, height: 44)
            .background(NexusColors.surfaceElevated)
            .clipShape(RoundedRectangle(cornerRadius: NexusRadius.sm))
    }
}
