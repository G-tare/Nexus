/**
 * Command Usage Image Generator
 *
 * Generates Discord-style chat mockup images showing how to run slash commands.
 * Used in /help command detail embeds as visual aids.
 *
 * Each image shows a dark Discord-themed chat with:
 * - Channel header bar (# help)
 * - Multiple usage variations stacked vertically with realistic example values
 * - User avatar + name + typed command
 * - Color-coded: command name in cyan, required params in blurple, optional in gray
 * - Nexus brand accent line
 *
 * For commands with optional parameters, generates multiple rows showing
 * different ways to run the command (minimal, partial, full).
 */

import { createCanvas } from '@napi-rs/canvas';

/* ── Colors (matching Nexus/Discord dark theme) ── */
const BG_DARK = '#1e1f22';
const BG_CHAT = '#313338';
const BG_HEADER = '#2b2d31';
const BG_MSG_HOVER = '#2e3035';
const TEXT_WHITE = '#f2f3f5';
const TEXT_DIM = '#949ba4';
const TEXT_CHANNEL = '#80848e';
const TEXT_COMMAND = '#00d4aa';
const TEXT_PARAM_REQ = '#5865f2';
const TEXT_PARAM_OPT = '#80848e';
const TEXT_USERNAME = '#e0e0e0';
const TEXT_EXAMPLE = '#b5bac1';
const ACCENT_CYAN = '#00d4aa';
const ACCENT_BLURPLE = '#5865f2';
const AVATAR_BG = '#5865f2';
const SEPARATOR = '#3f4147';
const BADGE_LABEL = '#949ba4';

/* ── Typography ── */
const FONT_NORMAL = '14px "Noto Sans", "Segoe UI", sans-serif';
const FONT_BOLD = 'bold 14px "Noto Sans", "Segoe UI", sans-serif';
const FONT_SMALL = '12px "Noto Sans", "Segoe UI", sans-serif';
const FONT_HEADER = 'bold 13px "Noto Sans", "Segoe UI", sans-serif';
const FONT_LABEL = 'bold 11px "Noto Sans", "Segoe UI", sans-serif';
const FONT_CMD = '15px "Noto Sans Mono", "Consolas", monospace';
const FONT_CMD_BOLD = 'bold 15px "Noto Sans Mono", "Consolas", monospace';

/* ── Layout ── */
const CANVAS_MIN_W = 480;
const CANVAS_MAX_W = 720;
const PADDING = 16;
const HEADER_H = 38;
const MSG_ROW_H = 52;
const AVATAR_SIZE = 32;
const AVATAR_MARGIN = 12;
const ROW_GAP = 4;
const LABEL_H = 22;
const BOTTOM_ACCENT = 3;
const BORDER_RADIUS = 10;

/* ── Example values by Discord option type ── */
const EXAMPLE_VALUES: Record<number, string> = {
  3: 'hello world',         // String
  4: '100',                 // Integer
  5: 'True',                // Boolean
  6: '@CoolUser',           // User
  7: '#general',            // Channel
  8: '@Member',             // Role
  9: '@CoolUser',           // Mentionable
  10: '2.5',                // Number
  11: 'image.png',          // Attachment
};

function exampleValue(type: number, name: string): string {
  // Use smarter defaults based on param name hints
  const lower = name.toLowerCase();
  if (lower.includes('reason')) return 'Breaking rules';
  if (lower.includes('duration') || lower.includes('time')) return '7d';
  if (lower.includes('amount') || lower.includes('count')) return '50';
  if (lower.includes('message') || lower.includes('text')) return 'Hello everyone!';
  if (lower.includes('color') || lower.includes('colour')) return '#5865f2';
  if (lower.includes('url') || lower.includes('link')) return 'https://example.com';
  if (lower.includes('name') || lower.includes('title')) return 'My Title';
  if (lower.includes('user') || lower.includes('member') || lower.includes('target')) return '@CoolUser';
  if (lower.includes('channel')) return '#general';
  if (lower.includes('role')) return '@Member';
  return EXAMPLE_VALUES[type] ?? 'value';
}

interface CommandParam {
  name: string;
  type: number;
  required: boolean;
}

interface UsageVariation {
  label: string;
  segments: { text: string; color: string }[];
}

/**
 * Build usage variations for a command, showing different ways to run it.
 */
function buildVariations(
  cmdName: string,
  subName: string | undefined,
  params: CommandParam[],
): UsageVariation[] {
  const baseName = subName ? `${cmdName} ${subName}` : cmdName;
  const required = params.filter((p) => p.required);
  const optional = params.filter((p) => !p.required);
  const variations: UsageVariation[] = [];

  // Helper to build segments for a set of params
  function makeSegments(useParams: CommandParam[], showExamples: boolean): { text: string; color: string }[] {
    const segs: { text: string; color: string }[] = [
      { text: '/', color: TEXT_DIM },
      { text: baseName, color: TEXT_COMMAND },
    ];
    for (const p of useParams) {
      if (showExamples) {
        segs.push({ text: ` ${p.name}:`, color: p.required ? TEXT_PARAM_REQ : TEXT_PARAM_OPT });
        segs.push({ text: exampleValue(p.type, p.name), color: TEXT_EXAMPLE });
      } else {
        const bracket = p.required ? `<${p.name}>` : `[${p.name}]`;
        segs.push({ text: ` ${bracket}`, color: p.required ? TEXT_PARAM_REQ : TEXT_PARAM_OPT });
      }
    }
    return segs;
  }

  // Variation 1: Syntax overview (brackets)
  if (params.length > 0) {
    variations.push({
      label: 'SYNTAX',
      segments: makeSegments(params, false),
    });
  }

  // Variation 2: Required only (with example values)
  if (required.length > 0) {
    variations.push({
      label: optional.length > 0 ? 'MINIMAL' : 'EXAMPLE',
      segments: makeSegments(required, true),
    });
  }

  // Variation 3: Required + some optional (if there are 2+ optional)
  if (optional.length >= 2) {
    const partial = [...required, optional[0]];
    variations.push({
      label: 'WITH OPTIONS',
      segments: makeSegments(partial, true),
    });
  }

  // Variation 4: All params (if there are any optional)
  if (optional.length > 0) {
    variations.push({
      label: 'FULL',
      segments: makeSegments([...required, ...optional], true),
    });
  }

  // No params at all — just show the command
  if (params.length === 0) {
    variations.push({
      label: 'USAGE',
      segments: [
        { text: '/', color: TEXT_DIM },
        { text: baseName, color: TEXT_COMMAND },
      ],
    });
  }

  return variations;
}

/**
 * Generate a Discord-style command usage image with multiple variations.
 */
export async function generateCommandImage(
  cmdName: string,
  subName: string | undefined,
  params: CommandParam[],
  description?: string,
): Promise<Buffer> {
  const variations = buildVariations(cmdName, subName, params);

  // ── Measure text to find max width ──
  const tempCanvas = createCanvas(1, 1);
  const tempCtx = tempCanvas.getContext('2d');

  let maxTextWidth = 0;
  for (const v of variations) {
    let w = 0;
    // Label width
    tempCtx.font = FONT_LABEL;
    w += tempCtx.measureText(v.label + '  ').width;
    // Segments width
    for (const seg of v.segments) {
      tempCtx.font = FONT_CMD;
      w += tempCtx.measureText(seg.text).width;
    }
    maxTextWidth = Math.max(maxTextWidth, w);
  }

  // Add label badge + avatar + padding
  const contentWidth = PADDING + AVATAR_SIZE + AVATAR_MARGIN + maxTextWidth + PADDING + 40;
  const canvasWidth = Math.min(CANVAS_MAX_W, Math.max(CANVAS_MIN_W, contentWidth));

  // Calculate height
  const variationAreaH = variations.length * (LABEL_H + MSG_ROW_H + ROW_GAP);
  const canvasHeight = HEADER_H + PADDING + variationAreaH + PADDING + BOTTOM_ACCENT;

  const canvas = createCanvas(canvasWidth, canvasHeight);
  const ctx = canvas.getContext('2d');

  // ── Background ──
  roundRect(ctx, 0, 0, canvasWidth, canvasHeight, BORDER_RADIUS);
  ctx.fillStyle = BG_CHAT;
  ctx.fill();

  // ── Channel header bar ──
  ctx.save();
  roundRectTop(ctx, 0, 0, canvasWidth, HEADER_H, BORDER_RADIUS);
  ctx.fillStyle = BG_HEADER;
  ctx.fill();
  ctx.restore();

  // Header separator
  ctx.fillStyle = SEPARATOR;
  ctx.fillRect(0, HEADER_H - 1, canvasWidth, 1);

  // Channel name
  ctx.font = FONT_HEADER;
  ctx.fillStyle = TEXT_CHANNEL;
  ctx.fillText('#', PADDING, HEADER_H / 2 + 5);
  ctx.fillStyle = TEXT_WHITE;
  ctx.fillText(' help', PADDING + ctx.measureText('#').width, HEADER_H / 2 + 5);

  // ── Render variations ──
  let y = HEADER_H + PADDING;

  for (const variation of variations) {
    // Label badge
    ctx.font = FONT_LABEL;
    const labelW = ctx.measureText(variation.label).width + 12;
    const labelX = PADDING;

    // Badge background
    const badgeColor = variation.label === 'SYNTAX' ? ACCENT_BLURPLE :
                       variation.label === 'FULL' ? ACCENT_CYAN :
                       '#4e5058';
    ctx.fillStyle = badgeColor;
    roundRect(ctx, labelX, y, labelW, LABEL_H - 4, 4);
    ctx.fill();

    // Badge text
    ctx.fillStyle = TEXT_WHITE;
    ctx.fillText(variation.label, labelX + 6, y + LABEL_H - 8);

    y += LABEL_H;

    // Message row background (subtle hover effect)
    ctx.fillStyle = BG_MSG_HOVER;
    ctx.fillRect(0, y, canvasWidth, MSG_ROW_H);

    // Avatar
    const avatarX = PADDING;
    const avatarY = y + (MSG_ROW_H - AVATAR_SIZE) / 2;
    ctx.fillStyle = AVATAR_BG;
    ctx.beginPath();
    ctx.arc(avatarX + AVATAR_SIZE / 2, avatarY + AVATAR_SIZE / 2, AVATAR_SIZE / 2, 0, Math.PI * 2);
    ctx.fill();

    // Avatar letter
    ctx.font = 'bold 14px "Noto Sans", sans-serif';
    ctx.fillStyle = TEXT_WHITE;
    const letterW = ctx.measureText('U').width;
    ctx.fillText('U', avatarX + (AVATAR_SIZE - letterW) / 2, avatarY + AVATAR_SIZE / 2 + 5);

    // Username
    const textStartX = avatarX + AVATAR_SIZE + AVATAR_MARGIN;
    ctx.font = FONT_BOLD;
    ctx.fillStyle = TEXT_USERNAME;
    ctx.fillText('You', textStartX, y + 18);

    // Command text segments
    let cmdX = textStartX;
    const cmdY = y + 38;

    for (const seg of variation.segments) {
      ctx.font = FONT_CMD;
      ctx.fillStyle = seg.color;
      ctx.fillText(seg.text, cmdX, cmdY);
      cmdX += ctx.measureText(seg.text).width;
    }

    y += MSG_ROW_H + ROW_GAP;
  }

  // ── Bottom accent bar ──
  const accentGrad = ctx.createLinearGradient(0, 0, canvasWidth, 0);
  accentGrad.addColorStop(0, ACCENT_BLURPLE);
  accentGrad.addColorStop(1, ACCENT_CYAN);
  ctx.fillStyle = accentGrad;

  const accentY = canvasHeight - BOTTOM_ACCENT;
  ctx.beginPath();
  ctx.moveTo(0, accentY);
  ctx.lineTo(canvasWidth, accentY);
  ctx.lineTo(canvasWidth, canvasHeight - BORDER_RADIUS);
  ctx.arcTo(canvasWidth, canvasHeight, canvasWidth - BORDER_RADIUS, canvasHeight, BORDER_RADIUS);
  ctx.lineTo(BORDER_RADIUS, canvasHeight);
  ctx.arcTo(0, canvasHeight, 0, canvasHeight - BORDER_RADIUS, BORDER_RADIUS);
  ctx.lineTo(0, accentY);
  ctx.closePath();
  ctx.fill();

  return Buffer.from(canvas.toBuffer('image/png'));
}

/**
 * Generate usage image from SlashCommandBuilder JSON data.
 */
export async function generateCommandImageFromData(
  cmdData: any,
  subcommandName?: string,
): Promise<Buffer> {
  const SUB_COMMAND = 1;
  const SUB_COMMAND_GROUP = 2;
  const options = cmdData.options ?? [];

  let params: CommandParam[] = [];
  const description = cmdData.description ?? '';

  if (subcommandName) {
    const parts = subcommandName.split(' ');
    let targetOptions = options;

    if (parts.length === 2) {
      const group = options.find((o: any) => o.type === SUB_COMMAND_GROUP && o.name === parts[0]);
      if (group) {
        const sub = (group.options ?? []).find((o: any) => o.type === SUB_COMMAND && o.name === parts[1]);
        if (sub) {
          targetOptions = sub.options ?? [];
        }
      }
    } else {
      const sub = options.find((o: any) => o.type === SUB_COMMAND && o.name === parts[0]);
      if (sub) {
        targetOptions = sub.options ?? [];
      }
    }

    params = targetOptions
      .filter((o: any) => o.type > SUB_COMMAND_GROUP)
      .map((o: any) => ({ name: o.name, type: o.type, required: !!o.required }));
  } else {
    params = options
      .filter((o: any) => o.type > SUB_COMMAND_GROUP)
      .map((o: any) => ({ name: o.name, type: o.type, required: !!o.required }));
  }

  return generateCommandImage(cmdData.name, subcommandName, params, description);
}

/* ── Canvas Helpers ── */

function roundRect(ctx: any, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

/** Round only the top corners. */
function roundRectTop(ctx: any, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x, y + h);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}
