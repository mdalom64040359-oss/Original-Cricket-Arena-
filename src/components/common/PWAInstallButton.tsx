import React, {useState} from 'react';
import {Download, Share, Smartphone, X} from 'lucide-react';
import {useUser} from '../../contexts/UserContext';
import {usePWAInstall} from '../../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  compact?: boolean;
  showFallbackGuide?: boolean;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  compact = false,
  showFallbackGuide = false,
}) => {
  const {language} = useUser();
  const {isInstallable, isInstalled, isIOS, install} = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);

  if (isInstalled) {
    return null;
  }

  const isBn = language === 'bn';
  const isInsideIframe = typeof window !== 'undefined' && window.self !== window.top;

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={() => {
          void install();
        }}
        className={`inline-flex items-center justify-center gap-2 rounded-xl bg-[#0F4D2F] border border-[#22C55E]/40 text-white font-semibold hover:bg-[#14633D] active:scale-[0.98] transition-all whitespace-nowrap shrink-0 min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22C55E] ${
          compact ? 'px-3 py-2 text-xs' : 'px-4 py-2.5 text-sm'
        }`}
        aria-label={isBn ? 'Cricket Arena অ্যাপ ইনস্টল করুন' : 'Install Cricket Arena App'}
      >
        <Download className="w-4 h-4 shrink-0" />
        <span>{isBn ? 'অ্যাপ ইনস্টল' : 'Install App'}</span>
      </button>
    );
  }

  if (!isIOS && !showFallbackGuide) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setShowGuideModal(true)}
        className={`inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#111914] border border-white/15 font-medium text-white hover:bg-[#19241D] transition-colors whitespace-nowrap shrink-0 min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22C55E] ${
          compact ? 'px-3 py-2 text-xs' : 'px-4 py-2.5 text-xs sm:text-sm'
        }`}
      >
        {isIOS ? <Share className="w-3.5 h-3.5 shrink-0" /> : <Smartphone className="w-4 h-4 text-[#4ADE80] shrink-0" />}
        <span>{isIOS ? (isBn ? 'ইনস্টল' : 'Install') : isBn ? 'অ্যান্ড্রয়েডে ইনস্টল' : 'Install on Android'}</span>
      </button>

      {showGuideModal && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pwa-install-guide-title"
        >
          <div className="w-full max-w-sm rounded-2xl bg-[#101713] border border-white/15 p-6 text-white shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <h3 id="pwa-install-guide-title" className="text-lg font-bold tracking-tight">
                {isBn ? 'Cricket Arena ইনস্টল করুন' : 'Install Cricket Arena'}
              </h3>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="min-h-[44px] min-w-[44px] -mt-2 -mr-2 flex items-center justify-center rounded-xl text-[#94A69C] hover:text-white hover:bg-white/5"
                aria-label={isBn ? 'বন্ধ করুন' : 'Close install instructions'}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {isIOS ? (
              <>
                <p className="mt-2 text-sm text-[#B8C7BE] leading-relaxed">
                  {isBn
                    ? 'অফলাইন স্কোরিং ও ফুল-স্ক্রিন ব্যবহারের জন্য আপনার হোম স্ক্রিনে যোগ করুন:'
                    : 'Add Cricket Arena to your home screen for full-screen offline scoring:'}
                </p>
                <ol className="mt-4 space-y-2.5 text-sm text-white/90">
                  <li className="flex items-start gap-2.5">
                    <span className="font-mono text-xs text-[#22C55E] mt-0.5">01.</span>
                    <span>
                      {isBn
                        ? 'ব্রাউজারের নিচে থাকা Share আইকনে ট্যাপ করুন।'
                        : 'Tap the Share icon in your browser toolbar.'}
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="font-mono text-xs text-[#22C55E] mt-0.5">02.</span>
                    <span>
                      {isBn
                        ? 'নিচে স্ক্রল করে Add to Home Screen নির্বাচন করুন।'
                        : 'Scroll down and select Add to Home Screen.'}
                    </span>
                  </li>
                </ol>
              </>
            ) : (
              <>
                <p className="mt-2 text-sm text-[#B8C7BE] leading-relaxed">
                  {isBn
                    ? 'অ্যান্ড্রয়েড Chrome থেকে অ্যাপ হিসেবে ইনস্টল করলে ইন্টারনেট ছাড়াই সাথে সাথে চালু হবে:'
                    : 'Install via Android Chrome for a full-screen launcher icon, splash screen, and instant offline startup:'}
                </p>
                <ol className="mt-4 space-y-2.5 text-sm text-white/90">
                  {isInsideIframe && (
                    <li className="flex items-start gap-2.5">
                      <span className="font-mono text-xs text-[#22C55E] mt-0.5">01.</span>
                      <span>
                        {isBn
                          ? 'প্রিভিউ ফ্রেমের বাইরে আলাদা Chrome ট্যাবে অ্যাপের মূল লিংকটি খুলুন।'
                          : 'Open the standalone app URL directly in Android Chrome (outside any preview frame).'}
                      </span>
                    </li>
                  )}
                  <li className="flex items-start gap-2.5">
                    <span className="font-mono text-xs text-[#22C55E] mt-0.5">
                      {isInsideIframe ? '02.' : '01.'}
                    </span>
                    <span>
                      {isBn
                        ? 'Chrome-এর ডানদিকে উপরে থাকা মেনু (⋮) আইকনে ট্যাপ করুন।'
                        : 'Tap the Chrome menu (⋮) in the top-right corner.'}
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="font-mono text-xs text-[#22C55E] mt-0.5">
                      {isInsideIframe ? '03.' : '02.'}
                    </span>
                    <span>
                      {isBn
                        ? 'Install app (অথবা Add to Home screen) অপশনে ট্যাপ করে Install নিশ্চিত করুন।'
                        : 'Select Install app (or Add to Home screen) and confirm Install.'}
                    </span>
                  </li>
                </ol>
              </>
            )}

            <button
              type="button"
              onClick={() => setShowGuideModal(false)}
              className="mt-6 w-full min-h-[44px] rounded-xl bg-[#16A34A] text-white font-semibold text-sm hover:bg-[#15803D] transition-colors"
            >
              {isBn ? 'বুঝেছি' : 'Got it'}
            </button>
          </div>
        </div>
      )}
    </>
  );
};
