import SwiftUI

struct OwnerAlertsView: View {
    @State private var selectedTab: AlertTab = .rules
    @State private var alertRules: [AlertRule] = []
    @State private var alertHistory: [AlertHistoryItem] = []
    @State private var isLoading = false
    @State private var showAddRuleSheet = false
    @State private var refreshID = UUID()

    enum AlertTab {
        case rules
        case history
    }

    var body: some View {
        ZStack {
            NexusColors.background.ignoresSafeArea()

            VStack(spacing: 0) {
                // Segmented Picker
                Picker("Alert Tab", selection: $selectedTab) {
                    Text("Rules").tag(AlertTab.rules)
                    Text("History").tag(AlertTab.history)
                }
                .pickerStyle(.segmented)
                .padding(.horizontal, NexusSpacing.lg)
                .padding(.vertical, NexusSpacing.lg)

                // Content
                if selectedTab == .rules {
                    rulesTabContent
                } else {
                    historyTabContent
                }
            }
        }
        .navigationTitle("Alerts")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if selectedTab == .rules {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button(action: { showAddRuleSheet = true }) {
                        Image(systemName: "plus")
                            .foregroundStyle(NexusColors.cyan)
                    }
                }
            }
        }
        .sheet(isPresented: $showAddRuleSheet) {
            AddAlertRuleSheet(isPresented: $showAddRuleSheet, refreshID: $refreshID)
        }
        .onAppear {
            loadData()
        }
        .onChange(of: refreshID) {
            loadData()
        }
        .refreshable {
            await refreshData()
        }
    }

    @ViewBuilder
    private var rulesTabContent: some View {
        if isLoading && alertRules.isEmpty {
            ScrollView {
                VStack(spacing: NexusSpacing.md) {
                    SkeletonView()
                        .frame(height: 100)
                    SkeletonView()
                        .frame(height: 100)
                    SkeletonView()
                        .frame(height: 100)
                }
                .padding(NexusSpacing.lg)
            }
        } else if alertRules.isEmpty {
            ScrollView {
                EmptyStateView(
                    title: "No Alert Rules",
                    subtitle: "Create your first alert rule to get started",
                    actionTitle: "Add Rule",
                    action: { showAddRuleSheet = true }
                )
                .frame(maxWidth: .infinity, alignment: .top)
                .padding(.vertical, NexusSpacing.lg)
            }
        } else {
            ScrollView {
                VStack(spacing: NexusSpacing.md) {
                    ForEach(alertRules, id: \.id) { rule in
                        AlertRuleCard(rule: rule, refreshID: $refreshID)
                    }
                }
                .padding(NexusSpacing.lg)
            }
        }
    }

    @ViewBuilder
    private var historyTabContent: some View {
        if isLoading && alertHistory.isEmpty {
            ScrollView {
                VStack(spacing: NexusSpacing.md) {
                    SkeletonView()
                        .frame(height: 100)
                    SkeletonView()
                        .frame(height: 100)
                    SkeletonView()
                        .frame(height: 100)
                }
                .padding(NexusSpacing.lg)
            }
        } else if alertHistory.isEmpty {
            ScrollView {
                EmptyStateView(
                    title: "No Alert History",
                    subtitle: "Triggered alerts will appear here"
                )
                .frame(maxWidth: .infinity, alignment: .top)
                .padding(.vertical, NexusSpacing.lg)
            }
        } else {
            ScrollView {
                VStack(spacing: NexusSpacing.md) {
                    ForEach(alertHistory, id: \.id) { item in
                        AlertHistoryCard(item: item)
                    }
                }
                .padding(NexusSpacing.lg)
            }
        }
    }

    private func loadData() {
        isLoading = true
        Task {
            do {
                let rulesResponse = try await APIClient.shared.fetchAlertRules()
                alertRules = rulesResponse.rules

                let historyResponse = try await APIClient.shared.fetchAlertHistory(limit: 50)
                alertHistory = historyResponse.history

                isLoading = false
            } catch {
                isLoading = false
                print("Failed to load alerts: \(error)")
            }
        }
    }

    private func refreshData() async {
        do {
            let rulesResponse = try await APIClient.shared.fetchAlertRules()
            alertRules = rulesResponse.rules

            let historyResponse = try await APIClient.shared.fetchAlertHistory(limit: 50)
            alertHistory = historyResponse.history
        } catch {
            print("Failed to refresh alerts: \(error)")
        }
    }
}

// MARK: - Alert Rule Card

struct AlertRuleCard: View {
    let rule: AlertRule
    @Binding var refreshID: UUID
    @State private var isDeleting = false

    var body: some View {
        NexusCard {
            VStack(alignment: .leading, spacing: NexusSpacing.md) {
                HStack(alignment: .top, spacing: NexusSpacing.md) {
                    VStack(alignment: .leading, spacing: NexusSpacing.sm) {
                        Text(rule.name)
                            .font(NexusFont.heading(18))
                            .foregroundStyle(NexusColors.textPrimary)

                        HStack(spacing: NexusSpacing.sm) {
                            if let metricEnum = MetricType(rawValue: rule.metricType) {
                                NexusBadge(
                                    text: metricEnum.displayName,
                                    backgroundColor: metricEnum.badgeColor,
                                    textColor: .white
                                )
                            } else {
                                NexusBadge(
                                    text: rule.metricType.replacingOccurrences(of: "_", with: " ").capitalized,
                                    backgroundColor: NexusColors.cyan,
                                    textColor: .white
                                )
                            }
                        }
                    }

                    Spacer()

                    Toggle("", isOn: Binding(
                        get: { rule.enabled },
                        set: { newValue in
                            toggleRule(enabled: newValue)
                        }
                    ))
                    .tint(NexusColors.cyan)
                }

                VStack(alignment: .leading, spacing: NexusSpacing.xs) {
                    Text("Condition")
                        .font(NexusFont.caption(12))
                        .foregroundStyle(NexusColors.textSecondary)

                    Text("\(rule.operator) \(String(format: "%.2f", rule.threshold))")
                        .font(NexusFont.mono(14))
                        .foregroundStyle(NexusColors.textPrimary)
                }

                if !(rule.webhookUrl?.isEmpty ?? true) || !(rule.discordChannelId?.isEmpty ?? true) {
                    VStack(alignment: .leading, spacing: NexusSpacing.xs) {
                        Text("Notifications")
                            .font(NexusFont.caption(12))
                            .foregroundStyle(NexusColors.textSecondary)

                        HStack(spacing: NexusSpacing.sm) {
                            if let webhook = rule.webhookUrl, !webhook.isEmpty {
                                HStack(spacing: NexusSpacing.xs) {
                                    Image(systemName: "network")
                                    Text("Webhook")
                                }
                                .font(NexusFont.caption(12))
                                .foregroundStyle(NexusColors.textSecondary)
                            }

                            if let channelId = rule.discordChannelId, !channelId.isEmpty {
                                HStack(spacing: NexusSpacing.xs) {
                                    Image(systemName: "message.fill")
                                    Text("Discord")
                                }
                                .font(NexusFont.caption(12))
                                .foregroundStyle(NexusColors.textSecondary)
                            }
                        }
                    }
                }

                HStack(spacing: NexusSpacing.sm) {
                    Text("Created \(rule.createdAt ?? "Unknown")")
                        .font(NexusFont.caption(12))
                        .foregroundStyle(NexusColors.textMuted)

                    Spacer()

                    NexusButton(
                        title: "Delete",
                        style: .destructive,
                        action: { isDeleting = true }
                    )
                }
            }
        }
        .confirmationDialog("Delete Rule", isPresented: $isDeleting, presenting: rule) { _ in
            Button("Delete", role: .destructive) {
                deleteRule()
            }
        } message: { _ in
            Text("Are you sure you want to delete this alert rule?")
        }
    }

    private func toggleRule(enabled: Bool) {
        Task {
            do {
                try await APIClient.shared.toggleAlertRule(rule.id, enabled: enabled)
                refreshID = UUID()
            } catch {
                print("Failed to toggle rule: \(error)")
            }
        }
    }

    private func deleteRule() {
        Task {
            do {
                try await APIClient.shared.deleteAlertRule(rule.id)
                refreshID = UUID()
            } catch {
                print("Failed to delete rule: \(error)")
            }
        }
    }
}

// MARK: - Alert History Card

struct AlertHistoryCard: View {
    let item: AlertHistoryItem

    var body: some View {
        NexusCard {
            VStack(alignment: .leading, spacing: NexusSpacing.md) {
                HStack(alignment: .top, spacing: NexusSpacing.md) {
                    VStack(alignment: .leading, spacing: NexusSpacing.sm) {
                        Text(item.ruleName ?? "Alert")
                            .font(NexusFont.heading(18))
                            .foregroundStyle(NexusColors.textPrimary)

                        HStack(spacing: NexusSpacing.sm) {
                            if let metricType = item.metricType {
                                NexusBadge(
                                    text: metricType.replacingOccurrences(of: "_", with: " ").capitalized,
                                    backgroundColor: NexusColors.cyan,
                                    textColor: .white
                                )
                            }

                            if item.resolved {
                                NexusBadge(
                                    text: "Resolved",
                                    backgroundColor: NexusColors.success,
                                    textColor: .white
                                )
                            }
                        }
                    }

                    Spacer()

                    VStack(alignment: .trailing, spacing: NexusSpacing.xs) {
                        Text(String(format: "%.2f", item.value))
                            .font(NexusFont.stat(22))
                            .foregroundStyle(item.resolved ? NexusColors.success : NexusColors.warning)
                    }
                }

                if let message = item.message, !message.isEmpty {
                    VStack(alignment: .leading, spacing: NexusSpacing.xs) {
                        Text("Message")
                            .font(NexusFont.caption(12))
                            .foregroundStyle(NexusColors.textSecondary)

                        Text(message)
                            .font(NexusFont.body(14))
                            .foregroundStyle(NexusColors.textPrimary)
                    }
                }

                HStack(spacing: NexusSpacing.md) {
                    HStack(spacing: NexusSpacing.xs) {
                        Image(systemName: "clock")
                        Text(item.triggeredDate?.formatted(date: .abbreviated, time: .shortened) ?? item.triggeredAt)
                    }
                    .font(NexusFont.caption(12))
                    .foregroundStyle(NexusColors.textMuted)

                    Spacer()
                }
            }
        }
    }
}

// MARK: - Add Alert Rule Sheet

struct AddAlertRuleSheet: View {
    @Binding var isPresented: Bool
    @Binding var refreshID: UUID

    @State private var name = ""
    @State private var selectedMetricType: MetricType = .errorRate
    @State private var selectedOperator = ">"
    @State private var threshold = ""
    @State private var webhookUrl = ""
    @State private var discordChannelId = ""
    @State private var isSubmitting = false

    let operators = [">", "<", ">=", "<="]
    let metricTypes: [MetricType] = [.errorRate, .latencyP95, .commandsPerHour, .memoryMb]

    var body: some View {
        NavigationView {
            Form {
                Section(header: Text("Rule Details")) {
                    TextField("Rule Name", text: $name)

                    Picker("Metric Type", selection: $selectedMetricType) {
                        ForEach(metricTypes, id: \.self) { type in
                            Text(type.displayName).tag(type)
                        }
                    }

                    Picker("Operator", selection: $selectedOperator) {
                        ForEach(operators, id: \.self) { op in
                            Text(op).tag(op)
                        }
                    }

                    TextField("Threshold", text: $threshold)
                        .keyboardType(.decimalPad)
                }

                Section(header: Text("Notifications (Optional)")) {
                    TextField("Webhook URL", text: $webhookUrl)
                        .keyboardType(.URL)
                        .autocapitalization(.none)

                    TextField("Discord Channel ID", text: $discordChannelId)
                        .keyboardType(.numberPad)
                }
            }
            .navigationTitle("Add Alert Rule")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") {
                        isPresented = false
                    }
                }

                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Create") {
                        createRule()
                    }
                    .disabled(name.isEmpty || threshold.isEmpty || isSubmitting)
                }
            }
        }
    }

    private func createRule() {
        isSubmitting = true
        Task {
            do {
                let thresholdValue = Double(threshold) ?? 0
                try await APIClient.shared.createAlertRule(
                    name: name,
                    metricType: selectedMetricType.rawValue,
                    operator: selectedOperator,
                    threshold: thresholdValue,
                    webhookUrl: webhookUrl.isEmpty ? nil : webhookUrl,
                    discordChannelId: discordChannelId.isEmpty ? nil : discordChannelId
                )
                refreshID = UUID()
                isPresented = false
            } catch {
                print("Failed to create alert rule: \(error)")
                isSubmitting = false
            }
        }
    }
}

// MARK: - Types

enum MetricType: String, CaseIterable {
    case errorRate = "error_rate"
    case latencyP95 = "latency_p95"
    case commandsPerHour = "commands_per_hour"
    case memoryMb = "memory_mb"

    var displayName: String {
        switch self {
        case .errorRate:
            return "Error Rate"
        case .latencyP95:
            return "Latency P95"
        case .commandsPerHour:
            return "Commands/hr"
        case .memoryMb:
            return "Memory (MB)"
        }
    }

    var badgeColor: Color {
        switch self {
        case .errorRate:
            return NexusColors.error
        case .latencyP95:
            return NexusColors.warning
        case .commandsPerHour:
            return NexusColors.cyan
        case .memoryMb:
            return NexusColors.purple
        }
    }
}


#Preview {
    NavigationView {
        OwnerAlertsView()
    }
}
