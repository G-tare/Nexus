import { Pool, PoolClient } from 'pg';
import { createModuleLogger } from '../../Shared/src/utils/logger';

export interface FormQuestion {
  label: string;
  type: 'short_text' | 'long_text' | 'multiple_choice' | 'checkbox' | 'dropdown' | 'number' | 'email' | 'url';
  required: boolean;
  placeholder?: string;
  options?: string[];
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
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
  status: 'pending' | 'approved' | 'denied';
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

let pool: Pool;

export function initializePool(dbPool: Pool): void {
  pool = dbPool;
}

export async function getPool(): Promise<Pool> {
  return pool;
}

// Form CRUD operations
export async function createForm(
  guildId: string,
  name: string,
  description: string,
  questions: FormQuestion[],
  responseChannelId: string,
  onePerUser: boolean = true,
  dmConfirm: boolean = false,
  maxResponses?: number
): Promise<FormData> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `INSERT INTO forms (guild_id, name, description, questions, response_channel_id, max_responses, one_per_user, dm_confirm, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
       RETURNING *`,
      [guildId, name, description, JSON.stringify(questions), responseChannelId, maxResponses || null, onePerUser, dmConfirm, true]
    );
    return formatFormData(result.rows[0]);
  } finally {
    client.release();
  }
}

export async function getFormById(formId: string): Promise<FormData | null> {
  const client = await pool.connect();
  try {
    const result = await client.query('SELECT * FROM forms WHERE id = $1', [formId]);
    return result.rows.length > 0 ? formatFormData(result.rows[0]) : null;
  } finally {
    client.release();
  }
}

export async function getFormsByGuild(guildId: string): Promise<FormData[]> {
  const client = await pool.connect();
  try {
    const result = await client.query('SELECT * FROM forms WHERE guild_id = $1 ORDER BY created_at DESC', [guildId]);
    return result.rows.map(formatFormData);
  } finally {
    client.release();
  }
}

export async function getActiveFormsByGuild(guildId: string): Promise<FormData[]> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT * FROM forms WHERE guild_id = $1 AND is_active = true ORDER BY created_at DESC',
      [guildId]
    );
    return result.rows.map(formatFormData);
  } finally {
    client.release();
  }
}

export async function updateForm(
  formId: string,
  updates: Partial<FormData>
): Promise<FormData | null> {
  const client = await pool.connect();
  try {
    const fields: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (updates.name !== undefined) {
      fields.push(`name = $${paramIndex++}`);
      values.push(updates.name);
    }
    if (updates.description !== undefined) {
      fields.push(`description = $${paramIndex++}`);
      values.push(updates.description);
    }
    if (updates.questions !== undefined) {
      fields.push(`questions = $${paramIndex++}`);
      values.push(JSON.stringify(updates.questions));
    }
    if (updates.responseChannelId !== undefined) {
      fields.push(`response_channel_id = $${paramIndex++}`);
      values.push(updates.responseChannelId);
    }
    if (updates.maxResponses !== undefined) {
      fields.push(`max_responses = $${paramIndex++}`);
      values.push(updates.maxResponses);
    }
    if (updates.onePerUser !== undefined) {
      fields.push(`one_per_user = $${paramIndex++}`);
      values.push(updates.onePerUser);
    }
    if (updates.dmConfirm !== undefined) {
      fields.push(`dm_confirm = $${paramIndex++}`);
      values.push(updates.dmConfirm);
    }
    if (updates.isActive !== undefined) {
      fields.push(`is_active = $${paramIndex++}`);
      values.push(updates.isActive);
    }

    if (fields.length === 0) return getFormById(formId);

    fields.push(`updated_at = NOW()`);
    values.push(formId);

    const result = await client.query(
      `UPDATE forms SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );
    return result.rows.length > 0 ? formatFormData(result.rows[0]) : null;
  } finally {
    client.release();
  }
}

export async function deleteForm(formId: string): Promise<boolean> {
  const client = await pool.connect();
  try {
    await client.query('DELETE FROM form_responses WHERE form_id = $1', [formId]);
    const result = await client.query('DELETE FROM forms WHERE id = $1', [formId]);
    return result.rowCount! > 0;
  } finally {
    client.release();
  }
}

export async function toggleFormActive(formId: string, isActive: boolean): Promise<FormData | null> {
  return updateForm(formId, { isActive });
}

// Form Response operations
export async function submitFormResponse(
  formId: string,
  userId: string,
  answers: Record<string, unknown>
): Promise<FormResponse> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `INSERT INTO form_responses (form_id, user_id, answers, status, submitted_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING *`,
      [formId, userId, JSON.stringify(answers), 'pending']
    );
    return formatResponseData(result.rows[0]);
  } finally {
    client.release();
  }
}

export async function getFormResponses(formId: string, limit: number = 10, offset: number = 0): Promise<{ responses: FormResponse[]; total: number }> {
  const client = await pool.connect();
  try {
    const countResult = await client.query('SELECT COUNT(*) FROM form_responses WHERE form_id = $1', [formId]);
    const total = parseInt(countResult.rows[0].count, 10);

    const result = await client.query(
      'SELECT * FROM form_responses WHERE form_id = $1 ORDER BY submitted_at DESC LIMIT $2 OFFSET $3',
      [formId]
    );
    return {
      responses: result.rows.map(formatResponseData),
      total,
    };
  } finally {
    client.release();
  }
}

export async function getUserFormResponses(formId: string, userId: string): Promise<FormResponse[]> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT * FROM form_responses WHERE form_id = $1 AND user_id = $2 ORDER BY submitted_at DESC',
      [formId, userId]
    );
    return result.rows.map(formatResponseData);
  } finally {
    client.release();
  }
}

export async function updateResponseStatus(
  responseId: string,
  status: 'approved' | 'denied',
  reviewedBy: string,
  reviewNotes?: string
): Promise<FormResponse | null> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `UPDATE form_responses SET status = $1, reviewed_by = $2, reviewed_at = NOW(), review_notes = $3 WHERE id = $4 RETURNING *`,
      [status, reviewedBy, reviewNotes || null, responseId]
    );
    return result.rows.length > 0 ? formatResponseData(result.rows[0]) : null;
  } finally {
    client.release();
  }
}

export async function deleteFormResponse(responseId: string): Promise<boolean> {
  const client = await pool.connect();
  try {
    const result = await client.query('DELETE FROM form_responses WHERE id = $1', [responseId]);
    return result.rowCount! > 0;
  } finally {
    client.release();
  }
}

// Form Config operations
export async function getFormConfig(guildId: string): Promise<FormConfig> {
  const client = await pool.connect();
  try {
    const result = await client.query('SELECT * FROM forms_config WHERE guild_id = $1', [guildId]);
    if (result.rows.length > 0) {
      return result.rows[0];
    }
    // Create default config if it doesn't exist
    return await createFormConfig(guildId);
  } finally {
    client.release();
  }
}

export async function createFormConfig(guildId: string): Promise<FormConfig> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `INSERT INTO forms_config (guild_id, enabled, require_approval) VALUES ($1, $2, $3)
       ON CONFLICT (guild_id) DO UPDATE SET guild_id = $1
       RETURNING *`,
      [guildId, true, false]
    );
    return result.rows[0];
  } finally {
    client.release();
  }
}

export async function updateFormConfig(
  guildId: string,
  updates: Partial<FormConfig>
): Promise<FormConfig> {
  const client = await pool.connect();
  try {
    const fields: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (updates.enabled !== undefined) {
      fields.push(`enabled = $${paramIndex++}`);
      values.push(updates.enabled);
    }
    if (updates.requireApproval !== undefined) {
      fields.push(`require_approval = $${paramIndex++}`);
      values.push(updates.requireApproval);
    }
    if (updates.notificationChannelId !== undefined) {
      fields.push(`notification_channel_id = $${paramIndex++}`);
      values.push(updates.notificationChannelId);
    }

    if (fields.length === 0) return getFormConfig(guildId);

    values.push(guildId);
    const result = await client.query(
      `UPDATE forms_config SET ${fields.join(', ')} WHERE guild_id = $${paramIndex} RETURNING *`,
      values
    );
    return result.rows[0];
  } finally {
    client.release();
  }
}

// Validation functions
export function validateAnswer(answer: unknown, question: FormQuestion): boolean {
  if (question.required && (answer === undefined || answer === null || answer === '')) {
    return false;
  }

  if (!answer) return true;

  const strAnswer = String(answer).trim();

  switch (question.type) {
    case 'short_text':
    case 'long_text':
      if (question.minLength && strAnswer.length < question.minLength) return false;
      if (question.maxLength && strAnswer.length > question.maxLength) return false;
      return true;

    case 'email':
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(strAnswer);

    case 'url':
      try {
        new URL(strAnswer);
        return true;
      } catch {
        return false;
      }

    case 'number':
      const num = parseFloat(strAnswer);
      if (isNaN(num)) return false;
      if (question.min !== undefined && num < question.min) return false;
      if (question.max !== undefined && num > question.max) return false;
      return true;

    case 'multiple_choice':
    case 'dropdown':
      return question.options ? question.options.includes(strAnswer) : true;

    case 'checkbox':
      return typeof answer === 'boolean';

    default:
      return true;
  }
}

export function validateAnswers(answers: Record<string, unknown>, questions: FormQuestion[]): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  questions.forEach((question) => {
    if (!validateAnswer(answers[question.label], question)) {
      errors[question.label] = `Invalid ${question.type} response`;
    }
  });

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

export async function checkUserFormSubmissions(formId: string, userId: string): Promise<number> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT COUNT(*) FROM form_responses WHERE form_id = $1 AND user_id = $2',
      [formId, userId]
    );
    return parseInt(result.rows[0].count, 10);
  } finally {
    client.release();
  }
}

export async function checkFormResponseCount(formId: string): Promise<number> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT COUNT(*) FROM form_responses WHERE form_id = $1',
      [formId]
    );
    return parseInt(result.rows[0].count, 10);
  } finally {
    client.release();
  }
}

// Utility functions
function formatFormData(row: any): FormData {
  return {
    id: row.id,
    guildId: row.guildId,
    name: row.name,
    description: row.description,
    questions: typeof row.questions === 'string' ? JSON.parse(row.questions) : row.questions,
    responseChannelId: row.response_channel_id,
    maxResponses: row.max_responses,
    onePerUser: row.one_per_user,
    dmConfirm: row.dm_confirm,
    isActive: row.is_active,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updated_at),
  };
}

function formatResponseData(row: any): FormResponse {
  return {
    id: row.id,
    formId: row.form_id,
    userId: row.userId,
    answers: typeof row.answers === 'string' ? JSON.parse(row.answers) : row.answers,
    status: row.status,
    submittedAt: new Date(row.submitted_at),
    reviewedAt: row.reviewed_at ? new Date(row.reviewed_at) : undefined,
    reviewedBy: row.reviewed_by,
    reviewNotes: row.review_notes,
  };
}
