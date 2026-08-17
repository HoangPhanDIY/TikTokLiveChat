import React, { useState, useEffect, useRef } from "react";
import {
  X,
  Copy,
  Check,
  Tv,
  ExternalLink,
  Palette,
  Eye,
  Volume2,
  Sparkles,
  Play,
  MessageSquare,
  Clock,
  UserPlus,
  Heart,
} from "lucide-react";
import {
  LiveFeedItem,
  TikTokCommentEvent,
  TikTokSocialEvent,
  TtsSettings,
} from "../types";
import { audioManager } from "../utils/audio";

interface ObsOverlayModalProps {
  isOpen: boolean;
  onClose: () => void;
  feedItems: LiveFeedItem[];
  uniqueId: string;
  ttsSettings?: TtsSettings;
}

// 100% Bulletproof TikTok Avatar with server-side proxy cache & SVG fallback
const TikTokAvatar: React.FC<{
  url?: string;
  name: string;
  uniqueId?: string;
  sizeClass?: string;
}> = ({ url, name, uniqueId, sizeClass = "w-12 h-12" }) => {
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
        className={`${sizeClass} rounded-full bg-gradient-to-tr from-pink-600 via-purple-600 to-cyan-500 flex items-center justify-center font-black text-white border-2 border-pink-400 shadow-md shrink-0`}
      >
        {cleanName.charAt(0).toUpperCase() || "U"}
      </div>
    );
  }

  return (
    <img
      src={avatarSrc}
      alt={cleanName}
      className={`${sizeClass} rounded-full object-cover border-2 border-pink-400 shadow-md ring-2 ring-pink-500/30 shrink-0 bg-slate-900`}
      referrerPolicy="no-referrer"
      onError={() => setLoadError(true)}
    />
  );
};

export const ObsOverlayModal: React.FC<ObsOverlayModalProps> = ({
  isOpen,
  onClose,
  feedItems,
  uniqueId,
  ttsSettings,
}) => {
  const [copied, setCopied] = useState(false);
  const [theme, setTheme] = useState<
    "glass" | "transparent" | "neon" | "green"
  >("glass");
  const [activeComment, setActiveComment] = useState<TikTokCommentEvent | null>(
    null,
  );
  const [activeFollower, setActiveFollower] =
    useState<TikTokSocialEvent | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isDelaying, setIsDelaying] = useState(false);
  const [delayLeft, setDelayLeft] = useState(0);

  const pendingRef = useRef<TikTokCommentEvent[]>([]);
  const followerQueueRef = useRef<TikTokSocialEvent[]>([]);
  const isBusyRef = useRef(false);
  const isFollowerBusyRef = useRef(false);
  const delayTimerRef = useRef<any>(null);
  const followTimerRef = useRef<any>(null);

  // Sync latest chat item if arrived
  useEffect(() => {
    if (!isOpen) return;

    audioManager.autoUnlock();

    // Find latest chat event
    const chats = feedItems.filter(
      (i) => i.type === "chat",
    ) as TikTokCommentEvent[];
    if (chats.length > 0) {
      const latest = chats[chats.length - 1];
      pendingRef.current.push(latest);
      if (!isBusyRef.current) {
        runCycle();
      }
    }

    // Find latest social / follow event
    const socials = feedItems.filter(
      (i) => i.type === "social",
    ) as TikTokSocialEvent[];
    if (socials.length > 0) {
      const latestSocial = socials[socials.length - 1];
      followerQueueRef.current.push(latestSocial);
      if (!isFollowerBusyRef.current) {
        runFollowerCycle();
      }
    }
  }, [feedItems, isOpen]);

  const runFollowerCycle = () => {
    if (isFollowerBusyRef.current) return;
    if (followerQueueRef.current.length === 0) {
      setActiveFollower(null);
      return;
    }

    const nextFollower = followerQueueRef.current.shift()!;
    isFollowerBusyRef.current = true;
    setActiveFollower(nextFollower);

    const settings = ttsSettings;
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
        setActiveFollower(null);
        isFollowerBusyRef.current = false;
        setTimeout(() => {
          if (followerQueueRef.current.length > 0) {
            runFollowerCycle();
          }
        }, 300);
      }, 2000);
    };

    const startFollowSpeech = () => {
      if (settings?.enabled && settings?.readFollows && followText) {
        audioManager.speakDirectly(followText, settings, finishFollow);
      } else {
        finishFollow();
      }
    };

    // Khi có follow mới: phát MP3 sau đó đọc cảm ơn
    if (settings?.soundEffects !== false) {
      audioManager
        .playFollowChime(settings?.volume)
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

  const runCycle = () => {
    if (isBusyRef.current) return;
    if (pendingRef.current.length === 0) {
      setActiveComment(null);
      return;
    }

    // Pick the NEWEST comment and clear old backlog
    const newest = pendingRef.current[pendingRef.current.length - 1];
    pendingRef.current = [];

    isBusyRef.current = true;
    setActiveComment(newest);
    setIsSpeaking(true);
    setIsDelaying(false);
    setDelayLeft(0);

    const settings: TtsSettings = ttsSettings || {
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
      blacklistWords: [],
      blockPrefixes: [],
      onlyReadQuestions: false,
      soundEffects: true,
    };

    const textToSpeak = audioManager.formatSpeechText(
      newest.nickname || newest.uniqueId || "Người xem",
      newest.comment || "",
      "chat",
      settings,
    );

    const finishCycle = () => {
      // 1. Mất cmt ngay lập tức khi đọc xong
      setActiveComment(null);
      setIsSpeaking(false);
      setIsDelaying(true);

      // 2. Đợi số giây cấu hình (ví dụ 10s hoặc 3s)
      const delay = Math.max(0.5, Number(settings.delayBetweenMessages ?? 3));
      setDelayLeft(Math.ceil(delay));

      let remaining = Math.ceil(delay);
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

        if (pendingRef.current.length > 0) {
          runCycle();
        }
      }, delay * 1000);
    };

    const startSpeech = () => {
      if (settings.enabled && textToSpeak) {
        audioManager.speakDirectly(textToSpeak, settings, finishCycle);
      } else {
        finishCycle();
      }
    };

    // Trước khi đọc cmt thì phát chuông thông báo MP3 rồi đọc cmt liền
    if (settings.soundEffects !== false) {
      audioManager
        .playNotificationChime(settings.volume)
        .then(() => {
          startSpeech();
        })
        .catch(() => {
          startSpeech();
        });
    } else {
      startSpeech();
    }
  };

  const handleTestComment = () => {
    audioManager.autoUnlock();
    const testComments: TikTokCommentEvent[] = [
      {
        id: `test_${Date.now()}`,
        type: "chat",
        uniqueId: "hoang_diy",
        nickname: "Hoàng Phan Live",
        comment: "Chào shop, áo mẫu 1 này chất vải cotton hay thun lạnh vậy ạ?",
        profilePictureUrl:
          "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
        timestamp: Date.now(),
      },
      {
        id: `test_${Date.now() + 1}`,
        type: "chat",
        uniqueId: "ngoc_anh_99",
        nickname: "Ngọc Ánh",
        comment:
          "Giọng Chị Google đọc hay quá shop ơi, cho mình xin giá sỉ nhé!",
        profilePictureUrl:
          "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80",
        timestamp: Date.now(),
      },
      {
        id: `test_${Date.now() + 2}`,
        type: "chat",
        uniqueId: "minh_quan_vlog",
        nickname: "Minh Quân Vlog",
        comment: "Đã thả 50 tim cho chủ phòng rồi nha!",
        profilePictureUrl:
          "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
        timestamp: Date.now(),
      },
    ];

    const random =
      testComments[Math.floor(Math.random() * testComments.length)];
    pendingRef.current.push(random);
    if (!isBusyRef.current) {
      runCycle();
    }
  };

  const handleTestFollow = () => {
    const testFollowers: TikTokSocialEvent[] = [
      {
        id: `test_fol_${Date.now()}`,
        type: "social",
        uniqueId: "lan_huong_live",
        nickname: "Lan Hương",
        displayType: "follow",
        profilePictureUrl:
          "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80",
        timestamp: Date.now(),
      },
      {
        id: `test_fol_${Date.now() + 1}`,
        type: "social",
        uniqueId: "anh_tuan_98",
        nickname: "Anh Tuấn Gaming",
        displayType: "follow",
        profilePictureUrl:
          "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80",
        timestamp: Date.now(),
      },
    ];
    const random =
      testFollowers[Math.floor(Math.random() * testFollowers.length)];
    followerQueueRef.current.push(random);
    if (!isFollowerBusyRef.current) {
      runFollowerCycle();
    }
  };

  useEffect(() => {
    return () => {
      if (delayTimerRef.current) clearTimeout(delayTimerRef.current);
      if (followTimerRef.current) clearTimeout(followTimerRef.current);
    };
  }, []);

  if (!isOpen) return null;

  const currentUrl =
    typeof window !== "undefined" ? window.location.origin + "?view=obs" : "";

  const handleCopy = () => {
    navigator.clipboard.writeText(currentUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-pink-500/20 border border-pink-500/30 flex items-center justify-center">
              <Tv className="w-5 h-5 text-pink-400" />
            </div>
            <div>
              <h2 className="font-bold text-base text-white">
                OBS Studio & TikTok Live Widget
              </h2>
              <p className="text-xs text-slate-400">
                Đọc cmt mới nhất + Cảm ơn Follow ở góc trên phải (Song song,
                không cần đọc) + Avatar TikTok
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Quick Copy Link Box */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-xs text-slate-300">
                Đường dẫn Browser Source cho OBS / TikTok Live Studio:
              </span>
              <a
                href="?view=obs"
                target="_blank"
                rel="noreferrer"
                className="text-xs text-pink-400 hover:underline flex items-center gap-1 font-medium"
              >
                <span>Mở tab OBS độc lập</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={currentUrl}
                className="flex-1 bg-slate-900 border border-slate-700/80 rounded-xl px-3.5 py-2 text-xs text-slate-200 font-mono select-all focus:outline-none"
              />
              <button
                onClick={handleCopy}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  copied
                    ? "bg-emerald-600 text-white"
                    : "bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white shadow-md shadow-pink-600/20"
                }`}
              >
                {copied ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
                <span>{copied ? "Đã sao chép" : "Sao chép URL"}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-400 leading-relaxed pt-1">
              <p>
                💬 <b>Bình luận dưới</b>: Hiện 1 cmt mới nhất + Avatar thật ➔
                Chị Google đọc ➔ Delay 3s ➔ Tự ẩn khi hết cmt.
              </p>
              <p>
                🎉 <b>Follow góc trên phải</b>: Tự động hiển thị cảm ơn Follower
                song song, không chen ngang hay đọc giọng TTS.
              </p>
            </div>
          </div>

          {/* Theme & Controls */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5 text-pink-400" />
                <span>Giao diện nền Overlay:</span>
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => setTheme("glass")}
                  className={`p-2.5 rounded-xl border text-xs font-medium transition cursor-pointer text-left ${
                    theme === "glass"
                      ? "bg-pink-500/20 border-pink-500 text-pink-200"
                      : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                  }`}
                >
                  Kính mờ Dark Glass
                </button>
                <button
                  type="button"
                  onClick={() => setTheme("transparent")}
                  className={`p-2.5 rounded-xl border text-xs font-medium transition cursor-pointer text-left ${
                    theme === "transparent"
                      ? "bg-pink-500/20 border-pink-500 text-pink-200"
                      : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                  }`}
                >
                  Trong suốt OBS
                </button>
                <button
                  type="button"
                  onClick={() => setTheme("neon")}
                  className={`p-2.5 rounded-xl border text-xs font-medium transition cursor-pointer text-left ${
                    theme === "neon"
                      ? "bg-pink-500/20 border-pink-500 text-pink-200"
                      : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                  }`}
                >
                  Neon Cyber TikTok
                </button>
                <button
                  type="button"
                  onClick={() => setTheme("green")}
                  className={`p-2.5 rounded-xl border text-xs font-medium transition cursor-pointer text-left ${
                    theme === "green"
                      ? "bg-emerald-500/20 border-emerald-500 text-emerald-200"
                      : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                  }`}
                >
                  Phông xanh Chroma
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Play className="w-3.5 h-3.5 text-cyan-400" />
                <span>Nút thử nghiệm hiển thị:</span>
              </label>
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3 space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleTestComment}
                    className="py-2.5 px-3 bg-gradient-to-r from-pink-600 to-indigo-600 hover:from-pink-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-md cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Bắn 1 cmt (Đọc TTS)</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleTestFollow}
                    className="py-2.5 px-3 bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-md cursor-pointer"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Bắn Follow góc phải</span>
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 text-center">
                  Follow hiển thị ở góc trên bên phải độc lập, không làm ngắt
                  quãng giọng đọc comment.
                </p>
              </div>
            </div>
          </div>

          {/* Live Preview Screen */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5 text-pink-400" />
                <span>
                  Màn hình OBS trực quan (Bình luận ở dưới, Follow ở góc trên
                  phải):
                </span>
              </span>

              {isSpeaking ? (
                <span className="px-2.5 py-0.5 rounded-full bg-pink-500/20 border border-pink-500/40 text-pink-300 text-[11px] font-bold flex items-center gap-1 animate-pulse">
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>Chị Google đang đọc...</span>
                </span>
              ) : isDelaying ? (
                <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 text-[11px] font-bold flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Nghỉ delay: {delayLeft}s</span>
                </span>
              ) : null}
            </div>

            <div
              className={`rounded-3xl p-6 border min-h-[300px] flex flex-col justify-between transition-all relative overflow-hidden ${
                theme === "green"
                  ? "bg-[#00b140] border-emerald-600"
                  : theme === "neon"
                    ? "bg-slate-950 border-pink-500/60 shadow-[inset_0_0_20px_rgba(236,72,153,0.2)]"
                    : theme === "transparent"
                      ? "bg-slate-950/40 border-dashed border-slate-700 bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:16px_16px]"
                      : "bg-slate-950/90 border-slate-800"
              }`}
            >
              {/* TOP RIGHT: Follow Alert */}
              <div className="flex justify-end w-full">
                {activeFollower ? (
                  <div
                    key={activeFollower.id}
                    className="bg-slate-950/95 backdrop-blur-2xl border-2 border-pink-500 rounded-3xl p-3 shadow-[0_8px_30px_rgba(236,72,153,0.4)] text-white animate-in slide-in-from-top-3 fade-in duration-300 flex items-center gap-3 max-w-xs"
                  >
                    <div className="relative shrink-0">
                      <TikTokAvatar
                        url={activeFollower.profilePictureUrl}
                        name={activeFollower.nickname}
                        uniqueId={activeFollower.uniqueId}
                        sizeClass="w-10 h-10"
                      />
                      <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-gradient-to-tr from-pink-600 to-rose-500 rounded-full border border-slate-950 flex items-center justify-center shadow">
                        <UserPlus className="w-2.5 h-2.5 text-white" />
                      </span>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1 text-[9px] font-black text-pink-400 uppercase tracking-wider">
                        <Sparkles className="w-2.5 h-2.5 text-amber-300 animate-spin" />
                        <span>Người theo dõi mới</span>
                      </div>
                      <p className="font-black text-xs text-white truncate">
                        {activeFollower.nickname || "Người xem"}
                      </p>
                      <p className="text-[10px] text-pink-200/90 font-medium flex items-center gap-1 truncate">
                        <span>Cảm ơn bạn đã Follow</span>
                        <Heart className="w-2.5 h-2.5 text-rose-400 fill-rose-400 inline" />
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="opacity-40 text-[10px] text-slate-400 border border-slate-800 bg-slate-950/50 rounded-xl px-2.5 py-1 flex items-center gap-1.5">
                    <UserPlus className="w-3 h-3 text-pink-400" />
                    <span>Vị trí thông báo Follow (Góc trên phải)</span>
                  </div>
                )}
              </div>

              {/* BOTTOM LEFT: Comments Container */}
              <div className="max-w-md w-full mt-auto">
                {activeComment ? (
                  <div
                    key={activeComment.id}
                    className={`backdrop-blur-xl rounded-3xl p-4 shadow-2xl border transition-all animate-in slide-in-from-bottom-3 fade-in relative overflow-hidden ${
                      theme === "neon"
                        ? "bg-black/90 border-pink-500 shadow-pink-500/30 text-white"
                        : "bg-slate-950/90 border-pink-500/80 text-white"
                    }`}
                  >
                    {/* Delay Progress Bar */}
                    {isDelaying && (
                      <div className="absolute top-0 left-0 right-0 h-1 bg-slate-800 overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-cyan-400 to-pink-500 animate-pulse w-full" />
                      </div>
                    )}

                    <div className="flex items-start gap-3.5">
                      {/* Real TikTok User Avatar */}
                      <div className="relative shrink-0">
                        <TikTokAvatar
                          url={activeComment.profilePictureUrl}
                          name={activeComment.nickname}
                          uniqueId={activeComment.uniqueId}
                          sizeClass="w-12 h-12"
                        />
                        <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-slate-950 rounded-full" />
                      </div>

                      {/* Content */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="font-black text-sm text-pink-300 truncate">
                              {activeComment.nickname || "Người xem"}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono truncate">
                              @{activeComment.uniqueId || "user"}
                            </span>
                          </div>

                          {isSpeaking ? (
                            <span className="shrink-0 px-2 py-0.5 bg-pink-500/20 text-pink-300 border border-pink-500/40 rounded-full text-[10px] font-bold flex items-center gap-1 animate-pulse">
                              <Volume2 className="w-3 h-3 text-pink-400" />
                              <span>Đang đọc</span>
                            </span>
                          ) : isDelaying ? (
                            <span className="shrink-0 px-2 py-0.5 bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 rounded-full text-[10px] font-bold flex items-center gap-1">
                              <span>Delay {delayLeft}s</span>
                            </span>
                          ) : null}
                        </div>

                        <p className="text-base font-bold text-white mt-1 leading-snug break-words tracking-wide">
                          {activeComment.comment}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-black/50 backdrop-blur-md rounded-2xl p-4 border border-white/10 text-white text-xs flex items-center gap-3">
                    <MessageSquare className="w-5 h-5 text-pink-400 shrink-0" />
                    <div>
                      <p className="font-bold text-pink-300">
                        Đang chờ bình luận TikTok...
                      </p>
                      <p className="text-slate-400 mt-0.5">
                        Khi không có bình luận, màn hình OBS sẽ hoàn toàn trống
                        và trong suốt.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
