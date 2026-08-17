import React, { useEffect, useState } from "react";
import confetti from "canvas-confetti";
import { Sparkles, Gift } from "lucide-react";
import { TikTokGiftEvent } from "../types";

interface GiftAlertBannerProps {
  latestGift: TikTokGiftEvent | null;
  onClose?: () => void;
}

export const GiftAlertBanner: React.FC<GiftAlertBannerProps> = ({
  latestGift,
}) => {
  const [visible, setVisible] = useState(false);
  const [currentGift, setCurrentGift] = useState<TikTokGiftEvent | null>(null);

  useEffect(() => {
    if (!latestGift) return;

    setCurrentGift(latestGift);
    setVisible(true);

    // Fire celebratory confetti for gifts!
    try {
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.2 },
        colors: ["#ec4899", "#f59e0b", "#06b6d4", "#a855f7"],
      });
    } catch {
      // ignore
    }

    const timer = setTimeout(() => {
      setVisible(false);
    }, 4500);

    return () => clearTimeout(timer);
  }, [latestGift]);

  if (!visible || !currentGift) return null;

  return (
    <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-4 duration-300 pointer-events-none">
      <div className="bg-gradient-to-r from-amber-600/95 via-pink-600/95 to-rose-600/95 text-white px-6 py-3 rounded-2xl shadow-2xl border-2 border-amber-300/60 backdrop-blur-md flex items-center gap-4 max-w-lg min-w-[320px]">
        <div className="relative shrink-0">
          {currentGift.giftPictureUrl ? (
            <img
              src={currentGift.giftPictureUrl}
              alt={currentGift.giftName}
              className="w-12 h-12 object-contain drop-shadow-xl animate-bounce"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center text-2xl shadow-inner">
              🎁
            </div>
          )}
          {currentGift.repeatCount > 1 && (
            <span className="absolute -bottom-1 -right-1 bg-yellow-400 text-slate-950 font-black text-xs px-2 py-0.5 rounded-full shadow-md border border-white">
              x{currentGift.repeatCount}
            </span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 text-amber-200 text-xs font-bold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Quà tặng trực tiếp</span>
          </div>
          <p className="font-extrabold text-base text-white truncate">
            {currentGift.nickname}
          </p>
          <p className="text-xs text-amber-100 font-medium flex items-center gap-1.5">
            <span>đã gửi tặng</span>
            <span className="bg-white/20 px-1.5 py-0.2 rounded font-bold text-white">
              {currentGift.giftName}
            </span>
            <span>
              ({currentGift.diamondCount * currentGift.repeatCount} 💎)
            </span>
          </p>
        </div>
      </div>
    </div>
  );
};
