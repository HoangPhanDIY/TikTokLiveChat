import React from "react";
import {
  Radio,
  Volume2,
  VolumeX,
  Tv,
  Settings2,
  Sparkles,
  Users,
  Heart,
  Gift,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { RoomInfo, TtsSettings } from "../types";

interface HeaderProps {
  isConnected: boolean;
  isConnecting: boolean;
  isSimulated: boolean;
  uniqueId: string;
  roomInfo: RoomInfo;
  ttsSettings: TtsSettings;
  onToggleTts: () => void;
  onOpenTtsSettings: () => void;
  onOpenObsModal: () => void;
  onOpenSimulator: () => void;
  isSpeaking: boolean;
  queueCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  isConnected,
  isConnecting,
  isSimulated,
  uniqueId,
  roomInfo,
  ttsSettings,
  onToggleTts,
  onOpenTtsSettings,
  onOpenObsModal,
  onOpenSimulator,
  isSpeaking,
  queueCount,
}) => {
  return (
    <header className="bg-slate-900/90 backdrop-blur-md border-b border-slate-800 sticky top-0 z-40 px-4 py-3 text-white transition-all shadow-lg">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Left: Brand & Status */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 via-rose-500 to-cyan-400 p-[2px] flex items-center justify-center shadow-md">
                <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                  <Radio className="w-5 h-5 text-pink-400 animate-pulse" />
                </div>
              </div>
              {isConnected && (
                <span className="absolute -bottom-1 -right-1 flex h-3.5 w-3.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 border-2 border-slate-900"></span>
                </span>
              )}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-lg tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent">
                  TikTok Live <span className="text-pink-400">Reader</span>
                </h1>
                {isSimulated && (
                  <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    Chế độ Giả lập
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 flex items-center gap-1.5">
                <span>Đọc bình luận bằng giọng Chị Google</span>
                <span className="inline-block w-1 h-1 rounded-full bg-slate-600"></span>
                {isConnected ? (
                  <span className="text-emerald-400 font-medium flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Live: @{uniqueId}
                  </span>
                ) : isConnecting ? (
                  <span className="text-amber-400 font-medium flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" /> Đang kết nối...
                  </span>
                ) : (
                  <span className="text-slate-400 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 text-slate-500" /> Chưa kết nối
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Quick Metrics on mobile */}
          {isConnected && (
            <div className="flex md:hidden items-center gap-2 text-xs">
              <div className="flex items-center gap-1 bg-slate-800/80 px-2 py-1 rounded-lg border border-slate-700">
                <Users className="w-3 h-3 text-cyan-400" />
                <span className="font-semibold text-slate-200">{roomInfo.viewerCount.toLocaleString()}</span>
              </div>
            </div>
          )}
        </div>

        {/* Center: Live Room Stats (if connected) */}
        {isConnected && (
          <div className="hidden lg:flex items-center gap-4 bg-slate-800/60 border border-slate-700/60 rounded-xl px-4 py-1.5 text-xs">
            <div className="flex items-center gap-2">
              {roomInfo.ownerAvatar ? (
                <img
                  src={roomInfo.ownerAvatar}
                  alt={roomInfo.ownerName}
                  className="w-6 h-6 rounded-full object-cover border border-pink-500/50"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-6 h-6 rounded-full bg-pink-500/20 text-pink-300 flex items-center justify-center font-bold">
                  {uniqueId[0]?.toUpperCase() || "T"}
                </div>
              )}
              <span className="font-medium text-slate-200 max-w-[140px] truncate" title={roomInfo.ownerName}>
                {roomInfo.ownerName || uniqueId}
              </span>
            </div>

            <div className="h-4 w-px bg-slate-700"></div>

            <div className="flex items-center gap-1.5 text-cyan-300" title="Số người đang xem">
              <Users className="w-3.5 h-3.5" />
              <span className="font-bold">{roomInfo.viewerCount.toLocaleString()}</span>
              <span className="text-slate-400">xem</span>
            </div>

            <div className="h-4 w-px bg-slate-700"></div>

            <div className="flex items-center gap-1.5 text-rose-400" title="Tổng lượt thích">
              <Heart className="w-3.5 h-3.5 fill-rose-500/30" />
              <span className="font-bold">{roomInfo.likeCount.toLocaleString()}</span>
            </div>

            <div className="h-4 w-px bg-slate-700"></div>

            <div className="flex items-center gap-1.5 text-amber-300" title="Xu kim cương quà tặng">
              <Gift className="w-3.5 h-3.5" />
              <span className="font-bold">{roomInfo.giftCount.toLocaleString()}</span>
            </div>
          </div>
        )}

        {/* Right: Controls & Actions */}
        <div className="flex items-center gap-2 w-full md:w-auto justify-end flex-wrap">
          {/* Simulator button */}
          <button
            onClick={onOpenSimulator}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 transition cursor-pointer active:scale-95"
            title="Mở bảng điều khiển giả lập bình luận và quà tặng để test thử"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Test Giả lập</span>
          </button>

          {/* OBS Overlay button */}
          <button
            onClick={onOpenObsModal}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 transition cursor-pointer active:scale-95"
            title="Mở giao diện màn hình OBS Browser Source trong suốt"
          >
            <Tv className="w-3.5 h-3.5 text-cyan-400" />
            <span>OBS Overlay</span>
          </button>

          {/* Master Voice Toggle */}
          <button
            onClick={onToggleTts}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition cursor-pointer active:scale-95 ${
              ttsSettings.enabled
                ? "bg-gradient-to-r from-pink-600 to-rose-600 border-pink-500 text-white shadow-md shadow-pink-500/20"
                : "bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200"
            }`}
            title={ttsSettings.enabled ? "Đang bật đọc Chị Google" : "Đang tắt đọc Chị Google"}
          >
            {ttsSettings.enabled ? (
              <>
                <Volume2 className={`w-3.5 h-3.5 ${isSpeaking ? "animate-bounce text-yellow-300" : ""}`} />
                <span>Chị Google: <b>BẬT</b></span>
                {queueCount > 0 && (
                  <span className="ml-1 px-1.5 py-0.2 bg-white/20 rounded-full text-[10px] font-bold">
                    {queueCount}
                  </span>
                )}
              </>
            ) : (
              <>
                <VolumeX className="w-3.5 h-3.5" />
                <span>Chị Google: <b>TẮT</b></span>
              </>
            )}
          </button>

          {/* Voice Settings Gear */}
          <button
            onClick={onOpenTtsSettings}
            className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition cursor-pointer active:scale-95"
            title="Cài đặt giọng đọc Chị Google, bộ lọc từ cấm, tốc độ, mẫu câu..."
          >
            <Settings2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
