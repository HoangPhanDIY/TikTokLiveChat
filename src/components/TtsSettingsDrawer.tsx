import React, { useState, useEffect } from "react";
import {
  X,
  Volume2,
  Sliders,
  Sparkles,
  ShieldAlert,
  Play,
  Square,
  Trash2,
  Check,
  Plus,
  Settings,
  HelpCircle,
  Headphones,
  Filter,
} from "lucide-react";
import { TtsSettings, QueueItem } from "../types";
import { audioManager } from "../utils/audio";

interface TtsSettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  settings: TtsSettings;
  onUpdateSettings: (newSettings: Partial<TtsSettings>) => void;
  currentSpeakingItem: QueueItem | null;
  queue: QueueItem[];
}

export const TtsSettingsDrawer: React.FC<TtsSettingsDrawerProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  currentSpeakingItem,
  queue,
}) => {
  const [availableVoices, setAvailableVoices] = useState<
    SpeechSynthesisVoice[]
  >([]);
  const [newBadWord, setNewBadWord] = useState("");
  const [testText, setTestText] = useState(
    "Xin chào mọi người! Chị Google chúc buổi Live của bạn thật đông người xem!",
  );

  useEffect(() => {
    const updateVoices = () => {
      const v = audioManager.getVietnameseVoices();
      setAvailableVoices(v.length > 0 ? v : audioManager.getAvailableVoices());
    };
    updateVoices();
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.onvoiceschanged = updateVoices;
    }
  }, []);

  if (!isOpen) return null;

  const blacklist = Array.isArray(settings?.blacklistWords)
    ? settings.blacklistWords
    : [];

  const handleAddBadWord = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBadWord.trim()) return;
    const word = newBadWord.trim().toLowerCase();
    if (!blacklist.includes(word)) {
      onUpdateSettings({
        blacklistWords: [...blacklist, word],
      });
    }
    setNewBadWord("");
  };

  const handleRemoveBadWord = (wordToRemove: string) => {
    onUpdateSettings({
      blacklistWords: blacklist.filter((w) => w !== wordToRemove),
    });
  };

  const handleTestVoice = () => {
    audioManager.testSpeech(testText, settings);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-5xl bg-slate-900 border-l border-slate-800 text-slate-100 flex flex-col h-full shadow-2xl overflow-hidden">
        {/* Drawer Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-pink-500/20 border border-pink-500/30 flex items-center justify-center">
              <Headphones className="w-4 h-4 text-pink-400" />
            </div>
            <div>
              <h2 className="font-bold text-sm text-white">
                Cài đặt giọng đọc Chị Google
              </h2>
              <p className="text-xs text-slate-400">
                Tùy biến âm thanh, bộ lọc và quy tắc đọc
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drawer Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5 text-xs">
          {/* Master Toggle */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between">
            <div>
              <span className="font-semibold text-sm text-slate-100 block">
                Bật giọng đọc Chị Google
              </span>
              <span className="text-[11px] text-slate-400">
                Tự động phát âm thanh khi có bình luận mới
              </span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.enabled}
                onChange={(e) =>
                  onUpdateSettings({ enabled: e.target.checked })
                }
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-pink-500 peer-checked:to-rose-500"></div>
            </label>
          </div>

          {/* Engine Selector */}
          <div className="space-y-2">
            <label className="font-semibold text-slate-200 block flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-pink-400" />
              Nguồn giọng đọc
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onUpdateSettings({ engine: "google_authentic" })}
                className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                  settings.engine === "google_authentic"
                    ? "bg-pink-500/15 border-pink-500/50 text-pink-200 ring-1 ring-pink-500/30"
                    : "bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700"
                }`}
              >
                <div className="font-bold text-xs flex items-center justify-between">
                  <span>Chị Google chuẩn</span>
                  {settings.engine === "google_authentic" && (
                    <Check className="w-3 h-3 text-pink-400" />
                  )}
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Giọng chị Google thân thuộc (Google TTS MP3)
                </p>
              </button>

              <button
                type="button"
                onClick={() => onUpdateSettings({ engine: "web_speech" })}
                className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                  settings.engine === "web_speech"
                    ? "bg-pink-500/15 border-pink-500/50 text-pink-200 ring-1 ring-pink-500/30"
                    : "bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700"
                }`}
              >
                <div className="font-bold text-xs flex items-center justify-between">
                  <span>Web Speech API</span>
                  {settings.engine === "web_speech" && (
                    <Check className="w-3 h-3 text-pink-400" />
                  )}
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Giọng hệ điều hành / Trình duyệt (Tốc độ phản hồi tức thì)
                </p>
              </button>
            </div>
          </div>

          {/* Voice Selector if Web Speech */}
          {settings.engine === "web_speech" && availableVoices.length > 0 && (
            <div className="space-y-1.5">
              <label className="font-semibold text-slate-300 block">
                Chọn giọng nói trình duyệt:
              </label>
              <select
                value={settings.voiceName}
                onChange={(e) =>
                  onUpdateSettings({ voiceName: e.target.value })
                }
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-pink-500"
              >
                <option value="">Tự động phát hiện (Google Tiếng Việt)</option>
                {availableVoices.map((voice) => (
                  <option key={voice.name} value={voice.name}>
                    {voice.name} ({voice.lang})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Voice Modulation Sliders */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5 space-y-3.5">
            <div className="flex items-center gap-1.5 font-semibold text-slate-200">
              <Sliders className="w-3.5 h-3.5 text-pink-400" />
              <span>Điều chỉnh âm điệu & tốc độ</span>
            </div>

            {/* Speed */}
            <div className="space-y-1">
              <div className="flex justify-between text-slate-300">
                <span>Tốc độ đọc</span>
                <span className="font-mono text-pink-400">
                  {settings.rate}x
                </span>
              </div>
              <input
                type="range"
                min="0.6"
                max="1.8"
                step="0.1"
                value={settings.rate}
                onChange={(e) =>
                  onUpdateSettings({ rate: parseFloat(e.target.value) })
                }
                className="w-full accent-pink-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-500">
                <span>Chậm (0.6x)</span>
                <span>Chuẩn (1.0x)</span>
                <span>Nhanh (1.8x)</span>
              </div>
            </div>

            {/* Pitch */}
            <div className="space-y-1">
              <div className="flex justify-between text-slate-300">
                <span>Cao độ giọng (Pitch)</span>
                <span className="font-mono text-pink-400">
                  {settings.pitch}x
                </span>
              </div>
              <input
                type="range"
                min="0.7"
                max="1.4"
                step="0.1"
                value={settings.pitch}
                onChange={(e) =>
                  onUpdateSettings({ pitch: parseFloat(e.target.value) })
                }
                className="w-full accent-pink-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
              />
            </div>

            {/* Volume */}
            <div className="space-y-1">
              <div className="flex justify-between text-slate-300">
                <span>Âm lượng</span>
                <span className="font-mono text-pink-400">
                  {Math.round(settings.volume * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={settings.volume}
                onChange={(e) =>
                  onUpdateSettings({ volume: parseFloat(e.target.value) })
                }
                className="w-full accent-pink-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
              />
            </div>

            {/* Delay between messages */}
            <div className="space-y-1">
              <div className="flex justify-between text-slate-300">
                <span>Thời gian nghỉ (Delay) sau khi đọc xong:</span>
                <span className="font-mono text-pink-400 font-bold">
                  {settings.delayBetweenMessages}s
                </span>
              </div>
              <input
                type="range"
                min="0.5"
                max="10.0"
                step="0.5"
                value={settings.delayBetweenMessages}
                onChange={(e) =>
                  onUpdateSettings({
                    delayBetweenMessages: parseFloat(e.target.value),
                  })
                }
                className="w-full accent-pink-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                <span>0.5s</span>
                <span className="text-pink-400 font-semibold">
                  Mặc định: 3.0s
                </span>
                <span>10s</span>
              </div>
            </div>
          </div>

          {/* Format & Reading Rules */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5 space-y-3">
            <span className="font-semibold text-slate-200 block">
              Quy tắc & Định dạng đọc:
            </span>

            {/* Read sender name */}
            <div className="flex items-center justify-between">
              <div>
                <span className="text-slate-200 font-medium block">
                  Đọc tên người bình luận
                </span>
                <span className="text-[10px] text-slate-400">
                  Ví dụ: "Huy nói: Chào bạn"
                </span>
              </div>
              <input
                type="checkbox"
                checked={settings.readSenderName}
                onChange={(e) =>
                  onUpdateSettings({ readSenderName: e.target.checked })
                }
                className="w-4 h-4 accent-pink-500 rounded cursor-pointer"
              />
            </div>

            {/* Name separator */}
            {settings.readSenderName && (
              <div className="pl-3 border-l-2 border-slate-800 space-y-1">
                <label className="text-slate-400 text-[11px]">
                  Từ nối sau tên người gửi:
                </label>
                <select
                  value={settings.nameCommentSeparator}
                  onChange={(e) =>
                    onUpdateSettings({ nameCommentSeparator: e.target.value })
                  }
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-slate-200"
                >
                  <option value="nói:">nói: (Ví dụ: Tuấn nói: Shop ơi)</option>
                  <option value="bảo:">bảo: (Ví dụ: Tuấn bảo: Shop ơi)</option>
                  <option value="hỏi:">hỏi: (Ví dụ: Tuấn hỏi: Shop ơi)</option>
                  <option value=":">: (Ví dụ: Tuấn: Shop ơi)</option>
                </select>
              </div>
            )}

            {/* Read gifts */}
            <div className="flex items-center justify-between">
              <div>
                <span className="text-slate-200 font-medium block">
                  Đọc thông báo tặng quà (Donate)
                </span>
                <span className="text-[10px] text-slate-400">
                  Tự động cảm ơn người gửi hoa hồng, kim cương...
                </span>
              </div>
              <input
                type="checkbox"
                checked={settings.readGifts}
                onChange={(e) =>
                  onUpdateSettings({ readGifts: e.target.checked })
                }
                className="w-4 h-4 accent-pink-500 rounded cursor-pointer"
              />
            </div>

            {/* Read follows */}
            <div className="flex items-center justify-between">
              <div>
                <span className="text-slate-200 font-medium block">
                  Đọc thông báo theo dõi mới (Follow)
                </span>
                <span className="text-[10px] text-slate-400">
                  Cảm ơn người vừa bấm Follow kênh
                </span>
              </div>
              <input
                type="checkbox"
                checked={settings.readFollows}
                onChange={(e) =>
                  onUpdateSettings({ readFollows: e.target.checked })
                }
                className="w-4 h-4 accent-pink-500 rounded cursor-pointer"
              />
            </div>

            {/* Sound effects */}
            <div className="flex items-center justify-between">
              <div>
                <span className="text-slate-200 font-medium block">
                  Âm thanh chuông thông báo (SFX)
                </span>
                <span className="text-[10px] text-slate-400">
                  Phát tiếng ting ting vui tai khi có quà & tin nhắn
                </span>
              </div>
              <input
                type="checkbox"
                checked={settings.soundEffects}
                onChange={(e) =>
                  onUpdateSettings({ soundEffects: e.target.checked })
                }
                className="w-4 h-4 accent-pink-500 rounded cursor-pointer"
              />
            </div>
          </div>

          {/* Smart Filters */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5 space-y-3">
            <div className="flex items-center gap-1.5 font-semibold text-slate-200">
              <Filter className="w-3.5 h-3.5 text-pink-400" />
              <span>Bộ lọc thông minh & Chống Spam:</span>
            </div>

            {/* Only read questions */}
            <div className="flex items-center justify-between">
              <div>
                <span className="text-slate-200 font-medium block">
                  Chỉ đọc câu hỏi (?)
                </span>
                <span className="text-[10px] text-slate-400">
                  Hữu ích khi live đông, chỉ đọc tin cần tư vấn
                </span>
              </div>
              <input
                type="checkbox"
                checked={settings.onlyReadQuestions}
                onChange={(e) =>
                  onUpdateSettings({ onlyReadQuestions: e.target.checked })
                }
                className="w-4 h-4 accent-pink-500 rounded cursor-pointer"
              />
            </div>

            {/* Strip emojis */}
            <div className="flex items-center justify-between">
              <div>
                <span className="text-slate-200 font-medium block">
                  Tự động bỏ biểu tượng Emoji
                </span>
                <span className="text-[10px] text-slate-400">
                  Tránh đọc tên icon dài dòng
                </span>
              </div>
              <input
                type="checkbox"
                checked={settings.stripEmojis}
                onChange={(e) =>
                  onUpdateSettings({ stripEmojis: e.target.checked })
                }
                className="w-4 h-4 accent-pink-500 rounded cursor-pointer"
              />
            </div>

            {/* Simplify repeated chars */}
            <div className="flex items-center justify-between">
              <div>
                <span className="text-slate-200 font-medium block">
                  Rút gọn chữ kéo dài (aaaa...)
                </span>
                <span className="text-[10px] text-slate-400">
                  Chống người xem spam chữ dài
                </span>
              </div>
              <input
                type="checkbox"
                checked={settings.simplifyRepeatedChars}
                onChange={(e) =>
                  onUpdateSettings({ simplifyRepeatedChars: e.target.checked })
                }
                className="w-4 h-4 accent-pink-500 rounded cursor-pointer"
              />
            </div>
          </div>

          {/* Blacklist Bad Words */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                Danh sách từ cấm / Lọc tục tĩu
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                {blacklist.length} từ
              </span>
            </div>

            <form onSubmit={handleAddBadWord} className="flex gap-2">
              <input
                type="text"
                value={newBadWord}
                onChange={(e) => setNewBadWord(e.target.value)}
                placeholder="Nhập từ cấm cần chặn..."
                className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 text-xs focus:outline-none focus:border-rose-500"
              />
              <button
                type="submit"
                className="px-3 py-1.5 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 rounded-lg font-semibold flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Thêm</span>
              </button>
            </form>

            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1">
              {blacklist.map((word) => (
                <span
                  key={word}
                  className="px-2 py-0.5 bg-rose-500/10 text-rose-300 rounded-md border border-rose-500/20 flex items-center gap-1 text-[11px]"
                >
                  <span>{word}</span>
                  <button
                    onClick={() => handleRemoveBadWord(word)}
                    className="hover:text-white cursor-pointer"
                    title="Xóa từ này"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Test Voice Section */}
          <div className="bg-gradient-to-br from-pink-950/40 to-slate-950 border border-pink-500/30 rounded-xl p-3.5 space-y-2.5">
            <span className="font-semibold text-pink-300 block flex items-center gap-1.5">
              <Volume2 className="w-3.5 h-3.5" />
              Thử giọng đọc Chị Google
            </span>
            <input
              type="text"
              value={testText}
              onChange={(e) => setTestText(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 text-xs"
            />
            <button
              onClick={handleTestVoice}
              className="w-full py-2 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white font-bold rounded-xl shadow-md flex items-center justify-center gap-2 cursor-pointer active:scale-98"
            >
              <Play className="w-3.5 h-3.5 fill-white" />
              <span>Phát thử giọng Chị Google ngay</span>
            </button>
          </div>

          {/* Live Queue Controller */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-300">
                Trạng thái hàng đợi đọc
              </span>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-pink-400 font-mono">
                {queue.length} câu đang chờ
              </span>
            </div>

            {currentSpeakingItem ? (
              <div className="bg-pink-500/10 border border-pink-500/30 rounded-lg p-2 text-pink-200">
                <span className="text-[10px] text-pink-400 font-bold block">
                  ĐANG ĐỌC:
                </span>
                <p className="font-medium text-xs truncate mt-0.5">
                  {currentSpeakingItem.textToSpeak}
                </p>
              </div>
            ) : (
              <p className="text-[11px] text-slate-500">
                Hiện tại chưa có câu nào đang đọc.
              </p>
            )}

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => audioManager.stopCurrentSpeech()}
                className="flex-1 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg flex items-center justify-center gap-1 cursor-pointer"
              >
                <Square className="w-3 h-3 text-rose-400" />
                <span>Dừng câu này</span>
              </button>
              <button
                onClick={() => audioManager.clearQueue()}
                className="flex-1 py-1.5 bg-slate-800 hover:bg-slate-700 text-rose-300 rounded-lg flex items-center justify-center gap-1 cursor-pointer"
              >
                <Trash2 className="w-3 h-3" />
                <span>Xóa hàng đợi</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
