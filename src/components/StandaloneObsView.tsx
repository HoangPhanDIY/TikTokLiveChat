import React, { useEffect, useState, useRef } from "react";
import {
  TikTokCommentEvent,
  TikTokGiftEvent,
  TikTokSocialEvent,
  TtsSettings,
} from "../types";
import { audioManager } from "../utils/audio";
import { Volume2, Sparkles, UserPlus, Heart, VolumeX } from "lucide-react";

const DEFAULT_TTS_SETTINGS: TtsSettings = {
  enabled: true,
  engine: "google_authentic",
  voiceName: "",
  rate: 1.0,
  pitch: 1.0,
  volume: 1.0,
  delayBetweenMessages: 3.0,
  readSenderName: true,
  nameCommentSeparator: "nói:",
  readGifts: true,
  giftTemplate: "Cảm ơn {name} đã tặng {count} {gift}",
  minGiftDiamonds: 1,
  readFollows: true,
  readLikes: false,
  minCharLength: 1,
  maxCharLength: 120,
  stripEmojis: true,
  simplifyRepeatedChars: true,
  blacklistWords: ["đụ", "địt", "lồn", "buồi", "cặc", "đm", "dmm", "vcl"],
  blockPrefixes: ["!", "/"],
  onlyReadQuestions: false,
  soundEffects: true,
};

// CSS Keyframes cho hiệu ứng viền chạy dải màu kiểu FB Live
const customStyles = `
@keyframes animatedGradient {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}
.animated-fb-border {
  background: linear-gradient(270deg, #f26822, #e91e63, #9c27b0, #00bcd4, #4caf50, #ffeb3b, #f26822);
  background-size: 400% 400%;
  animation: animatedGradient 4s ease infinite;
}
`;

// TikTok Avatar (Không góc tròn, khớp sát mép)
const TikTokAvatar: React.FC<{
  url?: string;
  name: string;
  uniqueId?: string;
  sizeClass?: string;
}> = ({ url, name, uniqueId, sizeClass = "w-14 h-14" }) => {
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    setLoadError(false);
  }, [url, uniqueId]);

  const cleanName = (name || uniqueId || "User").trim();
  const avatarSrc = url?.startsWith("/api/avatar")
    ? url
    : `/api/avatar?url=${encodeURIComponent(url || "")}&uniqueId=${encodeURIComponent(uniqueId || "")}&name=${encodeURIComponent(cleanName)}`;

  if (loadError) {
    return (
      <div
        className={`${sizeClass} bg-gradient-to-tr from-pink-600 via-purple-600 to-cyan-500 flex items-center justify-center font-black text-white shrink-0`}
      >
        {cleanName.charAt(0).toUpperCase() || "U"}
      </div>
    );
  }

  return (
    <img
      src={avatarSrc}
      alt={cleanName}
      className={`${sizeClass} object-cover shrink-0 bg-slate-900`}
      referrerPolicy="no-referrer"
      onError={() => setLoadError(true)}
    />
  );
};

export const StandaloneObsView: React.FC = () => {
  // Comment & Gift state
  const [currentComment, setCurrentComment] =
    useState<TikTokCommentEvent | null>(null);
  const [currentGift, setCurrentGift] = useState<TikTokGiftEvent | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isDelaying, setIsDelaying] = useState(false);
  const [delayLeft, setDelayLeft] = useState(0);
  const [audioUnlocked, setAudioUnlocked] = useState(true);

  // Independent Follow state
  const [currentFollower, setCurrentFollower] =
    useState<TikTokSocialEvent | null>(null);

  const pendingCommentsRef = useRef<TikTokCommentEvent[]>([]);
  const followerQueueRef = useRef<TikTokSocialEvent[]>([]);
  const isBusyRef = useRef(false);
  const isFollowerBusyRef = useRef(false);
  const settingsRef = useRef<TtsSettings>(DEFAULT_TTS_SETTINGS);
  const delayTimerRef = useRef<any>(null);
  const followTimerRef = useRef<any>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("tiktok_tts_settings");
      if (saved) {
        settingsRef.current = { ...DEFAULT_TTS_SETTINGS, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.warn("Could not read settings from localStorage:", e);
    }

    audioManager.autoUnlock();
  }, []);

  const processNextFollower = () => {
    if (isFollowerBusyRef.current) return;
    if (followerQueueRef.current.length === 0) {
      setCurrentFollower(null);
      return;
    }

    const nextFollower = followerQueueRef.current.shift()!;
    isFollowerBusyRef.current = true;
    setCurrentFollower(nextFollower);

    if (followTimerRef.current) clearTimeout(followTimerRef.current);
    followTimerRef.current = setTimeout(() => {
      setCurrentFollower(null);
      isFollowerBusyRef.current = false;
      setTimeout(() => {
        if (followerQueueRef.current.length > 0) {
          processNextFollower();
        }
      }, 300);
    }, 4500);
  };

  const processNextComment = () => {
    if (isBusyRef.current) return;

    if (pendingCommentsRef.current.length === 0) {
      setCurrentComment(null);
      return;
    }

    const newestComment =
      pendingCommentsRef.current[pendingCommentsRef.current.length - 1];
    pendingCommentsRef.current = [];

    isBusyRef.current = true;
    setCurrentGift(null);
    setCurrentComment(newestComment);
    setIsSpeaking(true);
    setIsDelaying(false);
    setDelayLeft(0);

    const settings = settingsRef.current;

    const textToSpeak = audioManager.formatSpeechText(
      newestComment.nickname || newestComment.uniqueId || "Người xem",
      newestComment.comment || "",
      "chat",
      settings,
    );

    const onSpeechFinished = () => {
      setIsSpeaking(false);
      setIsDelaying(true);

      const delaySeconds = Math.max(
        1,
        Math.round(settings.delayBetweenMessages || 3),
      );
      setDelayLeft(delaySeconds);

      let remaining = delaySeconds;
      const interval = setInterval(() => {
        remaining -= 1;
        if (remaining > 0) {
          setDelayLeft(remaining);
        } else {
          clearInterval(interval);
        }
      }, 1000);

      delayTimerRef.current = setTimeout(() => {
        clearInterval(interval);
        setIsDelaying(false);
        setDelayLeft(0);
        isBusyRef.current = false;

        if (pendingCommentsRef.current.length > 0) {
          processNextComment();
        } else {
          setCurrentComment(null);
        }
      }, delaySeconds * 1000);
    };

    if (settings.enabled && textToSpeak) {
      audioManager.speakDirectly(textToSpeak, settings, onSpeechFinished);
    } else {
      onSpeechFinished();
    }
  };

  useEffect(() => {
    const eventSource = new EventSource("/api/tiktok/events");

    eventSource.addEventListener("init", (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        if (data.ttsSettings) {
          settingsRef.current = {
            ...DEFAULT_TTS_SETTINGS,
            ...data.ttsSettings,
          };
        }
      } catch (err) {}
    });

    eventSource.addEventListener("tts_settings", (e: MessageEvent) => {
      try {
        const settings = JSON.parse(e.data);
        if (settings) {
          settingsRef.current = { ...DEFAULT_TTS_SETTINGS, ...settings };
        }
      } catch (err) {}
    });

    eventSource.addEventListener("chat", (e: MessageEvent) => {
      try {
        const data: TikTokCommentEvent = JSON.parse(e.data);
        if (!data || !data.comment) return;

        audioManager.autoUnlock();

        pendingCommentsRef.current.push(data);
        if (!isBusyRef.current) {
          processNextComment();
        }
      } catch (err) {
        console.error("SSE Chat parse error in OBS view:", err);
      }
    });

    eventSource.addEventListener("gift", (e: MessageEvent) => {
      try {
        const data: TikTokGiftEvent = JSON.parse(e.data);
        if (!data) return;
        setCurrentGift(data);
        setTimeout(() => {
          setCurrentGift((prev) => (prev?.id === data.id ? null : prev));
        }, 5000);
      } catch (err) {
        console.error("SSE Gift parse error in OBS view:", err);
      }
    });

    eventSource.addEventListener("social", (e: MessageEvent) => {
      try {
        const data: TikTokSocialEvent = JSON.parse(e.data);
        if (!data) return;
        followerQueueRef.current.push(data);
        if (!isFollowerBusyRef.current) {
          processNextFollower();
        }
      } catch (err) {
        console.error("SSE Social parse error in OBS view:", err);
      }
    });

    return () => {
      eventSource.close();
      if (delayTimerRef.current) clearTimeout(delayTimerRef.current);
      if (followTimerRef.current) clearTimeout(followTimerRef.current);
      audioManager.stopCurrentSpeech();
    };
  }, []);

  const handleManualUnlock = () => {
    audioManager.autoUnlock();
    audioManager.playSound("connect");
    setAudioUnlocked(true);
  };

  return (
    <div
      onClick={handleManualUnlock}
      className="min-h-screen bg-transparent p-4 flex flex-col justify-between overflow-hidden font-sans select-none relative"
    >
      <style>{customStyles}</style>

      {/* TOP-RIGHT: Follower Notification Banner */}
      <div className="fixed top-6 right-6 z-50 max-w-sm pointer-events-auto">
        {currentFollower && (
          <div className="p-[2px] animated-fb-border shadow-[0_10px_35px_rgba(0,0,0,0.5)] animate-in slide-in-from-top-4 fade-in duration-300">
            <div className="bg-slate-950/92 backdrop-blur-xl flex items-stretch text-white">
              {/* Ảnh bên trái sát vách */}
              <div className="relative shrink-0 flex">
                <TikTokAvatar
                  url={currentFollower.profilePictureUrl}
                  name={currentFollower.nickname}
                  uniqueId={currentFollower.uniqueId}
                  sizeClass="w-14 h-full min-h-[56px]"
                />
                <span className="absolute bottom-1 right-1 w-4 h-4 bg-gradient-to-tr from-pink-600 to-rose-500 border border-slate-950 flex items-center justify-center shadow">
                  <UserPlus className="w-2.5 h-2.5 text-white" />
                </span>
              </div>

              {/* Tên & Nội dung bên phải có Padding */}
              <div className="min-w-0 flex-1 p-3 flex flex-col justify-center">
                <div className="flex items-center gap-1.5 text-[10px] font-black text-amber-300 uppercase tracking-wider">
                  <Sparkles className="w-3 h-3 text-amber-300 animate-spin" />
                  <span>NGƯỜI THEO DÕI MỚI</span>
                </div>
                <p className="font-black text-sm bg-gradient-to-t from-[#bd9867] to-[#fce3bc] bg-clip-text text-transparent truncate">
                  {currentFollower.nickname || "Người xem"}
                </p>
                <p className="text-[11px] text-zinc-300 font-medium flex items-center gap-1 truncate">
                  <span>Cảm ơn bạn đã Follow kênh</span>
                  <Heart className="w-3 h-3 text-rose-400 fill-rose-400 inline" />
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* BOTTOM-LEFT: Comments & Gifts Container */}
      <div className="max-w-md w-full space-y-3 pointer-events-auto">
        {/* Gift Popup Celebration */}
        {currentGift && (
          <div className="p-[2px] animated-fb-border shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="bg-slate-950/92 backdrop-blur-xl flex items-stretch text-white">
              <div className="p-2 flex items-center justify-center shrink-0 bg-slate-900/50">
                {currentGift.giftPictureUrl ? (
                  <img
                    src={currentGift.giftPictureUrl}
                    alt={currentGift.giftName}
                    className="w-12 h-12 object-contain animate-bounce"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <span className="text-3xl animate-bounce">🎁</span>
                )}
              </div>
              <div className="min-w-0 flex-1 p-3 flex flex-col justify-center">
                <p className="font-black text-sm bg-gradient-to-t from-[#bd9867] to-[#fce3bc] bg-clip-text text-transparent truncate">
                  {currentGift.nickname || "Người xem"}
                </p>
                <p className="text-xs font-bold text-amber-200 flex items-center gap-1 mt-0.5">
                  <Sparkles className="w-3 h-3 text-amber-300" />
                  tặng {currentGift.giftName} x{currentGift.repeatCount || 1} (
                  {(currentGift.diamondCount || 1) *
                    (currentGift.repeatCount || 1)}{" "}
                  Kim cương)
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Single Comment Card */}
        {currentComment && (
          <div
            key={currentComment.id}
            className="p-[2px] animated-fb-border shadow-[0_10px_30px_rgba(0,0,0,0.5)] animate-in slide-in-from-bottom-4 fade-in duration-300 relative overflow-hidden"
          >
            {/* Khung chứa dạng flex items-stretch để ảnh vừa vặn chiều cao */}
            <div className=" backdrop-blur-xl flex items-stretch text-white">
              {/* Bên trái: Ảnh sát viền khung, không có padding */}
              <div className="relative shrink-0 flex">
                <TikTokAvatar
                  url={currentComment.profilePictureUrl}
                  name={currentComment.nickname}
                  uniqueId={currentComment.uniqueId}
                  sizeClass="w-16 h-full min-h-[64px]"
                />
                <span className="absolute bottom-1 right-1 w-3 h-3 bg-emerald-500 border border-slate-950" />
              </div>

              {/* Bên phải: Tên user và nội dung comment có Padding (p-3) */}
              <div className="min-w-0 flex-1 p-3 flex flex-col justify-center">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-black text-sm bg-gradient-to-t from-[#bd9867] to-[#fce3bc] bg-clip-text text-transparent truncate leading-tight">
                    {currentComment.nickname || "Người xem"}
                  </span>
                </div>

                <p className="text-sm font-bold text-white mt-1 leading-snug break-words tracking-wide">
                  {currentComment.comment}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
