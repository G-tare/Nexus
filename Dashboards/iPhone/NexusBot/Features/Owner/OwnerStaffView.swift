import SwiftUI

struct OwnerStaffView: View {
    @StateObject private var viewModel = StaffManagementViewModel()
    @State private var showAddStaffSheet = false
    @State private var selectedStaffMember: StaffMember?
    @State private var showRemoveConfirmation = false
    @State private var isRefreshing = false

    var body: some View {
        NavigationStack {
            ZStack {
                NexusColors.background.ignoresSafeArea()

                if viewModel.isLoading && viewModel.staffList.isEmpty {
                    ScrollView {
                        VStack(spacing: NexusSpacing.md) {
                            ForEach(0..<3, id: \.self) { _ in
                                SkeletonView()
                                    .frame(height: 80)
                            }
                        }
                        .padding(NexusSpacing.lg)
                    }
                } else {
                    ScrollViewReader { proxy in
                        ScrollView {
                            VStack(spacing: NexusSpacing.lg) {
                                // Add Staff Button
                                NexusButton(
                                    title: "Add Staff Member",
                                    action: { showAddStaffSheet = true }
                                )
                                .padding(.horizontal, NexusSpacing.lg)

                                // Active Staff Section
                                if !viewModel.activeStaff.isEmpty {
                                    VStack(alignment: .leading, spacing: NexusSpacing.md) {
                                        NexusSectionHeader(
                                            title: "Active Staff",
                                            subtitle: "\(viewModel.activeStaff.count) member\(viewModel.activeStaff.count == 1 ? "" : "s")"
                                        )

                                        VStack(spacing: NexusSpacing.sm) {
                                            ForEach(viewModel.activeStaff) { staff in
                                                StaffMemberCard(
                                                    staff: staff,
                                                    onTap: {
                                                        selectedStaffMember = staff
                                                    }
                                                )
                                            }
                                        }
                                    }
                                    .padding(.horizontal, NexusSpacing.lg)
                                }

                                // Staff Activity Section
                                if !viewModel.staffActivity.isEmpty {
                                    VStack(alignment: .leading, spacing: NexusSpacing.md) {
                                        NexusSectionHeader(
                                            title: "Recent Activity",
                                            subtitle: "\(viewModel.staffActivity.count) action\(viewModel.staffActivity.count == 1 ? "" : "s")"
                                        )

                                        VStack(spacing: NexusSpacing.sm) {
                                            ForEach(viewModel.staffActivity) { activity in
                                                StaffActivityRow(activity: activity)
                                            }
                                        }
                                    }
                                    .padding(.horizontal, NexusSpacing.lg)
                                }

                                // Removed Staff Section
                                if !viewModel.removedStaff.isEmpty {
                                    VStack(alignment: .leading, spacing: NexusSpacing.md) {
                                        NexusSectionHeader(
                                            title: "Removed Staff",
                                            subtitle: "\(viewModel.removedStaff.count) member\(viewModel.removedStaff.count == 1 ? "" : "s")"
                                        )

                                        VStack(spacing: NexusSpacing.sm) {
                                            ForEach(viewModel.removedStaff) { staff in
                                                RemovedStaffCard(staff: staff)
                                            }
                                        }
                                    }
                                    .padding(.horizontal, NexusSpacing.lg)
                                }

                                // Empty State
                                if viewModel.activeStaff.isEmpty && !viewModel.isLoading {
                                    VStack {
                                        EmptyStateView(
                                            icon: "person.3.fill",
                                            title: "No Staff Members",
                                            description: "Add staff members to manage your support team",
                                            action: {
                                                showAddStaffSheet = true
                                            },
                                            actionLabel: "Add Staff Member"
                                        )
                                        .padding(.vertical, NexusSpacing.xl)

                                        Spacer()
                                    }
                                }

                                Spacer()
                                    .frame(height: NexusSpacing.lg)
                            }
                            .padding(.vertical, NexusSpacing.lg)
                        }
                        .refreshable {
                            await viewModel.refreshData()
                        }
                    }
                }
            }
            .navigationTitle("Staff Management")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button(action: {
                        Task {
                            await viewModel.refreshData()
                        }
                    }) {
                        Image(systemName: "arrow.clockwise")
                            .foregroundStyle(NexusColors.cyan)
                    }
                }
            }
        }
        .sheet(isPresented: $showAddStaffSheet) {
            AddStaffSheet(
                isPresented: $showAddStaffSheet,
                viewModel: viewModel
            )
        }
        .confirmationDialog(
            "Staff Member Options",
            isPresented: .constant(selectedStaffMember != nil),
            presenting: selectedStaffMember
        ) { staff in
            Button("Change Role", action: {
                // Change role action
            })

            Button("Remove", role: .destructive) {
                showRemoveConfirmation = true
            }

            Button("Cancel", role: .cancel) {
                selectedStaffMember = nil
            }
        } message: { staff in
            Text("Options for \(staff.username)")
        }
        .confirmationDialog(
            "Remove Staff Member",
            isPresented: $showRemoveConfirmation,
            presenting: selectedStaffMember
        ) { staff in
            Button("Remove \(staff.username)", role: .destructive) {
                Task {
                    await viewModel.removeStaffMember(staffId: staff.id)
                    selectedStaffMember = nil
                }
            }

            Button("Cancel", role: .cancel) {
                selectedStaffMember = nil
            }
        } message: { staff in
            Text("This will remove \(staff.username) from the staff team.")
        }
        .task {
            await viewModel.loadData()
        }
    }
}

// MARK: - Staff Member Card
struct StaffMemberCard: View {
    let staff: StaffMember
    let onTap: () -> Void

    var body: some View {
        NexusCard {
            HStack(spacing: NexusSpacing.md) {
                // Avatar
                AsyncImage(url: staff.avatarURL) { phase in
                    switch phase {
                    case .empty:
                        Image(systemName: "person.circle.fill")
                            .font(.system(size: 40))
                            .foregroundStyle(NexusColors.textMuted)
                    case .success(let image):
                        image
                            .resizable()
                            .scaledToFill()
                    case .failure:
                        Image(systemName: "person.circle.fill")
                            .font(.system(size: 40))
                            .foregroundStyle(NexusColors.textMuted)
                    @unknown default:
                        Image(systemName: "person.circle.fill")
                            .font(.system(size: 40))
                            .foregroundStyle(NexusColors.textMuted)
                    }
                }
                .frame(width: 40, height: 40)
                .clipShape(Circle())

                // Staff Info
                VStack(alignment: .leading, spacing: NexusSpacing.xs) {
                    HStack(spacing: NexusSpacing.sm) {
                        Text(staff.username)
                            .font(NexusFont.body(14))
                            .foregroundStyle(NexusColors.textPrimary)

                        NexusBadge(
                            text: staff.role.capitalized,
                            backgroundColor: roleBadgeColor(staff.role),
                            textColor: .white
                        )
                    }

                    Text("Added \(staff.addedAt ?? "Unknown")")
                        .font(NexusFont.caption(12))
                        .foregroundStyle(NexusColors.textSecondary)
                }

                Spacer()

                Image(systemName: "chevron.right")
                    .foregroundStyle(NexusColors.textMuted)
            }
            .padding(NexusSpacing.md)
            .contentShape(Rectangle())
            .onTapGesture(perform: onTap)
        }
    }

    private func roleBadgeColor(_ role: String) -> Color {
        switch role.lowercased() {
        case "owner":
            return NexusColors.warning
        case "manager":
            return NexusColors.cyan
        case "support":
            return NexusColors.success
        default:
            return NexusColors.purple
        }
    }
}

// MARK: - Removed Staff Card
struct RemovedStaffCard: View {
    let staff: StaffMember

    var body: some View {
        NexusCard {
            HStack(spacing: NexusSpacing.md) {
                // Avatar (greyed out)
                AsyncImage(url: staff.avatarURL) { phase in
                    switch phase {
                    case .empty:
                        Image(systemName: "person.circle.fill")
                            .font(.system(size: 40))
                            .foregroundStyle(NexusColors.textMuted)
                    case .success(let image):
                        image
                            .resizable()
                            .scaledToFill()
                    case .failure:
                        Image(systemName: "person.circle.fill")
                            .font(.system(size: 40))
                            .foregroundStyle(NexusColors.textMuted)
                    @unknown default:
                        Image(systemName: "person.circle.fill")
                            .font(.system(size: 40))
                            .foregroundStyle(NexusColors.textMuted)
                    }
                }
                .frame(width: 40, height: 40)
                .clipShape(Circle())
                .opacity(0.5)

                // Staff Info (greyed out)
                VStack(alignment: .leading, spacing: NexusSpacing.xs) {
                    Text(staff.username)
                        .font(NexusFont.body(14))
                        .foregroundStyle(NexusColors.textSecondary)
                        .strikethrough()

                    if let removedAt = staff.removedAt, !removedAt.isEmpty {
                        Text("Removed \(removedAt)")
                            .font(NexusFont.caption(12))
                            .foregroundStyle(NexusColors.textMuted)
                    }
                }

                Spacer()
            }
            .padding(NexusSpacing.md)
            .opacity(0.6)
        }
    }
}

// MARK: - Staff Activity Row
struct StaffActivityRow: View {
    let activity: StaffActivity

    var body: some View {
        VStack(alignment: .leading, spacing: NexusSpacing.xs) {
            HStack(spacing: NexusSpacing.sm) {
                VStack(alignment: .leading, spacing: NexusSpacing.xs) {
                    Text(activity.staffName)
                        .font(NexusFont.body(14))
                        .foregroundStyle(NexusColors.textPrimary)

                    Text(activity.actionType.capitalized)
                        .font(NexusFont.caption(12))
                        .foregroundStyle(NexusColors.textSecondary)
                }

                Spacer()

                Text(activity.createdDate?.formatted(date: .abbreviated, time: .shortened) ?? activity.createdAt)
                    .font(NexusFont.caption(12))
                    .foregroundStyle(NexusColors.textMuted)
            }

            if let subject = activity.ticketSubject, !subject.isEmpty {
                Text("Ticket: \(subject)")
                    .font(NexusFont.caption(12))
                    .foregroundStyle(NexusColors.textSecondary)
                    .lineLimit(1)
            }
        }
        .padding(NexusSpacing.md)
        .background(NexusColors.cardBackground)
        .cornerRadius(NexusRadius.md)
    }
}

// MARK: - Add Staff Sheet
struct AddStaffSheet: View {
    @Binding var isPresented: Bool
    let viewModel: StaffManagementViewModel

    @State private var discordId = ""
    @State private var selectedRole = "support"
    @State private var isSubmitting = false
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            ZStack {
                NexusColors.background.ignoresSafeArea()

                VStack(spacing: NexusSpacing.lg) {
                    NexusSectionHeader(
                        title: "Add Staff Member",
                        subtitle: "Enter Discord details and select a role"
                    )

                    VStack(spacing: NexusSpacing.md) {
                        // Discord ID Input
                        VStack(alignment: .leading, spacing: NexusSpacing.sm) {
                            Text("Discord User ID")
                                .font(NexusFont.body(14))
                                .foregroundStyle(NexusColors.textPrimary)

                            TextField("Enter Discord ID", text: $discordId)
                                .textFieldStyle(.roundedBorder)
                                .font(NexusFont.body(14))
                                .keyboardType(.numberPad)
                        }

                        // Role Picker
                        VStack(alignment: .leading, spacing: NexusSpacing.sm) {
                            Text("Role")
                                .font(NexusFont.body(14))
                                .foregroundStyle(NexusColors.textPrimary)

                            Picker("Role", selection: $selectedRole) {
                                Text("Support").tag("support")
                                Text("Manager").tag("manager")
                            }
                            .pickerStyle(.segmented)
                        }

                        // Error Message
                        if let errorMessage {
                            HStack(spacing: NexusSpacing.sm) {
                                Image(systemName: "exclamationmark.circle.fill")
                                    .foregroundStyle(NexusColors.error)

                                Text(errorMessage)
                                    .font(NexusFont.caption(12))
                                    .foregroundStyle(NexusColors.error)
                            }
                            .padding(NexusSpacing.md)
                            .background(NexusColors.cardBackground)
                            .cornerRadius(NexusRadius.md)
                        }
                    }
                    .padding(NexusSpacing.lg)
                    .background(NexusColors.cardBackground)
                    .cornerRadius(NexusRadius.md)

                    Spacer()

                    HStack(spacing: NexusSpacing.md) {
                        Button("Cancel") {
                            isPresented = false
                        }
                        .foregroundStyle(NexusColors.textPrimary)
                        .frame(maxWidth: .infinity)
                        .padding(NexusSpacing.md)
                        .background(NexusColors.cardBackground)
                        .cornerRadius(NexusRadius.md)

                        Button(action: {
                            Task {
                                await addStaffMember()
                            }
                        }) {
                            if isSubmitting {
                                ProgressView()
                                    .progressViewStyle(.circular)
                                    .frame(maxWidth: .infinity)
                                    .foregroundStyle(NexusColors.cyan)
                            } else {
                                Text("Add Staff")
                                    .font(NexusFont.body(14))
                                    .frame(maxWidth: .infinity)
                            }
                        }
                        .disabled(discordId.trimmingCharacters(in: .whitespaces).isEmpty || isSubmitting)
                        .padding(NexusSpacing.md)
                        .background(discordId.trimmingCharacters(in: .whitespaces).isEmpty || isSubmitting ? NexusColors.textMuted : NexusColors.cyan)
                        .foregroundStyle(.white)
                        .cornerRadius(NexusRadius.md)
                    }
                    .padding(NexusSpacing.lg)
                }
            }
            .navigationBarTitleDisplayMode(.inline)
        }
    }

    private func addStaffMember() async {
        isSubmitting = true
        errorMessage = nil

        let trimmedId = discordId.trimmingCharacters(in: .whitespaces)

        do {
            _ = try await APIClient.shared.addStaffMember(
                discordId: trimmedId,
                role: selectedRole
            )

            await viewModel.loadData()
            isPresented = false
        } catch {
            errorMessage = error.localizedDescription
            isSubmitting = false
        }
    }
}

// MARK: - View Model
@MainActor
class StaffManagementViewModel: ObservableObject {
    @Published var staffList: [StaffMember] = []
    @Published var staffActivity: [StaffActivity] = []
    @Published var isLoading = false

    var activeStaff: [StaffMember] {
        staffList.filter { $0.isActive }
    }

    var removedStaff: [StaffMember] {
        staffList.filter { !$0.isActive }
    }

    func loadData() async {
        isLoading = true

        async let staffTask = fetchStaff()
        async let activityTask = fetchActivity()

        let (staff, activity) = await (staffTask, activityTask)

        self.staffList = staff
        self.staffActivity = activity
        self.isLoading = false
    }

    func refreshData() async {
        await loadData()
    }

    func removeStaffMember(staffId: Int) async {
        do {
            try await APIClient.shared.removeStaffMember(staffId)
            await loadData()
        } catch {
            // Handle error
        }
    }

    private func fetchStaff() async -> [StaffMember] {
        do {
            let response = try await APIClient.shared.fetchStaff()
            return response.staff
        } catch {
            return []
        }
    }

    private func fetchActivity() async -> [StaffActivity] {
        do {
            let response = try await APIClient.shared.fetchStaffActivity(limit: 10)
            return response.activity
        } catch {
            return []
        }
    }
}

#Preview {
    OwnerStaffView()
}
