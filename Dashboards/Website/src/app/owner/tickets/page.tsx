'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/auth';

interface Ticket {
  id: number;
  guild_id: string | null;
  user_id: string;
  username: string;
  category: string;
  subcategory: string | null;
  status: 'open' | 'claimed' | 'closed';
  subject: string;
  message?: string;
  claimed_by: string | null;
  closed_by: string | null;
  closed_reason: string | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  unread_count?: number;
}

interface TicketBan {
  user_id: string;
  username: string;
  reason: string;
  banned_by: string;
  created_at: string;
}

interface Attachment {
  url: string;
  filename: string;
  contentType: string;
}

interface TicketMessage {
  id: number;
  ticket_id: number;
  author_type: 'user' | 'staff';
  author_id: string;
  author_name: string;
  message: string;
  dm_message_id: string | null;
  attachments?: Attachment[];
  created_at: string;
}

interface TicketEvidence {
  modCases: Array<{
    id: number;
    guild_id: string;
    case_number: number;
    action: string;
    target_id: string;
    moderator_id: string;
    reason: string | null;
    duration: number | null;
    expires_at: string | null;
    is_active: boolean;
    created_at: string;
  }>;
  automodLogs: Array<{
    id: number;
    guild_id: string;
    target_id: string;
    action: string;
    violation_type: string;
    reason: string | null;
    message_content: string | null;
    channel_id: string | null;
    duration: number | null;
    created_at: string;
  }>;
  reports: Array<{
    id: number;
    guild_id: string;
    report_number: number;
    reporter_id: string;
    type: string;
    target_id: string | null;
    description: string;
    evidence: string | null;
    status: string;
    reviewed_by: string | null;
    review_note: string | null;
    created_at: string;
    reviewed_at: string | null;
  }>;
  banRecord: {
    type: string;
    reason: string;
    banned_by: string;
    [key: string]: unknown;
  } | null;
}

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  open: { bg: 'var(--nexus-green)', text: 'var(--nexus-green)', label: 'Open' },
  claimed: { bg: 'var(--nexus-yellow)', text: 'var(--nexus-yellow)', label: 'Claimed' },
  closed: { bg: 'var(--nexus-dim)', text: 'var(--nexus-dim)', label: 'Closed' },
};

const CATEGORY_ICONS: Record<string, string> = {
  help: '❓',
  appeal: '⚖️',
  suggestion: '💡',
  bug: '🐛',
  feedback: '💬',
};

function getTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function useTicketWebSocket(onEvent: (event: string, data: Record<string, unknown>) => void) {
  const callbackRef = useRef(onEvent);
  callbackRef.current = onEvent;

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('nexus_token') : null;
    if (!token) return;

    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    const wsUrl = apiBase.replace(/^http/, 'ws') + '/ws?token=' + token;

    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let pingTimer: ReturnType<typeof setInterval> | null = null;
    let destroyed = false;

    function connect() {
      if (destroyed) return;
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        pingTimer = setInterval(() => {
          if (ws?.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, 25000);
      };

      ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data);
          if (msg.event && msg.event !== 'connected') {
            callbackRef.current(msg.event, msg.data || {});
          }
        } catch { /* ignore */ }
      };

      ws.onclose = () => {
        if (pingTimer) clearInterval(pingTimer);
        if (!destroyed) {
          reconnectTimer = setTimeout(connect, 3000);
        }
      };

      ws.onerror = () => {
        ws?.close();
      };
    }

    connect();

    return () => {
      destroyed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (pingTimer) clearInterval(pingTimer);
      ws?.close();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

/* ── Right-panel tab type ── */
type RightPanelTab = 'banned' | 'evidence';

interface TicketsPageContentProps {
  category: string | null;
}

export function TicketsPageContent({ category }: TicketsPageContentProps) {
  const { user } = useAuthStore();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [evidence, setEvidence] = useState<TicketEvidence | null>(null);
  const [stats, setStats] = useState<{ open: number; claimed: number; closed: number } | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'claimed' | 'closed'>('open');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [replying, setReplying] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [bannedUsers, setBannedUsers] = useState<TicketBan[]>([]);
  const [banError, setBanError] = useState<string | null>(null);
  const [rightPanelTab, setRightPanelTab] = useState<RightPanelTab>('evidence');
  const [modal, setModal] = useState<{
    type: 'close' | 'ban';
    title: string;
    placeholder: string;
    required: boolean;
  } | null>(null);
  const [modalReason, setModalReason] = useState('');
  const modalInputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const prevMessageCountRef = useRef(0);
  const shouldAutoScrollRef = useRef(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll messages
  useEffect(() => {
    const newCount = messages.length;
    const wasAtBottom = shouldAutoScrollRef.current;
    const isNewMessage = newCount > prevMessageCountRef.current && prevMessageCountRef.current > 0;

    if (wasAtBottom || !isNewMessage) {
      messagesEndRef.current?.scrollIntoView({ behavior: isNewMessage ? 'smooth' : 'auto' });
    }
    prevMessageCountRef.current = newCount;
  }, [messages]);

  const handleMessagesScroll = () => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const { scrollTop, scrollHeight, clientHeight } = container;
    shouldAutoScrollRef.current = scrollHeight - scrollTop - clientHeight < 80;
  };

  // Fetch stats on mount
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const { data } = await api.get('/owner/tickets/stats');
        setStats({
          open: parseInt(data.open_count || '0', 10),
          claimed: parseInt(data.claimed_count || '0', 10),
          closed: parseInt(data.closed_count || '0', 10),
        });
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      }
    };
    fetchStats();
  }, []);

  // Fetch banned users on mount
  const fetchBannedUsers = useCallback(async () => {
    try {
      const { data } = await api.get('/owner/tickets/bans/list');
      setBannedUsers(data.bans || []);
    } catch (error) {
      console.error('Failed to fetch banned users:', error);
    }
  }, []);

  useEffect(() => {
    fetchBannedUsers();
  }, [fetchBannedUsers]);

  const selectedTicketRef = useRef<Ticket | null>(null);
  selectedTicketRef.current = selectedTicket;

  // Fetch tickets
  useEffect(() => {
    const fetchTickets = async () => {
      setLoading(true);
      try {
        const params: Record<string, unknown> = { page, limit: 20 };
        if (statusFilter !== 'all') params.status = statusFilter;
        if (category) params.category = category;
        if (searchQuery) params.search = searchQuery;

        const { data } = await api.get('/owner/tickets', { params });
        setTickets(data.tickets || []);
        setTotalPages(data.pagination?.totalPages || 1);

        if (data.tickets && data.tickets.length > 0 && !selectedTicketRef.current) {
          setSelectedTicket(data.tickets[0]);
        }
      } catch (error) {
        console.error('Failed to fetch tickets:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTickets();
  }, [page, statusFilter, category, searchQuery]);

  const selectedTicketId = selectedTicket?.id ?? null;

  // Fetch ticket details + evidence when selection changes
  useEffect(() => {
    shouldAutoScrollRef.current = true;
    prevMessageCountRef.current = 0;

    const fetchTicketDetails = async () => {
      if (!selectedTicketId) {
        setMessages([]);
        setEvidence(null);
        return;
      }

      try {
        const { data } = await api.get(`/owner/tickets/${selectedTicketId}`);
        if (data.ticket) setSelectedTicket(data.ticket);
        setMessages(data.messages || []);

        const evidenceData = await api.get(`/owner/tickets/${selectedTicketId}/evidence`);
        setEvidence(evidenceData.data);

        await api.patch(`/owner/tickets/${selectedTicketId}/read`);
        setTickets((prev) =>
          prev.map((t) => (t.id === selectedTicketId ? { ...t, unread_count: 0 } : t)),
        );
      } catch (error) {
        console.error('Failed to fetch ticket details:', error);
      }
    };

    fetchTicketDetails();
  }, [selectedTicketId]);

  // Refs for WS handler
  const pageRef = useRef(page);
  pageRef.current = page;
  const statusFilterRef = useRef(statusFilter);
  statusFilterRef.current = statusFilter;
  const categoryRef = useRef(category);
  categoryRef.current = category;
  const searchQueryRef = useRef(searchQuery);
  searchQueryRef.current = searchQuery;

  const refetchList = useCallback(async () => {
    try {
      const params: Record<string, unknown> = { page: pageRef.current, limit: 20 };
      if (statusFilterRef.current !== 'all') params.status = statusFilterRef.current;
      if (categoryRef.current) params.category = categoryRef.current;
      if (searchQueryRef.current) params.search = searchQueryRef.current;
      const { data: listData } = await api.get('/owner/tickets', { params });
      setTickets(listData.tickets || []);
      setTotalPages(listData.pagination?.totalPages || 1);
    } catch { /* ignore */ }
  }, []);

  const refetchStats = useCallback(async () => {
    try {
      const { data: statsData } = await api.get('/owner/tickets/stats');
      setStats({
        open: parseInt(statsData.open_count || '0', 10),
        claimed: parseInt(statsData.claimed_count || '0', 10),
        closed: parseInt(statsData.closed_count || '0', 10),
      });
    } catch { /* ignore */ }
  }, []);

  const handleWsEvent = useCallback((event: string, data: Record<string, unknown>) => {
    const currentTicket = selectedTicketRef.current;

    if (event === 'ticket:message') {
      const wsTicketId = data.ticketId as number | undefined;
      if (wsTicketId && currentTicket && wsTicketId === currentTicket.id) {
        const authorType = (data.authorType as 'user' | 'staff') || 'user';
        const wsAttachments = (data.attachments as Attachment[]) || [];
        const msgText = (data.message as string) || '';
        const authorId = (data.authorId as string) || '';

        setMessages((prev) => {
          // Deduplicate: if this exact message was already optimistically added (staff reply),
          // skip adding it again. Match on author + message text within last 10 seconds.
          if (authorType === 'staff') {
            const tenSecsAgo = Date.now() - 10000;
            const alreadyExists = prev.some(
              (m) =>
                m.author_type === 'staff' &&
                m.author_id === authorId &&
                m.message === msgText &&
                new Date(m.created_at).getTime() > tenSecsAgo,
            );
            if (alreadyExists) return prev;
          }

          const newMsg: TicketMessage = {
            id: Date.now(),
            ticket_id: wsTicketId,
            author_type: authorType,
            author_id: authorId,
            author_name: (data.authorName as string) || 'Unknown',
            message: msgText,
            dm_message_id: null,
            attachments: wsAttachments,
            created_at: new Date().toISOString(),
          };
          return [...prev, newMsg];
        });
      }
      refetchList();
    }

    if (event === 'ticket:created') {
      refetchList();
      refetchStats();
    }

    if (event === 'ticket:claimed') {
      const wsTicketId = data.ticketId as number | undefined;
      if (wsTicketId && currentTicket && wsTicketId === currentTicket.id) {
        setSelectedTicket({
          ...currentTicket,
          status: 'claimed' as const,
          claimed_by: (data.claimedBy as string) || currentTicket.claimed_by,
        });
      }
      setTickets((prev) => prev.map((t) =>
        t.id === wsTicketId
          ? { ...t, status: 'claimed' as const, claimed_by: (data.claimedBy as string) || t.claimed_by }
          : t
      ));
      refetchStats();
    }

    if (event === 'ticket:closed') {
      const wsTicketId = data.ticketId as number | undefined;
      if (wsTicketId && currentTicket && wsTicketId === currentTicket.id) {
        setSelectedTicket({
          ...currentTicket,
          status: 'closed' as const,
          closed_by: (data.closedBy as string) || currentTicket.closed_by,
          closed_reason: (data.reason as string) || null,
        });
      }
      setTickets((prev) => prev.map((t) =>
        t.id === wsTicketId
          ? { ...t, status: 'closed' as const, closed_by: (data.closedBy as string) || t.closed_by }
          : t
      ));
      refetchStats();
    }

    if (event === 'ticket:reopened') {
      const wsTicketId = data.ticketId as number | undefined;
      if (wsTicketId && currentTicket && wsTicketId === currentTicket.id) {
        setSelectedTicket({
          ...currentTicket,
          status: 'open' as const,
          closed_by: null,
          closed_reason: null,
          closed_at: null,
        });
      }
      setTickets((prev) => prev.map((t) =>
        t.id === wsTicketId
          ? { ...t, status: 'open' as const, closed_by: null, closed_reason: null, closed_at: null }
          : t
      ));
      refetchList();
      refetchStats();
    }
  }, [refetchList, refetchStats]);

  useTicketWebSocket(handleWsEvent);

  /* ── Action handlers ── */

  const handleClaim = async () => {
    if (!selectedTicket) return;
    try {
      await api.patch(`/owner/tickets/${selectedTicket.id}/claim`);
      const { data } = await api.get(`/owner/tickets/${selectedTicket.id}`);
      setSelectedTicket(data.ticket);
      setMessages(data.messages || []);
      setStats((prev) => prev ? ({
        open: Math.max(0, prev.open - 1),
        claimed: prev.claimed + 1,
        closed: prev.closed,
      }) : prev);
    } catch (error) {
      console.error('Failed to claim ticket:', error);
    }
  };

  const handleClose = () => {
    if (!selectedTicket) return;
    setModalReason('');
    setModal({
      type: 'close',
      title: 'Close Ticket',
      placeholder: 'Enter close reason (optional)...',
      required: false,
    });
    setTimeout(() => modalInputRef.current?.focus(), 50);
  };

  const confirmClose = async () => {
    if (!selectedTicket) return;
    setModal(null);
    try {
      await api.patch(`/owner/tickets/${selectedTicket.id}/close`, { reason: modalReason.trim() || undefined });
      const { data } = await api.get(`/owner/tickets/${selectedTicket.id}`);
      setSelectedTicket(data.ticket);
      setMessages(data.messages || []);
      setStats((prev) => prev ? ({
        open: prev.open,
        claimed: Math.max(0, prev.claimed - 1),
        closed: prev.closed + 1,
      }) : prev);
    } catch (error) {
      console.error('Failed to close ticket:', error);
    }
    setModalReason('');
  };

  const handleReply = async () => {
    if (!selectedTicket || !replyText.trim()) return;

    const sentText = replyText.trim();
    setReplying(true);
    try {
      await api.post(`/owner/tickets/${selectedTicket.id}/reply`, { message: sentText });
      const staffMsg: TicketMessage = {
        id: Date.now(),
        ticket_id: selectedTicket.id,
        author_type: 'staff',
        author_id: user?.id || '',
        author_name: user?.username || 'Staff',
        message: sentText,
        dm_message_id: null,
        attachments: [],
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, staffMsg]);
      setReplyText('');
    } catch (error) {
      console.error('Failed to send reply:', error);
    } finally {
      setReplying(false);
    }
  };

  const handleReopen = async () => {
    if (!selectedTicket) return;
    try {
      await api.patch(`/owner/tickets/${selectedTicket.id}/reopen`);
      setSelectedTicket({
        ...selectedTicket,
        status: 'open' as const,
        closed_by: null,
        closed_reason: null,
        closed_at: null,
      });
      setStats((prev) => prev ? ({
        open: prev.open + 1,
        claimed: prev.claimed,
        closed: Math.max(0, prev.closed - 1),
      }) : prev);
    } catch (error) {
      console.error('Failed to reopen ticket:', error);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedTicket) return;

    if (file.size > 8 * 1024 * 1024) {
      console.error('File size exceeds 8MB limit');
      return;
    }

    setUploading(true);
    setUploadStatus(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      await api.post(`/owner/tickets/${selectedTicket.id}/attachment`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (fileInputRef.current) fileInputRef.current.value = '';
      setUploadStatus(`Sent "${file.name}" — delivering to user...`);
      setTimeout(() => setUploadStatus(null), 5000);
    } catch (error) {
      console.error('Failed to upload file:', error);
      setUploadStatus('Failed to upload file.');
      setTimeout(() => setUploadStatus(null), 5000);
    } finally {
      setUploading(false);
    }
  };

  const handleBanUser = () => {
    if (!selectedTicket) return;
    setModalReason('');
    setModal({
      type: 'ban',
      title: `Ban ${selectedTicket.username}`,
      placeholder: 'Enter ban reason...',
      required: true,
    });
    setTimeout(() => modalInputRef.current?.focus(), 50);
  };

  const confirmBan = async () => {
    if (!selectedTicket || !modalReason.trim()) return;
    setModal(null);
    setBanError(null);
    try {
      await api.post('/owner/tickets/bans', {
        userId: selectedTicket.user_id,
        username: selectedTicket.username,
        reason: modalReason.trim(),
      });
      fetchBannedUsers();
    } catch (error) {
      console.error('Failed to ban user:', error);
      setBanError('Failed to ban user');
    }
    setModalReason('');
  };

  const handleUnbanUser = async (userId: string) => {
    try {
      await api.delete(`/owner/tickets/bans/${userId}`);
      fetchBannedUsers();
    } catch (error) {
      console.error('Failed to unban user:', error);
    }
  };

  const hasEvidence =
    evidence &&
    (evidence.modCases.length > 0 ||
      evidence.automodLogs.length > 0 ||
      evidence.reports.length > 0 ||
      evidence.banRecord !== null);

  const evidenceItemCount =
    (evidence?.modCases.length || 0) +
    (evidence?.automodLogs.length || 0) +
    (evidence?.reports.length || 0) +
    (evidence?.banRecord ? 1 : 0);

  // Collect all attachments from ticket messages for the Attachments panel
  const allAttachments = messages
    .filter((m) => m.attachments && m.attachments.length > 0)
    .flatMap((m) =>
      (m.attachments ?? []).map((a) => ({
        ...a,
        author: m.author_name,
        authorType: m.author_type,
        timestamp: m.created_at,
      })),
    );

  // Dynamic tab label based on ticket category
  const getInfoTabLabel = (): string => {
    if (!selectedTicket) return 'Info';
    switch (selectedTicket.category) {
      case 'appeal': return 'Evidence & History';
      case 'bug': return 'Reports & Logs';
      default: return 'Attachments';
    }
  };

  const getInfoTabBadgeCount = (): number => {
    if (!selectedTicket) return 0;
    switch (selectedTicket.category) {
      case 'appeal': return evidenceItemCount;
      case 'bug': return (evidence?.automodLogs.length || 0) + (evidence?.reports.length || 0);
      default: return allAttachments.length;
    }
  };

  /* ── Render helpers ── */

  const isImage = (att: Attachment) => {
    const contentType = att.contentType.toLowerCase();
    const filename = att.filename.toLowerCase();
    return contentType.startsWith('image/') || /\.(png|jpg|jpeg|gif|webp)$/i.test(filename);
  };

  return (
    <div
      style={{
        display: 'flex',
        height: 'calc(100vh - 56px)',
        width: '100%',
        overflow: 'hidden',
        backgroundColor: 'var(--nexus-dark)',
      }}
    >
      {/* ── LEFT COLUMN: Ticket List ── */}
      <div
        style={{
          width: '340px',
          minWidth: '340px',
          backgroundColor: 'var(--nexus-card)',
          borderRight: '1px solid var(--nexus-border)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Stats */}
        <div
          style={{
            padding: '12px',
            borderBottom: '1px solid var(--nexus-border)',
            fontSize: '12px',
            color: 'var(--nexus-text)',
          }}
        >
          <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontWeight: 'bold', color: 'var(--nexus-green)' }}>
                {stats ? stats.open + stats.claimed : '–'}
              </div>
              <div style={{ opacity: 0.7 }}>Active</div>
            </div>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontWeight: 'bold', color: 'var(--nexus-yellow)' }}>
                {stats ? stats.claimed : '–'}
              </div>
              <div style={{ opacity: 0.7 }}>Claimed</div>
            </div>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontWeight: 'bold', color: 'var(--nexus-dim)' }}>
                {stats ? stats.closed : '–'}
              </div>
              <div style={{ opacity: 0.7 }}>Closed</div>
            </div>
          </div>
        </div>

        {/* Search */}
        <div style={{ padding: '8px' }}>
          <input
            type="text"
            placeholder="Search tickets..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
            style={{
              width: '100%',
              padding: '6px 8px',
              backgroundColor: 'var(--nexus-dark)',
              color: 'var(--nexus-text)',
              border: '1px solid var(--nexus-border)',
              borderRadius: '4px',
              fontSize: '12px',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Filter tabs */}
        <div
          style={{
            display: 'flex',
            gap: '4px',
            padding: '8px',
            borderBottom: '1px solid var(--nexus-border)',
          }}
        >
          {(['all', 'open', 'claimed', 'closed'] as const).map((status) => (
            <button
              key={status}
              onClick={() => { setStatusFilter(status); setPage(1); }}
              style={{
                flex: 1,
                padding: '4px 6px',
                fontSize: '11px',
                backgroundColor: statusFilter === status ? 'var(--nexus-cyan)' : 'var(--nexus-dark)',
                color: statusFilter === status ? 'var(--nexus-dark)' : 'var(--nexus-text)',
                border: '1px solid var(--nexus-border)',
                borderRadius: '3px',
                cursor: 'pointer',
                fontWeight: statusFilter === status ? 'bold' : 'normal',
                transition: 'all 0.2s',
              }}
            >
              {status === 'open' ? 'Active' : status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>

        {/* Ticket list */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {tickets.map((ticket) => (
            <div
              key={ticket.id}
              onClick={() => setSelectedTicket(ticket)}
              style={{
                padding: '12px',
                borderBottom: '1px solid var(--nexus-border)',
                cursor: 'pointer',
                backgroundColor: selectedTicket?.id === ticket.id ? 'var(--nexus-dark)' : 'transparent',
                borderLeft: selectedTicket?.id === ticket.id
                  ? '3px solid var(--nexus-cyan)'
                  : '3px solid transparent',
                paddingLeft: selectedTicket?.id === ticket.id ? '9px' : '12px',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                if (selectedTicket?.id !== ticket.id)
                  (e.currentTarget as HTMLDivElement).style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
              }}
              onMouseLeave={(e) => {
                if (selectedTicket?.id !== ticket.id)
                  (e.currentTarget as HTMLDivElement).style.backgroundColor = 'transparent';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', position: 'relative' }}>
                <span style={{ fontSize: '14px' }}>
                  {CATEGORY_ICONS[ticket.category] || '📋'}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontWeight: 'bold',
                      fontSize: '12px',
                      color: 'var(--nexus-text)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    #{ticket.id}
                  </div>
                  <div
                    style={{
                      fontSize: '11px',
                      color: 'var(--nexus-dim)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {ticket.subject}
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--nexus-dim)', marginTop: '2px' }}>
                    {ticket.username} • {getTimeAgo(ticket.created_at)}
                  </div>
                </div>
                {ticket.unread_count !== undefined && ticket.unread_count > 0 && (
                  <div
                    style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--nexus-red)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '10px',
                      fontWeight: 'bold',
                      color: 'white',
                      flexShrink: 0,
                    }}
                  >
                    {ticket.unread_count}
                  </div>
                )}
                <div
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: STATUS_COLORS[ticket.status].bg,
                    flexShrink: 0,
                  }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div
            style={{
              padding: '8px',
              borderTop: '1px solid var(--nexus-border)',
              display: 'flex',
              gap: '4px',
              fontSize: '11px',
            }}
          >
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              style={{
                flex: 1,
                padding: '4px',
                backgroundColor: 'var(--nexus-dark)',
                color: page === 1 ? 'var(--nexus-dim)' : 'var(--nexus-cyan)',
                border: '1px solid var(--nexus-border)',
                borderRadius: '3px',
                cursor: page === 1 ? 'not-allowed' : 'pointer',
              }}
            >
              Prev
            </button>
            <div
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--nexus-text)',
              }}
            >
              {page} / {totalPages}
            </div>
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              style={{
                flex: 1,
                padding: '4px',
                backgroundColor: 'var(--nexus-dark)',
                color: page === totalPages ? 'var(--nexus-dim)' : 'var(--nexus-cyan)',
                border: '1px solid var(--nexus-border)',
                borderRadius: '3px',
                cursor: page === totalPages ? 'not-allowed' : 'pointer',
              }}
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* ── CENTER COLUMN: Conversation ── */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'var(--nexus-dark)',
          overflow: 'hidden',
          minWidth: 0,
        }}
      >
        {!selectedTicket ? (
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--nexus-dim)',
            }}
          >
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📋</div>
            <div style={{ fontSize: '18px' }}>Select a ticket to view details</div>
          </div>
        ) : (
          <>
            {/* Ticket header */}
            <div
              style={{
                padding: '16px',
                borderBottom: '1px solid var(--nexus-border)',
                backgroundColor: 'var(--nexus-card)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: '14px', color: 'var(--nexus-dim)', marginBottom: '4px' }}>
                    Ticket #{selectedTicket.id} •{' '}
                    <span style={{ color: STATUS_COLORS[selectedTicket.status].text, fontWeight: 'bold' }}>
                      {STATUS_COLORS[selectedTicket.status].label}
                    </span>{' '}
                    • {selectedTicket.category}
                  </div>
                  <h1
                    style={{
                      margin: '0 0 8px 0',
                      fontSize: '20px',
                      fontWeight: 'bold',
                      color: 'var(--nexus-text)',
                    }}
                  >
                    {selectedTicket.subject}
                  </h1>
                  <div style={{ fontSize: '13px', color: 'var(--nexus-dim)' }}>
                    <strong>From:</strong> {selectedTicket.username} ({selectedTicket.user_id})
                    {selectedTicket.guild_id && (
                      <>
                        <br />
                        <strong>Guild:</strong> {selectedTicket.guild_id}
                      </>
                    )}
                  </div>
                  {selectedTicket.status === 'closed' && selectedTicket.closed_reason && (
                    <div
                      style={{
                        marginTop: '8px',
                        padding: '8px 10px',
                        backgroundColor: 'rgba(237, 66, 69, 0.1)',
                        border: '1px solid rgba(237, 66, 69, 0.3)',
                        borderRadius: '4px',
                        fontSize: '12px',
                        color: 'var(--nexus-text)',
                      }}
                    >
                      <strong style={{ color: 'var(--nexus-red)' }}>Close Reason:</strong>{' '}
                      {selectedTicket.closed_reason}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', flexShrink: 0, marginLeft: '12px' }}>
                  {selectedTicket.status === 'open' && (
                    <button
                      onClick={handleClaim}
                      style={{
                        padding: '8px 12px',
                        backgroundColor: 'var(--nexus-cyan)',
                        color: 'var(--nexus-dark)',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontWeight: 'bold',
                      }}
                    >
                      Claim
                    </button>
                  )}
                  {selectedTicket.status !== 'closed' && (
                    <button
                      onClick={handleClose}
                      style={{
                        padding: '8px 12px',
                        backgroundColor: 'var(--nexus-red)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontWeight: 'bold',
                      }}
                    >
                      Close
                    </button>
                  )}
                  {selectedTicket.status === 'closed' && (
                    <button
                      onClick={handleReopen}
                      style={{
                        padding: '8px 12px',
                        backgroundColor: 'var(--nexus-blue)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontWeight: 'bold',
                      }}
                    >
                      Reopen
                    </button>
                  )}
                  <button
                    onClick={handleBanUser}
                    style={{
                      padding: '8px 12px',
                      backgroundColor: 'var(--nexus-purple)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: 'bold',
                    }}
                  >
                    Ban User
                  </button>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div
              ref={messagesContainerRef}
              onScroll={handleMessagesScroll}
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '16px',
              }}
            >
              {messages.map((msg) => {
                const attachments = msg.attachments || [];
                return (
                  <div
                    key={msg.id}
                    style={{
                      marginBottom: '12px',
                      padding: '10px',
                      backgroundColor:
                        msg.author_type === 'user'
                          ? 'rgba(0, 255, 255, 0.1)'
                          : 'rgba(255, 255, 255, 0.05)',
                      borderLeft:
                        msg.author_type === 'user'
                          ? '3px solid var(--nexus-cyan)'
                          : '3px solid var(--nexus-dim)',
                      borderRadius: '3px',
                    }}
                  >
                    <div style={{ fontSize: '11px', color: 'var(--nexus-dim)', marginBottom: '4px' }}>
                      <strong>{msg.author_name}</strong> ({msg.author_type})
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--nexus-text)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                      {msg.message}
                    </div>
                    {attachments.length > 0 && (
                      <div style={{ marginTop: '8px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {attachments.map((att, idx) =>
                          isImage(att) ? (
                            <a
                              key={idx}
                              href={att.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                display: 'inline-block',
                                maxWidth: '200px',
                                maxHeight: '200px',
                                borderRadius: '3px',
                                overflow: 'hidden',
                              }}
                            >
                              <img
                                src={att.url}
                                alt={att.filename}
                                style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer' }}
                              />
                            </a>
                          ) : (
                            <a
                              key={idx}
                              href={att.url}
                              download={att.filename}
                              style={{
                                padding: '6px 8px',
                                backgroundColor: 'rgba(0, 255, 255, 0.2)',
                                borderRadius: '3px',
                                fontSize: '12px',
                                color: 'var(--nexus-cyan)',
                                textDecoration: 'none',
                                cursor: 'pointer',
                              }}
                            >
                              📎 {att.filename}
                            </a>
                          )
                        )}
                      </div>
                    )}
                    <div style={{ fontSize: '10px', color: 'var(--nexus-dim)', marginTop: '4px' }}>
                      {getTimeAgo(msg.created_at)}
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Reply box */}
            {selectedTicket.status !== 'closed' && (
              <div
                style={{
                  padding: '16px',
                  borderTop: '1px solid var(--nexus-border)',
                  backgroundColor: 'var(--nexus-card)',
                  display: 'flex',
                  gap: '8px',
                  flexDirection: 'column',
                }}
              >
                <textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Type your reply here..."
                  style={{
                    padding: '8px',
                    backgroundColor: 'var(--nexus-dark)',
                    color: 'var(--nexus-text)',
                    border: '1px solid var(--nexus-border)',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontFamily: 'inherit',
                    resize: 'vertical',
                    minHeight: '60px',
                    boxSizing: 'border-box',
                  }}
                />
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={handleReply}
                    disabled={replying || !replyText.trim()}
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      backgroundColor: replying || !replyText.trim() ? 'var(--nexus-dim)' : 'var(--nexus-cyan)',
                      color: 'var(--nexus-dark)',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: replying || !replyText.trim() ? 'not-allowed' : 'pointer',
                      fontSize: '12px',
                      fontWeight: 'bold',
                    }}
                  >
                    {replying ? 'Sending...' : 'Send Reply'}
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    style={{
                      padding: '8px 12px',
                      backgroundColor: uploading ? 'var(--nexus-dim)' : 'var(--nexus-blue)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: uploading ? 'not-allowed' : 'pointer',
                      fontSize: '12px',
                      fontWeight: 'bold',
                    }}
                  >
                    {uploading ? 'Uploading...' : 'Upload File'}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    onChange={handleFileUpload}
                    style={{ display: 'none' }}
                  />
                </div>
                {uploadStatus && (
                  <div style={{
                    padding: '4px 8px',
                    fontSize: '11px',
                    color: uploadStatus.startsWith('Failed') ? 'var(--nexus-red)' : 'var(--nexus-green)',
                    opacity: 0.9,
                  }}>
                    {uploadStatus}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── RIGHT COLUMN: Info Panel (Banned Users + Evidence) ── */}
      <div
        style={{
          width: '340px',
          minWidth: '340px',
          backgroundColor: 'var(--nexus-card)',
          borderLeft: '1px solid var(--nexus-border)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Tab switcher */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid var(--nexus-border)',
          }}
        >
          <button
            onClick={() => setRightPanelTab('evidence')}
            style={{
              flex: 1,
              padding: '10px 8px',
              fontSize: '12px',
              fontWeight: 'bold',
              backgroundColor: rightPanelTab === 'evidence' ? 'var(--nexus-dark)' : 'transparent',
              color: rightPanelTab === 'evidence' ? 'var(--nexus-cyan)' : 'var(--nexus-dim)',
              border: 'none',
              borderBottom: rightPanelTab === 'evidence' ? '2px solid var(--nexus-cyan)' : '2px solid transparent',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            {getInfoTabLabel()}
            {getInfoTabBadgeCount() > 0 && (
              <span style={{
                marginLeft: '6px',
                padding: '1px 5px',
                fontSize: '10px',
                backgroundColor: 'var(--nexus-cyan)',
                color: 'var(--nexus-dark)',
                borderRadius: '8px',
                fontWeight: 'bold',
              }}>
                {getInfoTabBadgeCount()}
              </span>
            )}
          </button>
          <button
            onClick={() => setRightPanelTab('banned')}
            style={{
              flex: 1,
              padding: '10px 8px',
              fontSize: '12px',
              fontWeight: 'bold',
              backgroundColor: rightPanelTab === 'banned' ? 'var(--nexus-dark)' : 'transparent',
              color: rightPanelTab === 'banned' ? 'var(--nexus-red)' : 'var(--nexus-dim)',
              border: 'none',
              borderBottom: rightPanelTab === 'banned' ? '2px solid var(--nexus-red)' : '2px solid transparent',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            Banned Users
            {bannedUsers.length > 0 && (
              <span style={{
                marginLeft: '6px',
                padding: '1px 5px',
                fontSize: '10px',
                backgroundColor: 'var(--nexus-red)',
                color: 'white',
                borderRadius: '8px',
                fontWeight: 'bold',
              }}>
                {bannedUsers.length}
              </span>
            )}
          </button>
        </div>

        {/* Panel content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
          {/* ── Dynamic info tab (changes per ticket category) ── */}
          {rightPanelTab === 'evidence' && (
            <>
              {!selectedTicket ? (
                <div style={{ fontSize: '12px', color: 'var(--nexus-dim)', textAlign: 'center', padding: '24px' }}>
                  Select a ticket to view details
                </div>
              ) : selectedTicket.category === 'appeal' ? (
                /* ── APPEAL: Evidence & History ── */
                <>
                  {!hasEvidence ? (
                    <div style={{ fontSize: '12px', color: 'var(--nexus-dim)', textAlign: 'center', padding: '24px' }}>
                      No evidence or history found for this user
                    </div>
                  ) : (
                    <>
                      {evidence?.banRecord && (
                        <div style={{ marginBottom: '16px' }}>
                          <div style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--nexus-red)', marginBottom: '8px' }}>
                            Ban Record
                          </div>
                          <div
                            style={{
                              padding: '8px',
                              backgroundColor: 'rgba(255, 255, 255, 0.05)',
                              borderRadius: '3px',
                              fontSize: '11px',
                              color: 'var(--nexus-text)',
                              borderLeft: '3px solid var(--nexus-red)',
                            }}
                          >
                            <div><strong>Type:</strong> {evidence.banRecord.type}</div>
                            <div><strong>Reason:</strong> {evidence.banRecord.reason}</div>
                            <div><strong>Banned By:</strong> {evidence.banRecord.banned_by}</div>
                          </div>
                        </div>
                      )}

                      {evidence && evidence.modCases.length > 0 && (
                        <div style={{ marginBottom: '16px' }}>
                          <div style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--nexus-yellow)', marginBottom: '8px' }}>
                            Mod Cases ({evidence.modCases.length})
                          </div>
                          {evidence.modCases.map((modCase) => (
                            <div
                              key={modCase.id}
                              style={{
                                padding: '8px',
                                marginBottom: '6px',
                                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                                borderRadius: '3px',
                                fontSize: '11px',
                                color: 'var(--nexus-text)',
                              }}
                            >
                              <div><strong>Case #{modCase.case_number}:</strong> {modCase.action}</div>
                              <div style={{ color: 'var(--nexus-dim)' }}>
                                {modCase.reason || 'No reason provided'}
                              </div>
                              <div style={{ color: 'var(--nexus-dim)', marginTop: '4px' }}>
                                By {modCase.moderator_id} • {getTimeAgo(modCase.created_at)}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {evidence && evidence.automodLogs.length > 0 && (
                        <div style={{ marginBottom: '16px' }}>
                          <div style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--nexus-blue)', marginBottom: '8px' }}>
                            Automod Logs ({evidence.automodLogs.length})
                          </div>
                          {evidence.automodLogs.map((log) => (
                            <div
                              key={log.id}
                              style={{
                                padding: '8px',
                                marginBottom: '6px',
                                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                                borderRadius: '3px',
                                fontSize: '11px',
                                color: 'var(--nexus-text)',
                              }}
                            >
                              <div><strong>{log.violation_type}:</strong> {log.action}</div>
                              {log.message_content && (
                                <div style={{ color: 'var(--nexus-dim)', marginTop: '4px', wordBreak: 'break-word' }}>
                                  &quot;{log.message_content.substring(0, 100)}&quot;
                                  {log.message_content.length > 100 ? '...' : ''}
                                </div>
                              )}
                              <div style={{ color: 'var(--nexus-dim)', marginTop: '4px' }}>
                                {getTimeAgo(log.created_at)}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {evidence && evidence.reports.length > 0 && (
                        <div style={{ marginBottom: '0' }}>
                          <div style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--nexus-green)', marginBottom: '8px' }}>
                            Reports ({evidence.reports.length})
                          </div>
                          {evidence.reports.map((report) => (
                            <div
                              key={report.id}
                              style={{
                                padding: '8px',
                                marginBottom: '6px',
                                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                                borderRadius: '3px',
                                fontSize: '11px',
                                color: 'var(--nexus-text)',
                              }}
                            >
                              <div><strong>Report #{report.report_number}:</strong> {report.type}</div>
                              <div style={{ color: 'var(--nexus-dim)' }}>{report.description}</div>
                              {report.evidence && (
                                <div style={{ color: 'var(--nexus-dim)', marginTop: '4px', wordBreak: 'break-word' }}>
                                  Evidence: {report.evidence.substring(0, 100)}
                                  {report.evidence.length > 100 ? '...' : ''}
                                </div>
                              )}
                              <div style={{ color: 'var(--nexus-dim)', marginTop: '4px' }}>
                                Status: {report.status} • {getTimeAgo(report.created_at)}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </>
              ) : selectedTicket.category === 'bug' ? (
                /* ── BUG: Reports & Logs ── */
                <>
                  {(evidence?.automodLogs.length === 0 && evidence?.reports.length === 0) ? (
                    <div style={{ fontSize: '12px', color: 'var(--nexus-dim)', textAlign: 'center', padding: '24px' }}>
                      No related reports or logs found for this user
                    </div>
                  ) : (
                    <>
                      {evidence && evidence.automodLogs.length > 0 && (
                        <div style={{ marginBottom: '16px' }}>
                          <div style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--nexus-blue)', marginBottom: '8px' }}>
                            Automod Logs ({evidence.automodLogs.length})
                          </div>
                          {evidence.automodLogs.map((log) => (
                            <div
                              key={log.id}
                              style={{
                                padding: '8px',
                                marginBottom: '6px',
                                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                                borderRadius: '3px',
                                fontSize: '11px',
                                color: 'var(--nexus-text)',
                              }}
                            >
                              <div><strong>{log.violation_type}:</strong> {log.action}</div>
                              {log.message_content && (
                                <div style={{ color: 'var(--nexus-dim)', marginTop: '4px', wordBreak: 'break-word' }}>
                                  &quot;{log.message_content.substring(0, 100)}&quot;
                                  {log.message_content.length > 100 ? '...' : ''}
                                </div>
                              )}
                              <div style={{ color: 'var(--nexus-dim)', marginTop: '4px' }}>
                                {getTimeAgo(log.created_at)}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {evidence && evidence.reports.length > 0 && (
                        <div style={{ marginBottom: '0' }}>
                          <div style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--nexus-green)', marginBottom: '8px' }}>
                            Bug Reports ({evidence.reports.length})
                          </div>
                          {evidence.reports.map((report) => (
                            <div
                              key={report.id}
                              style={{
                                padding: '8px',
                                marginBottom: '6px',
                                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                                borderRadius: '3px',
                                fontSize: '11px',
                                color: 'var(--nexus-text)',
                              }}
                            >
                              <div><strong>Report #{report.report_number}:</strong> {report.type}</div>
                              <div style={{ color: 'var(--nexus-dim)' }}>{report.description}</div>
                              {report.evidence && (
                                <div style={{ color: 'var(--nexus-dim)', marginTop: '4px', wordBreak: 'break-word' }}>
                                  Evidence: {report.evidence.substring(0, 100)}
                                  {report.evidence.length > 100 ? '...' : ''}
                                </div>
                              )}
                              <div style={{ color: 'var(--nexus-dim)', marginTop: '4px' }}>
                                Status: {report.status} • {getTimeAgo(report.created_at)}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}

                  {/* Also show attachments for bug tickets (screenshots of the bug) */}
                  {allAttachments.length > 0 && (
                    <div style={{ marginTop: '16px' }}>
                      <div style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--nexus-cyan)', marginBottom: '8px' }}>
                        Attached Files ({allAttachments.length})
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {allAttachments.map((att, idx) => {
                          const isImage = att.contentType?.startsWith('image/') || /\.(png|jpg|jpeg|gif|webp)$/i.test(att.filename);
                          return (
                            <div key={idx}>
                              {isImage ? (
                                <a href={att.url} target="_blank" rel="noopener noreferrer" style={{ display: 'block' }}>
                                  <img
                                    src={att.url}
                                    alt={att.filename}
                                    style={{
                                      width: '100%',
                                      borderRadius: '4px',
                                      border: '1px solid var(--nexus-border)',
                                      cursor: 'pointer',
                                    }}
                                  />
                                </a>
                              ) : (
                                <a
                                  href={att.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{
                                    display: 'block',
                                    padding: '8px',
                                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                                    borderRadius: '3px',
                                    fontSize: '11px',
                                    color: 'var(--nexus-cyan)',
                                    textDecoration: 'none',
                                    wordBreak: 'break-word',
                                  }}
                                >
                                  📎 {att.filename}
                                </a>
                              )}
                              <div style={{ fontSize: '10px', color: 'var(--nexus-dim)', marginTop: '2px' }}>
                                {att.author} ({att.authorType}) • {getTimeAgo(att.timestamp)}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                /* ── HELP / SUGGESTION / FEEDBACK: Attachments gallery ── */
                <>
                  {allAttachments.length === 0 ? (
                    <div style={{ fontSize: '12px', color: 'var(--nexus-dim)', textAlign: 'center', padding: '24px' }}>
                      No attachments in this conversation
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--nexus-cyan)', marginBottom: '4px' }}>
                        All Files ({allAttachments.length})
                      </div>
                      {allAttachments.map((att, idx) => {
                        const isImage = att.contentType?.startsWith('image/') || /\.(png|jpg|jpeg|gif|webp)$/i.test(att.filename);
                        return (
                          <div key={idx}>
                            {isImage ? (
                              <a href={att.url} target="_blank" rel="noopener noreferrer" style={{ display: 'block' }}>
                                <img
                                  src={att.url}
                                  alt={att.filename}
                                  style={{
                                    width: '100%',
                                    borderRadius: '4px',
                                    border: '1px solid var(--nexus-border)',
                                    cursor: 'pointer',
                                  }}
                                />
                              </a>
                            ) : (
                              <a
                                href={att.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  padding: '10px',
                                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                                  borderRadius: '4px',
                                  fontSize: '12px',
                                  color: 'var(--nexus-cyan)',
                                  textDecoration: 'none',
                                  border: '1px solid var(--nexus-border)',
                                  wordBreak: 'break-word',
                                }}
                              >
                                📎 {att.filename}
                              </a>
                            )}
                            <div style={{ fontSize: '10px', color: 'var(--nexus-dim)', marginTop: '3px' }}>
                              {att.author} ({att.authorType}) • {getTimeAgo(att.timestamp)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {/* ── Banned Users tab ── */}
          {rightPanelTab === 'banned' && (
            <>
              {banError && (
                <div
                  style={{
                    padding: '8px',
                    backgroundColor: 'rgba(255, 0, 0, 0.1)',
                    borderLeft: '3px solid var(--nexus-red)',
                    borderRadius: '3px',
                    fontSize: '12px',
                    color: 'var(--nexus-red)',
                    marginBottom: '12px',
                  }}
                >
                  {banError}
                </div>
              )}
              {bannedUsers.length === 0 ? (
                <div style={{ fontSize: '12px', color: 'var(--nexus-dim)', textAlign: 'center', padding: '24px' }}>
                  No banned users
                </div>
              ) : (
                bannedUsers.map((ban) => (
                  <div
                    key={ban.user_id}
                    style={{
                      marginBottom: '12px',
                      padding: '10px',
                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                      borderLeft: '3px solid var(--nexus-red)',
                      borderRadius: '3px',
                    }}
                  >
                    <div style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--nexus-text)', marginBottom: '4px' }}>
                      {ban.username} ({ban.user_id})
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--nexus-dim)', marginBottom: '6px' }}>
                      <strong>Reason:</strong> {ban.reason}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--nexus-dim)', marginBottom: '8px' }}>
                      <strong>Banned by:</strong> {ban.banned_by} • {getTimeAgo(ban.created_at)}
                    </div>
                    <button
                      onClick={() => handleUnbanUser(ban.user_id)}
                      style={{
                        padding: '4px 8px',
                        backgroundColor: 'var(--nexus-green)',
                        color: 'var(--nexus-dark)',
                        border: 'none',
                        borderRadius: '3px',
                        cursor: 'pointer',
                        fontSize: '11px',
                        fontWeight: 'bold',
                      }}
                    >
                      Unban
                    </button>
                  </div>
                ))
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Reason Modal (Close / Ban) ── */}
      {modal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(4px)',
          }}
          onClick={() => { setModal(null); setModalReason(''); }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '420px',
              maxWidth: '90vw',
              backgroundColor: 'var(--nexus-card)',
              border: '1px solid var(--nexus-border)',
              borderRadius: '8px',
              overflow: 'hidden',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
            }}
          >
            {/* Modal header */}
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid var(--nexus-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: modal.type === 'ban' ? 'var(--nexus-purple)' : 'var(--nexus-red)',
                  }}
                />
                <span style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--nexus-text)' }}>
                  {modal.title}
                </span>
              </div>
              <button
                onClick={() => { setModal(null); setModalReason(''); }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--nexus-dim)',
                  cursor: 'pointer',
                  fontSize: '18px',
                  lineHeight: 1,
                  padding: '0 4px',
                }}
              >
                ✕
              </button>
            </div>

            {/* Modal body */}
            <div style={{ padding: '20px' }}>
              <label style={{ fontSize: '12px', color: 'var(--nexus-dim)', display: 'block', marginBottom: '8px' }}>
                Reason {modal.required ? '' : '(optional)'}
              </label>
              <textarea
                ref={modalInputRef}
                value={modalReason}
                onChange={(e) => setModalReason(e.target.value)}
                placeholder={modal.placeholder}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (modal.type === 'close') confirmClose();
                    else if (!modal.required || modalReason.trim()) confirmBan();
                  }
                  if (e.key === 'Escape') { setModal(null); setModalReason(''); }
                }}
                style={{
                  width: '100%',
                  minHeight: '80px',
                  padding: '10px 12px',
                  backgroundColor: 'var(--nexus-dark)',
                  color: 'var(--nexus-text)',
                  border: '1px solid var(--nexus-border)',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                  boxSizing: 'border-box',
                  outline: 'none',
                }}
              />
            </div>

            {/* Modal footer */}
            <div
              style={{
                padding: '12px 20px 16px',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '8px',
              }}
            >
              <button
                onClick={() => { setModal(null); setModalReason(''); }}
                style={{
                  padding: '8px 16px',
                  backgroundColor: 'transparent',
                  color: 'var(--nexus-dim)',
                  border: '1px solid var(--nexus-border)',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: 'bold',
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (modal.type === 'close') confirmClose();
                  else confirmBan();
                }}
                disabled={modal.required && !modalReason.trim()}
                style={{
                  padding: '8px 16px',
                  backgroundColor: modal.required && !modalReason.trim()
                    ? 'var(--nexus-dim)'
                    : modal.type === 'ban' ? 'var(--nexus-purple)' : 'var(--nexus-red)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: modal.required && !modalReason.trim() ? 'not-allowed' : 'pointer',
                  fontSize: '12px',
                  fontWeight: 'bold',
                }}
              >
                {modal.type === 'close' ? 'Close Ticket' : 'Ban User'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TicketsPage() {
  return <TicketsPageContent category={null} />;
}
