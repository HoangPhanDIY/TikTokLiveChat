import React, { useState, useEffect, useRef } from "react";
import {
  X,
  Sparkles,
  Send,
  Gift,
  Heart,
  UserPlus,
  Play,
  Square,
  Zap,
} from "lucide-react";
import { TikTokCommentEvent, TikTokGiftEvent } from "../types";

interface SimulatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSimulateEvent: (eventType: string, data: any) => void;
}

const SAMPLE_COMMENTS = [
  "Chào idol nha! Live vui vẻ nhé",
  "Shop ơi áo này còn size L không ạ?",
  "Chị Google đọc tên em với: Tuấn Đẹp Trai",
  "Sản phẩm này bảo hành bao lâu vậy shop?",
  "Mọi người cùng thả tim ủng hộ kênh đi ạ!",
  "Nay hát hay quá idol ơi ❤️❤️❤️",
  "Bao nhiêu một combo này vậy bạn?",
  "Gửi tặng idol bông hoa hồng nè 🌹",
  "Hôm nay có mã giảm giá freeship không shop?",
  "Chúc bạn buổi tối vui vẻ và chốt được nhiều đơn nha",
  "Chị Google ơi đọc giúp em câu này với nha",
  "Đã chia sẻ live lên các nhóm rồi nhé!",
];

const SAMPLE_USERS = [
  { name: "Minh Anh", id: "minhanh99", avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80" },
  { name: "Hoàng Long", id: "longhoang_gaming", avatar: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=100&auto=format&fit=crop&q=80" },
  { name: "Thu Hà", id: "thuha_cute", avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80" },
  { name: "Đức Thịnh", id: "thinhduc_vlog", avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80" },
  { name: "Khánh Linh", id: "linh_khanh2024", avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100&auto=format&fit=crop&q=80" },
];

const SAMPLE_GIFTS = [
  { name: "Hoa Hồng", diamonds: 1, img: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/5658_rose.png~tplv-obj.png" },
  { name: "Trái Tim", diamonds: 5, img: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/heart.png~tplv-obj.png" },
  { name: "Mũ Bóng Chày", diamonds: 99, img: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/cap.png~tplv-obj.png" },
  { name: "TikTok Galaxy", diamonds: 1000, img: "https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/galaxy.png~tplv-obj.png" },
];

export const SimulatorModal: React.FC<SimulatorModalProps> = ({
  isOpen,
  onClose,
  onSimulateEvent,
}) => {
  const [customName, setCustomName] = useState("Người xem thử nghiệm");
  const [customComment, setCustomComment] = useState("");
  const [isAutoSimulating, setIsAutoSimulating] = useState(false);
  const [speed, setSpeed] = useState<number>(2000); // ms
  const intervalRef = useRef<any>(null);

  // Stop interval on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const triggerRandomEvent = () => {
    const rand = Math.random();
    const user = SAMPLE_USERS[Math.floor(Math.random() * SAMPLE_USERS.length)];

    if (rand < 0.7) {
      // Chat comment
      const commentText = SAMPLE_COMMENTS[Math.floor(Math.random() * SAMPLE_COMMENTS.length)];
      const event: TikTokCommentEvent = {
        id: `sim_msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        type: "chat",
        uniqueId: user.id,
        nickname: user.name,
        comment: commentText,
        profilePictureUrl: user.avatar,
        timestamp: Date.now(),
      };
      onSimulateEvent("chat", event);
    } else if (rand < 0.85) {
      // Gift
      const gift = SAMPLE_GIFTS[Math.floor(Math.random() * SAMPLE_GIFTS.length)];
      const repeat = Math.floor(Math.random() * 3) + 1;
      const event: TikTokGiftEvent = {
        id: `sim_gift_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        type: "gift",
        uniqueId: user.id,
        nickname: user.name,
        giftId: 1,
        giftName: gift.name,
        diamondCount: gift.diamonds,
        repeatCount: repeat,
        profilePictureUrl: user.avatar,
        giftPictureUrl: gift.img,
        timestamp: Date.now(),
      };
      onSimulateEvent("gift", event);
    } else if (rand < 0.95) {
      // Likes
      onSimulateEvent("like", {
        id: `sim_like_${Date.now()}`,
        type: "like",
        uniqueId: user.id,
        nickname: user.name,
        likeCount: Math.floor(Math.random() * 15) + 1,
        timestamp: Date.now(),
      });
    } else {
      // Follow
      onSimulateEvent("social", {
        id: `sim_soc_${Date.now()}`,
        type: "social",
        uniqueId: user.id,
        nickname: user.name,
        displayType: "follow",
        timestamp: Date.now(),
      });
    }
  };

  const toggleAutoSimulate = () => {
    if (isAutoSimulating) {
      clearInterval(intervalRef.current);
      setIsAutoSimulating(false);
    } else {
      setIsAutoSimulating(true);
      triggerRandomEvent();
      intervalRef.current = setInterval(triggerRandomEvent, speed);
    }
  };

  const handleSendCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customComment.trim()) return;

    const event: TikTokCommentEvent = {
      id: `sim_custom_${Date.now()}`,
      type: "chat",
      uniqueId: customName.toLowerCase().replace(/\s+/g, "_"),
      nickname: customName.trim() || "Người xem",
      comment: customComment.trim(),
      profilePictureUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80",
      timestamp: Date.now(),
    };

    onSimulateEvent("chat", event);
    setCustomComment("");
  };

  const handleSendGift = (gift: (typeof SAMPLE_GIFTS)[0]) => {
    const event: TikTokGiftEvent = {
      id: `sim_gift_${Date.now()}`,
      type: "gift",
      uniqueId: customName.toLowerCase().replace(/\s+/g, "_"),
      nickname: customName.trim() || "Người xem",
      giftId: 99,
      giftName: gift.name,
      diamondCount: gift.diamonds,
      repeatCount: 1,
      profilePictureUrl: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=100&auto=format&fit=crop&q=80",
      giftPictureUrl: gift.img,
      timestamp: Date.now(),
    };
    onSimulateEvent("gift", event);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <h2 className="font-bold text-sm text-white">Bảng điều khiển Giả lập Live TikTok</h2>
              <p className="text-xs text-slate-400">Thử nghiệm Chị Google đọc bình luận & quà tặng</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-5 text-xs">
          {/* Auto Bot Traffic Generator */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-bold text-sm text-slate-100 block flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-amber-400" />
                  Tự động phát bình luận giả lập (Bot Stream)
                </span>
                <span className="text-[11px] text-slate-400">
                  Tự sinh bình luận, tặng hoa hồng và tim theo nhịp đều đặn
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleAutoSimulate}
                className={`flex-1 py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer active:scale-98 ${
                  isAutoSimulating
                    ? "bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/30 animate-pulse"
                    : "bg-gradient-to-r from-amber-500 to-pink-600 hover:from-amber-400 hover:to-pink-500 text-white shadow-lg shadow-pink-600/20"
                }`}
              >
                {isAutoSimulating ? (
                  <>
                    <Square className="w-4 h-4 fill-white" />
                    <span>DỪNG GIẢ LẬP TỰ ĐỘNG</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-white" />
                    <span>BẮT ĐẦU GIẢ LẬP TỰ ĐỘNG</span>
                  </>
                )}
              </button>

              <select
                value={speed}
                onChange={(e) => setSpeed(Number(e.target.value))}
                disabled={isAutoSimulating}
                className="bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-2 text-xs text-slate-200"
              >
                <option value={1500}>Nhanh (1.5s/tin)</option>
                <option value={2500}>Vừa (2.5s/tin)</option>
                <option value={4000}>Chậm (4.0s/tin)</option>
              </select>
            </div>
          </div>

          {/* Custom Message Sender */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 space-y-3">
            <span className="font-bold text-slate-200 block">Gửi bình luận thử nghiệm tùy ý:</span>

            <form onSubmit={handleSendCustom} className="space-y-2.5">
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Tên người xem:</label>
                <input
                  type="text"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="Ví dụ: Hoàng Phan, Tuấn Trần..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-slate-100 text-xs focus:outline-none focus:border-pink-500"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Nội dung bình luận:</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customComment}
                    onChange={(e) => setCustomComment(e.target.value)}
                    placeholder="Nhập nội dung để Chị Google đọc..."
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-slate-100 text-xs focus:outline-none focus:border-pink-500"
                  />
                  <button
                    type="submit"
                    disabled={!customComment.trim()}
                    className="px-3.5 py-1.5 bg-pink-600 hover:bg-pink-500 disabled:opacity-50 text-white font-semibold rounded-xl flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Gửi</span>
                  </button>
                </div>
              </div>
            </form>
          </div>

          {/* Quick Trigger Buttons: Gifts, Follows, Likes */}
          <div className="space-y-2">
            <span className="font-bold text-slate-300 block">Sự kiện tương tác nhanh:</span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  onSimulateEvent("social", {
                    id: `sim_soc_${Date.now()}`,
                    type: "social",
                    uniqueId: customName.toLowerCase().replace(/\s+/g, "_") || "user_fan",
                    nickname: customName.trim() || "Người xem mới",
                    displayType: "follow",
                    profilePictureUrl: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100&auto=format&fit=crop&q=80",
                    timestamp: Date.now(),
                  });
                }}
                className="bg-slate-950/90 border border-pink-500/40 hover:border-pink-400 p-2.5 rounded-xl flex items-center justify-center gap-2 text-pink-300 font-bold transition hover:scale-102 cursor-pointer shadow-sm"
              >
                <UserPlus className="w-4 h-4 text-pink-400" />
                <span>Bắn 1 Follow (Góc trên phải)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onSimulateEvent("like", {
                    id: `sim_like_${Date.now()}`,
                    type: "like",
                    uniqueId: customName.toLowerCase().replace(/\s+/g, "_") || "user_fan",
                    nickname: customName.trim() || "Người xem",
                    likeCount: 20,
                    profilePictureUrl: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=100&auto=format&fit=crop&q=80",
                    timestamp: Date.now(),
                  });
                }}
                className="bg-slate-950/90 border border-rose-500/40 hover:border-rose-400 p-2.5 rounded-xl flex items-center justify-center gap-2 text-rose-300 font-bold transition hover:scale-102 cursor-pointer shadow-sm"
              >
                <Heart className="w-4 h-4 text-rose-400 fill-rose-400" />
                <span>Thả 20 Tim</span>
              </button>
            </div>

            <span className="font-bold text-slate-300 block pt-1">Gửi quà tặng giả lập:</span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {SAMPLE_GIFTS.map((g) => (
                <button
                  key={g.name}
                  type="button"
                  onClick={() => handleSendGift(g)}
                  className="bg-slate-950/80 border border-slate-800 hover:border-amber-500/50 p-2.5 rounded-xl flex flex-col items-center gap-1.5 transition hover:scale-102 cursor-pointer text-center"
                >
                  <span className="text-xl">🎁</span>
                  <span className="font-bold text-slate-200 text-xs">{g.name}</span>
                  <span className="text-[10px] text-amber-400">{g.diamonds} 💎</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
