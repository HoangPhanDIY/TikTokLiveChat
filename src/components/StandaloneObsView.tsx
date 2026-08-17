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
  blacklistWords: [
    "đụ",
    "địt",
    "lồn",
    "buồi",
    "cặc",
    "đm",
    "dmm",
    "vcl",
    "xem hàu",
    "vui vẻ",
    "nhắn em",
    "tele",
    "lili",
    "van",
    "val",
    "hàu",
    "xem hàu",
    "xem trước",
    "đi khách",
    "hyt",
    "hayate",
  ],
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

    const settings = settingsRef.current;
    const followText = audioManager.formatSpeechText(
      nextFollower.nickname || nextFollower.uniqueId || "Người xem",
      "",
      "social",
      settings,
      { displayType: nextFollower.displayType },
    );

    const finishFollow = () => {
      if (followTimerRef.current) clearTimeout(followTimerRef.current);
      followTimerRef.current = setTimeout(() => {
        setCurrentFollower(null);
        isFollowerBusyRef.current = false;
        setTimeout(() => {
          if (followerQueueRef.current.length > 0) {
            processNextFollower();
          }
        }, 300);
      }, 2000);
    };

    const startFollowSpeech = () => {
      if (settings.enabled && settings.readFollows && followText) {
        audioManager.speakDirectly(followText, settings, finishFollow);
      } else {
        finishFollow();
      }
    };

    // Khi có người theo dõi mới: Phát MP3 thông báo sau đó đọc lời cảm ơn
    if (settings.soundEffects !== false) {
      audioManager
        .playFollowChime(settings.volume)
        .then(() => {
          startFollowSpeech();
        })
        .catch(() => {
          startFollowSpeech();
        });
    } else {
      startFollowSpeech();
    }
  };

  const processNextComment = () => {
    if (isBusyRef.current) return;

    if (pendingCommentsRef.current.length === 0) {
      setCurrentComment(null);
      return;
    }

    // Lấy cmt mới nhất và xóa backlog cũ
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
      // 1. Khi đọc xong, mất cmt ngay lập tức
      setCurrentComment(null);
      setIsSpeaking(false);
      setIsDelaying(true);

      // 2. Đợi số giây cấu hình (ví dụ: 10s hoặc 3s) mới đọc cmt mới nhất tiếp theo
      const delaySeconds = Math.max(
        0.5,
        Number(settings.delayBetweenMessages ?? 3),
      );
      setDelayLeft(Math.ceil(delaySeconds));

      let remaining = Math.ceil(delaySeconds);
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

        // Đợi xong khoảng thời gian set trước, nếu có cmt mới nhất tiếp theo thì tiếp tục đọc
        if (pendingCommentsRef.current.length > 0) {
          processNextComment();
        }
      }, delaySeconds * 1000);
    };

    const startSpeaking = () => {
      if (settings.enabled && textToSpeak) {
        audioManager.speakDirectly(textToSpeak, settings, onSpeechFinished);
      } else {
        onSpeechFinished();
      }
    };

    // Trước khi đọc cmt thì phát đoạn âm thanh thông báo MP3 rồi mới đọc cmt liền
    if (settings.soundEffects !== false) {
      audioManager
        .playNotificationChime(settings.volume)
        .then(() => {
          startSpeaking();
        })
        .catch(() => {
          startSpeaking();
        });
    } else {
      startSpeaking();
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
      <div className="fixed top-50 right-50 z-50 max-w-sm pointer-events-auto">
        {currentFollower && (
          <div className="p-4 flex flex-col items-center text-center animate-in slide-in-from-top-4 fade-in duration-300">
            <div className="relative mb-2 shrink-0">
              <TikTokAvatar
                url={currentFollower.profilePictureUrl}
                name={currentFollower.nickname}
                uniqueId={currentFollower.uniqueId}
                sizeClass="w-20 h-20 rounded-none border-0 bg-transparent object-cover"
              />
              {/* <span className="absolute bottom-0 right-0 p-1 bg-pink-600 flex items-center justify-center">
                <UserPlus className="w-6 h-6 text-white" />
              </span> */}
            </div>

            <div className="flex flex-col items-center justify-center gap-1">
              <p className="text-[25px] text-zinc-300 font-medium flex items-center gap-1 justify-center">
                <span>
                  Cảm ơn{" "}
                  <span className="font-black text-[30px] bg-gradient-to-t from-[#bd9867] to-[#fce3bc] bg-clip-text text-transparent truncate max-w-full">
                    {currentFollower.nickname || "Người xem"}
                  </span>{" "}
                  đã Follow kênh
                </span>
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* BOTTOM-LEFT: Comments & Gifts Container */}
      <div className="max-w-md w-full space-y-3 pointer-events-auto mb-40 ml-10">
        {/* Gift Popup Celebration */}
        {/* {currentGift && (
          <div
            key={currentGift.id || currentGift.msgId}
            className="p-[1px] animated-fb-border shadow-[0_10px_30px_rgba(0,0,0,0.5)] animate-in slide-in-from-bottom-4 fade-in duration-300 relative overflow-hidden"
          >
            <div className="bg-slate-950/92 backdrop-blur-xl flex items-stretch text-white min-h-[72px]">
              <div className="relative shrink-0 flex items-stretch self-stretch bg-slate-900/40 justify-center items-center">
                {currentGift.giftPictureUrl ? (
                  <img
                    src={currentGift.giftPictureUrl}
                    alt={currentGift.giftName}
                    className="h-[80px] aspect-square rounded-none border-0 bg-transparent object-contain p-2"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="h-[80px] aspect-square flex items-center justify-center text-3xl">
                    🎁
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1 px-3 py-1 flex flex-col justify-center">
                <div className="flex items-center justify-between gap-2 shrink-0">
                  <span className="font-black text-[22px] bg-gradient-to-t from-[#bd9867] to-[#fce3bc] bg-clip-text text-transparent truncate leading-tight">
                    {currentGift.nickname || "Người xem"}
                  </span>
                </div>

                <p className="text-[18px] font-bold text-amber-200 flex items-center gap-1.5 leading-snug break-words tracking-wide my-auto">
                  <Sparkles className="w-4 h-4 text-amber-300 shrink-0" />
                  <span className="truncate">
                    tặng{" "}
                    <span className="text-white">{currentGift.giftName}</span> x
                    {currentGift.repeatCount || 1}
                  </span>
                  <span className="text-xs text-amber-300/80 font-semibold shrink-0">
                    (
                    {(currentGift.diamondCount || 1) *
                      (currentGift.repeatCount || 1)}{" "}
                    💎)
                  </span>
                </p>
              </div>
            </div>
          </div>
        )} */}

        {/* Single Comment Card */}
        {currentComment && (
          <div
            key={currentComment.id}
            className="p-[1px] animated-fb-border shadow-[0_10px_30px_rgba(0,0,0,0.5)] animate-in slide-in-from-bottom-4 fade-in duration-300 relative overflow-hidden"
          >
            <div className="bg-slate-950/92 backdrop-blur-xl flex items-stretch text-white min-h-[72px]">
              <div className="relative shrink-0 flex items-stretch self-stretch">
                <TikTokAvatar
                  url={currentComment.profilePictureUrl}
                  name={currentComment.nickname}
                  uniqueId={currentComment.uniqueId}
                  sizeClass="h-[80px] aspect-square rounded-none border-0 bg-transparent object-cover"
                />
              </div>

              <div className="min-w-0 flex-1 px-3 py-1 flex flex-col justify-center">
                <div className="flex items-center justify-between gap-2 shrink-0">
                  <span className="font-black text-[30px] bg-gradient-to-t from-[#bd9867] to-[#fce3bc] bg-clip-text text-transparent truncate leading-tight">
                    {currentComment.nickname || "Người xem"}
                  </span>
                </div>

                <p className="text-[24px] font-bold text-white leading-snug break-words tracking-wide line-clamp-1 my-auto">
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
