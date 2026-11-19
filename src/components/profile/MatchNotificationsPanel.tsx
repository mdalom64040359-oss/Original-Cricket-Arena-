import React, {useState} from 'react';
import {Bell, CheckCheck, Radio} from 'lucide-react';
import {useUser} from '../../contexts/UserContext';
import type {MatchNotificationItem, NotificationSettings} from '../../types/user';

interface MatchNotificationsPanelProps {
  notifications: MatchNotificationItem[];
  onOpenMatch?: (matchId: string) => void;
}

export const MatchNotificationsPanel: React.FC<MatchNotificationsPanelProps> = ({
  notifications,
  onOpenMatch,
}) => {
  const {
    t,
    language,
    profile,
    readNotificationIds,
    markNotificationsRead,
    updateNotificationSettings,
  } = useUser();

  const [permStatus, setPermStatus] = useState<string | null>(null);

  const unreadCount = notifications.filter((n) => !readNotificationIds.includes(n.id)).length;

  const toggleSetting = async (key: keyof NotificationSettings) => {
    const nextVal = !profile.notificationSettings[key];
    if (key === 'browserNotifications' && nextVal && typeof Notification !== 'undefined') {
      try {
        const res = await Notification.requestPermission();
        setPermStatus(
          res === 'granted'
            ? language === 'bn'
              ? 'ব্রাউজার নোটিফিকেশন অনুমোদিত হয়েছে।'
              : 'Device notifications enabled.'
            : language === 'bn'
              ? 'ব্রাউজার অনুমতি দেয়নি — অ্যাপের ভেতরের অ্যালার্ট চালু থাকবে।'
              : 'Permission not granted — in-app match alerts remain active.',
        );
      } catch {
        // fallback cleanly
      }
    }
    await updateNotificationSettings({[key]: nextVal});
  };

  const settingRows: Array<{
    key: keyof NotificationSettings;
    labelEn: string;
    labelBn: string;
    descEn: string;
    descBn: string;
  }> = [
    {
      key: 'favTeams',
      labelEn: 'Favourite Team Updates',
      labelBn: 'প্রিয় দলের ম্যাচ আপডেট',
      descEn: 'Live scores & fixtures involving your favourite teams',
      descBn: 'আপনার পছন্দের দলের লাইভ স্কোর ও আসন্ন ম্যাচ',
    },
    {
      key: 'favPlayers',
      labelEn: 'Favourite Player Updates',
      labelBn: 'প্রিয় খেলোয়াড়ের আপডেট',
      descEn: 'Matches featuring your favourite players',
      descBn: 'আপনার পছন্দের খেলোয়াড়রা যেসব ম্যাচে খেলছেন',
    },
    {
      key: 'favLeagues',
      labelEn: 'Favourite League & Tournament Updates',
      labelBn: 'প্রিয় লিগ ও টুর্নামেন্টের আপডেট',
      descEn: 'Alerts for your followed tournaments and leagues',
      descBn: 'আপনার অনুসরণ করা লিগ ও টুর্নামেন্টের আপডেট',
    },
    {
      key: 'matchReminders',
      labelEn: 'Upcoming Match Alerts',
      labelBn: 'আসন্ন ম্যাচের রিমাইন্ডার',
      descEn: 'Notify about upcoming scheduled fixtures',
      descBn: 'আগামী নির্ধারিত ম্যাচগুলোর তথ্য',
    },
    {
      key: 'matchResults',
      labelEn: 'Completed Match Results',
      labelBn: 'ম্যাচের চূড়ান্ত ফলাফল',
      descEn: 'Final scorecards and winner summaries',
      descBn: 'ম্যাচ শেষ হওয়ার পর ফলাফলের সারাংশ',
    },
    {
      key: 'browserNotifications',
      labelEn: 'Device Notification Permission',
      labelBn: 'ডিভাইস নোটিফিকেশন অনুমতি',
      descEn: 'Use system notifications when supported by browser/Android',
      descBn: 'সমর্থিত ডিভাইসে সিস্টেম নোটিফিকেশন চালু করুন',
    },
  ];

  return (
    <div className="space-y-5">
      {/* Notification Settings */}
      <div className="rounded-2xl bg-[#101612] border border-white/10 p-5 sm:p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#0D3B24] border border-[#22C55E]/30 flex items-center justify-center text-[#4ADE80] shrink-0">
            <Bell className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-display text-lg font-bold text-white">{t.panel.notifSettingsTitle}</h3>
            <p className="text-xs text-[#9CB0A4]">
              {language === 'bn'
                ? 'কোন ধরনের ম্যাচ আপডেট দেখতে চান তা নিয়ন্ত্রণ করুন'
                : 'Control which match alerts you receive for your favourites'}
            </p>
          </div>
        </div>

        <div className="space-y-2.5">
          {settingRows.map((row) => {
            const checked = profile.notificationSettings[row.key];
            return (
              <label
                key={row.key}
                className="flex items-center justify-between gap-3 rounded-xl bg-[#0B100D] border border-white/10 p-3.5 cursor-pointer hover:border-white/20"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium text-white">
                    {language === 'bn' ? row.labelBn : row.labelEn}
                  </div>
                  <div className="text-xs text-[#8FA397] mt-0.5">
                    {language === 'bn' ? row.descBn : row.descEn}
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => void toggleSetting(row.key)}
                  className="h-5 w-5 rounded border-white/25 bg-[#080C0A] text-[#16A34A] accent-[#16A34A] shrink-0"
                />
              </label>
            );
          })}
        </div>

        {permStatus && (
          <p className="text-xs text-[#4ADE80]">{permStatus}</p>
        )}
      </div>

      {/* Match Notifications Feed */}
      <div className="rounded-2xl bg-[#101612] border border-white/10 p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Radio className="w-5 h-5 text-[#22C55E]" />
            <h3 className="font-display text-lg font-bold text-white">
              {t.panel.matchNotifsTitle}
              {unreadCount > 0 && (
                <span className="ml-2 font-mono text-xs text-[#4ADE80]">({unreadCount})</span>
              )}
            </h3>
          </div>

          {unreadCount > 0 && (
            <button
              type="button"
              onClick={() => void markNotificationsRead(notifications.map((n) => n.id))}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#4ADE80] hover:text-white"
            >
              <CheckCheck className="w-4 h-4" />
              <span>{t.panel.markAllRead}</span>
            </button>
          )}
        </div>

        {notifications.length === 0 ? (
          <div className="rounded-xl bg-[#0B100D] border border-white/10 p-4 text-xs text-[#9CB0A4]">
            {t.panel.noNotifs}
          </div>
        ) : (
          <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
            {notifications.map((item) => {
              const isRead = readNotificationIds.includes(item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    void markNotificationsRead([item.id]);
                    if (item.matchId && onOpenMatch) {
                      onOpenMatch(item.matchId);
                    }
                  }}
                  className={`w-full text-left rounded-xl border p-3.5 transition-colors ${
                    isRead
                      ? 'bg-[#0B100D] border-white/10'
                      : 'bg-[#0D3B24]/35 border-[#22C55E]/35'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-mono uppercase text-[#4ADE80]">
                      {item.status} · {item.category}
                    </span>
                    {!isRead && (
                      <span className="w-2 h-2 rounded-full bg-[#22C55E]" aria-label="Unread" />
                    )}
                  </div>
                  <div className="mt-1 text-sm font-semibold text-white">
                    {language === 'bn' ? item.titleBn : item.titleEn}
                  </div>
                  <div className="mt-0.5 text-xs text-[#9CB0A4]">
                    {language === 'bn' ? item.detailBn : item.detailEn}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
