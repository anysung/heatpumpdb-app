import React, { useState, useEffect } from 'react';
import { getUsers } from '../services/authService';
import { getAllTickets } from '../services/supportService';
import { Language } from '../types';
import { ADMIN_MENU, AdminPage } from '../config/adminConfig';
import { translations } from '../translations';

// Page components — essentials-only console
import { OverviewPage } from './admin/OverviewPage';
import { InboxPage } from './admin/InboxPage';
import { MembersPage } from './admin/MembersPage';
import { UsagePage } from './admin/UsagePage';
import { DataPage } from './admin/DataPage';
import { AuditPage } from './admin/AuditPage';

interface AdminDashboardProps {
  onLogout: () => void;
  /** Combined residential + commercial dataset loaded by the app shell. */
  cachedDatabase: any[] | null;
  lastUpdated: string | null;
  language: Language;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  onLogout, language, cachedDatabase, lastUpdated
}) => {
  const [activePage, setActivePage] = useState<AdminPage>('overview');
  const [pendingUsers, setPendingUsers] = useState(0);
  const [deletionRequests, setDeletionRequests] = useState(0);
  const [openTickets, setOpenTickets] = useState(0);
  const t = translations[language];

  // Load badge counts
  useEffect(() => {
    getUsers().then(users => {
      setPendingUsers(users.filter(u => u.status === 'pending').length);
      setDeletionRequests(users.filter(u => u.status === 'deletion_requested').length);
    });
    getAllTickets().then(tickets => {
      setOpenTickets(tickets.filter(tk => tk.status === 'open').length);
    });
  }, [activePage]);

  const badgeCtx = { pendingUsers, deletionRequests, openTickets };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col md:flex-row font-sans">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-slate-800 text-white flex-shrink-0 flex flex-col">
        <div className="p-5 border-b border-slate-700">
          <h2 className="text-lg font-bold flex items-center gap-2">🛡️ {t.adminPanel}</h2>
          <div className="text-xs text-slate-400 mt-0.5">Operations Console</div>
        </div>

        <nav className="flex-grow p-3 space-y-0.5 overflow-y-auto">
          {ADMIN_MENU.map(item => {
            const badge = item.getBadge?.(badgeCtx) || 0;
            const isActive = activePage === item.key;
            const label = language === 'de' ? item.labelDe : item.labelEn;

            return (
              <button
                key={item.key}
                onClick={() => setActivePage(item.key)}
                className={`w-full text-left px-3 py-2 rounded text-sm flex items-center justify-between transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                }`}
              >
                <span className="flex items-center gap-2">
                  <span className="text-sm">{item.icon}</span>
                  <span>{label}</span>
                </span>
                {badge > 0 && (
                  <span className="bg-yellow-400 text-slate-900 text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-slate-700">
          <button onClick={onLogout} className="text-sm text-gray-400 hover:text-white flex items-center gap-2">
            <span>🚪</span> {t.logoutAdmin}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-grow p-6 overflow-y-auto mt-16 md:mt-0 h-screen">
        {activePage === 'overview' && <OverviewPage language={language} productCount={cachedDatabase?.length ?? 0} lastUpdated={lastUpdated} />}
        {activePage === 'inbox' && <InboxPage language={language} />}
        {activePage === 'members' && <MembersPage language={language} />}
        {activePage === 'usage' && <UsagePage language={language} />}
        {activePage === 'data' && <DataPage language={language} products={cachedDatabase} lastUpdated={lastUpdated} />}
        {activePage === 'audit' && <AuditPage language={language} />}
      </main>
    </div>
  );
};
