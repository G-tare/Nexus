'use client';

import { useParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import api from '@/lib/api';

const TIMEZONES = [
  'UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Asia/Tokyo', 'Asia/Shanghai',
  'Asia/Kolkata', 'Australia/Sydney', 'Pacific/Auckland',
];

const LOCALES = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'ja', label: 'Japanese' },
  { value: 'ko', label: 'Korean' },
  { value: 'zh', label: 'Chinese' },
];

export default function SettingsPage() {
  const { guildId } = useParams() as { guildId: string };
  const [locale, setLocale] = useState('en');
  const [timezone, setTimezone] = useState('UTC');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/guilds/${guildId}`)
      .then(({ data }) => {
        if (data.guild?.locale) setLocale(data.guild.locale);
        if (data.guild?.timezone) setTimezone(data.guild.timezone);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [guildId]);

  const save = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await api.patch(`/guilds/${guildId}/settings`, { locale, timezone });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error('Save settings failed:', err);
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-10 h-10 border-2 border-[var(--nexus-cyan)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">Server Settings</h1>
      <p className="text-[var(--nexus-dim)] mb-6">Configure global settings for your server.</p>

      <div className="nexus-card p-6 max-w-2xl">
        <div className="space-y-6">
          {/* Locale */}
          <div>
            <label className="block text-sm font-medium mb-2">Language</label>
            <select
              value={locale}
              onChange={(e) => setLocale(e.target.value)}
              className="w-full px-3 py-2.5 bg-[var(--nexus-dark)] border border-[var(--nexus-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--nexus-cyan)]/50 transition-colors"
            >
              {LOCALES.map((l) => (
                <option key={l.value} value={l.value}>{l.label}</option>
              ))}
            </select>
            <p className="text-xs text-[var(--nexus-dim)] mt-1">Bot response language for this server.</p>
          </div>

          {/* Timezone */}
          <div>
            <label className="block text-sm font-medium mb-2">Timezone</label>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full px-3 py-2.5 bg-[var(--nexus-dark)] border border-[var(--nexus-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--nexus-cyan)]/50 transition-colors"
            >
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>{tz.replace(/_/g, ' ')}</option>
              ))}
            </select>
            <p className="text-xs text-[var(--nexus-dim)] mt-1">Used for scheduled messages, timed events, and log timestamps.</p>
          </div>

          {/* Save */}
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={save}
              disabled={saving}
              className="px-6 py-2.5 bg-[var(--nexus-cyan)] text-black font-semibold rounded-lg text-sm hover:bg-[var(--nexus-cyan)]/80 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
            {saved && (
              <span className="text-sm text-[var(--nexus-green)] animate-pulse">Saved!</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
