import React, {useRef, useState} from 'react';
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  KeyRound,
  LogIn,
  Mail,
  ShieldAlert,
  Trash2,
  UserPlus,
  WifiOff,
} from 'lucide-react';
import {useUser, type AuthActionError} from '../../contexts/UserContext';
import {compressImageToDataUrl} from '../../utils/imageUtils';

interface AuthPanelProps {
  isOnline: boolean;
}

type AuthTab = 'login' | 'signup' | 'forgot';

export const AuthPanel: React.FC<AuthPanelProps> = ({isOnline}) => {
  const {t, language, signUpWithEmail, loginWithEmail, loginWithGoogle, sendForgotPassword} =
    useUser();

  const [tab, setTab] = useState<AuthTab>('login');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [clubName, setClubName] = useState('');
  const [city, setCity] = useState('');
  const [photoDataUrl, setPhotoDataUrl] = useState('');

  const [busy, setBusy] = useState(false);
  const [errorInfo, setErrorInfo] = useState<AuthActionError | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handlePhotoChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImageToDataUrl(file, 128);
      setPhotoDataUrl(compressed);
      setErrorInfo(null);
    } catch (err) {
      setErrorInfo({
        code: 'image/invalid',
        message: err instanceof Error ? err.message : 'Failed to process image.',
      });
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorInfo(null);
    setSuccessMsg(null);

    if (!isOnline) {
      setErrorInfo({
        code: 'auth/offline',
        message: t.auth.offlineAuthWarning,
      });
      return;
    }

    if (tab === 'signup') {
      if (!displayName.trim()) {
        setErrorInfo({
          code: 'validation',
          message: language === 'bn' ? 'অনুগ্রহ করে আপনার নাম লিখুন।' : 'Please enter your name.',
        });
        return;
      }
      if (password.length < 6) {
        setErrorInfo({
          code: 'auth/weak-password',
          message:
            language === 'bn'
              ? 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।'
              : 'Password must be at least 6 characters.',
        });
        return;
      }
      if (password !== confirmPassword) {
        setErrorInfo({
          code: 'validation',
          message:
            language === 'bn'
              ? 'পাসওয়ার্ড দুটি মেলেনি।'
              : 'Passwords do not match.',
        });
        return;
      }
    }

    setBusy(true);
    try {
      if (tab === 'login') {
        await loginWithEmail(email, password);
      } else if (tab === 'signup') {
        await signUpWithEmail({
          displayName,
          email,
          password,
          photoDataUrl,
          clubName,
          city,
        });
      } else {
        await sendForgotPassword(email);
        setSuccessMsg(t.auth.resetSuccess);
      }
    } catch (err) {
      setErrorInfo(err as AuthActionError);
    } finally {
      setBusy(false);
    }
  };

  const handleGoogleLogin = async () => {
    setErrorInfo(null);
    setSuccessMsg(null);
    if (!isOnline) {
      setErrorInfo({code: 'auth/offline', message: t.auth.offlineAuthWarning});
      return;
    }
    setBusy(true);
    try {
      await loginWithGoogle();
    } catch (err) {
      setErrorInfo(err as AuthActionError);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl bg-[#101612] border border-[#22C55E]/25 p-5 sm:p-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg sm:text-xl font-bold text-white">{t.auth.title}</h2>
          <p className="text-xs sm:text-sm text-[#9CB0A4] mt-0.5">{t.auth.subtitle}</p>
        </div>

        <div
          role="tablist"
          className="inline-flex rounded-xl bg-[#080C0A] border border-white/10 p-1 w-full sm:w-auto"
        >
          {(['login', 'signup', 'forgot'] as const).map((id) => {
            const active = tab === id;
            const label =
              id === 'login'
                ? t.auth.loginTab
                : id === 'signup'
                  ? t.auth.signupTab
                  : t.auth.forgotTab;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => {
                  setTab(id);
                  setErrorInfo(null);
                  setSuccessMsg(null);
                }}
                className={`flex-1 sm:flex-none px-3.5 py-2 min-h-[38px] rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-[#0D3B24] text-white border border-[#22C55E]/35'
                    : 'text-[#9CB0A4] hover:text-white'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {!isOnline && (
        <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-3 flex items-start gap-2.5 text-xs text-amber-200">
          <WifiOff className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <span>{t.auth.offlineAuthWarning}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {tab === 'signup' && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 pb-2 border-b border-white/10">
            <div className="w-16 h-16 rounded-2xl bg-[#0D3B24] border border-[#22C55E]/30 flex items-center justify-center overflow-hidden shrink-0">
              {photoDataUrl ? (
                <img src={photoDataUrl} alt="Profile preview" className="w-full h-full object-cover" />
              ) : (
                <Camera className="w-6 h-6 text-[#4ADE80]" />
              )}
            </div>
            <div className="space-y-2">
              <div className="text-xs font-medium text-[#C8D6CE]">{t.auth.profilePhotoOptional}</div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#161F19] hover:bg-[#1E2B23] border border-white/15 px-3 py-1.5 text-xs font-semibold text-white"
                >
                  <Camera className="w-3.5 h-3.5 text-[#4ADE80]" />
                  <span>{t.auth.uploadPhoto}</span>
                </button>
                {photoDataUrl && (
                  <button
                    type="button"
                    onClick={() => setPhotoDataUrl('')}
                    className="inline-flex items-center gap-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 px-3 py-1.5 text-xs font-semibold text-rose-300"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{t.auth.removePhoto}</span>
                  </button>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoChange}
                className="hidden"
                aria-label={t.auth.profilePhotoOptional}
              />
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {tab === 'signup' && (
            <label className="block space-y-1.5 sm:col-span-2">
              <span className="text-xs font-medium text-[#C8D6CE]">{t.auth.fullName}</span>
              <input
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={t.auth.fullNamePlaceholder}
                maxLength={80}
                className="w-full min-h-[44px] rounded-xl bg-[#080C0A] border border-white/15 px-3.5 text-sm text-white placeholder-[#6E8276] focus:outline-none focus:border-[#22C55E]"
              />
            </label>
          )}

          <label className={`block space-y-1.5 ${tab === 'forgot' ? 'sm:col-span-2' : ''}`}>
            <span className="text-xs font-medium text-[#C8D6CE]">{t.auth.email}</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t.auth.emailPlaceholder}
              className="w-full min-h-[44px] rounded-xl bg-[#080C0A] border border-white/15 px-3.5 text-sm text-white placeholder-[#6E8276] focus:outline-none focus:border-[#22C55E]"
            />
          </label>

          {tab !== 'forgot' && (
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-[#C8D6CE]">{t.auth.password}</span>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t.auth.passwordPlaceholder}
                minLength={6}
                className="w-full min-h-[44px] rounded-xl bg-[#080C0A] border border-white/15 px-3.5 text-sm text-white placeholder-[#6E8276] focus:outline-none focus:border-[#22C55E]"
              />
            </label>
          )}

          {tab === 'signup' && (
            <>
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-[#C8D6CE]">{t.auth.confirmPassword}</span>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder={t.auth.passwordPlaceholder}
                  minLength={6}
                  className="w-full min-h-[44px] rounded-xl bg-[#080C0A] border border-white/15 px-3.5 text-sm text-white placeholder-[#6E8276] focus:outline-none focus:border-[#22C55E]"
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-[#C8D6CE]">{t.auth.clubOptional}</span>
                <input
                  type="text"
                  value={clubName}
                  onChange={(e) => setClubName(e.target.value)}
                  placeholder={t.auth.clubPlaceholder}
                  maxLength={100}
                  className="w-full min-h-[44px] rounded-xl bg-[#080C0A] border border-white/15 px-3.5 text-sm text-white placeholder-[#6E8276] focus:outline-none focus:border-[#22C55E]"
                />
              </label>

              <label className="block space-y-1.5 sm:col-span-2">
                <span className="text-xs font-medium text-[#C8D6CE]">{t.auth.cityOptional}</span>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder={t.auth.cityPlaceholder}
                  maxLength={80}
                  className="w-full min-h-[44px] rounded-xl bg-[#080C0A] border border-white/15 px-3.5 text-sm text-white placeholder-[#6E8276] focus:outline-none focus:border-[#22C55E]"
                />
              </label>
            </>
          )}
        </div>

        {errorInfo && (
          <div className="rounded-xl bg-rose-500/10 border border-rose-500/30 p-3.5 space-y-2 text-xs text-rose-200">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{errorInfo.message}</span>
            </div>
            {errorInfo.needsConsoleProviderEnable && (
              <div className="pl-6 pt-1 text-[#D7E4DC] space-y-1">
                <div className="font-semibold text-amber-300 flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>{t.auth.providerHelpTitle}</span>
                </div>
                <p>{t.auth.providerHelpDesc}</p>
              </div>
            )}
          </div>
        )}

        {successMsg && (
          <div className="rounded-xl bg-[#0D3B24]/60 border border-[#22C55E]/30 p-3 flex items-start gap-2 text-xs text-[#4ADE80]">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{successMsg}</span>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="submit"
            disabled={busy}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-[#16A34A] hover:bg-[#15803D] disabled:opacity-60 px-5 py-2.5 min-h-[44px] text-sm font-semibold text-white transition-colors"
          >
            {tab === 'login' ? (
              <LogIn className="w-4 h-4" />
            ) : tab === 'signup' ? (
              <UserPlus className="w-4 h-4" />
            ) : (
              <KeyRound className="w-4 h-4" />
            )}
            <span>
              {tab === 'login'
                ? t.auth.loginBtn
                : tab === 'signup'
                  ? t.auth.signupBtn
                  : t.auth.resetBtn}
            </span>
          </button>

          <button
            type="button"
            disabled={busy}
            onClick={() => void handleGoogleLogin()}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-[#161F19] hover:bg-[#1E2B23] border border-white/15 disabled:opacity-60 px-5 py-2.5 min-h-[44px] text-sm font-semibold text-white transition-colors"
          >
            <Mail className="w-4 h-4 text-[#4ADE80]" />
            <span>{t.auth.googleBtn}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
