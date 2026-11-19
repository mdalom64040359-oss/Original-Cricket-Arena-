import React, {useState} from 'react';
import {
  AlertCircle,
  CheckCircle2,
  KeyRound,
  Lock,
  LogOut,
  Shield,
  Trash2,
} from 'lucide-react';
import {useUser, type AuthActionError} from '../../contexts/UserContext';
import type {PrivacySettings} from '../../types/user';

export const AccountSecurityPanel: React.FC = () => {
  const {
    t,
    language,
    firebaseUser,
    profile,
    updatePrivacySettings,
    changeUserPassword,
    deleteUserAccount,
    logout,
  } = useUser();

  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwMsg, setPwMsg] = useState<{type: 'ok' | 'err'; text: string} | null>(null);
  const [pwBusy, setPwBusy] = useState(false);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteErr, setDeleteErr] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const hasPasswordProvider =
    firebaseUser?.providerData.some((p) => p.providerId === 'password') ?? false;

  const togglePrivacy = async (
    key: keyof Omit<PrivacySettings, 'profileVisibility'>,
  ) => {
    await updatePrivacySettings({[key]: !profile.privacySettings[key]});
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwMsg(null);
    if (newPw.length < 6) {
      setPwMsg({
        type: 'err',
        text:
          language === 'bn'
            ? 'নতুন পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।'
            : 'New password must be at least 6 characters.',
      });
      return;
    }
    if (newPw !== confirmPw) {
      setPwMsg({
        type: 'err',
        text:
          language === 'bn'
            ? 'নতুন পাসওয়ার্ড দুটি মেলেনি।'
            : 'New passwords do not match.',
      });
      return;
    }

    setPwBusy(true);
    try {
      await changeUserPassword(currentPw, newPw);
      setCurrentPw('');
      setNewPw('');
      setConfirmPw('');
      setPwMsg({
        type: 'ok',
        text:
          language === 'bn'
            ? 'পাসওয়ার্ড সফলভাবে পরিবর্তন হয়েছে।'
            : 'Password updated successfully.',
      });
    } catch (err) {
      const authErr = err as AuthActionError;
      setPwMsg({type: 'err', text: authErr.message});
    } finally {
      setPwBusy(false);
    }
  };

  const handleConfirmDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeleteErr(null);
    setDeleteBusy(true);
    try {
      await deleteUserAccount(hasPasswordProvider ? deletePassword : undefined);
      setShowDeleteConfirm(false);
    } catch (err) {
      const authErr = err as AuthActionError;
      setDeleteErr(authErr.message);
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Privacy Settings */}
      <div className="rounded-2xl bg-[#101612] border border-white/10 p-5 sm:p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#0D3B24] border border-[#22C55E]/30 flex items-center justify-center text-[#4ADE80] shrink-0">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-display text-lg font-bold text-white">{t.panel.privacyTitle}</h3>
            <p className="text-xs text-[#9CB0A4]">{t.panel.personalIsolationNote}</p>
          </div>
        </div>

        <div className="rounded-xl bg-[#0B100D] border border-[#22C55E]/25 p-3.5 flex items-center justify-between gap-3">
          <div>
            <div className="text-xs text-[#8FA397]">{t.panel.privacyVisibility}</div>
            <div className="text-sm font-semibold text-[#4ADE80] mt-0.5">{t.panel.onlyMeValue}</div>
          </div>
          <Lock className="w-4 h-4 text-[#4ADE80] shrink-0" />
        </div>

        <div className="space-y-2.5">
          {[
            {
              key: 'hideEmailOnScorecards' as const,
              label: t.panel.hideEmailScorecards,
            },
            {
              key: 'shareScorerNameLocally' as const,
              label: t.panel.shareScorerName,
            },
            {
              key: 'confirmBeforeBackupExport' as const,
              label: t.panel.confirmBeforeExport,
            },
            {
              key: 'clearCacheOnLogout' as const,
              label: t.panel.clearOnLogout,
            },
          ].map((item) => (
            <label
              key={item.key}
              className="flex items-center justify-between gap-3 rounded-xl bg-[#0B100D] border border-white/10 p-3.5 cursor-pointer"
            >
              <span className="text-xs sm:text-sm text-white">{item.label}</span>
              <input
                type="checkbox"
                checked={profile.privacySettings[item.key]}
                onChange={() => void togglePrivacy(item.key)}
                className="h-5 w-5 rounded border-white/25 bg-[#080C0A] accent-[#16A34A] shrink-0"
              />
            </label>
          ))}
        </div>
      </div>

      {/* Change Password & Account Actions (when signed in) */}
      {firebaseUser && (
        <>
          <div className="rounded-2xl bg-[#101612] border border-white/10 p-5 sm:p-6 space-y-4">
            <div className="flex items-center gap-3">
              <KeyRound className="w-5 h-5 text-[#4ADE80]" />
              <h3 className="font-display text-lg font-bold text-white">
                {t.panel.changePasswordTitle}
              </h3>
            </div>

            {!hasPasswordProvider ? (
              <p className="text-xs text-[#9CB0A4] rounded-xl bg-[#0B100D] border border-white/10 p-3.5">
                {t.panel.googlePasswordNote}
              </p>
            ) : (
              <form onSubmit={handlePasswordChange} className="space-y-3.5">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <label className="block space-y-1">
                    <span className="text-xs text-[#C8D6CE]">{t.panel.currentPassword}</span>
                    <input
                      type="password"
                      required
                      value={currentPw}
                      onChange={(e) => setCurrentPw(e.target.value)}
                      className="w-full min-h-[42px] rounded-xl bg-[#080C0A] border border-white/15 px-3 text-sm text-white focus:outline-none focus:border-[#22C55E]"
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-xs text-[#C8D6CE]">{t.panel.newPassword}</span>
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={newPw}
                      onChange={(e) => setNewPw(e.target.value)}
                      className="w-full min-h-[42px] rounded-xl bg-[#080C0A] border border-white/15 px-3 text-sm text-white focus:outline-none focus:border-[#22C55E]"
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-xs text-[#C8D6CE]">{t.panel.confirmNewPassword}</span>
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={confirmPw}
                      onChange={(e) => setConfirmPw(e.target.value)}
                      className="w-full min-h-[42px] rounded-xl bg-[#080C0A] border border-white/15 px-3 text-sm text-white focus:outline-none focus:border-[#22C55E]"
                    />
                  </label>
                </div>

                {pwMsg && (
                  <div
                    className={`rounded-xl p-3 flex items-center gap-2 text-xs ${
                      pwMsg.type === 'ok'
                        ? 'bg-[#0D3B24]/60 border border-[#22C55E]/30 text-[#4ADE80]'
                        : 'bg-rose-500/10 border border-rose-500/30 text-rose-300'
                    }`}
                  >
                    {pwMsg.type === 'ok' ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 shrink-0" />
                    )}
                    <span>{pwMsg.text}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={pwBusy}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#16A34A] hover:bg-[#15803D] disabled:opacity-60 px-4 py-2.5 min-h-[42px] text-xs sm:text-sm font-semibold text-white"
                >
                  <KeyRound className="w-4 h-4" />
                  <span>{t.panel.updatePasswordBtn}</span>
                </button>
              </form>
            )}
          </div>

          {/* Logout & Delete Account */}
          <div className="rounded-2xl bg-[#101612] border border-rose-500/25 p-5 sm:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-white/10">
              <div>
                <h3 className="font-display text-base font-bold text-white">{t.panel.logout}</h3>
                <p className="text-xs text-[#9CB0A4]">
                  {language === 'bn'
                    ? 'অ্যাকাউন্ট থেকে সাইন আউট করুন; আপনার লোকাল ম্যাচ রেকর্ড নিরাপদ থাকবে।'
                    : 'Sign out safely from this device while preserving local cricket records.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void logout()}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#161F19] hover:bg-[#1E2B23] border border-white/15 px-4 py-2.5 min-h-[42px] text-xs sm:text-sm font-semibold text-white whitespace-nowrap"
              >
                <LogOut className="w-4 h-4 text-[#4ADE80]" />
                <span>{t.panel.logout}</span>
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <h4 className="font-display text-base font-bold text-rose-300">
                  {t.panel.deleteAccountTitle}
                </h4>
                <p className="text-xs text-[#9CB0A4] mt-0.5">{t.panel.deleteAccountWarning}</p>
              </div>

              {!showDeleteConfirm ? (
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="inline-flex items-center gap-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/35 px-4 py-2.5 min-h-[42px] text-xs sm:text-sm font-semibold text-rose-200"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>{t.panel.deleteAccountBtn}</span>
                </button>
              ) : (
                <form
                  onSubmit={handleConfirmDelete}
                  className="rounded-xl bg-rose-950/30 border border-rose-500/40 p-4 space-y-3"
                >
                  <div className="text-xs font-semibold text-rose-200">{t.panel.confirmDeleteTitle}</div>
                  {hasPasswordProvider && (
                    <input
                      type="password"
                      required
                      value={deletePassword}
                      onChange={(e) => setDeletePassword(e.target.value)}
                      placeholder={t.panel.enterPasswordDelete}
                      className="w-full min-h-[42px] rounded-xl bg-[#080C0A] border border-rose-500/35 px-3.5 text-sm text-white placeholder-[#8FA397] focus:outline-none focus:border-rose-400"
                    />
                  )}
                  {deleteErr && <p className="text-xs text-rose-300">{deleteErr}</p>}
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="submit"
                      disabled={deleteBusy}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-60 px-4 py-2 text-xs font-semibold text-white"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{t.panel.deleteAccountBtn}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowDeleteConfirm(false);
                        setDeletePassword('');
                        setDeleteErr(null);
                      }}
                      className="rounded-xl bg-[#141D17] border border-white/15 px-4 py-2 text-xs font-semibold text-[#C8D6CE]"
                    >
                      {language === 'bn' ? 'বাতিল' : 'Cancel'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
