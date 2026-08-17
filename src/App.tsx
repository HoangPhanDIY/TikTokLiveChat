import React, { useState, useEffect, useRef, useCallback } from "react";
import { Header } from "./components/Header";
import { ConnectCard } from "./components/ConnectCard";
import { ChatFeed } from "./components/ChatFeed";
import { TtsSettingsDrawer } from "./components/TtsSettingsDrawer";
import { ObsOverlayModal } from "./components/ObsOverlay";
import { SimulatorModal } from "./components/SimulatorModal";
import { GiftAlertBanner } from "./components/GiftAlertBanner";
import { StandaloneObsView } from "./components/StandaloneObsView";
import {
  LiveFeedItem,
  TikTokCommentEvent,
  TikTokGiftEvent,
  RoomInfo,
  TtsSettings,
  QueueItem,
} from "./types";
import { audioManager } from "./utils/audio";
import {
  Sparkles,
  Volume2,
  Tv,
  MessageSquare,
  ShieldCheck,
  Zap,
  Info,
  Radio,
  CheckCircle,
  AlertTriangle,
} from "lucide-react";

const INITIAL_TTS_SETTINGS: TtsSettings = {
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

const sanitizeTtsSettings = (
  savedSettings: Partial<TtsSettings> | null | undefined,
): TtsSettings => {
  const merged = { ...INITIAL_TTS_SETTINGS, ...(savedSettings || {}) };
  if (!Array.isArray(merged.blacklistWords)) {
    merged.blacklistWords = [...INITIAL_TTS_SETTINGS.blacklistWords];
  }
  if (!Array.isArray(merged.blockPrefixes)) {
    merged.blockPrefixes = [...INITIAL_TTS_SETTINGS.blockPrefixes];
  }
  return merged;
};

export default function App() {
  // Check if URL has ?view=obs for standalone OBS browser source
  const isObsView =
    typeof window !== "undefined" &&
    window.location.search.includes("view=obs");
  if (isObsView) {
    return <StandaloneObsView />;
  }

  // Connection & Room state with persistent session ID
  const [uniqueId, setUniqueId] = useState<string>("");
  const [savedUniqueId, setSavedUniqueId] = useState<string>(() => {
    try {
      return localStorage.getItem("tiktok_saved_unique_id") || "";
    } catch {
      return "";
    }
  });

  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [isSimulated, setIsSimulated] = useState<boolean>(false);
  const [connectNotice, setConnectNotice] = useState<{
    type: "success" | "error" | "info";
    message: string;
  } | null>(null);

  const [roomInfo, setRoomInfo] = useState<RoomInfo>({
    title: "Chưa kết nối",
    ownerName: "",
    ownerAvatar: "",
    viewerCount: 0,
    likeCount: 0,
    giftCount: 0,
    startedAt: Date.now(),
  });

  // Feed items & Gifts
  const [feedItems, setFeedItems] = useState<LiveFeedItem[]>([]);
  const [latestGift, setLatestGift] = useState<TikTokGiftEvent | null>(null);

  // Audio / TTS state
  const [ttsSettings, setTtsSettings] = useState<TtsSettings>(() => {
    try {
      const saved = localStorage.getItem("tiktok_tts_settings");
      if (saved) return sanitizeTtsSettings(JSON.parse(saved));
    } catch {}
    return INITIAL_TTS_SETTINGS;
  });

  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [currentSpeakingItem, setCurrentSpeakingItem] =
    useState<QueueItem | null>(null);

  // Modals / Drawers
  const [isTtsDrawerOpen, setIsTtsDrawerOpen] = useState<boolean>(false);
  const [isObsModalOpen, setIsObsModalOpen] = useState<boolean>(false);
  const [isSimulatorOpen, setIsSimulatorOpen] = useState<boolean>(false);

  // Keep ref to latest settings for event handlers
  const settingsRef = useRef(ttsSettings);
  settingsRef.current = ttsSettings;

  // Save settings to localStorage & sync with server for OBS Overlay
  const updateTtsSettings = (newSettings: Partial<TtsSettings>) => {
    setTtsSettings((prev) => {
      const updated = sanitizeTtsSettings({ ...prev, ...newSettings });
      try {
        localStorage.setItem("tiktok_tts_settings", JSON.stringify(updated));
        fetch("/api/tts/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updated),
        }).catch(() => {});
      } catch {}
      return updated;
    });
  };

  // Sync initial settings on mount
  useEffect(() => {
    try {
      fetch("/api/tts/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ttsSettings),
      }).catch(() => {});
    } catch {}
  }, []);

  // Audio queue listener
  useEffect(() => {
    audioManager.setQueueCallback((q, current) => {
      setQueue(q);
      setCurrentSpeakingItem(current);
    });
  }, []);

  // Auto-connect tracking
  const hasAttemptedAutoConnect = useRef<boolean>(false);
  const userExplicitlyDisconnected = useRef<boolean>(false);

  // Connect to SSE stream from server
  useEffect(() => {
    const eventSource = new EventSource("/api/tiktok/events");

    eventSource.addEventListener("init", (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        const targetId =
          data.savedUniqueId ||
          savedUniqueId ||
          (typeof window !== "undefined"
            ? localStorage.getItem("tiktok_saved_unique_id")
            : "") ||
          "";

        if (targetId && !savedUniqueId) {
          setSavedUniqueId(targetId);
          try {
            localStorage.setItem("tiktok_saved_unique_id", targetId);
          } catch {}
        }

        if (data.isConnected) {
          setIsConnected(true);
          setIsConnecting(false);
          setIsSimulated(data.isSimulated);
          setUniqueId(data.uniqueId);
          if (data.roomInfo) setRoomInfo(data.roomInfo);
        } else if (
          targetId &&
          !hasAttemptedAutoConnect.current &&
          !userExplicitlyDisconnected.current
        ) {
          // Auto connect on page load/refresh
          hasAttemptedAutoConnect.current = true;
          console.log("Auto-connecting to saved TikTok Live ID:", targetId);
          handleConnect(targetId);
        }
      } catch (err) {
        console.error("SSE Init parse error:", err);
      }
    });

    eventSource.addEventListener("connected", (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        setIsConnected(true);
        setIsConnecting(false);
        setUniqueId(data.uniqueId);
        if (data.savedUniqueId) {
          setSavedUniqueId(data.savedUniqueId);
          try {
            localStorage.setItem("tiktok_saved_unique_id", data.savedUniqueId);
          } catch {}
        }
        if (data.roomInfo) setRoomInfo(data.roomInfo);
        setConnectNotice({
          type: "success",
          message: `Đã kết nối thành công tới phòng Live @${data.uniqueId}!`,
        });
      } catch (err) {
        console.error(err);
      }
    });

    eventSource.addEventListener("chat", (e: MessageEvent) => {
      try {
        const chatData: TikTokCommentEvent = JSON.parse(e.data);
        if (!chatData) return;
        setFeedItems((prev) => [...prev, chatData]);
      } catch (err) {
        console.error("SSE Chat parse error:", err);
      }
    });

    eventSource.addEventListener("gift", (e: MessageEvent) => {
      try {
        const giftData: TikTokGiftEvent = JSON.parse(e.data);
        if (!giftData) return;
        setFeedItems((prev) => [...prev, giftData]);
        setLatestGift(giftData);
        const diamond = Number(giftData.diamondCount) || 1;
        const count = Number(giftData.repeatCount) || 1;
        setRoomInfo((prev) => ({
          ...prev,
          giftCount: (prev.giftCount || 0) + diamond * count,
        }));
      } catch (err) {
        console.error("SSE Gift parse error:", err);
      }
    });

    eventSource.addEventListener("like", (e: MessageEvent) => {
      try {
        const likeData = JSON.parse(e.data);
        setFeedItems((prev) => [...prev, likeData]);
        setRoomInfo((prev) => ({
          ...prev,
          likeCount:
            likeData.totalLikeCount || prev.likeCount + likeData.likeCount,
        }));
      } catch (err) {
        console.error(err);
      }
    });

    eventSource.addEventListener("social", (e: MessageEvent) => {
      try {
        const socialData = JSON.parse(e.data);
        setFeedItems((prev) => [...prev, socialData]);
      } catch (err) {
        console.error(err);
      }
    });

    eventSource.addEventListener("viewer_update", (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        setRoomInfo((prev) => ({ ...prev, viewerCount: data.viewerCount }));
      } catch (err) {
        console.error(err);
      }
    });

    eventSource.addEventListener("disconnected", (e: MessageEvent) => {
      setIsConnected(false);
      setIsConnecting(false);
      setConnectNotice({
        type: "info",
        message: "Đã ngắt kết nối từ TikTok Live.",
      });
    });

    eventSource.addEventListener("error", (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        setConnectNotice({
          type: "error",
          message: data.message || "Lỗi kết nối TikTok Live.",
        });
      } catch {
        // ignore
      }
      setIsConnecting(false);
    });

    return () => {
      eventSource.close();
    };
  }, []);

  // Connect handler
  const handleConnect = async (id: string, optSessionId?: string) => {
    userExplicitlyDisconnected.current = false;
    setIsConnecting(true);
    setConnectNotice(null);
    try {
      const clean = id.replace(/^@+/, "").trim();
      // Save session immediately in localStorage
      localStorage.setItem("tiktok_saved_unique_id", clean);
      setSavedUniqueId(clean);

      const sessId =
        optSessionId ||
        (typeof window !== "undefined"
          ? localStorage.getItem("tiktok_session_id")
          : "") ||
        "";

      const res = await fetch("/api/tiktok/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uniqueId: clean, sessionId: sessId }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Không thể kết nối tới TikTok Live.");
      }
      setUniqueId(clean);
      setIsConnected(true);
      setIsConnecting(false);
      setIsSimulated(false);
    } catch (err: any) {
      console.error(err);
      setIsConnecting(false);
      setIsConnected(false);
      setConnectNotice({
        type: "error",
        message:
          err.message ||
          "Không thể kết nối. Tài khoản có thể đang Offline hoặc chưa mở phát trực tiếp.",
      });
    }
  };

  // Disconnect handler
  const handleDisconnect = async () => {
    userExplicitlyDisconnected.current = true;
    try {
      await fetch("/api/tiktok/disconnect", { method: "POST" });
    } catch (e) {
      console.error(e);
    }
    setIsConnected(false);
    setIsConnecting(false);
    setIsSimulated(false);
    setUniqueId("");
  };

  // Simulate event handler
  const handleSimulateEvent = async (eventType: string, data: any) => {
    try {
      await fetch("/api/tiktok/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventType, data }),
      });
      if (!isConnected) {
        setIsConnected(true);
        setIsSimulated(true);
        setUniqueId("demo_live");
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Start quick demo simulation
  const handleStartSimulation = () => {
    setIsSimulatorOpen(true);
    handleSimulateEvent("chat", {
      id: `sim_${Date.now()}`,
      type: "chat",
      uniqueId: "hoang_fan",
      nickname: "Hoàng Phan",
      comment: "Xin chào idol! Chúc buổi Live hôm nay thật bùng nổ nha ❤️",
      profilePictureUrl: "/api/avatar?name=Hoang+Phan&uniqueId=hoang_fan",
      timestamp: Date.now(),
    });
  };

  // Read item manually
  const handleSpeakItem = (item: LiveFeedItem) => {
    if (item.type === "chat") {
      const chat = item as TikTokCommentEvent;
      audioManager.enqueue(
        {
          sender: chat.nickname,
          originalText: chat.comment,
          type: "chat",
        },
        { ...ttsSettings, enabled: true },
      );
    } else if (item.type === "gift") {
      const gift = item as TikTokGiftEvent;
      audioManager.enqueue(
        {
          sender: gift.nickname,
          originalText: `Cảm ơn ${gift.nickname} đã tặng ${gift.giftName}`,
          type: "gift",
        },
        { ...ttsSettings, enabled: true },
      );
    }
  };

  // Toggle pin
  const handleTogglePin = (id: string) => {
    setFeedItems((prev) =>
      prev.map((item) => {
        if (item.type === "chat" && item.id === id) {
          const chat = item as TikTokCommentEvent;
          return { ...chat, isPinned: !chat.isPinned };
        }
        return item;
      }),
    );
  };

  // Clear feed
  const handleClearFeed = () => {
    setFeedItems([]);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-pink-500 selection:text-white">
      {/* Top Navigation Bar */}
      <Header
        isConnected={isConnected}
        isConnecting={isConnecting}
        isSimulated={isSimulated}
        uniqueId={uniqueId}
        roomInfo={roomInfo}
        ttsSettings={ttsSettings}
        queueCount={queue.length}
        isSpeaking={!!currentSpeakingItem}
        onToggleTts={() => updateTtsSettings({ enabled: !ttsSettings.enabled })}
        onOpenTtsSettings={() => setIsTtsDrawerOpen(true)}
        onOpenObsModal={() => setIsObsModalOpen(true)}
        onOpenSimulator={() => setIsSimulatorOpen(true)}
      />

      {/* Gift celebration popup on top if new gift arrives */}
      {latestGift && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full pt-3">
          <GiftAlertBanner
            latestGift={latestGift}
            onClose={() => setLatestGift(null)}
          />
        </div>
      )}

      {/* Connection Notice banner */}
      {connectNotice && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full pt-3">
          <div
            className={`p-3.5 rounded-2xl border text-xs font-medium flex items-center justify-between shadow-lg animate-in fade-in duration-200 ${
              connectNotice.type === "success"
                ? "bg-emerald-950/80 border-emerald-500/50 text-emerald-200"
                : connectNotice.type === "error"
                  ? "bg-rose-950/80 border-rose-500/50 text-rose-200"
                  : "bg-slate-900 border-slate-700 text-slate-200"
            }`}
          >
            <div className="flex items-center gap-2.5">
              {connectNotice.type === "success" && (
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
              )}
              {connectNotice.type === "error" && (
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              {connectNotice.type === "info" && (
                <Info className="w-4 h-4 text-cyan-400 shrink-0" />
              )}
              <span>{connectNotice.message}</span>
            </div>
            <button
              onClick={() => setConnectNotice(null)}
              className="text-xs opacity-70 hover:opacity-100 px-2 py-0.5 rounded-lg hover:bg-black/20 cursor-pointer"
            >
              Đóng
            </button>
          </div>
        </div>
      )}

      {/* Main Content Dashboard */}
      <main className="flex-1 mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full space-y-6">
        {/* Main Grid: Left (Connect & Controls) + Right (Real-time Live Chat Feed) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column (4 cols) */}
          <div className="lg:col-span-4 space-y-6">
            <ConnectCard
              uniqueId={uniqueId}
              isConnected={isConnected}
              isConnecting={isConnecting}
              isSimulated={isSimulated}
              savedUniqueId={savedUniqueId}
              onConnect={handleConnect}
              onDisconnect={handleDisconnect}
              onStartSimulation={handleStartSimulation}
            />

            {/* Quick Voice Settings Summary Card */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-pink-500/10 border border-pink-500/20 flex items-center justify-center">
                    <Volume2 className="w-4 h-4 text-pink-400" />
                  </div>
                  <h3 className="font-semibold text-sm text-slate-200">
                    Trạng thái Chị Google
                  </h3>
                </div>

                <button
                  onClick={() => setIsTtsDrawerOpen(true)}
                  className="text-xs text-pink-400 hover:text-pink-300 font-medium hover:underline cursor-pointer"
                >
                  Tùy chỉnh sâu ➔
                </button>
              </div>

              {/* Status indicator */}
              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Giọng đọc:</span>
                  <span className="font-semibold text-pink-300">
                    {ttsSettings.engine === "google_authentic"
                      ? "Chị Google chuẩn (Google Translate)"
                      : "Giọng đọc Trình duyệt"}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Tốc độ đọc:</span>
                  <span className="font-semibold text-slate-200">
                    {ttsSettings.rate}x
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">
                    Thời gian nghỉ giữa cmt:
                  </span>
                  <span className="font-semibold text-slate-200">
                    {ttsSettings.delayBetweenMessages} giây
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Đọc tên người gửi:</span>
                  <span className="font-semibold text-emerald-400">
                    {ttsSettings.readSenderName ? "Bật" : "Tắt"}
                  </span>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  onClick={() => setIsObsModalOpen(true)}
                  className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition border border-slate-700 cursor-pointer"
                >
                  <Tv className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Mã nguồn OBS</span>
                </button>

                <button
                  onClick={() => setIsSimulatorOpen(true)}
                  className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition border border-slate-700 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>Giả lập Live</span>
                </button>
              </div>
            </div>
          </div>

          {/* Right Column (8 cols): Real-time live feed */}
          <div className="lg:col-span-8">
            <ChatFeed
              feedItems={feedItems}
              currentSpeakingId={currentSpeakingItem?.id}
              onSpeakItem={handleSpeakItem}
              onTogglePin={handleTogglePin}
              onClearFeed={handleClearFeed}
              soundEnabled={ttsSettings.soundEffects}
            />
          </div>
        </div>
      </main>

      {/* TTS Settings Drawer */}
      <TtsSettingsDrawer
        isOpen={isTtsDrawerOpen}
        onClose={() => setIsTtsDrawerOpen(false)}
        settings={ttsSettings}
        onUpdateSettings={updateTtsSettings}
        currentSpeakingItem={currentSpeakingItem} // Bổ sung prop này
        queue={queue}
      />

      {/* OBS Overlay Modal */}
      <ObsOverlayModal
        isOpen={isObsModalOpen}
        onClose={() => setIsObsModalOpen(false)}
        feedItems={feedItems}
        uniqueId={uniqueId}
        ttsSettings={ttsSettings}
      />

      {/* Live Event Simulator Modal */}
      <SimulatorModal
        isOpen={isSimulatorOpen}
        onClose={() => setIsSimulatorOpen(false)}
        onSimulateEvent={handleSimulateEvent}
      />
    </div>
  );
}
