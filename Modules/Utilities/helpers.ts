import { cache } from '../../Shared/src/cache/cacheManager';
import { createModuleLogger } from '../../Shared/src/utils/logger';

const logger = createModuleLogger('Utilities:Helpers');

export const DEFAULT_UTILITIES_CONFIG = {
  enabled: true,
  embedColor: '#2ECC71',
  searchCooldown: 5,
  maxNotes: 25,
  notepadEnabled: true,
};

interface Note {
  id: string;
  title: string;
  content: string;
  createdAt: number;
}

interface NotepadData {
  notes: Note[];
}

export async function getNotes(guildId: string, userId: string): Promise<Note[]> {
  try {
    const key = `notepad:${guildId}:${userId}`;
    const data = cache.get<NotepadData>(key);

    if (!data) {
      return [];
    }

    return data.notes || [];
  } catch (error) {
    logger.error('Error getting notes:', error);
    return [];
  }
}

export async function addNote(
  guildId: string,
  userId: string,
  title: string,
  content: string,
  maxNotes: number
): Promise<{ success: boolean; error?: string; note?: Note }> {
  try {
    const key = `notepad:${guildId}:${userId}`;

    const notes = await getNotes(guildId, userId);

    if (notes.length >= maxNotes) {
      return { success: false, error: `Maximum notes (${maxNotes}) reached` };
    }

    const newNote: Note = {
      id: Date.now().toString(),
      title,
      content,
      createdAt: Date.now(),
    };

    notes.push(newNote);
    const data: NotepadData = { notes };

    cache.set(key, data, 2592000); // 30 days

    return { success: true, note: newNote };
  } catch (error) {
    logger.error('Error adding note:', error);
    return { success: false, error: 'Failed to add note' };
  }
}

export async function updateNote(
  guildId: string,
  userId: string,
  noteId: string,
  content: string
): Promise<{ success: boolean; error?: string; note?: Note }> {
  try {
    const key = `notepad:${guildId}:${userId}`;

    const notes = await getNotes(guildId, userId);
    const note = notes.find(n => n.id === noteId);

    if (!note) {
      return { success: false, error: 'Note not found' };
    }

    note.content = content;
    const data: NotepadData = { notes };

    cache.set(key, data, 2592000);

    return { success: true, note };
  } catch (error) {
    logger.error('Error updating note:', error);
    return { success: false, error: 'Failed to update note' };
  }
}

export async function deleteNote(
  guildId: string,
  userId: string,
  noteId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const key = `notepad:${guildId}:${userId}`;

    const notes = await getNotes(guildId, userId);
    const index = notes.findIndex(n => n.id === noteId);

    if (index === -1) {
      return { success: false, error: 'Note not found' };
    }

    notes.splice(index, 1);

    if (notes.length === 0) {
      cache.del(key);
    } else {
      const data: NotepadData = { notes };
      cache.set(key, data, 2592000);
    }

    return { success: true };
  } catch (error) {
    logger.error('Error deleting note:', error);
    return { success: false, error: 'Failed to delete note' };
  }
}

/**
 * Safe calculator evaluation
 */
export function evaluateExpression(expression: string): { result: number; error?: string } {
  try {
    // Remove spaces and validate input
    const sanitized = expression.replace(/\s/g, '');

    // Only allow numbers, operators, and parentheses
    if (!/^[\d+\-*/%().]+$/.test(sanitized)) {
      return { result: 0, error: 'Invalid characters in expression' };
    }

    // Prevent malicious patterns
    if (sanitized.includes('()') || /\.+/.test(sanitized)) {
      return { result: 0, error: 'Invalid expression format' };
    }

    // Use Function constructor with restricted scope
    const func = new Function('return ' + sanitized);
    const result = func() as number;

    if (!isFinite(result)) {
      return { result: 0, error: 'Result is infinite or not a number' };
    }

    return { result };
  } catch (error) {
    return { result: 0, error: 'Invalid mathematical expression' };
  }
}

/**
 * Generate secure random password
 */
export function generatePassword(length: number = 16): string {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const symbols = '!@#$%^&*_-+=?';

  const all = uppercase + lowercase + numbers + symbols;
  let password = '';

  // Ensure at least one of each type
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += symbols[Math.floor(Math.random() * symbols.length)];

  // Fill the rest randomly
  for (let i = password.length; i < length; i++) {
    password += all[Math.floor(Math.random() * all.length)];
  }

  // Shuffle the password
  return password
    .split('')
    .sort(() => Math.random() - 0.5)
    .join('');
}

/**
 * Base64 encode
 */
export function encodeBase64(text: string): string {
  try {
    return Buffer.from(text).toString('base64');
  } catch {
    return 'Error encoding text';
  }
}

/**
 * Base64 decode
 */
export function decodeBase64(text: string): string {
  try {
    return Buffer.from(text, 'base64').toString('utf-8');
  } catch {
    return 'Error decoding text';
  }
}

/**
 * Convert text to emoji regional indicators
 */
export function emojifyText(text: string): string {
  const charMap: Record<string, string> = {
    'a': '🇦', 'b': '🇧', 'c': '🇨', 'd': '🇩', 'e': '🇪',
    'f': '🇫', 'g': '🇬', 'h': '🇭', 'i': '🇮', 'j': '🇯',
    'k': '🇰', 'l': '🇱', 'm': '🇲', 'n': '🇳', 'o': '🇴',
    'p': '🇵', 'q': '🇶', 'r': '🇷', 's': '🇸', 't': '🇹',
    'u': '🇺', 'v': '🇻', 'w': '🇼', 'x': '🇽', 'y': '🇾',
    'z': '🇿',
    '0': '0️⃣', '1': '1️⃣', '2': '2️⃣', '3': '3️⃣', '4': '4️⃣',
    '5': '5️⃣', '6': '6️⃣', '7': '7️⃣', '8': '8️⃣', '9': '9️⃣',
    '!': '❗', '?': '❓', ' ': ' ',
  };

  return text
    .toLowerCase()
    .split('')
    .map(char => charMap[char] || char)
    .join('');
}

/**
 * Find anagrams of a word (simple check against common words)
 */
export function findAnagrams(word: string): string[] {
  const commonWords = [
    'listen', 'silent', 'enlist', 'tab', 'bat', 'cat', 'act', 'cart', 'tract',
    'art', 'rat', 'tar', 'stressed', 'desserts', 'tea', 'eat', 'ate',
    'stop', 'post', 'tops', 'spot', 'pots', 'opts',
    'least', 'steal', 'tales', 'teals', 'slate',
  ];

  const sortedWord = word.toLowerCase().split('').sort().join('');
  return commonWords.filter(w => w.split('').sort().join('') === sortedWord);
}

/**
 * Parse hex color and return RGB and HSL
 */
export function parseColor(hex: string): { rgb: string; hsl: string } | null {
  try {
    // Remove # if present
    const color = hex.replace(/^#/, '');

    // Validate hex
    if (!/^[0-9A-Fa-f]{6}$/i.test(color)) {
      return null;
    }

    // Convert hex to RGB
    const r = parseInt(color.substring(0, 2), 16);
    const g = parseInt(color.substring(2, 4), 16);
    const b = parseInt(color.substring(4, 6), 16);
    const rgb = `rgb(${r}, ${g}, ${b})`;

    // Convert RGB to HSL
    const _r = r / 255;
    const _g = g / 255;
    const _b = b / 255;
    const max = Math.max(_r, _g, _b);
    const min = Math.min(_r, _g, _b);
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case _r:
          h = (((_g - _b) / d + (_g < _b ? 6 : 0)) / 6) * 360;
          break;
        case _g:
          h = (((_b - _r) / d + 2) / 6) * 360;
          break;
        case _b:
          h = (((_r - _g) / d + 4) / 6) * 360;
          break;
      }
    }

    const hsl = `hsl(${Math.round(h)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`;
    return { rgb, hsl };
  } catch {
    return null;
  }
}
