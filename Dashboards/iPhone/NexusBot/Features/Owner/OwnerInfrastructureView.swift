import SwiftUI

struct OwnerInfrastructureView: View {
    @State private var databaseInfo: DatabaseInfo?
    @State private var systemInfo: SystemInfo?
    @State private var isLoading = false

    var body: some View {
        ZStack {
            NexusColors.background.ignoresSafeArea()

            if isLoading && databaseInfo == nil && systemInfo == nil {
                ScrollView {
                    VStack(spacing: NexusSpacing.md) {
                        SkeletonView()
                            .frame(height: 120)
                        SkeletonView()
                            .frame(height: 200)
                        SkeletonView()
                            .frame(height: 150)
                    }
                    .padding(NexusSpacing.lg)
                }
            } else {
                ScrollView {
                    VStack(spacing: NexusSpacing.lg) {
                        if let dbInfo = databaseInfo {
                            databaseSection(dbInfo)
                        }

                        if let sysInfo = systemInfo {
                            systemInfoSection(sysInfo)
                            memorySection(sysInfo)
                        }
                    }
                    .padding(NexusSpacing.lg)
                }
            }
        }
        .navigationTitle("Infrastructure")
        .navigationBarTitleDisplayMode(.inline)
        .onAppear {
            loadData()
        }
        .refreshable {
            await refreshData()
        }
    }

    // MARK: - Database Section

    @ViewBuilder
    private func databaseSection(_ dbInfo: DatabaseInfo) -> some View {
        VStack(alignment: .leading, spacing: NexusSpacing.md) {
            NexusSectionHeader(title: "Database")

            HStack(spacing: NexusSpacing.lg) {
                StatCard(
                    title: "Size",
                    value: String(format: "%.2f MB", dbInfo.database.sizeMB),
                    icon: "internaldrive.fill",
                    color: NexusColors.cyan
                )

                StatCard(
                    title: "Connections",
                    value: "\(dbInfo.database.activeConnections) Active",
                    icon: "network",
                    color: NexusColors.purple
                )
            }

            // Tables List
            NexusCard {
                VStack(alignment: .leading, spacing: NexusSpacing.md) {
                    Text("Tables")
                        .font(NexusFont.heading(18))
                        .foregroundStyle(NexusColors.textPrimary)

                    if dbInfo.tables.isEmpty {
                        Text("No tables found")
                            .font(NexusFont.body(14))
                            .foregroundStyle(NexusColors.textSecondary)
                    } else {
                        VStack(spacing: NexusSpacing.sm) {
                            ForEach(dbInfo.tables.sorted { $0.sizeMB > $1.sizeMB }, id: \.name) { table in
                                tableRow(table)
                            }
                        }
                    }
                }
            }
        }
    }

    private func tableRow(_ table: TableInfo) -> some View {
        VStack(alignment: .leading, spacing: NexusSpacing.xs) {
            HStack(alignment: .center, spacing: NexusSpacing.md) {
                VStack(alignment: .leading, spacing: NexusSpacing.xs) {
                    Text(table.name)
                        .font(NexusFont.body(14))
                        .foregroundStyle(NexusColors.textPrimary)

                    HStack(spacing: NexusSpacing.md) {
                        HStack(spacing: NexusSpacing.xs) {
                            Image(systemName: "text.page.fill")
                                .font(.caption)
                            Text("\(table.rowCount) rows")
                                .font(NexusFont.caption(12))
                        }
                        .foregroundStyle(NexusColors.textSecondary)

                        HStack(spacing: NexusSpacing.xs) {
                            Image(systemName: "internaldrive")
                                .font(.caption)
                            Text(String(format: "%.2f MB", table.sizeMB))
                                .font(NexusFont.caption(12))
                        }
                        .foregroundStyle(NexusColors.textSecondary)
                    }
                }

                Spacer()

                VStack(alignment: .trailing, spacing: NexusSpacing.xs) {
                    Text(String(format: "%.1f%%", getTablePercentage(table)))
                        .font(NexusFont.stat(22))
                        .foregroundStyle(NexusColors.cyan)
                }
            }

            Divider()
                .foregroundStyle(NexusColors.border)
        }
    }

    private func getTablePercentage(_ table: TableInfo) -> Double {
        guard let dbInfo = databaseInfo, dbInfo.database.sizeMB > 0 else { return 0 }
        return (table.sizeMB / dbInfo.database.sizeMB) * 100
    }

    // MARK: - System Info Section

    @ViewBuilder
    private func systemInfoSection(_ sysInfo: SystemInfo) -> some View {
        VStack(alignment: .leading, spacing: NexusSpacing.md) {
            NexusSectionHeader(title: "System Information")

            NexusCard {
                VStack(alignment: .leading, spacing: NexusSpacing.md) {
                    infoRow(label: "Node Version", value: sysInfo.nodeVersion)
                    Divider().foregroundStyle(NexusColors.border)

                    infoRow(label: "Platform", value: sysInfo.platform)
                    Divider().foregroundStyle(NexusColors.border)

                    infoRow(label: "Architecture", value: sysInfo.arch)
                    Divider().foregroundStyle(NexusColors.border)

                    infoRow(label: "Process ID", value: String(sysInfo.pid))
                    Divider().foregroundStyle(NexusColors.border)

                    infoRow(label: "Uptime", value: formatUptime(sysInfo.uptime))
                    Divider().foregroundStyle(NexusColors.border)

                    infoRow(label: "Environment", value: sysInfo.env)
                }
            }
        }
    }

    private func infoRow(label: String, value: String) -> some View {
        HStack(spacing: NexusSpacing.md) {
            Text(label)
                .font(NexusFont.body(14))
                .foregroundStyle(NexusColors.textSecondary)

            Spacer()

            Text(value)
                .font(NexusFont.mono(14))
                .foregroundStyle(NexusColors.textPrimary)
        }
    }

    // MARK: - Memory Section

    @ViewBuilder
    private func memorySection(_ sysInfo: SystemInfo) -> some View {
        VStack(alignment: .leading, spacing: NexusSpacing.md) {
            NexusSectionHeader(title: "Memory")

            HStack(spacing: NexusSpacing.lg) {
                StatCard(
                    title: "Heap Used",
                    value: String(format: "%.2f MB", sysInfo.memory.heapUsedMB),
                    icon: "memorychip.fill",
                    color: NexusColors.cyan
                )

                StatCard(
                    title: "Heap Total",
                    value: String(format: "%.2f MB", sysInfo.memory.heapTotalMB),
                    icon: "memorychip",
                    color: NexusColors.purple
                )
            }

            NexusCard {
                VStack(alignment: .leading, spacing: NexusSpacing.md) {
                    HStack(alignment: .center, spacing: NexusSpacing.md) {
                        VStack(alignment: .leading, spacing: NexusSpacing.xs) {
                            Text("Resident Set Size")
                                .font(NexusFont.body(14))
                                .foregroundStyle(NexusColors.textPrimary)

                            Text("Physical memory allocated")
                                .font(NexusFont.caption(12))
                                .foregroundStyle(NexusColors.textSecondary)
                        }

                        Spacer()

                        VStack(alignment: .trailing, spacing: NexusSpacing.xs) {
                            Text(String(format: "%.2f", sysInfo.memory.rssMB))
                                .font(NexusFont.stat(22))
                                .foregroundStyle(NexusColors.cyan)

                            Text("MB")
                                .font(NexusFont.caption(12))
                                .foregroundStyle(NexusColors.textSecondary)
                        }
                    }
                }
            }

            // Memory Usage Bar
            NexusCard {
                VStack(alignment: .leading, spacing: NexusSpacing.md) {
                    Text("Heap Usage")
                        .font(NexusFont.body(14))
                        .foregroundStyle(NexusColors.textPrimary)

                    GeometryReader { geometry in
                        ZStack(alignment: .leading) {
                            RoundedRectangle(cornerRadius: NexusRadius.sm)
                                .foregroundStyle(NexusColors.surfaceElevated)

                            let percentage = sysInfo.memory.heapTotalMB > 0
                                ? (sysInfo.memory.heapUsedMB / sysInfo.memory.heapTotalMB) * 100
                                : 0

                            RoundedRectangle(cornerRadius: NexusRadius.sm)
                                .foregroundStyle(memoryColor(percentage))
                                .frame(width: geometry.size.width * CGFloat(percentage / 100))
                        }
                    }
                    .frame(height: 8)

                    HStack(spacing: NexusSpacing.md) {
                        Text(String(format: "%.1f%%", sysInfo.memory.heapUsedMB / sysInfo.memory.heapTotalMB * 100))
                            .font(NexusFont.caption(12))
                            .foregroundStyle(NexusColors.textSecondary)

                        Spacer()

                        Text(String(format: "%.2f / %.2f MB", sysInfo.memory.heapUsedMB, sysInfo.memory.heapTotalMB))
                            .font(NexusFont.caption(12))
                            .foregroundStyle(NexusColors.textMuted)
                    }
                }
            }
        }
    }

    private func memoryColor(_ percentage: Double) -> Color {
        if percentage < 50 {
            return NexusColors.success
        } else if percentage < 75 {
            return NexusColors.cyan
        } else if percentage < 90 {
            return NexusColors.warning
        } else {
            return NexusColors.error
        }
    }

    // MARK: - Helpers

    private func formatUptime(_ secondsDouble: Double) -> String {
        let seconds = Int(secondsDouble)
        let days = seconds / 86400
        let hours = (seconds % 86400) / 3600
        let minutes = (seconds % 3600) / 60

        if days > 0 {
            return "\(days)d \(hours)h \(minutes)m"
        } else if hours > 0 {
            return "\(hours)h \(minutes)m"
        } else {
            return "\(minutes)m"
        }
    }

    private func loadData() {
        isLoading = true
        Task {
            do {
                async let dbTask = APIClient.shared.fetchDatabaseInfo()
                async let sysTask = APIClient.shared.fetchSystemInfo()

                let dbResult = try await dbTask
                let sysResult = try await sysTask

                databaseInfo = dbResult
                systemInfo = sysResult

                isLoading = false
            } catch {
                isLoading = false
                print("Failed to load infrastructure data: \(error)")
            }
        }
    }

    private func refreshData() async {
        do {
            async let dbTask = APIClient.shared.fetchDatabaseInfo()
            async let sysTask = APIClient.shared.fetchSystemInfo()

            let dbResult = try await dbTask
            let sysResult = try await sysTask

            databaseInfo = dbResult
            systemInfo = sysResult
        } catch {
            print("Failed to refresh infrastructure data: \(error)")
        }
    }
}

// MARK: - Types


struct MemoryInfo {
    let heapUsedMB: Double
    let heapTotalMB: Double
    let rssMB: Double
}

#Preview {
    NavigationView {
        OwnerInfrastructureView()
    }
}
