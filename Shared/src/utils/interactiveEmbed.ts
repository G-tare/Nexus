/**
 * Interactive Session — reusable manager for paginated,
 * interactive Component V2 flows (used by /configs, /help, etc.).
 *
 * Handles user ownership, timeouts, page editing, modals, and cleanup.
 *
 * IMPORTANT: Uses ONLY awaitMessageComponent (no persistent collector)
 * to prevent dual-collector race conditions that cause "interaction failed".
 *
 * All messages use Components V2 (ContainerBuilder) instead of EmbedBuilder.
 * Messages are sent with MessageFlags.IsComponentsV2.
 */

import {
  ChatInputCommandInteraction,
  Message,
  ContainerBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  MessageComponentInteraction,
  ModalSubmitInteraction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  StringSelectMenuBuilder,
  ChannelSelectMenuBuilder,
  RoleSelectMenuBuilder,
  CollectedInteraction,
  AttachmentBuilder,
  MessageFlags,
} from 'discord.js';

/**
 * Page content for V2 messages.
 * Uses ContainerBuilder arrays instead of EmbedBuilder.
 */
export interface PageContent {
  /** One or more containers that make up the page layout */
  containers: ContainerBuilder[];
  /** Optional file attachments (e.g. command usage images) */
  files?: AttachmentBuilder[];
}

/**
 * Interactive session that manages a Components V2 message with buttons/menus.
 * Only the user who initiated the session can interact.
 *
 * Uses time-based session tracking instead of persistent collectors
 * to avoid dual-collector conflicts that cause "This interaction failed".
 */
export class InteractiveSession {
  private message: Message | null = null;
  private readonly sessionTimeout: number;
  private readonly startTime: number;
  readonly userId: string;
  private ended = false;

  constructor(
    private readonly interaction: ChatInputCommandInteraction,
    options?: { timeout?: number }
  ) {
    this.userId = interaction.user.id;
    this.sessionTimeout = options?.timeout ?? 300_000; // 5 minutes default
    this.startTime = Date.now();
  }

  /**
   * Start the session by sending the initial reply.
   */
  async start(page: PageContent): Promise<void> {
    await this.interaction.reply({
      components: page.containers as any[],
      files: page.files ?? [],
      flags: MessageFlags.IsComponentsV2,
    });
    this.message = await this.interaction.fetchReply() as Message;
  }

  /**
   * Edit the current message to show a new page.
   */
  async setPage(page: PageContent): Promise<void> {
    if (!this.message || this.ended) return;
    try {
      const editPayload: any = {
        components: page.containers as any[],
        flags: MessageFlags.IsComponentsV2,
      };
      // Include files if provided, otherwise clear previous attachments
      if (page.files && page.files.length > 0) {
        editPayload.files = page.files;
      } else {
        editPayload.files = [];
      }
      await this.message.edit(editPayload);
    } catch {
      // Message may have been deleted
      this.ended = true;
    }
  }

  /**
   * Check if the overall session has exceeded its lifetime.
   */
  private isSessionExpired(): boolean {
    return Date.now() - this.startTime >= this.sessionTimeout;
  }

  /**
   * Wait for the next component interaction from the session owner.
   * Returns null on timeout or session expiry.
   */
  async awaitComponent(idleTimeout = 120_000): Promise<MessageComponentInteraction | null> {
    if (!this.message || this.ended) return null;

    // Check overall session timeout
    if (this.isSessionExpired()) {
      this.ended = true;
      await this.disableComponents();
      return null;
    }

    // Clamp idle timeout to remaining session time
    const remaining = this.sessionTimeout - (Date.now() - this.startTime);
    const effectiveTimeout = Math.min(idleTimeout, remaining);

    if (effectiveTimeout <= 0) {
      this.ended = true;
      await this.disableComponents();
      return null;
    }

    try {
      const collected = await this.message.awaitMessageComponent({
        time: effectiveTimeout,
        filter: (i: CollectedInteraction) => {
          if (i.user.id !== this.userId) {
            i.reply({
              content: '❌ This session belongs to someone else. Run the command yourself to start your own.',
              ephemeral: true,
            }).catch(() => {});
            return false;
          }
          return true;
        },
      });
      return collected as MessageComponentInteraction;
    } catch {
      // Timeout — either idle or session expired
      this.ended = true;
      await this.disableComponents();
      return null;
    }
  }

  /**
   * Show a modal to collect text/number input. Returns the submitted value or null.
   */
  async showModal(
    componentInteraction: MessageComponentInteraction,
    options: {
      title: string;
      fieldId: string;
      label: string;
      placeholder?: string;
      required?: boolean;
      style?: 'short' | 'paragraph';
      value?: string;
      minLength?: number;
      maxLength?: number;
    }
  ): Promise<{ value: string; modalInteraction: ModalSubmitInteraction } | null> {
    const customId = `modal:${this.userId}:${options.fieldId}:${Date.now()}`;

    const input = new TextInputBuilder()
      .setCustomId(`input:${options.fieldId}`)
      .setLabel(options.label)
      .setStyle(options.style === 'paragraph' ? TextInputStyle.Paragraph : TextInputStyle.Short)
      .setRequired(options.required ?? true);

    if (options.placeholder) input.setPlaceholder(options.placeholder);
    if (options.value) input.setValue(options.value);
    if (options.minLength !== undefined) input.setMinLength(options.minLength);
    if (options.maxLength !== undefined) input.setMaxLength(options.maxLength);

    const modal = new ModalBuilder()
      .setCustomId(customId)
      .setTitle(options.title)
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(input)
      );

    await componentInteraction.showModal(modal);

    try {
      const submission = await componentInteraction.awaitModalSubmit({
        time: 120_000, // 2 minutes to fill modal
        filter: (i) => i.customId === customId && i.user.id === this.userId,
      });

      const value = submission.fields.getTextInputValue(`input:${options.fieldId}`);
      return { value, modalInteraction: submission };
    } catch {
      return null; // Modal timed out
    }
  }

  /**
   * End the session and disable all components.
   */
  async end(): Promise<void> {
    this.ended = true;
    await this.disableComponents();
  }

  /**
   * Whether the session has ended.
   */
  get isEnded(): boolean {
    return this.ended;
  }

  /**
   * Disable all interactive components on the message.
   * For V2, we need to walk the container tree and disable buttons/menus in action rows.
   */
  private async disableComponents(): Promise<void> {
    if (!this.message) return;
    try {
      await this.message.delete().catch(() => {});
    } catch {
      // Message may have been deleted already
    }
  }
}

// ── Helper: Build a back button ──

export function backButton(customId = 'back'): ButtonBuilder {
  return new ButtonBuilder()
    .setCustomId(customId)
    .setLabel('← Back')
    .setStyle(ButtonStyle.Secondary);
}

// ── Helper: Build pagination buttons ──

export function paginationButtons(
  currentPage: number,
  totalPages: number,
  prefix: string
): ButtonBuilder[] {
  const buttons: ButtonBuilder[] = [];

  buttons.push(
    new ButtonBuilder()
      .setCustomId(`${prefix}:prev`)
      .setLabel('◀ Prev')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(currentPage <= 0)
  );

  buttons.push(
    new ButtonBuilder()
      .setCustomId(`${prefix}:page`)
      .setLabel(`${currentPage + 1}/${totalPages}`)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true)
  );

  buttons.push(
    new ButtonBuilder()
      .setCustomId(`${prefix}:next`)
      .setLabel('Next ▶')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(currentPage >= totalPages - 1)
  );

  return buttons;
}
