import { EventEmitter } from 'events';
import { ModuleEvent } from '../../Shared/src/types/command';
import { createModuleLogger } from '../../Shared/src/utils/logger';
const logger = createModuleLogger('Forms');
import { FormResponse } from './helpers';

export type FormEventType = 'formSubmitted' | 'formApproved' | 'formDenied';

export interface FormEvent {
  type: FormEventType;
  formId: string;
  userId: string;
  guildId: string;
  response?: FormResponse;
  reviewedBy?: string;
  reviewNotes?: string;
}

let eventBus: EventEmitter;

export function initializeEventBus(bus: EventEmitter): void {
  eventBus = bus;
  setupFormEventListeners();
}

export function getEventBus(): EventEmitter {
  return eventBus;
}

function setupFormEventListeners(): void {
  // Log form submissions
  eventBus.on('formSubmitted', (event: FormEvent) => {
    logger.info(`[Forms] Form submitted - Form: ${event.formId}, User: ${event.userId}, Guild: ${event.guildId}`);
  });

  // Log form approvals
  eventBus.on('formApproved', (event: FormEvent) => {
    logger.info(
      `[Forms] Form approved - Form: ${event.formId}, User: ${event.userId}, ReviewedBy: ${event.reviewedBy}, Guild: ${event.guildId}`
    );
  });

  // Log form denials
  eventBus.on('formDenied', (event: FormEvent) => {
    logger.info(
      `[Forms] Form denied - Form: ${event.formId}, User: ${event.userId}, ReviewedBy: ${event.reviewedBy}, Guild: ${event.guildId}`
    );
  });
}

export function emitFormEvent(event: FormEvent): void {
  eventBus.emit(event.type, event);
  // Also emit as auditLog for audit trail
  eventBus.emit('auditLog', {
    action: `form_${event.type}`,
    guildId: event.guildId,
    userId: event.userId,
    targetId: event.formId,
    details: {
      formId: event.formId,
      reviewedBy: event.reviewedBy,
      reviewNotes: event.reviewNotes,
    },
  });
}

export async function emitFormSubmitted(formId: string, userId: string, guildId: string, response: FormResponse): Promise<void> {
  emitFormEvent({
    type: 'formSubmitted',
    formId,
    userId,
    guildId,
    response,
  });
}

export async function emitFormApproved(
  formId: string,
  userId: string,
  guildId: string,
  reviewedBy: string,
  reviewNotes?: string
): Promise<void> {
  emitFormEvent({
    type: 'formApproved',
    formId,
    userId,
    guildId,
    reviewedBy,
    reviewNotes,
  });
}

export async function emitFormDenied(
  formId: string,
  userId: string,
  guildId: string,
  reviewedBy: string,
  reviewNotes?: string
): Promise<void> {
  emitFormEvent({
    type: 'formDenied',
    formId,
    userId,
    guildId,
    reviewedBy,
    reviewNotes,
  });
}

/**
 * Discord.js event handlers for forms module
 * These are placeholder handlers for the ModuleEvent[] pattern
 * Actual form event handling is done through the custom event bus system
 */
export const formsEvents: ModuleEvent[] = [
  // Placeholder for future Discord.js event integrations
];
