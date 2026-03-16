'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ConfigSection,
  ConfigGrid,
  ConfigToggle,
  ConfigNumberField,
  ConfigTextField,
  ConfigPicker,
  ConfigChannelPicker,
  ConfigRolePicker,
  ConfigColorPicker,
} from '@/components/ConfigComponents';
import { useGuildStore } from '@/stores/guild';
import { MODULE_REGISTRY } from '@/lib/types';
import type { Channel, Role, PermissionRule } from '@/lib/types';
import { getCommandsForModule, DEFAULT_ACCESS_LABELS } from '@/lib/commandRegistry';
import type { CommandDef, DefaultAccess } from '@/lib/commandRegistry';
import api from '@/lib/api';

/* ── Tab type ── */
type Tab = 'settings' | 'commands' | 'history';

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'settings', label: 'General Settings', icon: '⚙️' },
  { key: 'commands', label: 'Commands', icon: '📋' },
  { key: 'history', label: 'History', icon: '📊' },
];

/* ── Access level colors ── */
const ACCESS_COLORS: Record<DefaultAccess, string> = {
  everyone: 'var(--nexus-green)',
  staffOnly: 'var(--nexus-yellow)',
  adminOnly: 'var(--nexus-red)',
  ownerOnly: 'var(--nexus-purple)',
};

/* ── Command subgroups for all modules ── */
const COMMAND_GROUPS: Record<string, { name: string; icon: string; cmds: string[] }[]> = {
  moderation: [
    { name: 'Ban System', icon: '🔨', cmds: ['ban', 'tempban', 'unban', 'massban', 'banlist', 'softban'] },
    { name: 'Warning System', icon: '⚠️', cmds: ['warn', 'warnings', 'unwarn', 'clearwarnings', 'serverwarns'] },
    { name: 'Mute System', icon: '🔇', cmds: ['mute', 'unmute', 'massmute', 'mutelist'] },
    { name: 'Channel Control', icon: '🔒', cmds: ['lock', 'unlock', 'lockdown', 'unlockdown', 'slowmode', 'nuke'] },
    { name: 'Message Cleanup', icon: '🧹', cmds: ['purge', 'bulkdelete', 'purgeuser', 'purgebot', 'purgehuman'] },
    { name: 'User Management', icon: '👤', cmds: ['kick', 'role', 'nickname', 'userinfo', 'history', 'case', 'note', 'notes'] },
    { name: 'Advanced', icon: '🛡️', cmds: ['watchlist', 'altdetect', 'quarantine', 'unquarantine', 'shadowban', 'unshadowban'] },
    { name: 'Reputation', icon: '⭐', cmds: ['addreputation', 'removereputation', 'setreputation', 'reputationhistory'] },
    { name: 'Statistics', icon: '📊', cmds: ['modstats'] },
  ],
  automod: [
    { name: 'Filters', icon: '🛡️', cmds: ['automod', 'testword', 'antilink', 'wordfilter'] },
  ],
  logging: [
    { name: 'Configuration', icon: '📝', cmds: ['logchannel', 'logconfig', 'logignore', 'logtoggle', 'logs'] },
  ],
  antiraid: [
    { name: 'Configuration', icon: '🛡️', cmds: ['antiraidconfig', 'raidstatus', 'raid-lockdown', 'raid-unlockdown'] },
  ],
  leveling: [
    { name: 'User Commands', icon: '📈', cmds: ['levels', 'rank', 'rewards', 'cardstyle', 'cardbg'] },
    { name: 'XP Management', icon: '✨', cmds: ['setxp', 'setlevel', 'resetxp', 'xpmultiplier', 'noxproles'] },
    { name: 'Configuration', icon: '⚙️', cmds: ['levelroles', 'doublexp', 'levelconfig'] },
  ],
  welcome: [
    { name: 'Messages', icon: '👋', cmds: ['welcome', 'leave', 'welcomedm', 'greet', 'welcometest', 'welcome-config'] },
    { name: 'Auto Roles', icon: '🏷️', cmds: ['autorole'] },
    { name: 'Verification', icon: '✅', cmds: ['screening', 'joingate'] },
    { name: 'Info', icon: 'ℹ️', cmds: ['membercount'] },
  ],
  tickets: [
    { name: 'User Commands', icon: '🎫', cmds: ['ticket'] },
    { name: 'Staff Commands', icon: '👨‍💼', cmds: ['close', 'ticket-add', 'ticket-remove', 'ticket-rename', 'claim', 'transfer', 'priority', 'transcript', 'transcriptlog', 'ticket-notice', 'ticket-stats'] },
    { name: 'Panel Management', icon: '📋', cmds: ['ticketpanel', 'paneledit', 'panellist'] },
    { name: 'Configuration', icon: '⚙️', cmds: ['ticket-config', 'ticket-staffrole', 'ticket-feedback'] },
  ],
  music: [
    { name: 'Playback', icon: '▶️', cmds: ['play', 'pause', 'resume', 'stop', 'seek', 'nowplaying', 'forceplay'] },
    { name: 'Queue', icon: '📃', cmds: ['queue', 'clear', 'remove', 'move', 'skipto', 'shuffle', 'skip', 'previous'] },
    { name: 'Audio', icon: '🔊', cmds: ['volume', 'filters', 'loop', 'autoplay'] },
    { name: 'Playlists', icon: '📁', cmds: ['playlist', 'serverplaylist', 'favorites'] },
    { name: 'Discovery', icon: '🔍', cmds: ['songinfo', 'lyrics', 'radio-play', 'radio-stop', 'radio-list'] },
    { name: 'Management', icon: '⚙️', cmds: ['voteskip', 'musicconfig', 'djrole'] },
  ],
  currency: [
    { name: 'Balance', icon: '💰', cmds: ['balance', 'daily', 'weekly', 'pay', 'economy', 'richest'] },
    { name: 'Banking', icon: '🏦', cmds: ['bank-deposit', 'bank-withdraw', 'bank-balance', 'bank-savings', 'bank-collect', 'bank-upgrade'] },
    { name: 'Earning', icon: '⛏️', cmds: ['earn-beg', 'earn-fish', 'earn-hunt', 'earn-crime', 'earn-rob', 'earn-dig', 'earn-search', 'earn-monthly'] },
    { name: 'Jobs', icon: '💼', cmds: ['job-apply', 'job-work', 'job-info', 'job-quit', 'job-list', 'job-leaderboard'] },
    { name: 'Admin', icon: '🔧', cmds: ['currency-give', 'currency-take', 'currency-setbalance', 'currency-reset', 'currency-config', 'currency-audit'] },
  ],
  shop: [
    { name: 'Shopping', icon: '🛒', cmds: ['shop', 'buy', 'use', 'inventory'] },
    { name: 'Management', icon: '⚙️', cmds: ['shop-config', 'shop-add', 'shop-edit', 'shop-remove'] },
  ],
  casino: [
    { name: 'Card Games', icon: '🃏', cmds: ['blackjack', 'poker', 'highlow'] },
    { name: 'Chance Games', icon: '🎰', cmds: ['slots', 'crash', 'roulette', 'coinflip', 'wheel', 'scratchcard', 'horserace'] },
    { name: 'Admin', icon: '⚙️', cmds: ['casino-config'] },
  ],
  fun: [
    { name: 'Games', icon: '🎮', cmds: ['wordle', 'trivia', 'tictactoe', 'rps', 'connect4', 'hangman', 'snake', 'memory', 'puzzle', 'scramble', 'quizbowl', 'highlow', 'duel', 'guess', 'mathrace', 'fasttype', 'reaction', 'wordchain'] },
    { name: 'Social', icon: '💬', cmds: ['wouldyourather', 'tord', 'roll', 'ship', 'rate', 'compliment', 'roast', 'hack'] },
    { name: 'Interactions', icon: '🤗', cmds: ['hug', 'pat', 'pout', 'wave', 'poke', 'bite', 'dance', 'boop', 'punch', 'laugh', 'highfive', 'kick-fun', 'slap', 'kiss', 'cry', 'cuddle'] },
    { name: 'Content', icon: '📖', cmds: ['fact', 'meme', 'quote', 'dog', 'cat', 'joke', 'birdfact', 'pandafact', 'fox'] },
    { name: 'Tools', icon: '🔧', cmds: ['ascii', 'say', 'reverse', 'emojify', 'activity'] },
  ],
  giveaways: [
    { name: 'Management', icon: '🎁', cmds: ['giveaway-config', 'gschedule', 'drop', 'glist', 'greroll', 'gcancel'] },
  ],
  counting: [
    { name: 'Configuration', icon: '🔢', cmds: ['counting', 'counting-config'] },
  ],
  afk: [
    { name: 'AFK Commands', icon: '💤', cmds: ['afk', 'afklist'] },
    { name: 'Management', icon: '⚙️', cmds: ['afk-config', 'afk-remove', 'afk-ban'] },
  ],
  aichatbot: [
    { name: 'User Commands', icon: '🤖', cmds: ['ask', 'aiclear'] },
    { name: 'Configuration', icon: '⚙️', cmds: ['aiconfig', 'aichannel', 'aipersona'] },
  ],
  activitytracking: [
    { name: 'Tracking', icon: '📊', cmds: ['inactivelist', 'activityconfig'] },
  ],
  messagetracking: [
    { name: 'Sniping', icon: '👀', cmds: ['snipe', 'editsnipe'] },
    { name: 'Configuration', icon: '⚙️', cmds: ['messagetrackconfig'] },
  ],
  invitetracker: [
    { name: 'User Commands', icon: '📨', cmds: ['invites', 'invite-leaderboard'] },
    { name: 'Management', icon: '⚙️', cmds: ['invite-config', 'invite-reset', 'invite-bonus'] },
  ],
  suggestions: [
    { name: 'User Commands', icon: '💡', cmds: ['suggest'] },
    { name: 'Staff Actions', icon: '👨‍⚖️', cmds: ['suggestion-approve', 'suggestion-consider', 'suggestion-deny', 'suggestion-remove', 'suggestion-implement'] },
    { name: 'Configuration', icon: '⚙️', cmds: ['suggestion-config'] },
  ],
  polls: [
    { name: 'User Commands', icon: '📊', cmds: ['poll', 'quickpoll', 'pollresults'] },
    { name: 'Management', icon: '⚙️', cmds: ['pollend', 'poll-config'] },
  ],
  forms: [
    { name: 'User Commands', icon: '📝', cmds: ['form'] },
    { name: 'Staff Actions', icon: '📋', cmds: ['formresponses', 'formreview'] },
    { name: 'Management', icon: '⚙️', cmds: ['formconfig', 'formcreate', 'formedit', 'formdelete', 'formtoggle'] },
  ],
  autoroles: [
    { name: 'User Commands', icon: '🏷️', cmds: ['autorolelist', 'myroles'] },
    { name: 'Management', icon: '⚙️', cmds: ['autoroleconfig', 'autoroleadd', 'autoroleedit', 'autoroledelete', 'autoroleclear'] },
  ],
  reputation: [
    { name: 'Commands', icon: '⭐', cmds: ['setrep', 'repconfig'] },
  ],
  colorroles: [
    { name: 'User Commands', icon: '🎨', cmds: ['color', 'colorinfo', 'colorlist', 'colorremove', 'colorrandom'] },
    { name: 'Management', icon: '⚙️', cmds: ['colorconfig', 'coloradd', 'coloredit', 'colordelete', 'colorexport', 'colorimport'] },
  ],
  quoteboard: [
    { name: 'User Commands', icon: '⭐', cmds: ['board', 'random-star'] },
    { name: 'Configuration', icon: '⚙️', cmds: ['board-config'] },
  ],
  leaderboards: [
    { name: 'User Commands', icon: '🏆', cmds: ['leaderboard', 'top'] },
    { name: 'Configuration', icon: '⚙️', cmds: ['leaderboard-config'] },
  ],
  scheduledmessages: [
    { name: 'Commands', icon: '📅', cmds: ['schedule', 'scheduleedit', 'scheduledelete', 'schedulelist'] },
    { name: 'Configuration', icon: '⚙️', cmds: ['scheduleconfig'] },
  ],
  customcommands: [
    { name: 'User Commands', icon: '⚡', cmds: ['clist', 'cvariables'] },
    { name: 'Management', icon: '⚙️', cmds: ['ccreate', 'cedit', 'cdelete', 'cconfig'] },
  ],
  stickymessages: [
    { name: 'Commands', icon: '📌', cmds: ['stick', 'unstick', 'stickyedit', 'sticky-config'] },
  ],
  statschannels: [
    { name: 'User Commands', icon: '📊', cmds: ['statslist'] },
    { name: 'Management', icon: '⚙️', cmds: ['statsconfig', 'statsedit', 'statscreate', 'statsdelete'] },
  ],
  tempvoice: [
    { name: 'Management', icon: '🔊', cmds: ['vcconfig', 'vcban', 'vcunban', 'vcforceclose'] },
  ],
  reminders: [
    { name: 'Commands', icon: '⏰', cmds: ['remind', 'reminders', 'remind-repeat', 'reminder-cancel', 'snooze'] },
  ],
  translation: [
    { name: 'User Commands', icon: '🌐', cmds: ['translate', 'translatelast', 'languages'] },
    { name: 'Management', icon: '⚙️', cmds: ['translateconfig', 'translatechannel', 'translateremove'] },
  ],
  reactionroles: [
    { name: 'Management', icon: '🏷️', cmds: ['reactionrole', 'rr-button', 'rr-list', 'rr-edit', 'rr-remove', 'rr-config'] },
  ],
  birthdays: [
    { name: 'User Commands', icon: '🎂', cmds: ['birthday', 'birthdayview', 'birthdaylist', 'birthdayupcoming'] },
    { name: 'Management', icon: '⚙️', cmds: ['birthdayannounce', 'birthdayconfig', 'birthdayremove'] },
  ],
  confessions: [
    { name: 'User Commands', icon: '🤫', cmds: ['confess'] },
    { name: 'Staff Actions', icon: '👮', cmds: ['confession-approve', 'confession-deny', 'confession-ban'] },
    { name: 'Management', icon: '⚙️', cmds: ['confession-config', 'confession-reveal'] },
  ],
  profile: [
    { name: 'View & Create', icon: '👤', cmds: ['profile-view', 'profile-create', 'profile-delete'] },
    { name: 'Customization', icon: '✏️', cmds: ['profile-aboutme', 'profile-age', 'profile-gender', 'profile-location', 'profile-status', 'profile-birthday', 'profile-color', 'profile-banner'] },
    { name: 'Favorites', icon: '❤️', cmds: ['profile-add', 'profile-remove'] },
    { name: 'Management', icon: '⚙️', cmds: ['profile-config'] },
  ],
  family: [
    { name: 'Relationships', icon: '💕', cmds: ['family-propose', 'family-adopt', 'family-divorce', 'family-disown'] },
    { name: 'View', icon: '🌳', cmds: ['family-tree', 'family-partner', 'family-children', 'family-family'] },
    { name: 'Configuration', icon: '⚙️', cmds: ['family-config'] },
  ],
  userphone: [
    { name: 'Commands', icon: '📞', cmds: ['userphone', 'hangup', 'phonebook'] },
    { name: 'Configuration', icon: '⚙️', cmds: ['userphoneconfig'] },
  ],
  backup: [
    { name: 'Backup Commands', icon: '💾', cmds: ['backupcreate', 'backuplist', 'backupinfo', 'backuprestore', 'backupcompare', 'backupdelete'] },
    { name: 'Configuration', icon: '⚙️', cmds: ['backupconfig'] },
  ],
  raffles: [
    { name: 'User Commands', icon: '🎟️', cmds: ['enterraffle', 'mytickets', 'raffleinfo', 'rafflelist'] },
    { name: 'Management', icon: '⚙️', cmds: ['raffle', 'endraffle', 'cancelraffle', 'raffle-config'] },
  ],
  donationtracking: [
    { name: 'User Commands', icon: '💝', cmds: ['donate', 'donationleaderboard', 'donationprogress', 'mydonations'] },
    { name: 'Management', icon: '⚙️', cmds: ['donationgoal', 'donationlist', 'donationconfig', 'donationreset'] },
  ],
  timers: [
    { name: 'User Commands', icon: '⏱️', cmds: ['timer', 'timerlist', 'timercancel', 'timercheck'] },
    { name: 'Management', icon: '⚙️', cmds: ['timerserverlist', 'timerconfig'] },
  ],
  images: [
    { name: 'Animals', icon: '🐾', cmds: ['cat', 'dog', 'fox', 'bird', 'panda', 'redpanda'] },
    { name: 'Memes', icon: '😂', cmds: ['drake', 'meme'] },
    { name: 'Effects', icon: '🎨', cmds: ['wasted', 'wanted', 'triggered', 'blur', 'greyscale', 'invert', 'pixelate', 'mirror'] },
    { name: 'Info', icon: '🖼️', cmds: ['avatar', 'banner', 'servericon'] },
    { name: 'Configuration', icon: '⚙️', cmds: ['images-config'] },
  ],
  utilities: [
    { name: 'Search', icon: '🔍', cmds: ['google', 'youtube', 'github', 'npm', 'steam'] },
    { name: 'Tools', icon: '🛠️', cmds: ['weather', 'crypto', 'translate', 'color', 'calculator', 'qrcode', 'password', 'encode', 'decode', 'emojify', 'enlarge', 'anagram', 'minecraft'] },
    { name: 'Notepad', icon: '📝', cmds: ['notepad-add', 'notepad-view', 'notepad-edit', 'notepad-delete'] },
    { name: 'Other', icon: '📦', cmds: ['poll', 'utilities-config'] },
  ],
  soundboard: [
    { name: 'User Commands', icon: '🔈', cmds: ['soundboard-play', 'soundboard-list', 'soundboard-random'] },
    { name: 'Management', icon: '⚙️', cmds: ['soundboard-add', 'soundboard-remove', 'soundboard-rename', 'soundboard-config'] },
  ],
  autosetup: [
    { name: 'Setup Wizards', icon: '🧙', cmds: ['autosetup-logs', 'autosetup-welcome', 'autosetup-tickets', 'autosetup-fun', 'autosetup-music', 'autosetup-moderation', 'autosetup-leveling', 'autosetup-all'] },
    { name: 'Configuration', icon: '⚙️', cmds: ['autosetup-config'] },
  ],
  core: [
    { name: 'Reports', icon: '🚩', cmds: ['report-user', 'report-bug'] },
  ],
};

/* ══════════════════════════════════════════════════════════════
   Main Page Component
   ══════════════════════════════════════════════════════════════ */

export default function ModuleConfigPage() {
  const params = useParams();
  const router = useRouter();
  const guildId = params.guildId as string;
  const moduleKey = params.moduleKey as string;

  const { modules, channels, roles, permissions, toggleModule, updateModuleConfig, fetchPermissions, isLoadingGuild } = useGuildStore();

  const [localConfig, setLocalConfig] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('settings');

  // Module info from registry (static)
  const moduleInfo = MODULE_REGISTRY.find((m) => m.key === moduleKey);

  // Module state from store (synced with API)
  const moduleState = modules[moduleKey];
  const isEnabled = moduleState?.enabled ?? false;

  // Commands for this module
  const commands = useMemo(() => getCommandsForModule(moduleKey), [moduleKey]);
  const commandCount = commands.length;

  // Initialize local config from store
  useEffect(() => {
    if (moduleState) {
      setLocalConfig(moduleState.config || {});
    }
  }, [moduleState]);

  // Fetch permissions on mount
  useEffect(() => {
    if (guildId) {
      fetchPermissions(guildId);
    }
  }, [guildId, fetchPermissions]);

  const handleToggle = async () => {
    try {
      await toggleModule(guildId, moduleKey, !isEnabled);
      showToast(`Module ${!isEnabled ? 'enabled' : 'disabled'}`, 'success');
    } catch {
      showToast('Failed to toggle module', 'error');
    }
  };

  const handleConfigChange = (newConfig: Record<string, unknown>) => {
    setLocalConfig(newConfig);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateModuleConfig(guildId, moduleKey, localConfig);
      showToast('Configuration saved successfully', 'success');
    } catch {
      showToast('Failed to save configuration', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (moduleState) {
      setLocalConfig(moduleState.config || {});
    }
  };

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  if (isLoadingGuild) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-10 h-10 border-2 border-[var(--nexus-cyan)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!moduleInfo) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <p className="text-lg font-semibold mb-4">Module not found</p>
          <button onClick={() => router.back()} className="text-[var(--nexus-cyan)] hover:underline text-sm">
            Go back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Back link */}
      <button
        onClick={() => router.push(`/dashboard/${guildId}/modules`)}
        className="flex items-center gap-1.5 text-[var(--nexus-cyan)] hover:underline text-sm mb-4"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Modules
      </button>

      {/* Module header + enable toggle (combined row) */}
      <div className="flex items-center gap-4 mb-5">
        <span className="text-3xl">{moduleInfo.icon}</span>
        <div className="flex-1">
          <h1 className="text-xl font-bold">{moduleInfo.name}</h1>
          <span className="text-xs text-[var(--nexus-dim)] capitalize">{moduleInfo.category}</span>
        </div>
        <button
          onClick={handleToggle}
          className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            isEnabled
              ? 'bg-[var(--nexus-green)]/10 text-[var(--nexus-green)] border border-[var(--nexus-green)]/30'
              : 'bg-[var(--nexus-red)]/10 text-[var(--nexus-red)] border border-[var(--nexus-red)]/30'
          }`}
          disabled={saving}
        >
          {isEnabled ? 'Enabled' : 'Disabled'}
        </button>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-lg shadow-lg text-sm border ${
            toast.type === 'success'
              ? 'bg-[var(--nexus-green)]/10 border-[var(--nexus-green)]/30 text-[var(--nexus-green)]'
              : 'bg-[var(--nexus-red)]/10 border-[var(--nexus-red)]/30 text-[var(--nexus-red)]'
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* Tab bar */}
      {isEnabled && (
        <div className="flex gap-0 border-b border-[var(--nexus-border)] mb-5">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            const badge = tab.key === 'commands' && commandCount > 0 ? commandCount : null;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  isActive
                    ? 'border-[var(--nexus-cyan)] text-[var(--nexus-cyan)]'
                    : 'border-transparent text-[var(--nexus-dim)] hover:text-[var(--nexus-text)]'
                }`}
              >
                <span className="text-sm">{tab.icon}</span>
                {tab.label}
                {badge !== null && (
                  <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                    isActive ? 'bg-[var(--nexus-cyan)]/15 text-[var(--nexus-cyan)]' : 'bg-white/5 text-[var(--nexus-dim)]'
                  }`}>{badge}</span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Tab content */}
      {isEnabled && activeTab === 'settings' && (
        <>
          {renderModuleConfig(moduleKey, localConfig, handleConfigChange, channels, roles)}
          <div className="flex justify-end gap-3 mt-5">
            <button
              onClick={handleCancel}
              className="px-4 py-2 rounded-lg border border-[var(--nexus-border)] text-sm text-[var(--nexus-dim)] hover:text-[var(--nexus-text)] hover:border-[var(--nexus-text)]/30 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-[var(--nexus-cyan)] text-black text-sm font-medium hover:bg-[var(--nexus-cyan)]/80 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </>
      )}

      {isEnabled && activeTab === 'commands' && (
        <CommandsTab
          moduleKey={moduleKey}
          guildId={guildId}
          commands={commands}
          permissions={permissions}
          channels={channels}
          roles={roles}
        />
      )}

      {isEnabled && activeTab === 'history' && (
        <HistoryTab guildId={guildId} moduleKey={moduleKey} />
      )}

      {/* When disabled, show a message */}
      {!isEnabled && (
        <div className="nexus-card p-8 text-center">
          <span className="text-3xl block mb-3">🔌</span>
          <p className="text-sm text-[var(--nexus-dim)]">
            Enable this module to configure settings, commands, and view usage history.
          </p>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   Commands Tab — Grid of command cards grouped by subcategory
   ══════════════════════════════════════════════════════════════ */

function CommandsTab({
  moduleKey,
  guildId,
  commands,
  permissions,
  channels,
  roles,
}: {
  moduleKey: string;
  guildId: string;
  commands: CommandDef[];
  permissions: PermissionRule[];
  channels: Channel[];
  roles: Role[];
}) {
  const [expandedCmd, setExpandedCmd] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [togglingCmd, setTogglingCmd] = useState<string | null>(null);
  const [cmdToggleError, setCmdToggleError] = useState<string | null>(null);
  const { setPermission, removePermission, toggleCommand, modules } = useGuildStore();

  // Get disabledCommands from module config
  const disabledCommands: string[] = useMemo(() => {
    const mod = modules[moduleKey];
    if (!mod?.config) return [];
    return (mod.config as Record<string, any>).disabledCommands || [];
  }, [modules, moduleKey]);

  // Count rules per command
  const ruleCountMap = useMemo(() => {
    const map: Record<string, { roleCount: number; channelCount: number }> = {};
    for (const cmd of commands) {
      const rules = permissions.filter((p) => p.command === cmd.name);
      const roleCount = rules.filter((r) => r.targetType === 'role').length;
      const channelCount = rules.filter((r) => r.targetType === 'channel').length;
      map[cmd.name] = { roleCount, channelCount };
    }
    return map;
  }, [commands, permissions]);

  const totalRules = useMemo(
    () => permissions.filter((p) => commands.some((c) => c.name === p.command)).length,
    [permissions, commands]
  );

  // Filter commands by search
  const filtered = useMemo(() => {
    if (!searchText) return commands;
    const q = searchText.toLowerCase();
    return commands.filter((c) => c.name.includes(q) || c.description.toLowerCase().includes(q));
  }, [commands, searchText]);

  // Group commands
  const groups = useMemo(() => {
    const definedGroups = COMMAND_GROUPS[moduleKey];
    if (!definedGroups) {
      return [{ name: 'All Commands', icon: '📋', cmds: filtered }];
    }
    const result: { name: string; icon: string; cmds: CommandDef[] }[] = [];
    const placed = new Set<string>();

    for (const grp of definedGroups) {
      const matching = filtered.filter((c) => grp.cmds.includes(c.name));
      if (matching.length > 0) {
        result.push({ name: grp.name, icon: grp.icon, cmds: matching });
        for (const m of matching) placed.add(m.name);
      }
    }
    // Ungrouped commands
    const remaining = filtered.filter((c) => !placed.has(c.name));
    if (remaining.length > 0) {
      result.push({ name: 'Other', icon: '📦', cmds: remaining });
    }
    return result;
  }, [moduleKey, filtered]);

  if (commands.length === 0) {
    return (
      <div className="nexus-card p-8 text-center">
        <p className="text-sm text-[var(--nexus-dim)]">This module has no registered commands.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Stats bar */}
      <div className="flex items-center gap-5 mb-4">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-[var(--nexus-green)]">{commands.length - disabledCommands.length}</span>
          <span className="text-xs text-[var(--nexus-dim)]">Enabled</span>
        </div>
        {disabledCommands.length > 0 && (
          <>
            <div className="w-px h-5 bg-[var(--nexus-border)]" />
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-[var(--nexus-red)]">{disabledCommands.length}</span>
              <span className="text-xs text-[var(--nexus-dim)]">Disabled</span>
            </div>
          </>
        )}
        <div className="w-px h-5 bg-[var(--nexus-border)]" />
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-[var(--nexus-cyan)]">{totalRules}</span>
          <span className="text-xs text-[var(--nexus-dim)]">Permission Rules</span>
        </div>
        <div className="flex-1" />
        {/* Search */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--nexus-card)] border border-[var(--nexus-border)]">
          <svg className="w-3.5 h-3.5 text-[var(--nexus-dim)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Search commands..."
            className="bg-transparent outline-none text-xs text-[var(--nexus-text)] placeholder-[var(--nexus-dim)] w-36"
          />
        </div>
      </div>

      {/* Grouped command grids */}
      {groups.map((group) => (
        <div key={group.name} className="mb-6">
          {/* Group header */}
          <div className="flex items-center gap-2 mb-2.5 px-1">
            <span className="text-sm">{group.icon}</span>
            <span className="text-xs font-semibold text-[var(--nexus-dim)] uppercase tracking-wider">{group.name}</span>
            <span className="text-[10px] text-[var(--nexus-dim)] px-1.5 py-0.5 rounded bg-white/5">
              {group.cmds.length} command{group.cmds.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Group container panel with 3-column grid */}
          <div className="nexus-card p-3">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3" style={{ columnGap: '0.625rem', rowGap: '0.625rem' }}>
              {group.cmds.map((cmd) => {
                const isExpanded = expandedCmd === cmd.id;
                const cmdDisabled = disabledCommands.includes(cmd.name);
                const { roleCount, channelCount } = ruleCountMap[cmd.name] || { roleCount: 0, channelCount: 0 };
                const accessColor = ACCESS_COLORS[cmd.defaultAccess];

                return (
                  <div
                    key={cmd.id}
                    className={`nexus-card p-3.5 transition-all hover:border-[var(--nexus-cyan)]/30 ${
                      isExpanded ? 'border-[var(--nexus-cyan)]/40 ring-1 ring-[var(--nexus-cyan)]/20' : ''
                    } ${cmdDisabled ? 'opacity-60' : ''}`}
                  >
                    {/* Command header - clickable */}
                    <div className="cursor-pointer" onClick={() => setExpandedCmd(isExpanded ? null : cmd.id)}>
                      {/* Command name with toggle */}
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`text-sm font-mono font-medium ${cmdDisabled ? 'text-[var(--nexus-dim)] line-through' : 'text-[var(--nexus-text)]'}`}>/{cmd.name}</span>
                        <div className="flex-1" />
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (togglingCmd === cmd.name) return;
                            setTogglingCmd(cmd.name);
                            setCmdToggleError(null);
                            toggleCommand(guildId, moduleKey, cmd.name, !cmdDisabled)
                              .catch(() => {
                                setCmdToggleError(`Failed to toggle /${cmd.name}`);
                                setTimeout(() => setCmdToggleError(null), 3000);
                              })
                              .finally(() => setTogglingCmd(null));
                          }}
                          style={{
                            position: 'relative',
                            flexShrink: 0,
                            width: '32px',
                            height: '18px',
                            borderRadius: '9px',
                            backgroundColor: cmdDisabled ? 'var(--nexus-border)' : 'var(--nexus-green)',
                            border: 'none',
                            cursor: togglingCmd === cmd.name ? 'wait' : 'pointer',
                            padding: 0,
                            transition: 'background-color 0.2s',
                          }}
                          title={cmdDisabled ? 'Enable command' : 'Disable command'}
                        >
                          <span
                            style={{
                              position: 'absolute',
                              top: '2px',
                              left: cmdDisabled ? '2px' : '16px',
                              width: '14px',
                              height: '14px',
                              borderRadius: '50%',
                              backgroundColor: '#fff',
                              boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
                              transition: 'left 0.2s',
                              display: 'block',
                            }}
                          />
                        </button>
                      </div>

                      {/* Description */}
                      <p className="text-[11px] text-[var(--nexus-dim)] leading-relaxed mb-2.5 line-clamp-2">
                        {cmd.description}
                      </p>

                      {/* Stats */}
                      <div className="space-y-1.5 mb-3 text-[10px]">
                        <div className="flex items-center gap-2">
                          <span className="text-[var(--nexus-dim)]">Cooldown:</span>
                          <span className="text-[var(--nexus-text)] font-mono">{cmd.cooldown || 5}s</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[var(--nexus-dim)]">Default Permission:</span>
                          <span
                            className="font-semibold px-1.5 py-0.5 rounded"
                            style={{
                              backgroundColor: `color-mix(in srgb, ${accessColor} 10%, transparent)`,
                              color: accessColor,
                            }}
                          >
                            {cmd.defaultAccess === 'everyone' ? '1' : cmd.defaultAccess === 'staffOnly' ? '5' : cmd.defaultAccess === 'adminOnly' ? '8' : '10'}
                          </span>
                        </div>
                        {roleCount > 0 && (
                          <div className="flex items-center gap-2">
                            <span className="text-[var(--nexus-dim)]">Custom Roles:</span>
                            <span className="text-[var(--nexus-cyan)] font-mono">{roleCount}</span>
                          </div>
                        )}
                        {channelCount > 0 && (
                          <div className="flex items-center gap-2">
                            <span className="text-[var(--nexus-dim)]">Channels:</span>
                            <span className="text-[var(--nexus-cyan)] font-mono">{channelCount}</span>
                          </div>
                        )}
                      </div>

                      {/* Configure Permissions toggle */}
                      <div className="flex items-center justify-end">
                        <span className="text-[var(--nexus-dim)] hover:text-[var(--nexus-text)] transition-colors text-[10px] font-semibold flex items-center gap-1">
                          Configure Permissions
                          <svg
                            className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </span>
                      </div>
                    </div>

                    {/* Expanded permission editor - INSIDE the same card */}
                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t border-[var(--nexus-border)]">
                        <CommandPermissionPanel
                          cmd={cmd}
                          rules={permissions.filter((p) => p.command === cmd.name)}
                          channels={channels}
                          roles={roles}
                          guildId={guildId}
                          setPermission={setPermission}
                          removePermission={removePermission}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ))}

      {/* Error toast for command toggle failures */}
      {cmdToggleError && (
        <div
          className="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-lg shadow-lg text-sm border"
          style={{
            backgroundColor: 'color-mix(in srgb, var(--nexus-red) 10%, var(--nexus-card))',
            borderColor: 'color-mix(in srgb, var(--nexus-red) 30%, transparent)',
            color: 'var(--nexus-red)',
          }}
        >
          {cmdToggleError}
        </div>
      )}
    </div>
  );
}

/* ── Inline permission panel for a single command card ── */

interface Member {
  id: string;
  username: string;
  globalName?: string;
  avatar?: string;
  discriminator?: string;
}

function PermSection({
  label,
  targetType,
  rules,
  items,
  resolveLabel,
  cmdName,
  guildId,
  setPermission,
  removePermission,
}: {
  label: string;
  targetType: 'role' | 'channel' | 'user';
  rules: PermissionRule[];
  items: { id: string; name: string; color?: number }[];
  resolveLabel: (id: string) => string;
  cmdName: string;
  guildId: string;
  setPermission: (guildId: string, command: string, targetType: string, targetId: string, allowed: boolean) => Promise<void>;
  removePermission: (guildId: string, command: string, targetId: string) => Promise<void>;
}) {
  const sectionRules = rules.filter((r) => r.targetType === targetType);
  const hasAllowed = sectionRules.some((r) => r.allowed);
  const hasDenied = sectionRules.some((r) => !r.allowed);
  // Default to "allowed" mode; if user has only denied entries, switch to denied
  const [mode, setMode] = useState<'allowed' | 'disallowed'>(hasDenied && !hasAllowed ? 'disallowed' : 'allowed');
  const [showPicker, setShowPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [userInput, setUserInput] = useState('');
  const [searchResults, setSearchResults] = useState<Member[]>([]);
  const [searching, setSearching] = useState(false);

  const isAllowed = mode === 'allowed';
  const activeRules = sectionRules.filter((r) => r.allowed === isAllowed);
  const color = isAllowed ? 'var(--nexus-green)' : 'var(--nexus-red)';

  const handleRemove = async (rule: PermissionRule) => {
    setSaving(true);
    try { await removePermission(guildId, cmdName, rule.targetId); } catch { /* */ }
    finally { setSaving(false); }
  };

  const handleAdd = async (targetId: string) => {
    setSaving(true);
    try {
      await setPermission(guildId, cmdName, targetType, targetId, isAllowed);
      setShowPicker(false);
      setUserInput('');
    } catch { /* */ }
    finally { setSaving(false); }
  };

  const searchMembers = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('nexus_token') : null;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const apiUrl = typeof window !== 'undefined' ? (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api') : 'http://localhost:3001/api';
      const response = await fetch(`${apiUrl}/guilds/${guildId}/members/search?q=${encodeURIComponent(query)}`, {
        headers,
      });

      if (response.status === 401 && typeof window !== 'undefined') {
        localStorage.removeItem('nexus_token');
        localStorage.removeItem('nexus_user');
        window.location.href = '/';
        return;
      }

      if (!response.ok) throw new Error(`API error: ${response.status}`);

      const data = await response.json();
      setSearchResults(data.members || []);
    } catch (err) {
      console.error('Member search failed:', err);
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, [guildId]);

  useEffect(() => {
    if (!showPicker || targetType !== 'user') return;
    const timer = setTimeout(() => {
      searchMembers(userInput);
    }, 300);
    return () => clearTimeout(timer);
  }, [userInput, showPicker, targetType, searchMembers]);

  const available = items.filter((i) => !sectionRules.some((r) => r.targetId === i.id));

  return (
    <div>
      {/* Section header with mode toggle */}
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] font-semibold text-[var(--nexus-dim)] uppercase tracking-wider">{label}</span>
        <div className="flex rounded overflow-hidden border border-[var(--nexus-border)]">
          <button
            onClick={() => setMode('allowed')}
            className="px-2 py-0.5 text-[9px] font-semibold transition-colors"
            style={{
              backgroundColor: isAllowed ? 'var(--nexus-green)' : 'transparent',
              color: isAllowed ? '#000' : 'var(--nexus-dim)',
            }}
          >
            Allowed
          </button>
          <button
            onClick={() => setMode('disallowed')}
            className="px-2 py-0.5 text-[9px] font-semibold transition-colors"
            style={{
              backgroundColor: !isAllowed ? 'var(--nexus-red)' : 'transparent',
              color: !isAllowed ? '#fff' : 'var(--nexus-dim)',
            }}
          >
            Disallowed
          </button>
        </div>
      </div>

      {/* Tags for current mode */}
      <div className="flex flex-wrap gap-1 mb-1.5">
        {activeRules.map((rule) => (
          <div
            key={rule.targetId}
            className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px]"
            style={{
              backgroundColor: `color-mix(in srgb, ${color} 12%, transparent)`,
              border: `1px solid color-mix(in srgb, ${color} 30%, transparent)`,
              color,
            }}
          >
            <span className="truncate max-w-[100px]">
              {targetType === 'channel' ? '#' : ''}{resolveLabel(rule.targetId)}
            </span>
            <button
              onClick={() => handleRemove(rule)}
              disabled={saving}
              className="opacity-50 hover:opacity-100 ml-0.5"
            >
              ✕
            </button>
          </div>
        ))}
        {activeRules.length === 0 && (
          <span className="text-[9px] text-[var(--nexus-dim)] italic">
            {isAllowed ? 'No restrictions — all allowed' : 'None disallowed'}
          </span>
        )}
      </div>

      {/* Add button / picker */}
      {!showPicker ? (
        <button
          onClick={() => setShowPicker(true)}
          disabled={saving}
          className="text-[10px] text-[var(--nexus-cyan)] hover:underline"
        >
          + Add {targetType}
        </button>
      ) : (
        <div className="rounded-md bg-[var(--nexus-dark)] border border-[var(--nexus-border)] p-1.5">
          {targetType === 'user' ? (
            <div className="space-y-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[9px] text-[var(--nexus-dim)]">Search member</span>
                <button onClick={() => { setShowPicker(false); setUserInput(''); setSearchResults([]); }} className="text-[var(--nexus-dim)] hover:text-[var(--nexus-text)] text-xs">✕</button>
              </div>
              <input
                type="text"
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                placeholder="Search by username..."
                className="w-full px-2 py-1 rounded bg-transparent border border-[var(--nexus-border)] text-[var(--nexus-text)] text-[10px] outline-none"
              />
              <div className="max-h-32 overflow-y-auto space-y-0.5">
                {searching ? (
                  <span className="text-[9px] text-[var(--nexus-dim)] px-2 py-1">Searching...</span>
                ) : searchResults.length > 0 ? (
                  searchResults
                    .filter((m) => !sectionRules.some((r) => r.targetId === m.id))
                    .map((member) => (
                      <button
                        key={member.id}
                        onClick={() => {
                          handleAdd(member.id);
                          setSearchResults([]);
                        }}
                        disabled={saving}
                        className="w-full text-left px-2 py-1 rounded hover:bg-white/5 text-[10px]"
                      >
                        <div className="flex items-center gap-1">
                          <span className="font-semibold">{member.globalName || member.username}</span>
                          {member.username && member.globalName && (
                            <span className="text-[var(--nexus-dim)]">@{member.username}</span>
                          )}
                        </div>
                      </button>
                    ))
                ) : userInput.trim() ? (
                  <span className="text-[9px] text-[var(--nexus-dim)] px-2 py-1">No members found</span>
                ) : (
                  <span className="text-[9px] text-[var(--nexus-dim)] px-2 py-1">Type to search...</span>
                )}
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[9px] text-[var(--nexus-dim)]">Select {targetType} to {isAllowed ? 'allow' : 'disallow'}</span>
                <button onClick={() => setShowPicker(false)} className="text-[var(--nexus-dim)] hover:text-[var(--nexus-text)] text-xs">✕</button>
              </div>
              <div className="max-h-32 overflow-y-auto space-y-0.5">
                {available.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleAdd(item.id)}
                    disabled={saving}
                    className="w-full text-left px-2 py-1 rounded hover:bg-white/5 flex items-center gap-1.5 text-[10px]"
                  >
                    {targetType === 'role' && (
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: item.color ? `#${item.color.toString(16).padStart(6, '0')}` : 'var(--nexus-dim)' }}
                      />
                    )}
                    {targetType === 'channel' && <span className="text-[var(--nexus-dim)]">#</span>}
                    {item.name}
                  </button>
                ))}
                {available.length === 0 && (
                  <span className="text-[9px] text-[var(--nexus-dim)] px-2">No more {targetType}s to add</span>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function CommandPermissionPanel({
  cmd,
  rules,
  channels,
  roles,
  guildId,
  setPermission,
  removePermission,
}: {
  cmd: CommandDef;
  rules: PermissionRule[];
  channels: Channel[];
  roles: Role[];
  guildId: string;
  setPermission: (guildId: string, command: string, targetType: string, targetId: string, allowed: boolean) => Promise<void>;
  removePermission: (guildId: string, command: string, targetId: string) => Promise<void>;
}) {
  const selectableRoles = roles.filter((r) => !r.managed);
  const selectableChannels = channels.filter((c) => c.type === 0 || c.type === 5);

  return (
    <div className="space-y-3 text-xs">
      <PermSection
        label="Roles"
        targetType="role"
        rules={rules}
        items={selectableRoles.map((r) => ({ id: r.id, name: r.name, color: r.color }))}
        resolveLabel={(id) => roles.find((r) => r.id === id)?.name || id}
        cmdName={cmd.name}
        guildId={guildId}
        setPermission={setPermission}
        removePermission={removePermission}
      />
      <PermSection
        label="Members"
        targetType="user"
        rules={rules}
        items={[]}
        resolveLabel={(id) => id}
        cmdName={cmd.name}
        guildId={guildId}
        setPermission={setPermission}
        removePermission={removePermission}
      />
      <PermSection
        label="Channels"
        targetType="channel"
        rules={rules}
        items={selectableChannels.map((c) => ({ id: c.id, name: c.name }))}
        resolveLabel={(id) => channels.find((c) => c.id === id)?.name || id}
        cmdName={cmd.name}
        guildId={guildId}
        setPermission={setPermission}
        removePermission={removePermission}
      />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   History Tab — Recent command usage
   ══════════════════════════════════════════════════════════════ */

interface HistoryEntry {
  command_name: string;
  subcommand_name: string | null;
  user_id: string;
  display_name: string | null;
  execution_ms: number;
  success: boolean;
  timestamp: string;
}

interface HistoryStats {
  total_uses: string;
  successful: string;
  failed: string;
  avg_latency: string;
  unique_users: string;
  unique_commands: string;
}

function HistoryTab({ guildId, moduleKey }: { guildId: string; moduleKey: string }) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [stats, setStats] = useState<HistoryStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchHistory = useCallback(async () => {
    try {
      const { data } = await api.get(`/modules/${guildId}/${moduleKey}/history?limit=50`);
      setHistory(data.history || []);
      setStats(data.stats || null);
    } catch {
      /* non-critical */
    } finally {
      setLoading(false);
    }
  }, [guildId, moduleKey]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-[var(--nexus-cyan)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const totalUses = parseInt(stats?.total_uses || '0', 10);
  const successRate = totalUses > 0
    ? Math.round((parseInt(stats?.successful || '0', 10) / totalUses) * 100)
    : 0;

  return (
    <div>
      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mb-5">
        <StatMini label="Total Uses (30d)" value={stats?.total_uses || '0'} />
        <StatMini label="Success Rate" value={totalUses > 0 ? `${successRate}%` : 'N/A'} />
        <StatMini label="Avg Latency" value={stats?.avg_latency ? `${stats.avg_latency}ms` : 'N/A'} />
        <StatMini label="Unique Users" value={stats?.unique_users || '0'} />
      </div>

      {/* Recent history table */}
      {history.length === 0 ? (
        <div className="nexus-card p-8 text-center">
          <span className="text-2xl block mb-2">📭</span>
          <p className="text-sm text-[var(--nexus-dim)]">
            No command usage recorded yet. Commands will appear here once they are used.
          </p>
        </div>
      ) : (
        <div className="nexus-card overflow-hidden">
          <div className="px-3 py-2.5 border-b border-[var(--nexus-border)]">
            <span className="text-xs font-semibold text-[var(--nexus-dim)] uppercase">Recent Usage</span>
          </div>
          <div className="divide-y divide-[var(--nexus-border)]">
            {history.map((entry, idx) => {
              const ts = new Date(entry.timestamp);
              const timeStr = ts.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
              return (
                <div key={idx} className="flex items-center gap-3 px-3 py-2">
                  <div
                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                      entry.success ? 'bg-[var(--nexus-green)]' : 'bg-[var(--nexus-red)]'
                    }`}
                  />
                  <span className="text-xs font-mono text-[var(--nexus-text)] min-w-[100px]">
                    /{entry.command_name}{entry.subcommand_name ? ` ${entry.subcommand_name}` : ''}
                  </span>
                  <span className="text-[10px] text-[var(--nexus-dim)] font-mono">{entry.display_name || entry.user_id}</span>
                  <div className="flex-1" />
                  <span className="text-[10px] text-[var(--nexus-dim)]">{entry.execution_ms}ms</span>
                  <span className="text-[10px] text-[var(--nexus-dim)] min-w-[80px] text-right">{timeStr}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Mini stat card for History tab ── */

function StatMini({ label, value }: { label: string; value: string }) {
  return (
    <div className="nexus-card p-3">
      <p className="text-lg font-bold text-[var(--nexus-cyan)]">{value}</p>
      <p className="text-[10px] text-[var(--nexus-dim)] mt-0.5">{label}</p>
    </div>
  );
}

function renderModuleConfig(
  moduleKey: string,
  config: Record<string, unknown>,
  onChange: (newConfig: Record<string, unknown>) => void,
  channels: Channel[],
  roles: Role[]
): React.ReactNode {
  switch (moduleKey) {
    case 'moderation':
      return (
        <>
          <ConfigGrid cols={3}>
            <ConfigSection title="DM Notifications" icon="🔔">
              <ConfigToggle
                configKey="dmOnBan"
                config={config}
                onChange={onChange}
                label="DM on Ban"
                description="Send a DM to users when they get banned"
              />
              <ConfigToggle
                configKey="dmOnKick"
                config={config}
                onChange={onChange}
                label="DM on Kick"
                description="Send a DM to users when they get kicked"
              />
              <ConfigToggle
                configKey="dmOnMute"
                config={config}
                onChange={onChange}
                label="DM on Mute"
                description="Send a DM to users when they get muted"
              />
              <ConfigToggle
                configKey="dmOnWarn"
                config={config}
                onChange={onChange}
                label="DM on Warn"
                description="Send a DM to users when they receive a warning"
              />
            </ConfigSection>
            <ConfigSection title="Rules" icon="📋">
              <ConfigToggle
                configKey="requireReason"
                config={config}
                onChange={onChange}
                label="Require Reason"
                description="Staff must provide a reason for all mod actions"
              />
              <ConfigToggle
                configKey="appealEnabled"
                config={config}
                onChange={onChange}
                label="Allow Appeals"
                description="Let users appeal bans and punishments"
              />
              <ConfigChannelPicker
                configKey="appealChannelId"
                config={config}
                onChange={onChange}
                channels={channels}
                label="Appeals Channel"
              />
            </ConfigSection>
            <ConfigSection title="Advanced" icon="⚙️">
              <ConfigToggle
                configKey="shadowBanEnabled"
                config={config}
                onChange={onChange}
                label="Shadow Ban"
                description="Silently restrict users without them knowing"
              />
              <ConfigToggle
                configKey="altDetectionEnabled"
                config={config}
                onChange={onChange}
                label="Alt Detection"
                description="Detect alternative accounts joining the server"
              />
              <ConfigChannelPicker
                configKey="altDetectionLogChannelId"
                config={config}
                onChange={onChange}
                channels={channels}
                label="Alt Detection Log Channel"
              />
              <ConfigToggle
                configKey="fineEnabled"
                config={config}
                onChange={onChange}
                label="Fines"
                description="Allow staff to issue currency fines as punishment"
              />
            </ConfigSection>
          </ConfigGrid>
          <ConfigGrid cols={3}>
            <ConfigSection title="Reputation" icon="⭐">
              <ConfigToggle
                configKey="reputationEnabled"
                config={config}
                onChange={onChange}
                label="Enable Reputation"
                description="Track user reputation scores based on mod actions"
              />
              <ConfigNumberField
                configKey="defaultReputation"
                config={config}
                onChange={onChange}
                label="Starting Reputation"
                placeholder="100"
              />
              <ConfigNumberField
                configKey="reputationPenalties.warn"
                config={config}
                onChange={onChange}
                label="Warn Penalty"
                placeholder="-10"
              />
              <ConfigNumberField
                configKey="reputationPenalties.mute"
                config={config}
                onChange={onChange}
                label="Mute Penalty"
                placeholder="-20"
              />
              <ConfigNumberField
                configKey="reputationPenalties.kick"
                config={config}
                onChange={onChange}
                label="Kick Penalty"
                placeholder="-30"
              />
              <ConfigNumberField
                configKey="reputationPenalties.tempban"
                config={config}
                onChange={onChange}
                label="Temp Ban Penalty"
                placeholder="-40"
              />
              <ConfigNumberField
                configKey="reputationPenalties.ban"
                config={config}
                onChange={onChange}
                label="Perm Ban Penalty"
                placeholder="-100"
              />
            </ConfigSection>
          </ConfigGrid>
        </>
      );

    case 'automod':
      return (
        <>
          <ConfigGrid cols={3}>
            <ConfigSection title="Anti-Spam" icon="🛡️">
              <ConfigToggle
                configKey="antispam.enabled"
                config={config}
                onChange={onChange}
                label="Anti-Spam"
                description="Automatically detect and punish message spam"
              />
              <ConfigNumberField
                configKey="antispam.maxMessages"
                config={config}
                onChange={onChange}
                label="Max Messages"
                placeholder="5"
              />
              <ConfigNumberField
                configKey="antispam.timeframeSeconds"
                config={config}
                onChange={onChange}
                label="Timeframe (seconds)"
                placeholder="5"
              />
              <ConfigPicker
                configKey="antispam.action"
                config={config}
                onChange={onChange}
                label="Punishment Action"
                options={[
                  { value: 'delete', label: 'Delete Messages' },
                  { value: 'warn', label: 'Warn User' },
                  { value: 'mute', label: 'Mute User' },
                  { value: 'kick', label: 'Kick User' },
                  { value: 'ban', label: 'Ban User' },
                ]}
              />
            </ConfigSection>
            <ConfigSection title="Anti-Emoji Spam" icon="😂">
              <ConfigToggle
                configKey="antispam.emojiEnabled"
                config={config}
                onChange={onChange}
                label="Anti-Emoji Spam"
                description="Limit excessive emoji usage in messages"
              />
              <ConfigNumberField
                configKey="antispam.maxEmojis"
                config={config}
                onChange={onChange}
                label="Max Emojis Per Message"
                placeholder="10"
              />
            </ConfigSection>
            <ConfigSection title="Anti-Caps" icon="🔠">
              <ConfigToggle
                configKey="antispam.capsEnabled"
                config={config}
                onChange={onChange}
                label="Anti-Caps"
                description="Detect and filter messages with excessive capital letters"
              />
              <ConfigNumberField
                configKey="antispam.maxCaps"
                config={config}
                onChange={onChange}
                label="Max Caps Percentage"
                placeholder="70"
              />
            </ConfigSection>
          </ConfigGrid>
          <ConfigGrid cols={3}>
            <ConfigSection title="Anti-Mass Mention" icon="📢">
              <ConfigToggle
                configKey="antispam.mentionEnabled"
                config={config}
                onChange={onChange}
                label="Anti-Mass Mention"
                description="Prevent mass pinging of users or roles"
              />
              <ConfigNumberField
                configKey="antispam.maxMentions"
                config={config}
                onChange={onChange}
                label="Max Mentions Per Message"
                placeholder="5"
              />
              <ConfigPicker
                configKey="antispam.mentionAction"
                config={config}
                onChange={onChange}
                label="Punishment Action"
                options={[
                  { value: 'delete', label: 'Delete Message' },
                  { value: 'warn', label: 'Warn User' },
                  { value: 'mute', label: 'Mute User' },
                  { value: 'kick', label: 'Kick User' },
                ]}
              />
            </ConfigSection>
            <ConfigSection title="Anti-Link" icon="🔗">
              <ConfigToggle
                configKey="antilink.enabled"
                config={config}
                onChange={onChange}
                label="Anti-Link"
                description="Block messages containing URLs and links"
              />
              <ConfigPicker
                configKey="antilink.action"
                config={config}
                onChange={onChange}
                label="Punishment Action"
                options={[
                  { value: 'delete', label: 'Delete Message' },
                  { value: 'warn', label: 'Warn + Delete' },
                  { value: 'mute', label: 'Mute + Delete' },
                ]}
              />
              <ConfigToggle
                configKey="antilink.allowImages"
                config={config}
                onChange={onChange}
                label="Allow Image Links"
                description="Permit direct image URLs (imgur, i.redd.it, etc.)"
              />
            </ConfigSection>
            <ConfigSection title="Anti-Invite" icon="✉️">
              <ConfigToggle
                configKey="antiinvite.enabled"
                config={config}
                onChange={onChange}
                label="Anti-Invite"
                description="Block Discord server invite links"
              />
              <ConfigPicker
                configKey="antiinvite.action"
                config={config}
                onChange={onChange}
                label="Punishment Action"
                options={[
                  { value: 'delete', label: 'Delete Message' },
                  { value: 'warn', label: 'Warn + Delete' },
                  { value: 'mute', label: 'Mute + Delete' },
                ]}
              />
              <ConfigToggle
                configKey="antiinvite.allowOwnServer"
                config={config}
                onChange={onChange}
                label="Allow Own Server Invites"
                description="Permit invite links for this server"
              />
            </ConfigSection>
          </ConfigGrid>
          <ConfigGrid cols={3}>
            <ConfigSection title="Word Filter" icon="🚫">
              <ConfigToggle
                configKey="wordfilter.enabled"
                config={config}
                onChange={onChange}
                label="Word Filter"
                description="Filter messages containing banned words or regex patterns"
              />
              <ConfigPicker
                configKey="wordfilter.action"
                config={config}
                onChange={onChange}
                label="Punishment Action"
                options={[
                  { value: 'delete', label: 'Delete Message' },
                  { value: 'warn', label: 'Warn + Delete' },
                  { value: 'mute', label: 'Mute + Delete' },
                ]}
              />
              <ConfigToggle
                configKey="wordfilter.filterNicknames"
                config={config}
                onChange={onChange}
                label="Filter Nicknames"
                description="Also check nicknames for banned words"
              />
            </ConfigSection>
            <ConfigSection title="Anti-Nuke" icon="⚠️">
              <ConfigToggle
                configKey="antinuke.enabled"
                config={config}
                onChange={onChange}
                label="Anti-Nuke Protection"
                description="Detect mass destructive actions and auto-lockdown"
              />
              <ConfigNumberField
                configKey="antinuke.maxChannelDeletesPerMinute"
                config={config}
                onChange={onChange}
                label="Max Channel Deletes/Min"
                placeholder="3"
              />
              <ConfigNumberField
                configKey="antinuke.maxRoleDeletesPerMinute"
                config={config}
                onChange={onChange}
                label="Max Role Deletes/Min"
                placeholder="3"
              />
              <ConfigNumberField
                configKey="antinuke.maxBansPerMinute"
                config={config}
                onChange={onChange}
                label="Max Bans/Min"
                placeholder="5"
              />
              <ConfigPicker
                configKey="antinuke.action"
                config={config}
                onChange={onChange}
                label="On Detection"
                options={[
                  { value: 'lockdown', label: 'Auto-Lockdown Server' },
                  { value: 'stripRoles', label: 'Strip Attacker Roles' },
                  { value: 'ban', label: 'Ban Attacker' },
                  { value: 'alert', label: 'Alert Only' },
                ]}
              />
            </ConfigSection>
            <ConfigSection title="Logging & Exemptions" icon="📝">
              <ConfigChannelPicker
                configKey="logChannelId"
                config={config}
                onChange={onChange}
                channels={channels}
                label="Automod Log Channel"
              />
              <ConfigPicker
                configKey="warnAction"
                config={config}
                onChange={onChange}
                label="Auto-Action After Warns"
                options={[
                  { value: 'none', label: 'None' },
                  { value: 'mute', label: 'Auto-Mute' },
                  { value: 'kick', label: 'Auto-Kick' },
                  { value: 'ban', label: 'Auto-Ban' },
                ]}
              />
              <ConfigNumberField
                configKey="warnThreshold"
                config={config}
                onChange={onChange}
                label="Warn Threshold"
                placeholder="3"
              />
            </ConfigSection>
          </ConfigGrid>
        </>
      );

    case 'leveling':
      return (
        <>
          <ConfigGrid cols={3}>
            <ConfigSection title="XP Settings" icon="✨">
              <ConfigNumberField
                configKey="xpPerMessage.min"
                config={config}
                onChange={onChange}
                label="Min XP per Message"
                placeholder="5"
              />
              <ConfigNumberField
                configKey="xpPerMessage.max"
                config={config}
                onChange={onChange}
                label="Max XP per Message"
                placeholder="15"
              />
              <ConfigNumberField
                configKey="xpCooldownSeconds"
                config={config}
                onChange={onChange}
                label="XP Cooldown (seconds)"
                placeholder="10"
              />
              <ConfigNumberField
                configKey="xpPerVoiceMinute"
                config={config}
                onChange={onChange}
                label="XP per Voice Minute"
                placeholder="2"
              />
              <ConfigToggle
                configKey="voiceRequireUnmuted"
                config={config}
                onChange={onChange}
                label="Require Unmuted for Voice XP"
                description="Users must be unmuted to gain voice XP"
              />
            </ConfigSection>
            <ConfigSection title="Boosts" icon="⚡">
              <ConfigToggle
                configKey="doubleXpActive"
                config={config}
                onChange={onChange}
                label="Double XP Active"
                description="Doubles all XP gains server-wide"
              />
            </ConfigSection>
          </ConfigGrid>
          <ConfigGrid cols={3}>
            <ConfigSection title="Level-Up Announcements" icon="📢">
              <ConfigPicker
                configKey="announceType"
                config={config}
                onChange={onChange}
                options={[
                  { value: 'current', label: 'Current Channel' },
                  { value: 'channel', label: 'Specific Channel' },
                  { value: 'dm', label: 'Direct Message' },
                  { value: 'off', label: 'Off' },
                ]}
                label="Announcement Type"
              />
              <ConfigChannelPicker
                configKey="announceChannelId"
                config={config}
                onChange={onChange}
                channels={channels}
                label="Announcement Channel"
              />
              <ConfigTextField
                configKey="announceMessage"
                config={config}
                onChange={onChange}
                label="Announcement Message"
                description="Message template for level-ups. Use {user}, {level}, {server} as variables"
                placeholder="{user} reached level {level}!"
                multiline
              />
            </ConfigSection>
            <ConfigSection title="Role Stacking" icon="👥">
              <ConfigToggle
                configKey="stackRoles"
                config={config}
                onChange={onChange}
                label="Stack Roles"
                description="Users keep all level roles instead of only getting the highest"
              />
            </ConfigSection>
          </ConfigGrid>
          <ConfigSection title="Prestige" icon="👑">
            <ConfigToggle
              configKey="prestigeEnabled"
              config={config}
              onChange={onChange}
              label="Prestige Enabled"
              description="Allow users to reset levels and gain a prestige rank"
            />
            <ConfigNumberField
              configKey="prestigeMaxLevel"
              config={config}
              onChange={onChange}
              label="Prestige Max Level"
              placeholder="100"
            />
            <ConfigNumberField
              configKey="prestigeXpMultiplier"
              config={config}
              onChange={onChange}
              label="Prestige XP Multiplier"
              placeholder="1.5"
            />
          </ConfigSection>
        </>
      );

    case 'welcome':
      return (
        <>
          <ConfigGrid cols={3}>
            <ConfigSection title="Welcome Message" icon="👋">
              <ConfigToggle
                configKey="welcome.enabled"
                config={config}
                onChange={onChange}
                label="Enabled"
                description="Send a welcome message when users join"
              />
              <ConfigChannelPicker
                configKey="welcome.channelId"
                config={config}
                onChange={onChange}
                channels={channels}
                label="Welcome Channel"
              />
              <ConfigTextField
                configKey="welcome.message"
                config={config}
                onChange={onChange}
                label="Welcome Message"
                description="Message template. Use {user}, {server} as variables"
                placeholder="Welcome {user} to {server}!"
                multiline
              />
            </ConfigSection>
            <ConfigSection title="Leave Message" icon="🚶">
              <ConfigToggle
                configKey="leave.enabled"
                config={config}
                onChange={onChange}
                label="Enabled"
                description="Send a message when users leave the server"
              />
              <ConfigChannelPicker
                configKey="leave.channelId"
                config={config}
                onChange={onChange}
                channels={channels}
                label="Leave Channel"
              />
              <ConfigTextField
                configKey="leave.message"
                config={config}
                onChange={onChange}
                label="Leave Message"
                description="Message template. Use {user}, {server} as variables"
                placeholder="{username} has left the server"
                multiline
              />
            </ConfigSection>
          </ConfigGrid>
          <ConfigGrid cols={3}>
            <ConfigSection title="DM on Join" icon="✉️">
              <ConfigToggle
                configKey="dm.enabled"
                config={config}
                onChange={onChange}
                label="Enabled"
                description="Send a direct message to new users"
              />
              <ConfigTextField
                configKey="dm.message"
                config={config}
                onChange={onChange}
                label="DM Message"
                description="Message template. Use {user}, {server} as variables"
                placeholder="Welcome to {server}!"
                multiline
              />
            </ConfigSection>
            <ConfigSection title="Auto Roles" icon="🎭">
              <ConfigToggle
                configKey="autorole.enabled"
                config={config}
                onChange={onChange}
                label="Enabled"
                description="Automatically assign roles to new users"
              />
              <ConfigNumberField
                configKey="autorole.delaySeconds"
                config={config}
                onChange={onChange}
                label="Delay (seconds)"
                placeholder="0"
              />
            </ConfigSection>
          </ConfigGrid>
          <ConfigSection title="Join Gate" icon="🔒">
            <ConfigToggle
              configKey="joingate.enabled"
              config={config}
              onChange={onChange}
              label="Enabled"
              description="Require accounts to be a minimum age before joining"
            />
            <ConfigNumberField
              configKey="joingate.minAccountAgeDays"
              config={config}
              onChange={onChange}
              label="Min Account Age (days)"
              placeholder="7"
            />
            <ConfigToggle
              configKey="joingate.logKicks"
              config={config}
              onChange={onChange}
              label="Log Kicks"
              description="Log when users are kicked by the join gate"
            />
          </ConfigSection>
        </>
      );

    case 'tickets':
      return (
        <>
          <ConfigGrid cols={3}>
            <ConfigSection title="General" icon="🎫">
              <ConfigNumberField
                configKey="maxOpenTicketsPerUser"
                config={config}
                onChange={onChange}
                label="Max Open Tickets per User"
                placeholder="3"
              />
              <ConfigToggle
                configKey="claimEnabled"
                config={config}
                onChange={onChange}
                label="Claim Enabled"
                description="Allow staff to claim tickets"
              />
              <ConfigToggle
                configKey="priorityEnabled"
                config={config}
                onChange={onChange}
                label="Priority Enabled"
                description="Allow tickets to be marked as priority"
              />
              <ConfigToggle
                configKey="feedbackEnabled"
                config={config}
                onChange={onChange}
                label="Feedback Enabled"
                description="Request feedback after ticket closure"
              />
            </ConfigSection>
            <ConfigSection title="Transcripts" icon="📄">
              <ConfigToggle
                configKey="transcriptEnabled"
                config={config}
                onChange={onChange}
                label="Transcript Enabled"
                description="Save ticket transcripts when closed"
              />
              <ConfigChannelPicker
                configKey="transcriptChannelId"
                config={config}
                onChange={onChange}
                channels={channels}
                label="Transcript Channel"
              />
            </ConfigSection>
          </ConfigGrid>
          <ConfigGrid cols={3}>
            <ConfigSection title="Auto-Close" icon="⏰">
              <ConfigToggle
                configKey="autoCloseEnabled"
                config={config}
                onChange={onChange}
                label="Auto-Close Enabled"
                description="Automatically close inactive tickets"
              />
              <ConfigNumberField
                configKey="autoCloseHours"
                config={config}
                onChange={onChange}
                label="Auto-Close Hours"
                placeholder="48"
              />
              <ConfigNumberField
                configKey="autoCloseWarningHours"
                config={config}
                onChange={onChange}
                label="Warning Hours Before Close"
                placeholder="24"
              />
            </ConfigSection>
            <ConfigSection title="Close Behavior" icon="❌">
              <ConfigToggle
                configKey="closeConfirmation"
                config={config}
                onChange={onChange}
                label="Require Close Confirmation"
                description="Staff must confirm before closing tickets"
              />
              <ConfigToggle
                configKey="deleteOnClose"
                config={config}
                onChange={onChange}
                label="Delete on Close"
                description="Delete ticket channel immediately after closure"
              />
              <ConfigNumberField
                configKey="closeDelay"
                config={config}
                onChange={onChange}
                label="Close Delay (seconds)"
                placeholder="5"
              />
              <ConfigChannelPicker
                configKey="logChannelId"
                config={config}
                onChange={onChange}
                channels={channels}
                label="Log Channel"
              />
            </ConfigSection>
          </ConfigGrid>
        </>
      );

    case 'music':
      return (
        <>
          <ConfigGrid cols={3}>
            <ConfigSection title="DJ System" icon="🎤">
              <ConfigToggle
                configKey="djEnabled"
                config={config}
                onChange={onChange}
                label="DJ Enabled"
                description="Restrict music commands to users with the DJ role"
              />
              <ConfigRolePicker
                configKey="djRoleId"
                config={config}
                onChange={onChange}
                roles={roles}
                label="DJ Role"
              />
            </ConfigSection>
            <ConfigSection title="Playback" icon="▶️">
              <ConfigNumberField
                configKey="defaultVolume"
                config={config}
                onChange={onChange}
                label="Default Volume"
                placeholder="50"
              />
              <ConfigNumberField
                configKey="maxVolume"
                config={config}
                onChange={onChange}
                label="Max Volume"
                placeholder="100"
              />
              <ConfigNumberField
                configKey="maxQueueSize"
                config={config}
                onChange={onChange}
                label="Max Queue Size"
                placeholder="100"
              />
              <ConfigNumberField
                configKey="maxSongDuration"
                config={config}
                onChange={onChange}
                label="Max Song Duration (seconds)"
                placeholder="3600"
              />
            </ConfigSection>
          </ConfigGrid>
          <ConfigGrid cols={3}>
            <ConfigSection title="Vote Skip" icon="🗳️">
              <ConfigToggle
                configKey="voteSkipEnabled"
                config={config}
                onChange={onChange}
                label="Vote Skip Enabled"
                description="Allow users to vote to skip songs"
              />
              <ConfigNumberField
                configKey="voteSkipPercent"
                config={config}
                onChange={onChange}
                label="Vote Skip Percent"
                placeholder="50"
              />
            </ConfigSection>
            <ConfigSection title="Behavior" icon="⚙️">
              <ConfigToggle
                configKey="autoplayEnabled"
                config={config}
                onChange={onChange}
                label="Autoplay Enabled"
                description="Continue playing similar songs after queue ends"
              />
              <ConfigToggle
                configKey="twentyFourSevenEnabled"
                config={config}
                onChange={onChange}
                label="24/7 Enabled"
                description="Keep the bot playing music at all times"
              />
              <ConfigChannelPicker
                configKey="twentyFourSevenChannelId"
                config={config}
                onChange={onChange}
                channels={channels}
                label="24/7 Channel"
                voiceOnly
              />
              <ConfigToggle
                configKey="announceNowPlaying"
                config={config}
                onChange={onChange}
                label="Announce Now Playing"
                description="Post a message when a new song starts playing"
              />
              <ConfigToggle
                configKey="leaveOnEmpty"
                config={config}
                onChange={onChange}
                label="Leave on Empty"
                description="Bot leaves voice channel when queue is empty"
              />
              <ConfigNumberField
                configKey="leaveOnEmptyDelay"
                config={config}
                onChange={onChange}
                label="Leave Delay (seconds)"
                placeholder="30"
              />
            </ConfigSection>
          </ConfigGrid>
        </>
      );

    case 'currency':
      return (
        <>
          <ConfigGrid cols={3}>
            <ConfigSection title="Transfer Limits" icon="💰">
              <ConfigNumberField
                configKey="sendCap"
                config={config}
                onChange={onChange}
                label="Send Cap"
                placeholder="1000000"
              />
              <ConfigNumberField
                configKey="receiveCap"
                config={config}
                onChange={onChange}
                label="Receive Cap"
                placeholder="5000000"
              />
              <ConfigNumberField
                configKey="taxPercent"
                config={config}
                onChange={onChange}
                label="Tax Percent"
                placeholder="5"
              />
            </ConfigSection>
            <ConfigSection title="Earning" icon="📈">
              <ConfigNumberField
                configKey="streakBonusMultiplier"
                config={config}
                onChange={onChange}
                label="Streak Bonus Multiplier"
                placeholder="1.1"
              />
              <ConfigNumberField
                configKey="streakMaxMultiplier"
                config={config}
                onChange={onChange}
                label="Streak Max Multiplier"
                placeholder="3"
              />
            </ConfigSection>
          </ConfigGrid>
          <ConfigGrid cols={3}>
            <ConfigSection title="Banking" icon="🏦">
              <ConfigToggle
                configKey="banking"
                config={config}
                onChange={onChange}
                label="Banking Enabled"
                description="Allow users to deposit and withdraw currency"
              />
              <ConfigToggle
                configKey="savings"
                config={config}
                onChange={onChange}
                label="Savings Enabled"
                description="Allow users to earn interest on savings"
              />
              <ConfigToggle
                configKey="robbery"
                config={config}
                onChange={onChange}
                label="Robbery Enabled"
                description="Allow users to rob currency from each other"
              />
              <ConfigNumberField
                configKey="robChance"
                config={config}
                onChange={onChange}
                label="Rob Chance (%)"
                placeholder="30"
              />
            </ConfigSection>
            <ConfigSection title="Earning Options" icon="💵">
              <ConfigToggle
                configKey="earning"
                config={config}
                onChange={onChange}
                label="Earning Enabled"
                description="Give users monthly currency rewards"
              />
              <ConfigNumberField
                configKey="monthlyAmount"
                config={config}
                onChange={onChange}
                label="Monthly Amount"
                placeholder="1000"
              />
              <ConfigNumberField
                configKey="monthlyGems"
                config={config}
                onChange={onChange}
                label="Monthly Gems"
                placeholder="50"
              />
            </ConfigSection>
          </ConfigGrid>
          <ConfigSection title="Jobs" icon="💼">
            <ConfigToggle
              configKey="jobs"
              config={config}
              onChange={onChange}
              label="Jobs Enabled"
              description="Allow users to complete jobs for currency"
            />
            <ConfigToggle
              configKey="jobSlacking"
              config={config}
              onChange={onChange}
              label="Job Slacking Enabled"
              description="Punish users for not doing their job"
            />
            <ConfigNumberField
              configKey="slackingThreshold"
              config={config}
              onChange={onChange}
              label="Slacking Threshold"
              placeholder="3"
            />
            <ConfigNumberField
              configKey="jailDuration"
              config={config}
              onChange={onChange}
              label="Jail Duration (seconds)"
              placeholder="300"
            />
          </ConfigSection>
        </>
      );

    case 'antiraid':
      return (
        <>
          <ConfigGrid cols={3}>
            <ConfigSection title="Detection" icon="🛡️">
              <ConfigNumberField
                configKey="joinThreshold"
                config={config}
                onChange={onChange}
                label="Join Threshold"
                placeholder="5"
              />
              <ConfigNumberField
                configKey="joinWindow"
                config={config}
                onChange={onChange}
                label="Join Window (seconds)"
                placeholder="10"
              />
              <ConfigNumberField
                configKey="minAccountAge"
                config={config}
                onChange={onChange}
                label="Min Account Age (days)"
                placeholder="1"
              />
            </ConfigSection>
            <ConfigSection title="Response" icon="⚠️">
              <ConfigToggle
                configKey="autoLockdown"
                config={config}
                onChange={onChange}
                label="Auto Lockdown"
                description="Automatically lock server during raid detection"
              />
              <ConfigNumberField
                configKey="lockdownDuration"
                config={config}
                onChange={onChange}
                label="Lockdown Duration (seconds)"
                placeholder="600"
              />
              <ConfigPicker
                configKey="action"
                config={config}
                onChange={onChange}
                options={[
                  { value: 'kick', label: 'Kick' },
                  { value: 'ban', label: 'Ban' },
                  { value: 'quarantine', label: 'Quarantine' },
                  { value: 'alert', label: 'Alert' },
                ]}
                label="Action"
              />
              <ConfigChannelPicker
                configKey="alertChannelId"
                config={config}
                onChange={onChange}
                channels={channels}
                label="Alert Channel"
              />
              <ConfigRolePicker
                configKey="quarantineRoleId"
                config={config}
                onChange={onChange}
                roles={roles}
                label="Quarantine Role"
              />
            </ConfigSection>
          </ConfigGrid>
          <ConfigSection title="Verification" icon="✅">
            <ConfigToggle
              configKey="verificationEnabled"
              config={config}
              onChange={onChange}
              label="Verification Enabled"
              description="Require users to verify before joining during raids"
            />
            <ConfigTextField
              configKey="verificationMessage"
              config={config}
              onChange={onChange}
              label="Verification Message"
              description="Message shown to new users during verification"
              placeholder="Please verify..."
              multiline
            />
          </ConfigSection>
        </>
      );

    case 'logging':
      return (
        <>
          <ConfigGrid cols={3}>
            <ConfigSection title="Message Logging" icon="💬">
              <ConfigToggle
                configKey="categories.message.enabled"
                config={config}
                onChange={onChange}
                label="Message Logging"
                description="Log message edits, deletes, and bulk deletes"
              />
              <ConfigChannelPicker
                configKey="categories.message.channelId"
                config={config}
                onChange={onChange}
                channels={channels}
                label="Message Log Channel"
              />
              <ConfigToggle
                configKey="categories.message.logEdits"
                config={config}
                onChange={onChange}
                label="Log Edits"
                description="Log when messages are edited"
              />
              <ConfigToggle
                configKey="categories.message.logDeletes"
                config={config}
                onChange={onChange}
                label="Log Deletes"
                description="Log when messages are deleted"
              />
              <ConfigToggle
                configKey="categories.message.logBulkDeletes"
                config={config}
                onChange={onChange}
                label="Log Bulk Deletes"
                description="Log when messages are purged in bulk"
              />
            </ConfigSection>
            <ConfigSection title="User Logging" icon="👤">
              <ConfigToggle
                configKey="categories.user.enabled"
                config={config}
                onChange={onChange}
                label="User Logging"
                description="Log joins, leaves, bans, and profile changes"
              />
              <ConfigChannelPicker
                configKey="categories.user.channelId"
                config={config}
                onChange={onChange}
                channels={channels}
                label="User Log Channel"
              />
              <ConfigToggle
                configKey="categories.user.logJoins"
                config={config}
                onChange={onChange}
                label="Log Joins"
                description="Log when members join the server"
              />
              <ConfigToggle
                configKey="categories.user.logLeaves"
                config={config}
                onChange={onChange}
                label="Log Leaves"
                description="Log when members leave the server"
              />
              <ConfigToggle
                configKey="categories.user.logNameChanges"
                config={config}
                onChange={onChange}
                label="Log Name Changes"
                description="Log nickname and username changes"
              />
              <ConfigToggle
                configKey="categories.user.logRoleChanges"
                config={config}
                onChange={onChange}
                label="Log Role Changes"
                description="Log when member roles are updated"
              />
            </ConfigSection>
            <ConfigSection title="Moderation Logging" icon="🔨">
              <ConfigToggle
                configKey="categories.moderation.enabled"
                config={config}
                onChange={onChange}
                label="Moderation Logging"
                description="Log bans, kicks, mutes, and warns"
              />
              <ConfigChannelPicker
                configKey="categories.moderation.channelId"
                config={config}
                onChange={onChange}
                channels={channels}
                label="Moderation Log Channel"
              />
              <ConfigToggle
                configKey="categories.moderation.logBans"
                config={config}
                onChange={onChange}
                label="Log Bans"
                description="Log ban and unban actions"
              />
              <ConfigToggle
                configKey="categories.moderation.logKicks"
                config={config}
                onChange={onChange}
                label="Log Kicks"
                description="Log kick actions"
              />
              <ConfigToggle
                configKey="categories.moderation.logMutes"
                config={config}
                onChange={onChange}
                label="Log Mutes"
                description="Log mute and timeout actions"
              />
              <ConfigToggle
                configKey="categories.moderation.logWarns"
                config={config}
                onChange={onChange}
                label="Log Warns"
                description="Log warning actions"
              />
            </ConfigSection>
          </ConfigGrid>
          <ConfigGrid cols={3}>
            <ConfigSection title="Channel Logging" icon="#️⃣">
              <ConfigToggle
                configKey="categories.channel.enabled"
                config={config}
                onChange={onChange}
                label="Channel Logging"
                description="Log channel creates, deletes, and updates"
              />
              <ConfigChannelPicker
                configKey="categories.channel.channelId"
                config={config}
                onChange={onChange}
                channels={channels}
                label="Channel Log Channel"
              />
              <ConfigToggle
                configKey="categories.channel.logCreates"
                config={config}
                onChange={onChange}
                label="Log Creates"
                description="Log when channels are created"
              />
              <ConfigToggle
                configKey="categories.channel.logDeletes"
                config={config}
                onChange={onChange}
                label="Log Deletes"
                description="Log when channels are deleted"
              />
              <ConfigToggle
                configKey="categories.channel.logUpdates"
                config={config}
                onChange={onChange}
                label="Log Updates"
                description="Log channel permission and setting changes"
              />
            </ConfigSection>
            <ConfigSection title="Role Logging" icon="🛡️">
              <ConfigToggle
                configKey="categories.role.enabled"
                config={config}
                onChange={onChange}
                label="Role Logging"
                description="Log role creates, deletes, and updates"
              />
              <ConfigChannelPicker
                configKey="categories.role.channelId"
                config={config}
                onChange={onChange}
                channels={channels}
                label="Role Log Channel"
              />
              <ConfigToggle
                configKey="categories.role.logCreates"
                config={config}
                onChange={onChange}
                label="Log Creates"
                description="Log when roles are created"
              />
              <ConfigToggle
                configKey="categories.role.logDeletes"
                config={config}
                onChange={onChange}
                label="Log Deletes"
                description="Log when roles are deleted"
              />
              <ConfigToggle
                configKey="categories.role.logUpdates"
                config={config}
                onChange={onChange}
                label="Log Updates"
                description="Log role permission and setting changes"
              />
            </ConfigSection>
            <ConfigSection title="Voice Logging" icon="🎙️">
              <ConfigToggle
                configKey="categories.voice.enabled"
                config={config}
                onChange={onChange}
                label="Voice Logging"
                description="Log voice channel joins, leaves, and moves"
              />
              <ConfigChannelPicker
                configKey="categories.voice.channelId"
                config={config}
                onChange={onChange}
                channels={channels}
                label="Voice Log Channel"
              />
              <ConfigToggle
                configKey="categories.voice.logJoins"
                config={config}
                onChange={onChange}
                label="Log Joins"
                description="Log when members join voice channels"
              />
              <ConfigToggle
                configKey="categories.voice.logLeaves"
                config={config}
                onChange={onChange}
                label="Log Leaves"
                description="Log when members leave voice channels"
              />
              <ConfigToggle
                configKey="categories.voice.logMoves"
                config={config}
                onChange={onChange}
                label="Log Moves"
                description="Log when members switch voice channels"
              />
            </ConfigSection>
          </ConfigGrid>
          <ConfigGrid cols={3}>
            <ConfigSection title="Server Logging" icon="⚙️">
              <ConfigToggle
                configKey="categories.server.enabled"
                config={config}
                onChange={onChange}
                label="Server Logging"
                description="Log server setting and emoji changes"
              />
              <ConfigChannelPicker
                configKey="categories.server.channelId"
                config={config}
                onChange={onChange}
                channels={channels}
                label="Server Log Channel"
              />
              <ConfigToggle
                configKey="categories.server.logSettings"
                config={config}
                onChange={onChange}
                label="Log Settings"
                description="Log server setting changes"
              />
              <ConfigToggle
                configKey="categories.server.logEmojis"
                config={config}
                onChange={onChange}
                label="Log Emojis"
                description="Log emoji and sticker changes"
              />
            </ConfigSection>
            <ConfigSection title="AutoMod Logging" icon="🤖">
              <ConfigToggle
                configKey="categories.automod.enabled"
                config={config}
                onChange={onChange}
                label="AutoMod Logging"
                description="Log automod actions and violations"
              />
              <ConfigChannelPicker
                configKey="categories.automod.channelId"
                config={config}
                onChange={onChange}
                channels={channels}
                label="AutoMod Log Channel"
              />
            </ConfigSection>
            <ConfigSection title="Default Fallback" icon="📝">
              <ConfigChannelPicker
                configKey="defaultChannelId"
                config={config}
                onChange={onChange}
                channels={channels}
                label="Default Log Channel"
              />
              <ConfigToggle
                configKey="logBotActions"
                config={config}
                onChange={onChange}
                label="Log Bot Actions"
                description="Include actions taken by bots in logs"
              />
              <ConfigToggle
                configKey="includeThumbnails"
                config={config}
                onChange={onChange}
                label="Include Thumbnails"
                description="Show user avatars in log embeds"
              />
            </ConfigSection>
          </ConfigGrid>
        </>
      );

    case 'activitytracking':
      return (
        <>
          <ConfigGrid cols={3}>
            <ConfigSection title="Tracking" icon="📊">
              <ConfigToggle
                configKey="trackMessages"
                config={config}
                onChange={onChange}
                label="Track Messages"
                description="Track message activity per user"
              />
              <ConfigToggle
                configKey="trackVoice"
                config={config}
                onChange={onChange}
                label="Track Voice"
                description="Track voice channel activity per user"
              />
              <ConfigToggle
                configKey="trackReactions"
                config={config}
                onChange={onChange}
                label="Track Reactions"
                description="Track emoji reactions per user"
              />
            </ConfigSection>
            <ConfigSection title="Behavior" icon="⚙️">
              <ConfigNumberField
                configKey="inactiveThresholdDays"
                config={config}
                onChange={onChange}
                label="Inactive Threshold (days)"
                placeholder="30"
              />
              <ConfigNumberField
                configKey="leaderboardSize"
                config={config}
                onChange={onChange}
                label="Leaderboard Size"
                placeholder="10"
              />
              <ConfigToggle
                configKey="resetOnLeave"
                config={config}
                onChange={onChange}
                label="Reset on Leave"
                description="Reset user activity when they leave"
              />
              <ConfigChannelPicker
                configKey="logChannelId"
                config={config}
                onChange={onChange}
                channels={channels}
                label="Log Channel"
              />
            </ConfigSection>
          </ConfigGrid>
        </>
      );

    case 'aichatbot':
      return (
        <>
          <ConfigGrid cols={3}>
            <ConfigSection title="AI Provider" icon="🧠">
              <ConfigPicker
                configKey="provider"
                config={config}
                onChange={onChange}
                options={[
                  { value: 'groq', label: 'Groq' },
                  { value: 'gemini', label: 'Gemini' },
                  { value: 'openai', label: 'OpenAI' },
                  { value: 'anthropic', label: 'Anthropic' },
                ]}
                label="Provider"
              />
              <ConfigTextField
                configKey="model"
                config={config}
                onChange={onChange}
                label="Model"
                description="The AI model to use for this provider"
                placeholder="llama-3.3-70b-versatile"
              />
              <ConfigTextField
                configKey="apiKey"
                config={config}
                onChange={onChange}
                label="API Key"
                description="API key for the AI provider (encrypted)"
                placeholder="Encrypted on save"
              />
              <ConfigNumberField
                configKey="maxTokens"
                config={config}
                onChange={onChange}
                label="Max Tokens"
                placeholder="1000"
              />
              <ConfigPicker
                configKey="temperature"
                config={config}
                onChange={onChange}
                options={[
                  { value: '0', label: '0 (Deterministic)' },
                  { value: '0.3', label: '0.3' },
                  { value: '0.5', label: '0.5' },
                  { value: '0.7', label: '0.7' },
                  { value: '1.0', label: '1.0' },
                  { value: '1.5', label: '1.5 (Creative)' },
                ]}
                label="Temperature"
              />
            </ConfigSection>
            <ConfigSection title="Agent System" icon="🤖">
              <ConfigToggle
                configKey="agentEnabled"
                config={config}
                onChange={onChange}
                label="Agent Enabled"
                description="Enable AI to use tools and take actions"
              />
              <ConfigToggle
                configKey="confirmDestructive"
                config={config}
                onChange={onChange}
                label="Confirm Destructive Actions"
                description="Require confirmation for delete/ban actions"
              />
              <ConfigNumberField
                configKey="maxToolCalls"
                config={config}
                onChange={onChange}
                label="Max Tool Calls"
                placeholder="10"
              />
            </ConfigSection>
          </ConfigGrid>
          <ConfigGrid cols={3}>
            <ConfigSection title="Activation" icon="💬">
              <ConfigTextField
                configKey="triggerPhrase"
                config={config}
                onChange={onChange}
                label="Trigger Phrase"
                description="Phrase that triggers the AI to respond"
                placeholder="hey nexus"
              />
              <ConfigToggle
                configKey="autoReply"
                config={config}
                onChange={onChange}
                label="Auto Reply"
                description="AI responds to all messages automatically"
              />
              <ConfigToggle
                configKey="mentionReply"
                config={config}
                onChange={onChange}
                label="Reply to Mentions"
                description="AI responds when mentioned"
              />
            </ConfigSection>
            <ConfigSection title="Usage Limits" icon="⏱️">
              <ConfigNumberField
                configKey="cooldown"
                config={config}
                onChange={onChange}
                label="Cooldown (seconds)"
                placeholder="5"
              />
              <ConfigNumberField
                configKey="maxHistory"
                config={config}
                onChange={onChange}
                label="Max History"
                placeholder="10"
              />
            </ConfigSection>
          </ConfigGrid>
        </>
      );

    case 'stickymessages':
      return (
        <>
          <ConfigGrid cols={3}>
          <ConfigSection title="General" icon="📌">
            <ConfigPicker
              configKey="mode"
              config={config}
              onChange={onChange}
              options={[
                { value: 'edit', label: 'Edit' },
                { value: 'resend', label: 'Resend' },
              ]}
              label="Mode"
            />
            <ConfigNumberField
              configKey="maxStickiesPerChannel"
              config={config}
              onChange={onChange}
              label="Max Stickies per Channel"
              placeholder="5"
            />
            <ConfigToggle
              configKey="deleteBotMessage"
              config={config}
              onChange={onChange}
              label="Delete Bot Message"
              description="Delete messages after bumping sticky to top"
            />
          </ConfigSection>
          </ConfigGrid>
        </>
      );

    case 'counting':
      return (
        <>
          <ConfigGrid cols={3}>
            <ConfigSection title="General" icon="🔢">
              <ConfigChannelPicker
                configKey="channelId"
                config={config}
                onChange={onChange}
                channels={channels}
                label="Counting Channel"
              />
              <ConfigToggle
                configKey="mathMode"
                config={config}
                onChange={onChange}
                label="Math Mode"
                description="Users must solve math equations instead of counting"
              />
              <ConfigToggle
                configKey="allowDoubleCount"
                config={config}
                onChange={onChange}
                label="Allow Double Count"
                description="The same user can count twice in a row"
              />
            </ConfigSection>
            <ConfigSection title="Behavior" icon="⚙️">
              <ConfigToggle
                configKey="deleteWrongNumbers"
                config={config}
                onChange={onChange}
                label="Delete Wrong Numbers"
                description="Delete messages with incorrect numbers"
              />
              <ConfigToggle
                configKey="resetOnWrong"
                config={config}
                onChange={onChange}
                label="Reset on Wrong"
                description="Reset count to 0 when wrong number is sent"
              />
              <ConfigToggle
                configKey="reactOnCorrect"
                config={config}
                onChange={onChange}
                label="React on Correct"
                description="Add a reaction when correct number is counted"
              />
            </ConfigSection>
          </ConfigGrid>
          <ConfigGrid cols={3}>
            <ConfigSection title="Milestones" icon="🏁">
              <ConfigToggle
                configKey="notifyOnMilestone"
                config={config}
                onChange={onChange}
                label="Notify on Milestone"
                description="Send a message when milestone is reached"
              />
              <ConfigNumberField
                configKey="milestoneInterval"
                config={config}
                onChange={onChange}
                label="Milestone Interval"
                placeholder="100"
              />
            </ConfigSection>
            <ConfigSection title="Extra" icon="💜">
              <ConfigToggle
                configKey="livesEnabled"
                config={config}
                onChange={onChange}
                label="Lives Enabled"
                description="Users have limited lives before being removed"
              />
              <ConfigToggle
                configKey="globalLeaderboardEnabled"
                config={config}
                onChange={onChange}
                label="Global Leaderboard Enabled"
                description="Track counting stats across all servers"
              />
            </ConfigSection>
          </ConfigGrid>
        </>
      );

    case 'customcommands':
      return (
        <>
          <ConfigGrid cols={3}>
          <ConfigSection title="General" icon="⚙️">
            <ConfigTextField
              configKey="prefix"
              config={config}
              onChange={onChange}
              label="Prefix"
              description="Character(s) that trigger custom commands"
              placeholder="!"
            />
            <ConfigNumberField
              configKey="maxCommands"
              config={config}
              onChange={onChange}
              label="Max Commands"
              placeholder="50"
            />
            <ConfigToggle
              configKey="allowSlash"
              config={config}
              onChange={onChange}
              label="Allow Slash Commands"
              description="Allow custom commands to be used as slash commands"
            />
          </ConfigSection>
          </ConfigGrid>
        </>
      );

    case 'forms':
      return (
        <>
          <ConfigGrid cols={3}>
          <ConfigSection title="General" icon="📋">
            <ConfigToggle
              configKey="requireApproval"
              config={config}
              onChange={onChange}
              label="Require Approval"
              description="Staff must approve forms before they're published"
            />
            <ConfigChannelPicker
              configKey="notificationChannelId"
              config={config}
              onChange={onChange}
              channels={channels}
              label="Notification Channel"
            />
          </ConfigSection>
          </ConfigGrid>
        </>
      );

    case 'autoroles':
      return (
        <>
          <ConfigGrid cols={3}>
          <ConfigSection title="General" icon="🎭">
            <ConfigToggle
              configKey="persistentRoles"
              config={config}
              onChange={onChange}
              label="Persistent Roles"
              description="Restore roles when users rejoin after leaving"
            />
            <ConfigToggle
              configKey="ignoreBots"
              config={config}
              onChange={onChange}
              label="Ignore Bots"
              description="Do not assign autoroles to bot accounts"
            />
            <ConfigToggle
              configKey="stackRoles"
              config={config}
              onChange={onChange}
              label="Stack Roles"
              description="Users keep all roles instead of only highest"
            />
            <ConfigChannelPicker
              configKey="logChannelId"
              config={config}
              onChange={onChange}
              channels={channels}
              label="Log Channel"
            />
          </ConfigSection>
          </ConfigGrid>
        </>
      );

    case 'translation':
      return (
        <>
          <ConfigGrid cols={3}>
            <ConfigSection title="Provider" icon="🌍">
              <ConfigPicker
                configKey="provider"
                config={config}
                onChange={onChange}
                options={[
                  { value: 'google', label: 'Google' },
                  { value: 'libre', label: 'Libre Translate' },
                ]}
                label="Provider"
              />
              <ConfigTextField
                configKey="libreUrl"
                config={config}
                onChange={onChange}
                label="Libre URL"
                description="URL for Libre Translate instance (if using Libre)"
                placeholder="https://..."
              />
            </ConfigSection>
            <ConfigSection title="Behavior" icon="⚙️">
              <ConfigToggle
                configKey="flagReactions"
                config={config}
                onChange={onChange}
                label="Flag Reactions"
                description="Users react with flag emoji to request translation"
              />
              <ConfigToggle
                configKey="useWebhooks"
                config={config}
                onChange={onChange}
                label="Use Webhooks"
                description="Use webhooks to preserve original author name"
              />
              <ConfigTextField
                configKey="defaultLanguage"
                config={config}
                onChange={onChange}
                label="Default Language"
                description="Language code for translation target"
                placeholder="en"
              />
              <ConfigNumberField
                configKey="userCooldown"
                config={config}
                onChange={onChange}
                label="User Cooldown (seconds)"
                placeholder="5"
              />
            </ConfigSection>
          </ConfigGrid>
        </>
      );

    case 'reactionroles':
      return (
        <>
          <ConfigGrid cols={3}>
          <ConfigSection title="Defaults" icon="🎯">
            <ConfigPicker
              configKey="defaultMode"
              config={config}
              onChange={onChange}
              options={[
                { value: 'toggle', label: 'Toggle' },
                { value: 'add', label: 'Add' },
                { value: 'remove', label: 'Remove' },
              ]}
              label="Default Mode"
            />
            <ConfigPicker
              configKey="defaultType"
              config={config}
              onChange={onChange}
              options={[
                { value: 'reaction', label: 'Reaction' },
                { value: 'button', label: 'Button' },
              ]}
              label="Default Type"
            />
            <ConfigToggle
              configKey="dmConfirmation"
              config={config}
              onChange={onChange}
              label="DM Confirmation"
              description="Send confirmation DM when user gets role"
            />
            <ConfigChannelPicker
              configKey="logChannelId"
              config={config}
              onChange={onChange}
              channels={channels}
              label="Log Channel"
            />
          </ConfigSection>
          </ConfigGrid>
        </>
      );

    case 'reputation':
      return (
        <>
          <ConfigGrid cols={3}>
            <ConfigSection title="General" icon="⭐">
              <ConfigNumberField
                configKey="defaultRep"
                config={config}
                onChange={onChange}
                label="Default Reputation"
                placeholder="0"
              />
              <ConfigNumberField
                configKey="giveCooldown"
                config={config}
                onChange={onChange}
                label="Give Cooldown (seconds)"
                placeholder="60"
              />
              <ConfigNumberField
                configKey="dailyLimit"
                config={config}
                onChange={onChange}
                label="Daily Limit"
                placeholder="10"
              />
              <ConfigToggle
                configKey="allowNegative"
                config={config}
                onChange={onChange}
                label="Allow Negative"
                description="Users can have negative reputation"
              />
            </ConfigSection>
            <ConfigSection title="Decay" icon="📉">
              <ConfigToggle
                configKey="decayEnabled"
                config={config}
                onChange={onChange}
                label="Decay Enabled"
                description="Reputation decreases over time"
              />
              <ConfigNumberField
                configKey="decayAfterDays"
                config={config}
                onChange={onChange}
                label="Decay After (days)"
                placeholder="30"
              />
              <ConfigNumberField
                configKey="decayAmount"
                config={config}
                onChange={onChange}
                label="Decay Amount"
                placeholder="5"
              />
              <ConfigNumberField
                configKey="decayFloor"
                config={config}
                onChange={onChange}
                label="Decay Floor"
                placeholder="0"
              />
            </ConfigSection>
          </ConfigGrid>
          <ConfigGrid cols={3}>
            <ConfigSection title="Reaction Rep" icon="👍">
              <ConfigToggle
                configKey="reactionRepEnabled"
                config={config}
                onChange={onChange}
                label="Reaction Rep Enabled"
                description="Give reputation based on emoji reactions"
              />
              <ConfigTextField
                configKey="upvoteEmoji"
                config={config}
                onChange={onChange}
                label="Upvote Emoji"
                description="Emoji that gives positive reputation"
                placeholder="👍"
              />
              <ConfigTextField
                configKey="downvoteEmoji"
                config={config}
                onChange={onChange}
                label="Downvote Emoji"
                description="Emoji that gives negative reputation"
                placeholder="👎"
              />
            </ConfigSection>
            <ConfigSection title="Logging" icon="📝">
              <ConfigChannelPicker
                configKey="logChannelId"
                config={config}
                onChange={onChange}
                channels={channels}
                label="Log Channel"
              />
            </ConfigSection>
          </ConfigGrid>
        </>
      );

    case 'shop':
      return (
        <>
          <ConfigGrid cols={3}>
            <ConfigSection title="General" icon="🛒">
              <ConfigPicker
                configKey="currencyType"
                config={config}
                onChange={onChange}
                options={[
                  { value: 'coins', label: 'Coins' },
                  { value: 'gems', label: 'Gems' },
                ]}
                label="Currency Type"
              />
              <ConfigNumberField
                configKey="taxPercent"
                config={config}
                onChange={onChange}
                label="Tax Percent"
                placeholder="10"
              />
              <ConfigNumberField
                configKey="maxItemsPerServer"
                config={config}
                onChange={onChange}
                label="Max Items per Server"
                placeholder="100"
              />
              <ConfigToggle
                configKey="showOutOfStock"
                config={config}
                onChange={onChange}
                label="Show Out of Stock"
                description="Show sold-out items in the shop"
              />
            </ConfigSection>
            <ConfigSection title="Refunds" icon="↩️">
              <ConfigToggle
                configKey="refundsEnabled"
                config={config}
                onChange={onChange}
                label="Refunds Enabled"
                description="Allow users to refund purchased items"
              />
              <ConfigNumberField
                configKey="refundPercent"
                config={config}
                onChange={onChange}
                label="Refund Percent"
                placeholder="75"
              />
            </ConfigSection>
          </ConfigGrid>
          <ConfigSection title="Logging" icon="📝">
            <ConfigChannelPicker
              configKey="logChannelId"
              config={config}
              onChange={onChange}
              channels={channels}
              label="Log Channel"
            />
          </ConfigSection>
        </>
      );

    case 'quoteboard':
      return (
        <>
          <ConfigGrid cols={3}>
          <ConfigSection title="Board Settings" icon="✨">
            <ConfigToggle
              configKey="selfReact"
              config={config}
              onChange={onChange}
              label="Allow Self React"
              description="Users can react to their own messages"
            />
            <ConfigToggle
              configKey="nsfw"
              config={config}
              onChange={onChange}
              label="NSFW Allowed"
              description="Allow NSFW content on the board"
            />
          </ConfigSection>
          </ConfigGrid>
        </>
      );

    case 'confessions':
      return (
        <>
          <ConfigGrid cols={3}>
            <ConfigSection title="General" icon="🗣️">
              <ConfigChannelPicker
                configKey="channelId"
                config={config}
                onChange={onChange}
                channels={channels}
                label="Confessions Channel"
              />
              <ConfigToggle
                configKey="fullAnonymity"
                config={config}
                onChange={onChange}
                label="Full Anonymity"
                description="Hide author even from staff"
              />
              <ConfigNumberField
                configKey="cooldownSeconds"
                config={config}
                onChange={onChange}
                label="Cooldown (seconds)"
                placeholder="60"
              />
              <ConfigToggle
                configKey="allowImages"
                config={config}
                onChange={onChange}
                label="Allow Images"
                description="Allow images in confessions"
              />
            </ConfigSection>
            <ConfigSection title="Moderation" icon="🛡️">
              <ConfigToggle
                configKey="moderationEnabled"
                config={config}
                onChange={onChange}
                label="Moderation Enabled"
                description="Allow staff to approve/reject confessions"
              />
              <ConfigChannelPicker
                configKey="moderationChannelId"
                config={config}
                onChange={onChange}
                channels={channels}
                label="Moderation Channel"
              />
            </ConfigSection>
          </ConfigGrid>
        </>
      );

    case 'fun':
      return (
        <>
          <ConfigGrid cols={3}>
            <ConfigSection title="Gambling" icon="🎲">
              <ConfigToggle
                configKey="gambling"
                config={config}
                onChange={onChange}
                label="Gambling Enabled"
                description="Allow users to gamble currency"
              />
              <ConfigNumberField
                configKey="minBet"
                config={config}
                onChange={onChange}
                label="Min Bet"
                placeholder="10"
              />
              <ConfigNumberField
                configKey="maxBet"
                config={config}
                onChange={onChange}
                label="Max Bet"
                placeholder="10000"
              />
            </ConfigSection>
            <ConfigSection title="Features" icon="✨">
              <ConfigToggle
                configKey="interactionsEnabled"
                config={config}
                onChange={onChange}
                label="Interactions Enabled"
                description="Enable fun interactions (hug, slap, etc)"
              />
              <ConfigToggle
                configKey="gamesEnabled"
                config={config}
                onChange={onChange}
                label="Games Enabled"
                description="Enable mini-games"
              />
              <ConfigToggle
                configKey="gifsEnabled"
                config={config}
                onChange={onChange}
                label="GIFs Enabled"
                description="Send GIFs with fun commands"
              />
              <ConfigNumberField
                configKey="globalCooldown"
                config={config}
                onChange={onChange}
                label="Global Cooldown (seconds)"
                placeholder="3"
              />
            </ConfigSection>
          </ConfigGrid>
        </>
      );

    case 'afk':
      return (
        <>
          <ConfigGrid cols={3}>
            <ConfigSection title="General" icon="💤">
              <ConfigNumberField
                configKey="maxMessageLength"
                config={config}
                onChange={onChange}
                label="Max Message Length"
                placeholder="500"
              />
              <ConfigToggle
                configKey="dmPingsOnReturn"
                config={config}
                onChange={onChange}
                label="DM Pings on Return"
                description="Send DM with list of pings when user returns"
              />
              <ConfigNumberField
                configKey="maxPingsToTrack"
                config={config}
                onChange={onChange}
                label="Max Pings to Track"
                placeholder="10"
              />
              <ConfigToggle
                configKey="autoRemoveOnMessage"
                config={config}
                onChange={onChange}
                label="Auto Remove on Message"
                description="Remove AFK status when user sends a message"
              />
              <ConfigChannelPicker
                configKey="logChannelId"
                config={config}
                onChange={onChange}
                channels={channels}
                label="Log Channel"
              />
            </ConfigSection>
          </ConfigGrid>
        </>
      );

    case 'polls':
      return (
        <>
          <ConfigGrid cols={3}>
          <ConfigSection title="Defaults" icon="📊">
            <ConfigToggle
              configKey="defaultAnonymous"
              config={config}
              onChange={onChange}
              label="Default Anonymous"
              description="Polls are anonymous by default"
            />
            <ConfigToggle
              configKey="defaultShowLiveResults"
              config={config}
              onChange={onChange}
              label="Default Show Live Results"
              description="Show results as users vote"
            />
            <ConfigNumberField
              configKey="defaultMaxVotes"
              config={config}
              onChange={onChange}
              label="Default Max Votes"
              placeholder="1"
            />
            <ConfigNumberField
              configKey="maxOptions"
              config={config}
              onChange={onChange}
              label="Max Options"
              placeholder="10"
            />
            <ConfigNumberField
              configKey="maxDuration"
              config={config}
              onChange={onChange}
              label="Max Duration (hours)"
              placeholder="24"
            />
          </ConfigSection>
          </ConfigGrid>
        </>
      );

    case 'birthdays':
      return (
        <>
          <ConfigGrid cols={3}>
            <ConfigSection title="General" icon="🎂">
              <ConfigChannelPicker
                configKey="channelId"
                config={config}
                onChange={onChange}
                channels={channels}
                label="Birthday Channel"
              />
              <ConfigRolePicker
                configKey="roleId"
                config={config}
                onChange={onChange}
                roles={roles}
                label="Birthday Role"
              />
              <ConfigTextField
                configKey="timezone"
                config={config}
                onChange={onChange}
                label="Timezone"
                description="Timezone for birthday calculations (e.g., UTC, EST, PST)"
                placeholder="UTC"
              />
            </ConfigSection>
            <ConfigSection title="Notifications" icon="🔔">
              <ConfigToggle
                configKey="dmNotification"
                config={config}
                onChange={onChange}
                label="DM Notification"
                description="Send DM notification on birthday"
              />
              <ConfigToggle
                configKey="showAge"
                config={config}
                onChange={onChange}
                label="Show Age"
                description="Show age calculation in announcements"
              />
              <ConfigToggle
                configKey="allowHideYear"
                config={config}
                onChange={onChange}
                label="Allow Hide Year"
                description="Let users hide their birth year"
              />
              <ConfigTextField
                configKey="announcementMessage"
                config={config}
                onChange={onChange}
                label="Announcement Message"
                description="Message template. Use {user}, {age} as variables"
                placeholder="Happy birthday {user}!"
                multiline
              />
            </ConfigSection>
          </ConfigGrid>
        </>
      );

    case 'messagetracking':
      return (
        <>
          <ConfigGrid cols={3}>
            <ConfigSection title="Events" icon="🔍">
              <ConfigToggle
                configKey="logEdits"
                config={config}
                onChange={onChange}
                label="Log Edits"
                description="Log when messages are edited"
              />
              <ConfigToggle
                configKey="logDeletes"
                config={config}
                onChange={onChange}
                label="Log Deletes"
                description="Log when messages are deleted"
              />
              <ConfigToggle
                configKey="logBulkDeletes"
                config={config}
                onChange={onChange}
                label="Log Bulk Deletes"
                description="Log bulk message deletions"
              />
              <ConfigToggle
                configKey="ghostPingAlert"
                config={config}
                onChange={onChange}
                label="Ghost Ping Alert"
                description="Alert when ping is removed before seen"
              />
            </ConfigSection>
            <ConfigSection title="Snipe" icon="👁️">
              <ConfigToggle
                configKey="snipeEnabled"
                config={config}
                onChange={onChange}
                label="Snipe Enabled"
                description="Allow users to view recently deleted messages"
              />
              <ConfigNumberField
                configKey="snipeTimeout"
                config={config}
                onChange={onChange}
                label="Snipe Timeout (seconds)"
                placeholder="300"
              />
            </ConfigSection>
          </ConfigGrid>
          <ConfigSection title="Logging" icon="📝">
            <ConfigChannelPicker
              configKey="logChannelId"
              config={config}
              onChange={onChange}
              channels={channels}
              label="Log Channel"
            />
            <ConfigToggle
              configKey="ignoreBots"
              config={config}
              onChange={onChange}
              label="Ignore Bots"
              description="Don't track bot message changes"
            />
          </ConfigSection>
        </>
      );

    case 'giveaways':
      return (
        <>
          <ConfigGrid cols={3}>
            <ConfigSection title="General" icon="🎁">
              <ConfigChannelPicker
                configKey="defaultChannel"
                config={config}
                onChange={onChange}
                channels={channels}
                label="Default Channel"
              />
              <ConfigTextField
                configKey="reactionEmoji"
                config={config}
                onChange={onChange}
                label="Reaction Emoji"
                description="Emoji users react with to enter giveaway"
                placeholder="🎉"
              />
              <ConfigToggle
                configKey="buttonMode"
                config={config}
                onChange={onChange}
                label="Button Mode"
                description="Use buttons instead of reactions"
              />
              <ConfigToggle
                configKey="dmWinners"
                config={config}
                onChange={onChange}
                label="DM Winners"
                description="Send winner notification via DM"
              />
              <ConfigToggle
                configKey="allowSelfEntry"
                config={config}
                onChange={onChange}
                label="Allow Self Entry"
                description="Allow creators to enter their own giveaway"
              />
              <ConfigNumberField
                configKey="maxActive"
                config={config}
                onChange={onChange}
                label="Max Active"
                placeholder="5"
              />
            </ConfigSection>
            <ConfigSection title="Appearance" icon="🎨">
              <ConfigRolePicker
                configKey="pingRole"
                config={config}
                onChange={onChange}
                roles={roles}
                label="Ping Role"
              />
              <ConfigPicker
                configKey="endAction"
                config={config}
                onChange={onChange}
                options={[
                  { value: 'edit', label: 'Edit' },
                  { value: 'new', label: 'New' },
                ]}
                label="End Action"
              />
            </ConfigSection>
          </ConfigGrid>
        </>
      );

    case 'colorroles':
      return (
        <>
          <ConfigGrid cols={3}>
            <ConfigSection title="General" icon="🌈">
              <ConfigChannelPicker
                configKey="commandChannelId"
                config={config}
                onChange={onChange}
                channels={channels}
                label="Command Channel"
              />
              <ConfigTextField
                configKey="joinColor"
                config={config}
                onChange={onChange}
                label="Join Color"
                description="Default color assigned to new members (hex)"
                placeholder="#FFFFFF"
              />
              <ConfigNumberField
                configKey="maxColors"
                config={config}
                onChange={onChange}
                label="Max Colors"
                placeholder="10"
              />
            </ConfigSection>
            <ConfigSection title="Behavior" icon="⚙️">
              <ConfigToggle
                configKey="deleteResponses"
                config={config}
                onChange={onChange}
                label="Delete Responses"
                description="Delete bot responses after user changes color"
              />
              <ConfigNumberField
                configKey="deleteResponseDelay"
                config={config}
                onChange={onChange}
                label="Delete Delay (seconds)"
                placeholder="5"
              />
              <ConfigToggle
                configKey="overlapWarning"
                config={config}
                onChange={onChange}
                label="Overlap Warning"
                description="Warn users when colors overlap too much"
              />
              <ConfigNumberField
                configKey="overlapThreshold"
                config={config}
                onChange={onChange}
                label="Overlap Threshold (%)"
                placeholder="20"
              />
            </ConfigSection>
          </ConfigGrid>
          <ConfigSection title="Whitelist" icon="✅">
            <ConfigToggle
              configKey="whitelistEnabled"
              config={config}
              onChange={onChange}
              label="Whitelist Enabled"
              description="Only allow certain color hex codes"
            />
          </ConfigSection>
        </>
      );

    case 'invitetracker':
      return (
        <>
          <ConfigGrid cols={3}>
            <ConfigSection title="Tracking" icon="🔗">
              <ConfigToggle
                configKey="trackJoins"
                config={config}
                onChange={onChange}
                label="Track Joins"
                description="Track member join sources"
              />
              <ConfigToggle
                configKey="trackLeaves"
                config={config}
                onChange={onChange}
                label="Track Leaves"
                description="Track when members leave"
              />
              <ConfigToggle
                configKey="trackFakes"
                config={config}
                onChange={onChange}
                label="Track Fakes"
                description="Detect fake invites (accounts that leave quickly)"
              />
              <ConfigNumberField
                configKey="fakeAccountAgeDays"
                config={config}
                onChange={onChange}
                label="Fake Account Age (days)"
                placeholder="7"
              />
              <ConfigNumberField
                configKey="fakeLeaveHours"
                config={config}
                onChange={onChange}
                label="Fake Leave Hours"
                placeholder="24"
              />
            </ConfigSection>
            <ConfigSection title="Announcements" icon="📢">
              <ConfigToggle
                configKey="announceJoins"
                config={config}
                onChange={onChange}
                label="Announce Joins"
                description="Announce when members join via invites"
              />
              <ConfigChannelPicker
                configKey="announceChannelId"
                config={config}
                onChange={onChange}
                channels={channels}
                label="Announce Channel"
              />
              <ConfigChannelPicker
                configKey="logChannelId"
                config={config}
                onChange={onChange}
                channels={channels}
                label="Log Channel"
              />
            </ConfigSection>
          </ConfigGrid>
        </>
      );

    case 'statschannels':
      return (
        <>
          <ConfigGrid cols={3}>
            <ConfigSection title="General" icon="📈">
              <ConfigNumberField
                configKey="updateInterval"
                config={config}
                onChange={onChange}
                label="Update Interval (minutes)"
                placeholder="10"
              />
              <ConfigPicker
                configKey="numberFormat"
                config={config}
                onChange={onChange}
                options={[
                  { value: 'full', label: 'Full' },
                  { value: 'abbreviated', label: 'Abbreviated' },
                ]}
                label="Number Format"
              />
              <ConfigTextField
                configKey="categoryName"
                config={config}
                onChange={onChange}
                label="Category Name"
                description="Name of category containing stat channels"
                placeholder="Server Stats"
              />
            </ConfigSection>
            <ConfigSection title="Goal" icon="🏁">
              <ConfigNumberField
                configKey="goalTarget"
                config={config}
                onChange={onChange}
                label="Goal Target"
                placeholder="100"
              />
              <ConfigPicker
                configKey="goalStatType"
                config={config}
                onChange={onChange}
                options={[
                  { value: 'members', label: 'Members' },
                  { value: 'messages', label: 'Messages' },
                  { value: 'voice', label: 'Voice' },
                ]}
                label="Goal Stat Type"
              />
            </ConfigSection>
          </ConfigGrid>
        </>
      );

    case 'leaderboards':
      return (
        <>
          <ConfigGrid cols={3}>
          <ConfigSection title="General" icon="🏆">
            <ConfigPicker
              configKey="defaultType"
              config={config}
              onChange={onChange}
              options={[
                { value: 'xp', label: 'XP' },
                { value: 'level', label: 'Level' },
                { value: 'currency', label: 'Currency' },
                { value: 'messages', label: 'Messages' },
                { value: 'invites', label: 'Invites' },
                { value: 'voice', label: 'Voice' },
                { value: 'reputation', label: 'Reputation' },
                { value: 'counting', label: 'Counting' },
              ]}
              label="Default Type"
            />
            <ConfigNumberField
              configKey="entriesPerPage"
              config={config}
              onChange={onChange}
              label="Entries per Page"
              placeholder="10"
            />
            <ConfigToggle
              configKey="showRankCard"
              config={config}
              onChange={onChange}
              label="Show Rank Card"
              description="Display rank card when viewing leaderboard"
            />
          </ConfigSection>
          </ConfigGrid>
        </>
      );

    case 'suggestions':
      return (
        <>
          <ConfigGrid cols={3}>
            <ConfigSection title="General" icon="💡">
              <ConfigChannelPicker
                configKey="channelId"
                config={config}
                onChange={onChange}
                channels={channels}
                label="Suggestions Channel"
              />
              <ConfigToggle
                configKey="anonymous"
                config={config}
                onChange={onChange}
                label="Anonymous"
                description="Hide author identity from other users"
              />
              <ConfigToggle
                configKey="autoThread"
                config={config}
                onChange={onChange}
                label="Auto Thread"
                description="Create a thread for each suggestion"
              />
              <ConfigToggle
                configKey="requireReason"
                config={config}
                onChange={onChange}
                label="Require Reason"
                description="Staff must provide reason for status changes"
              />
              <ConfigToggle
                configKey="allowEditing"
                config={config}
                onChange={onChange}
                label="Allow Editing"
                description="Users can edit their suggestions"
              />
              <ConfigToggle
                configKey="dmOnStatusChange"
                config={config}
                onChange={onChange}
                label="DM on Status Change"
                description="Send DM when suggestion status changes"
              />
            </ConfigSection>
            <ConfigSection title="Emojis" icon="😀">
              <ConfigTextField
                configKey="upvoteEmoji"
                config={config}
                onChange={onChange}
                label="Upvote Emoji"
                description="Emoji for upvoting suggestions"
                placeholder="👍"
              />
              <ConfigTextField
                configKey="downvoteEmoji"
                config={config}
                onChange={onChange}
                label="Downvote Emoji"
                description="Emoji for downvoting suggestions"
                placeholder="👎"
              />
            </ConfigSection>
          </ConfigGrid>
          <ConfigSection title="Colors" icon="🎨">
            <ConfigColorPicker
              configKey="embedColor"
              config={config}
              onChange={onChange}
              label="Embed Color"
              defaultColor="#3498DB"
            />
            <ConfigColorPicker
              configKey="approvedColor"
              config={config}
              onChange={onChange}
              label="Approved Color"
              defaultColor="#2ECC71"
            />
            <ConfigColorPicker
              configKey="deniedColor"
              config={config}
              onChange={onChange}
              label="Denied Color"
              defaultColor="#E74C3C"
            />
            <ConfigColorPicker
              configKey="consideringColor"
              config={config}
              onChange={onChange}
              label="Considering Color"
              defaultColor="#F39C12"
            />
            <ConfigColorPicker
              configKey="implementedColor"
              config={config}
              onChange={onChange}
              label="Implemented Color"
              defaultColor="#9B59B6"
            />
          </ConfigSection>
        </>
      );

    case 'scheduledmessages':
      return (
        <>
          <ConfigGrid cols={3}>
          <ConfigSection title="General" icon="📅">
            <ConfigNumberField
              configKey="maxScheduledPerGuild"
              config={config}
              onChange={onChange}
              label="Max Scheduled per Guild"
              placeholder="10"
            />
            <ConfigTextField
              configKey="timezone"
              config={config}
              onChange={onChange}
              label="Timezone"
              description="Timezone for scheduled message times (e.g., UTC, EST, PST)"
              placeholder="UTC"
            />
          </ConfigSection>
          </ConfigGrid>
        </>
      );

    case 'backup':
      return (
        <>
          <ConfigGrid cols={3}>
          <ConfigSection title="Auto Backup" icon="💾">
            <ConfigNumberField
              configKey="autoBackupInterval"
              config={config}
              onChange={onChange}
              label="Auto Backup Interval (hours)"
              placeholder="24"
            />
            <ConfigNumberField
              configKey="maxBackups"
              config={config}
              onChange={onChange}
              label="Max Backups"
              placeholder="10"
            />
            <ConfigToggle
              configKey="backupOnChange"
              config={config}
              onChange={onChange}
              label="Backup on Change"
              description="Create backup when server is modified"
            />
            <ConfigNumberField
              configKey="changeCooldown"
              config={config}
              onChange={onChange}
              label="Change Cooldown (seconds)"
              placeholder="300"
            />
          </ConfigSection>
          </ConfigGrid>
        </>
      );

    case 'userphone':
      return (
        <>
          <ConfigGrid cols={3}>
            <ConfigSection title="General" icon="📞">
              <ConfigNumberField
                configKey="maxDuration"
                config={config}
                onChange={onChange}
                label="Max Duration (seconds)"
                placeholder="3600"
              />
              <ConfigToggle
                configKey="allowAttachments"
                config={config}
                onChange={onChange}
                label="Allow Attachments"
                description="Allow users to send files via phone"
              />
              <ConfigToggle
                configKey="showServerName"
                config={config}
                onChange={onChange}
                label="Show Server Name"
                description="Show which server the call is from"
              />
              <ConfigChannelPicker
                configKey="reportChannelId"
                config={config}
                onChange={onChange}
                channels={channels}
                label="Report Channel"
              />
              <ConfigNumberField
                configKey="callCooldown"
                config={config}
                onChange={onChange}
                label="Call Cooldown (seconds)"
                placeholder="30"
              />
            </ConfigSection>
            <ConfigSection title="Message Format" icon="💬">
              <ConfigPicker
                configKey="messageFormat"
                config={config}
                onChange={onChange}
                options={[
                  { value: 'embed', label: 'Embed' },
                  { value: 'plain', label: 'Plain' },
                ]}
                label="Message Format"
              />
            </ConfigSection>
          </ConfigGrid>
          <ConfigSection title="Content Filter" icon="🛡️">
            <ConfigToggle
              configKey="contentFilter.blockNSFW"
              config={config}
              onChange={onChange}
              label="Block NSFW"
              description="Block NSFW content in calls"
            />
            <ConfigToggle
              configKey="contentFilter.blockProfanity"
              config={config}
              onChange={onChange}
              label="Block Profanity"
              description="Block profanity in calls"
            />
            <ConfigToggle
              configKey="contentFilter.blockLinks"
              config={config}
              onChange={onChange}
              label="Block Links"
              description="Block links in calls"
            />
          </ConfigSection>
        </>
      );

    case 'voicephone':
      return (
        <>
          <ConfigGrid cols={3}>
            <ConfigSection title="General" icon="📞">
              <ConfigNumberField
                configKey="maxDuration"
                config={config}
                onChange={onChange}
                label="Max Duration (seconds)"
                placeholder="3600"
              />
              <ConfigNumberField
                configKey="callCooldown"
                config={config}
                onChange={onChange}
                label="Call Cooldown (seconds)"
                placeholder="30"
              />
              <ConfigToggle
                configKey="showServerName"
                config={config}
                onChange={onChange}
                label="Show Server Name"
                description="Show which server the call is from"
              />
              <ConfigChannelPicker
                configKey="reportChannelId"
                config={config}
                onChange={onChange}
                channels={channels}
                label="Report Channel"
              />
            </ConfigSection>
            <ConfigSection title="Audio" icon="🔊">
              <ConfigNumberField
                configKey="bitrate"
                config={config}
                onChange={onChange}
                label="Bitrate"
                placeholder="64"
              />
              <ConfigNumberField
                configKey="maxSpeakersPerSide"
                config={config}
                onChange={onChange}
                label="Max Speakers per Side"
                placeholder="2"
              />
            </ConfigSection>
          </ConfigGrid>
          <ConfigSection title="Safety & Trust" icon="🛡️">
            <ConfigNumberField
              configKey="minServerSize"
              config={config}
              onChange={onChange}
              label="Min Server Size"
              placeholder="50"
            />
            <ConfigToggle
              configKey="requireCommunity"
              config={config}
              onChange={onChange}
              label="Require Community"
              description="Both servers must be communities"
            />
            <ConfigNumberField
              configKey="maxStrikes"
              config={config}
              onChange={onChange}
              label="Max Strikes"
              placeholder="3"
            />
            <ConfigNumberField
              configKey="strikeBanDuration"
              config={config}
              onChange={onChange}
              label="Strike Ban Duration (days)"
              placeholder="7"
            />
          </ConfigSection>
        </>
      );

    case 'raffles':
      return (
        <>
          <ConfigGrid cols={3}>
            <ConfigSection title="Tickets" icon="🎟️">
              <ConfigNumberField
                configKey="ticketPrice"
                config={config}
                onChange={onChange}
                label="Ticket Price"
                placeholder="100"
              />
              <ConfigPicker
                configKey="currencyType"
                config={config}
                onChange={onChange}
                options={[
                  { value: 'coins', label: 'Coins' },
                  { value: 'gems', label: 'Gems' },
                  { value: 'event_tokens', label: 'Event Tokens' },
                ]}
                label="Currency Type"
              />
              <ConfigNumberField
                configKey="maxTicketsPerUser"
                config={config}
                onChange={onChange}
                label="Max Tickets per User"
                placeholder="50"
              />
              <ConfigNumberField
                configKey="maxActive"
                config={config}
                onChange={onChange}
                label="Max Active"
                placeholder="5"
              />
            </ConfigSection>
            <ConfigSection title="Behavior" icon="⚙️">
              <ConfigToggle
                configKey="dmWinners"
                config={config}
                onChange={onChange}
                label="DM Winners"
                description="Send winner notification via DM"
              />
              <ConfigToggle
                configKey="refundOnCancel"
                config={config}
                onChange={onChange}
                label="Refund on Cancel"
                description="Refund all tickets when raffle is cancelled"
              />
            </ConfigSection>
          </ConfigGrid>
          <ConfigGrid cols={3}>
            <ConfigSection title="Channels & Roles" icon="📌">
              <ConfigChannelPicker
                configKey="defaultChannelId"
                config={config}
                onChange={onChange}
                channels={channels}
                label="Default Channel"
              />
              <ConfigRolePicker
                configKey="pingRoleId"
                config={config}
                onChange={onChange}
                roles={roles}
                label="Ping Role"
              />
            </ConfigSection>
            <ConfigSection title="Appearance" icon="🎨">
              <ConfigColorPicker
                configKey="embedColor"
                config={config}
                onChange={onChange}
                label="Embed Color"
                defaultColor="#FF6B35"
              />
            </ConfigSection>
          </ConfigGrid>
        </>
      );

    case 'donationtracking':
      return (
        <>
          <ConfigGrid cols={3}>
            <ConfigSection title="Currency" icon="💰">
              <ConfigPicker
                configKey="currencyType"
                config={config}
                onChange={onChange}
                options={[
                  { value: 'coins', label: 'Coins' },
                  { value: 'gems', label: 'Gems' },
                  { value: 'event_tokens', label: 'Event Tokens' },
                ]}
                label="Currency Type"
              />
              <ConfigNumberField
                configKey="minDonation"
                config={config}
                onChange={onChange}
                label="Min Donation"
                placeholder="1"
              />
              <ConfigNumberField
                configKey="maxDonation"
                config={config}
                onChange={onChange}
                label="Max Donation"
                placeholder="100000"
              />
            </ConfigSection>
            <ConfigSection title="Goal" icon="🏁">
              <ConfigToggle
                configKey="goalActive"
                config={config}
                onChange={onChange}
                label="Goal Active"
                description="Track donations towards a goal"
              />
              <ConfigTextField
                configKey="goalName"
                config={config}
                onChange={onChange}
                label="Goal Name"
                description="Name of the donation goal"
                placeholder="Server Upgrade Fund"
              />
              <ConfigNumberField
                configKey="goalAmount"
                config={config}
                onChange={onChange}
                label="Goal Amount"
                placeholder="10000"
              />
            </ConfigSection>
          </ConfigGrid>
          <ConfigGrid cols={3}>
            <ConfigSection title="Announcements" icon="📢">
              <ConfigToggle
                configKey="announceMilestones"
                config={config}
                onChange={onChange}
                label="Announce Milestones"
                description="Announce when milestone donations are reached"
              />
              <ConfigNumberField
                configKey="leaderboardSize"
                config={config}
                onChange={onChange}
                label="Leaderboard Size"
                placeholder="10"
              />
            </ConfigSection>
            <ConfigSection title="Channels" icon="📌">
              <ConfigChannelPicker
                configKey="defaultChannelId"
                config={config}
                onChange={onChange}
                channels={channels}
                label="Default Channel"
              />
              <ConfigChannelPicker
                configKey="logChannelId"
                config={config}
                onChange={onChange}
                channels={channels}
                label="Log Channel"
              />
            </ConfigSection>
          </ConfigGrid>
          <ConfigSection title="Appearance" icon="🎨">
            <ConfigColorPicker
              configKey="embedColor"
              config={config}
              onChange={onChange}
              label="Embed Color"
              defaultColor="#2ECC71"
            />
          </ConfigSection>
        </>
      );

    case 'timers':
      return (
        <>
          <ConfigGrid cols={3}>
            <ConfigSection title="Limits" icon="⏱️">
              <ConfigNumberField
                configKey="maxPerUser"
                config={config}
                onChange={onChange}
                label="Max per User"
                placeholder="10"
              />
              <ConfigToggle
                configKey="allowDm"
                config={config}
                onChange={onChange}
                label="Allow DM"
                description="Allow users to receive timer notifications via DM"
              />
            </ConfigSection>
            <ConfigSection title="Channels" icon="📌">
              <ConfigChannelPicker
                configKey="defaultNotifyChannelId"
                config={config}
                onChange={onChange}
                channels={channels}
                label="Default Notify Channel"
              />
              <ConfigChannelPicker
                configKey="logChannelId"
                config={config}
                onChange={onChange}
                channels={channels}
                label="Log Channel"
              />
            </ConfigSection>
          </ConfigGrid>
          <ConfigSection title="Appearance" icon="🎨">
            <ConfigColorPicker
              configKey="embedColor"
              config={config}
              onChange={onChange}
              label="Embed Color"
              defaultColor="#3498DB"
            />
          </ConfigSection>
        </>
      );

    case 'reminders':
      return (
        <>
          <ConfigGrid cols={3}>
          <ConfigSection title="Limits" icon="⏰">
            <ConfigNumberField
              configKey="maxReminders"
              config={config}
              onChange={onChange}
              label="Max Reminders"
              placeholder="20"
            />
            <ConfigNumberField
              configKey="maxRepeat"
              config={config}
              onChange={onChange}
              label="Max Repeat"
              placeholder="100"
            />
          </ConfigSection>
          </ConfigGrid>
        </>
      );

    case 'tempvoice':
      return (
        <>
          <ConfigGrid cols={3}>
            <ConfigSection title="Channel Setup" icon="🔊">
              <ConfigChannelPicker
                configKey="categoryId"
                config={config}
                onChange={onChange}
                channels={channels}
                label="Category"
              />
              <ConfigChannelPicker
                configKey="lobbyChannelId"
                config={config}
                onChange={onChange}
                channels={channels}
                label="Lobby Channel"
                voiceOnly
              />
            </ConfigSection>
            <ConfigSection title="Defaults" icon="⚙️">
              <ConfigNumberField
                configKey="defaultUserLimit"
                config={config}
                onChange={onChange}
                label="Default User Limit"
                placeholder="5"
              />
              <ConfigNumberField
                configKey="defaultBitrate"
                config={config}
                onChange={onChange}
                label="Default Bitrate"
                placeholder="64"
              />
              <ConfigTextField
                configKey="nameTemplate"
                config={config}
                onChange={onChange}
                label="Name Template"
                description="Template for channel names. Use {user}, {number} variables"
                placeholder="{user}'s Channel"
              />
            </ConfigSection>
          </ConfigGrid>
        </>
      );

    case 'casino':
      return (
        <>
          <ConfigGrid cols={3}>
            <ConfigSection title="Betting" icon="🎰">
              <ConfigNumberField
                configKey="minBet"
                config={config}
                onChange={onChange}
                label="Min Bet"
                placeholder="10"
              />
              <ConfigNumberField
                configKey="maxBet"
                config={config}
                onChange={onChange}
                label="Max Bet"
                placeholder="10000"
              />
              <ConfigPicker
                configKey="currencyType"
                config={config}
                onChange={onChange}
                options={[
                  { value: 'coins', label: 'Coins' },
                  { value: 'gems', label: 'Gems' },
                ]}
                label="Currency Type"
              />
            </ConfigSection>
            <ConfigSection title="Settings" icon="⚙️">
              <ConfigNumberField
                configKey="cooldown"
                config={config}
                onChange={onChange}
                label="Cooldown (seconds)"
                placeholder="10"
              />
              <ConfigChannelPicker
                configKey="logChannelId"
                config={config}
                onChange={onChange}
                channels={channels}
                label="Log Channel"
              />
            </ConfigSection>
          </ConfigGrid>
          <ConfigSection title="Appearance" icon="🎨">
            <ConfigColorPicker
              configKey="embedColor"
              config={config}
              onChange={onChange}
              label="Embed Color"
              defaultColor="#FFD700"
            />
          </ConfigSection>
        </>
      );

    case 'profile':
      return (
        <>
          <ConfigGrid cols={3}>
            <ConfigSection title="General" icon="👤">
              <ConfigNumberField
                configKey="maxListItems"
                config={config}
                onChange={onChange}
                label="Max List Items"
                placeholder="10"
              />
              <ConfigToggle
                configKey="requireCreate"
                config={config}
                onChange={onChange}
                label="Require Create"
                description="Users must create profile before using features"
              />
            </ConfigSection>
            <ConfigSection title="Appearance" icon="🎨">
              <ConfigColorPicker
                configKey="embedColor"
                config={config}
                onChange={onChange}
                label="Embed Color"
                defaultColor="#9B59B6"
              />
            </ConfigSection>
          </ConfigGrid>
        </>
      );

    case 'family':
      return (
        <>
          <ConfigGrid cols={3}>
            <ConfigSection title="Limits" icon="👪">
              <ConfigNumberField
                configKey="maxChildren"
                config={config}
                onChange={onChange}
                label="Max Children"
                placeholder="5"
              />
              <ConfigNumberField
                configKey="proposalExpiry"
                config={config}
                onChange={onChange}
                label="Proposal Expiry (hours)"
                placeholder="24"
              />
            </ConfigSection>
            <ConfigSection title="Appearance" icon="🎨">
              <ConfigColorPicker
                configKey="embedColor"
                config={config}
                onChange={onChange}
                label="Embed Color"
                defaultColor="#E91E63"
              />
            </ConfigSection>
          </ConfigGrid>
        </>
      );

    case 'images':
      return (
        <>
          <ConfigGrid cols={3}>
            <ConfigSection title="Settings" icon="🖼️">
              <ConfigNumberField
                configKey="cooldown"
                config={config}
                onChange={onChange}
                label="Cooldown (seconds)"
                placeholder="5"
              />
            </ConfigSection>
            <ConfigSection title="Appearance" icon="🎨">
              <ConfigColorPicker
                configKey="embedColor"
                config={config}
                onChange={onChange}
                label="Embed Color"
                defaultColor="#3498DB"
              />
            </ConfigSection>
          </ConfigGrid>
        </>
      );

    case 'utilities':
      return (
        <>
          <ConfigGrid cols={3}>
            <ConfigSection title="Search" icon="🔍">
              <ConfigNumberField
                configKey="searchCooldown"
                config={config}
                onChange={onChange}
                label="Search Cooldown (seconds)"
                placeholder="30"
              />
            </ConfigSection>
            <ConfigSection title="Notepad" icon="📝">
              <ConfigToggle
                configKey="notepadEnabled"
                config={config}
                onChange={onChange}
                label="Notepad Enabled"
                description="Allow users to save personal notes"
              />
              <ConfigNumberField
                configKey="maxNotes"
                config={config}
                onChange={onChange}
                label="Max Notes"
                placeholder="100"
              />
            </ConfigSection>
          </ConfigGrid>
          <ConfigSection title="Appearance" icon="🎨">
            <ConfigColorPicker
              configKey="embedColor"
              config={config}
              onChange={onChange}
              label="Embed Color"
              defaultColor="#2ECC71"
            />
          </ConfigSection>
        </>
      );

    case 'soundboard':
      return (
        <>
          <ConfigGrid cols={3}>
            <ConfigSection title="Settings" icon="🔊">
              <ConfigNumberField
                configKey="maxCustomSounds"
                config={config}
                onChange={onChange}
                label="Max Custom Sounds"
                placeholder="50"
              />
              <ConfigToggle
                configKey="allowUserUpload"
                config={config}
                onChange={onChange}
                label="Allow User Upload"
                description="Allow users to upload custom sounds"
              />
              <ConfigNumberField
                configKey="cooldown"
                config={config}
                onChange={onChange}
                label="Cooldown (seconds)"
                placeholder="3"
              />
            </ConfigSection>
            <ConfigSection title="Appearance" icon="🎨">
              <ConfigColorPicker
                configKey="embedColor"
                config={config}
                onChange={onChange}
                label="Embed Color"
                defaultColor="#E67E22"
              />
            </ConfigSection>
          </ConfigGrid>
        </>
      );

    case 'autosetup':
      return (
        <>
          <ConfigGrid cols={3}>
            <ConfigSection title="Settings" icon="⚡">
              <ConfigTextField
                configKey="categoryName"
                config={config}
                onChange={onChange}
                label="Category Name"
                description="Category name for auto-setup channels"
                placeholder="Bot Setup"
              />
            </ConfigSection>
            <ConfigSection title="Appearance" icon="🎨">
              <ConfigColorPicker
                configKey="embedColor"
                config={config}
                onChange={onChange}
                label="Embed Color"
                defaultColor="#1ABC9C"
              />
            </ConfigSection>
          </ConfigGrid>
        </>
      );

    case 'core':
      return (
        <>
          <ConfigGrid cols={3}>
            <ConfigSection title="Embed Colors" icon="🎨">
              <ConfigToggle
                configKey="helpEmbedColors"
                config={config}
                onChange={onChange}
                label="Help Embed Colors"
                description="Use unique per-module colors in /help embeds"
              />
              <ConfigToggle
                configKey="configEmbedColors"
                config={config}
                onChange={onChange}
                label="Config Embed Colors"
                description="Use unique per-module colors in /configs embeds"
              />
            </ConfigSection>
          </ConfigGrid>
        </>
      );

    default:
      return (
        <div
          className="rounded-lg p-8 text-center"
          style={{ backgroundColor: 'var(--nexus-card)', borderColor: 'var(--nexus-border)', borderWidth: '1px' }}
        >
          <p style={{ color: 'var(--nexus-dim)' }}>No configurable settings available for this module.</p>
        </div>
      );
  }
}
