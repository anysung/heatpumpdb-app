/**
 * InboxPage — support ticket inbox (receive, answer, close user inquiries).
 * Counterpart of the in-app Support card on the user Account page.
 * Tickets carry a country code so the unified admin can filter per market.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { getAllTickets, adminReply, setTicketStatus } from '../../services/supportService';
import { SupportTicket, TicketStatus } from '../../types';
import { StatCard, SectionCard, EmptyState, PageHeader } from './shared';
import { AdminLang, ADMIN_I18N } from './adminI18n';

interface InboxPageProps {
  al: AdminLang;
  /** Restrict to one market (per-market workspace); omit for the global inbox. */
  country?: string;
  /** Rendered inside a market workspace — its own header is suppressed. */
  embedded?: boolean;
}

const STATUS_BADGE: Record<TicketStatus, string> = {
  open: 'bg-yellow-100 text-yellow-700',
  answered: 'bg-green-100 text-green-700',
  closed: 'bg-gray-100 text-gray-600',
};

export const InboxPage: React.FC<InboxPageProps> = ({ al, country, embedded }) => {
  const ko = al === 'ko';
  const A = ADMIN_I18N[al];
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<TicketStatus | 'all'>('open');
  const [countryFilter, setCountryFilter] = useState<string>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = () => {
    setLoading(true);
    getAllTickets().then(list => { setTickets(list); setLoading(false); });
  };
  useEffect(refresh, []);

  const scoped = useMemo(
    () => country ? tickets.filter(t => (t.country || 'DE') === country) : tickets,
    [tickets, country]);
  const countries = useMemo(() => Array.from(new Set(scoped.map(t => t.country))).sort(), [scoped]);
  const filtered = scoped.filter(t =>
    (statusFilter === 'all' || t.status === statusFilter) &&
    (countryFilter === 'all' || t.country === countryFilter),
  );
  const selected = tickets.find(t => t.id === selectedId) ?? null;

  const statusLabel = (s: TicketStatus) =>
    ko ? ({ open: '미답변', answered: '답변 완료', closed: '종결' }[s]) : ({ open: 'Open', answered: 'Answered', closed: 'Closed' }[s]);

  const sendReply = () => {
    if (!selected || !reply.trim() || busy) return;
    setBusy(true);
    adminReply(selected.id, 'Support team', reply.trim())
      .then(() => { setReply(''); refresh(); })
      .catch(e => alert(`Reply failed: ${e.message}`))
      .finally(() => setBusy(false));
  };

  const changeStatus = (status: TicketStatus) => {
    if (!selected) return;
    setTicketStatus(selected.id, status).then(refresh).catch(e => alert(e.message));
  };

  const openCount = scoped.filter(t => t.status === 'open').length;
  const answeredCount = scoped.filter(t => t.status === 'answered').length;

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-gray-400 animate-pulse">Loading inbox...</div>;
  }

  return (
    <div>
      {!embedded && (
        <PageHeader
          title={A.ibTitle}
          subtitle={ko ? '앱에서 접수된 문의를 확인하고 답변합니다' : 'Receive and answer in-app inquiries'}
        />
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label={A.ibOpen} value={openCount} color="yellow" icon="📬" />
        <StatCard label={A.ibAnswered} value={answeredCount} color="green" icon="✅" />
        <StatCard label={ko ? '전체' : 'Total'} value={scoped.length} color="blue" icon="🗂️" />
        <StatCard label={ko ? '마켓' : 'Markets'} value={countries.length} color="gray" icon="🌍" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {(['open', 'answered', 'closed', 'all'] as (TicketStatus | 'all')[]).map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
              statusFilter === s ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
            }`}
          >
            {s === 'all' ? (ko ? '전체' : 'All') : statusLabel(s)}
          </button>
        ))}
        {!country && countries.length > 1 && (
          <select
            value={countryFilter}
            onChange={e => setCountryFilter(e.target.value)}
            className="ml-2 px-3 py-1.5 rounded-full text-xs font-semibold border border-gray-300 bg-white"
          >
            <option value="all">{ko ? '모든 마켓' : 'All countries'}</option>
            {countries.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
        <button onClick={refresh} className="ml-auto px-3 py-1.5 rounded-full text-xs border border-gray-300 bg-white text-gray-600 hover:bg-gray-50">
          ↻ {ko ? '새로고침' : 'Refresh'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-4 items-start">
        {/* Ticket list */}
        <SectionCard title={ko ? '문의 목록' : 'Inquiries'}>
          {filtered.length === 0 ? (
            <EmptyState message={ko ? '이 조건에 해당하는 문의가 없습니다' : 'No inquiries in this view'} icon="📭" />
          ) : (
            <div className="divide-y divide-gray-100 -mx-2">
              {filtered.map(t => (
                <button
                  key={t.id}
                  onClick={() => { setSelectedId(t.id); setReply(''); }}
                  className={`w-full text-left px-2 py-3 hover:bg-gray-50 ${selectedId === t.id ? 'bg-blue-50' : ''}`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-800 flex-1 truncate">{t.subject}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_BADGE[t.status]}`}>
                      {statusLabel(t.status)}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-2">
                    <span className="font-mono text-[10px] border border-gray-200 rounded px-1">{t.country}</span>
                    <span className="truncate">{t.userName} · {t.userEmail}</span>
                    <span className="ml-auto whitespace-nowrap">{new Date(t.updatedAt).toLocaleDateString()}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </SectionCard>

        {/* Thread + reply */}
        <SectionCard title={selected ? selected.subject : (ko ? '문의를 선택하세요' : 'Select an inquiry')}>
          {!selected ? (
            <EmptyState message={ko ? '왼쪽 목록에서 문의를 선택하세요.' : 'Choose an inquiry from the list.'} icon="💬" />
          ) : (
            <div className="flex flex-col gap-3">
              <div className="text-xs text-gray-500 flex flex-wrap items-center gap-2">
                <span className="font-mono border border-gray-200 rounded px-1">{selected.country}</span>
                <span>{selected.userName} &lt;{selected.userEmail}&gt;</span>
                <span>· {ko ? '분류' : 'Category'}: {selected.category}</span>
                <span>· {new Date(selected.createdAt).toLocaleString()}</span>
                <span className="ml-auto flex gap-2">
                  {selected.status !== 'closed' ? (
                    <button onClick={() => changeStatus('closed')} className="px-2 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-50 text-xs">
                      {ko ? '종결' : 'Close'}
                    </button>
                  ) : (
                    <button onClick={() => changeStatus('open')} className="px-2 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-50 text-xs">
                      {ko ? '다시 열기' : 'Reopen'}
                    </button>
                  )}
                </span>
              </div>

              <div className="flex flex-col gap-2 max-h-[420px] overflow-y-auto pr-1">
                {selected.messages.map((m, i) => (
                  <div key={i} className={`flex flex-col ${m.from === 'admin' ? 'items-end' : 'items-start'}`}>
                    <span className="text-[10px] text-gray-400">
                      {m.from === 'admin' ? (ko ? '지원팀' : 'Support team') : m.authorName} · {new Date(m.at).toLocaleString()}
                    </span>
                    <span className={`text-sm rounded-xl px-3 py-2 max-w-[85%] whitespace-pre-wrap ${
                      m.from === 'admin' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800'
                    }`}>{m.text}</span>
                  </div>
                ))}
              </div>

              {selected.status !== 'closed' && (
                <div className="flex gap-2 pt-2 border-t border-gray-100">
                  <textarea
                    value={reply}
                    onChange={e => setReply(e.target.value)}
                    rows={2}
                    placeholder={ko ? '답변을 입력하세요…' : 'Write a reply…'}
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500 resize-y"
                    maxLength={4000}
                  />
                  <button
                    onClick={sendReply}
                    disabled={busy || !reply.trim()}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg self-end disabled:opacity-50"
                  >
                    {ko ? '보내기' : 'Send'}
                  </button>
                </div>
              )}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
};
