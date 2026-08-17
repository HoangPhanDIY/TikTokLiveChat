import React, { useState, useEffect } from "react";
import {
  AtSign,
  Radio,
  Power,
  Sparkles,
  Info,
  CheckCircle2,
  Bookmark,
  Zap,
  RotateCcw,
  SlidersHorizontal,
  KeyRound,
} from "lucide-react";

interface ConnectCardProps {
  uniqueId: string;
  isConnected: boolean;
  isConnecting: boolean;
  isSimulated: boolean;
  savedUniqueId?: string;
  onConnect: (id: string, sessionId?: string) => void;
  onDisconnect: () => void;
  onStartSimulation: () => void;
}

export const ConnectCard: React.FC<ConnectCardProps> = ({
  uniqueId,
  isConnected,
  isConnecting,
  isSimulated,
  savedUniqueId,
  onConnect,
  onDisconnect,
  onStartSimulation,
}) => {
  // Initialize input with current connected uniqueId, or prop savedUniqueId, or localStorage
  const [inputId, setInputId] = useState<string>(() => {
    if (uniqueId) return uniqueId;
    if (savedUniqueId) return savedUniqueId;
    try {
      return localStorage.getItem("tiktok_saved_unique_id") || "";
    } catch {
      return "";
    }
  });

  const [storedSessionId, setStoredSessionId] = useState<string>(() => {
    try {
      return (
        savedUniqueId || localStorage.getItem("tiktok_saved_unique_id") || ""
      );
    } catch {
      return "";
    }
  });

  const [errorMsg, setErrorMsg] = useState("");

  // Sync if uniqueId or savedUniqueId updates from server
  useEffect(() => {
    if (uniqueId) {
      setInputId(uniqueId);
      setStoredSessionId(uniqueId);
      try {
        localStorage.setItem("tiktok_saved_unique_id", uniqueId);
      } catch {}
    } else if (savedUniqueId && !inputId) {
      setInputId(savedUniqueId);
      setStoredSessionId(savedUniqueId);
    }
  }, [uniqueId, savedUniqueId]);

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [sessionId, setSessionId] = useState<string>(() => {
    try {
      return localStorage.getItem("tiktok_session_id") || "";
    } catch {
      return "";
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = inputId.trim();
    if (!cleanId) {
      setErrorMsg(
        "Vui lòng nhập TikTok Username (Ví dụ: hoangphan_diy hoặc @hoangphan_diy)",
      );
      return;
    }
    setErrorMsg("");
    // Save to localStorage immediately
    try {
      localStorage.setItem("tiktok_saved_unique_id", cleanId);
      setStoredSessionId(cleanId);
      if (sessionId) localStorage.setItem("tiktok_session_id", sessionId);
    } catch {}
    onConnect(cleanId, sessionId ? sessionId.trim() : undefined);
  };

  const handleQuickConnectSaved = (idToConnect: string) => {
    setInputId(idToConnect);
    setErrorMsg("");
    onConnect(idToConnect, sessionId ? sessionId.trim() : undefined);
  };

  const sampleAccounts = ["hoangaonhay.aov", "bangiusix", "adc.gaming99"];

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl backdrop-blur-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-pink-500/10 border border-pink-500/20 flex items-center justify-center">
            <Radio className="w-4 h-4 text-pink-400" />
          </div>
          <div>
            <h2 className="font-semibold text-slate-100 text-sm">
              Kết nối TikTok Live
            </h2>
            <p className="text-xs text-slate-400">
              Tự động nhớ ID tài khoản khi tải lại trang
            </p>
          </div>
        </div>

        {isConnected ? (
          <span className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 animate-pulse">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            ĐANG KẾT NỐI
          </span>
        ) : storedSessionId ? (
          <span className="flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-pink-500/10 text-pink-300 border border-pink-500/20">
            <Bookmark className="w-3 h-3 text-pink-400" />
            <span>Đã nhớ ID</span>
          </span>
        ) : null}
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <AtSign className="w-4 h-4 text-pink-400" />
          </div>
          <input
            type="text"
            value={inputId}
            onChange={(e) => {
              const val = e.target.value;
              setInputId(val);
              if (errorMsg) setErrorMsg("");
              try {
                if (val.trim()) {
                  localStorage.setItem("tiktok_saved_unique_id", val.trim());
                  setStoredSessionId(val.trim());
                }
              } catch {}
            }}
            disabled={isConnected || isConnecting}
            placeholder="Nhập ID TikTok (vd: hoangphan_diy hoặc link live)"
            className="w-full pl-10 pr-4 py-2.5 bg-slate-950/80 border border-slate-700/80 rounded-xl text-slate-100 text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent transition disabled:opacity-60 disabled:cursor-not-allowed"
          />
        </div>

        {/* Quick chip for saved session ID if different or disconnected */}
        {!isConnected && storedSessionId && (
          <div className="flex items-center justify-between text-xs bg-slate-950/60 border border-slate-800 rounded-xl px-3 py-1.5 text-slate-300">
            <div className="flex items-center gap-1.5 truncate">
              <CheckCircle2 className="w-3.5 h-3.5 text-pink-400 shrink-0" />
              <span className="text-slate-400">ID đã lưu:</span>
              <span className="font-bold text-pink-300 truncate">
                {storedSessionId}
              </span>
            </div>
            {inputId !== storedSessionId && (
              <button
                type="button"
                onClick={() => setInputId(storedSessionId)}
                className="text-[11px] text-pink-400 hover:text-pink-300 hover:underline flex items-center gap-0.5 shrink-0 font-medium cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Khôi phục</span>
              </button>
            )}
          </div>
        )}

        {/* Advanced Settings Toggle */}
        {!isConnected && (
          <div className="pt-0.5">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-xs text-slate-400 hover:text-slate-300 flex items-center gap-1 cursor-pointer transition py-0.5"
            >
              <SlidersHorizontal className="w-3 h-3 text-pink-400" />
              <span>
                {showAdvanced
                  ? "Ẩn cài đặt nâng cao"
                  : "Cài đặt nâng cao (TikTok Session ID nếu cần)"}
              </span>
            </button>

            {showAdvanced && (
              <div className="mt-2 p-3 bg-slate-950/80 border border-slate-800 rounded-xl space-y-2 text-xs">
                <div className="flex items-center gap-1.5 text-slate-300 font-medium">
                  <KeyRound className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>TikTok Session ID Cookie (Tùy chọn):</span>
                </div>
                <input
                  type="text"
                  value={sessionId}
                  onChange={(e) => {
                    setSessionId(e.target.value);
                    try {
                      localStorage.setItem("tiktok_session_id", e.target.value);
                    } catch {}
                  }}
                  placeholder="Dán cookie sessionid từ tiktok.com (nếu phòng Live yêu cầu)"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700/80 rounded-lg text-slate-200 text-xs placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-pink-500 font-mono"
                />
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Chỉ cần nhập nếu tài khoản của bạn bật giới hạn độ tuổi người
                  xem hoặc TikTok yêu cầu phiên đăng nhập.
                </p>
              </div>
            )}
          </div>
        )}

        {errorMsg && (
          <p className="text-xs text-rose-400 font-medium flex items-center gap-1">
            <Info className="w-3.5 h-3.5" />
            {errorMsg}
          </p>
        )}

        <div className="flex items-center gap-2">
          {!isConnected ? (
            <button
              type="submit"
              disabled={isConnecting || !inputId.trim()}
              className="flex-1 py-2.5 px-4 bg-gradient-to-r from-pink-600 via-rose-600 to-pink-500 hover:from-pink-500 hover:to-rose-500 text-white text-sm font-semibold rounded-xl transition shadow-lg shadow-pink-600/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer active:scale-98"
            >
              {isConnecting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>Đang kết nối tới Live...</span>
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4" />
                  <span>Bắt đầu kết nối</span>
                </>
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={onDisconnect}
              className="flex-1 py-2.5 px-4 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 text-sm font-semibold rounded-xl transition flex items-center justify-center gap-2 cursor-pointer active:scale-98"
            >
              <Power className="w-4 h-4 text-rose-400" />
              <span>Ngắt kết nối</span>
            </button>
          )}

          {!isConnected && (
            <button
              type="button"
              onClick={onStartSimulation}
              className="py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 text-xs font-semibold rounded-xl transition flex items-center gap-1.5 cursor-pointer active:scale-98"
              title="Thử nghiệm bình luận & đọc Chị Google với phòng Live giả lập"
            >
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span className="hidden sm:inline">Chạy thử Demo</span>
            </button>
          )}
        </div>
      </form>

      {/* Suggestion tags if not connected */}
      {!isConnected && (
        <div className="mt-3 pt-3 border-t border-slate-800/80">
          <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1.5">
            <span>Gợi ý tài khoản mẫu hoặc tài khoản của bạn:</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {sampleAccounts.map((acc) => (
              <button
                key={acc}
                type="button"
                onClick={() => {
                  setInputId(acc);
                  if (errorMsg) setErrorMsg("");
                }}
                className="text-xs px-2 py-0.8 bg-slate-800/60 hover:bg-slate-700/80 text-slate-300 rounded-lg border border-slate-700/50 transition cursor-pointer"
              >
                @{acc}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Helpful instruction note */}
      <div className="mt-3 bg-slate-950/60 border border-slate-800/60 rounded-xl p-3 text-xs text-slate-400 space-y-1">
        <div className="flex items-start gap-1.5 text-slate-300 font-medium">
          <Info className="w-3.5 h-3.5 text-cyan-400 mt-0.5 shrink-0" />
          <span>Lưu ý kết nối:</span>
        </div>
        <p className="pl-5 text-[11px] leading-relaxed">
          TikTok ID của bạn đã được <b>lưu tự động</b>. Khi bạn F5 hoặc mở lại
          trình duyệt sau này, ID sẽ tự động điền sẵn để kết nối ngay mà không
          cần nhập lại.
        </p>
      </div>
    </div>
  );
};
