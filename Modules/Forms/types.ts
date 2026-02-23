/**
 * Forms Module Type Definitions
 */

export type QuestionType = 'short_text' | 'long_text' | 'multiple_choice' | 'checkbox' | 'dropdown' | 'number' | 'email' | 'url';

export type ResponseStatus = 'pending' | 'approved' | 'denied';

export interface FormQuestion {
  label: string;
  type: QuestionType;
  required: boolean;
  placeholder?: string;
  options?: string[];
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  description?: string;
}

export interface FormData {
  id: string;
  guildId: string;
  name: string;
  description: string;
  questions: FormQuestion[];
  responseChannelId: string;
  maxResponses?: number;
  onePerUser: boolean;
  dmConfirm: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface FormResponse {
  id: string;
  formId: string;
  userId: string;
  answers: Record<string, unknown>;
  status: ResponseStatus;
  submittedAt: Date;
  reviewedAt?: Date;
  reviewedBy?: string;
  reviewNotes?: string;
}

export interface FormConfig {
  guildId: string;
  enabled: boolean;
  requireApproval: boolean;
  notificationChannelId?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

export interface FormSubmissionResult {
  success: boolean;
  responseId?: string;
  message: string;
  errors?: Record<string, string>;
}

export interface GuildInfo {
  name: string;
  iconUrl?: string;
  color?: string;
}

export interface FormEvent {
  type: 'formSubmitted' | 'formApproved' | 'formDenied';
  formId: string;
  userId: string;
  guildId: string;
  response?: FormResponse;
  reviewedBy?: string;
  reviewNotes?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
