import React, { useRef, useEffect } from 'react';
import { useMarket } from '../../context/MarketContext';
import { Bell, Check, CheckCheck, TrendingUp, AlertTriangle, ShieldCheck, ArrowRight } from 'lucide-react';

interface NotificationDropdownProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NotificationDropdown: React.FC<NotificationDropdownProps> = ({ isOpen, onClose }) => {
  const { notifications, markNotificationAsRead, clearNotifications, navigateTo } = useMarket();
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div
      ref={dropdownRef}
      className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-slate-900 border border-slate-800 rounded-2xl elevation-popover z-50 overflow-hidden"
    >
      <div className="p-3.5 border-b border-slate-800/80 flex items-center justify-between bg-slate-950/40">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="font-semibold text-sm text-slate-100">Notifications</span>
          {unreadCount > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-mono font-medium tabular-nums">
              {unreadCount} new
            </span>
          )}
        </div>
        {notifications.length > 0 && (
          <button
            onClick={clearNotifications}
            className="text-xs text-slate-400 hover:text-slate-200 px-2 py-1 rounded-md btn-tactile cursor-pointer"
          >
            Clear all
          </button>
        )}
      </div>

      <div className="max-h-80 overflow-y-auto divide-y divide-slate-800/50">
        {notifications.length === 0 ? (
          <div className="p-6 text-center text-slate-500 text-sm">
            No notifications yet
          </div>
        ) : (
          notifications.map((notif) => {
            const timeAgo = Math.round((Date.now() - new Date(notif.timestamp).getTime()) / 60000);
            const timeStr = timeAgo <= 1 ? 'Just now' : `${timeAgo}m ago`;

            return (
              <div
                key={notif.id}
                onClick={() => {
                  markNotificationAsRead(notif.id);
                  if (notif.marketId) {
                    navigateTo('detail', notif.marketId);
                    onClose();
                  }
                }}
                className={`p-3.5 hover:bg-slate-800/50 cursor-pointer transition-colors flex items-start gap-3 ${
                  !notif.read ? 'bg-slate-850/60' : ''
                }`}
              >
                <div className="mt-0.5 shrink-0">
                  {notif.type === 'trade' && (
                    <div className="w-6 h-6 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                      <TrendingUp className="w-3.5 h-3.5" />
                    </div>
                  )}
                  {notif.type === 'resolution' && (
                    <div className="w-6 h-6 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400">
                      <Check className="w-3.5 h-3.5" />
                    </div>
                  )}
                  {notif.type === 'system' && (
                    <div className="w-6 h-6 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-400">
                      <ShieldCheck className="w-3.5 h-3.5" />
                    </div>
                  )}
                  {notif.type === 'market' && (
                    <div className="w-6 h-6 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                      <ArrowRight className="w-3.5 h-3.5" />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <h4 className="text-xs font-semibold text-slate-200 truncate">
                      {notif.title}
                    </h4>
                    <span className="text-[10px] text-slate-500 shrink-0 font-mono tabular-nums">
                      {timeStr}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5 line-clamp-2 leading-relaxed text-wrap-pretty">
                    {notif.message}
                  </p>
                </div>

                {!notif.read && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0 mt-2" />
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
