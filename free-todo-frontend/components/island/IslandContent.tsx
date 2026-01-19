"use client";

import { motion, type Variants } from "framer-motion";
import {
  Camera,
  CheckCircle2,
  Maximize2,
  MessageCircle,
  Mic,
} from "lucide-react";
import Image from "next/image";
import type React from "react";
import { IslandMode } from "@/lib/island/types";

const fadeVariants: Variants = {
  initial: { opacity: 0, filter: "blur(8px)", scale: 0.98 },
  animate: {
    opacity: 1,
    filter: "blur(0px)",
    scale: 1,
    transition: { duration: 0.4, ease: "easeOut", delay: 0.1 },
  },
  exit: { opacity: 0, filter: "blur(8px)", scale: 1.05, transition: { duration: 0.2 } },
};

// 图标按钮组件
interface IconButtonProps {
  icon: React.ReactNode;
  onClick?: () => void;
  title?: string;
  color?: string;
}

const IconButton: React.FC<IconButtonProps> = ({ icon, onClick, title, color }) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    className={`w-8 h-8 flex items-center justify-center rounded-full
               bg-white/5 hover:bg-white/15 active:bg-white/20
               transition-all duration-200 ease-out
               hover:scale-105 active:scale-95 ${color || 'text-white/70 hover:text-white'}`}
    style={{
      // @ts-expect-error - WebkitAppRegion is valid in Electron
      WebkitAppRegion: "no-drag",
    }}
  >
    {icon}
  </button>
);

interface FloatContentProps {
  onModeChange?: (mode: IslandMode) => void;
}

// --- 1. FLOAT STATE: 三个功能图标 - 录音、截图、全屏 ---
export const FloatContent: React.FC<FloatContentProps> = ({ onModeChange }) => (
  <motion.div
    variants={fadeVariants}
    initial="initial"
    animate="animate"
    exit="exit"
    className="w-full h-full flex items-center justify-center gap-4 px-4 relative"
  >
    {/* 录音按钮 - 红色 */}
    <IconButton
      icon={<Mic size={16} strokeWidth={2} />}
      title="开始录音"
      color="text-red-400 hover:text-red-300"
      onClick={() => {
        // TODO: 触发录音功能，可能会切换到形态2
        console.log("Start recording");
      }}
    />

    {/* 截图按钮 - 绿色 */}
    <IconButton
      icon={<Camera size={16} strokeWidth={2} />}
      title="截图"
      color="text-green-400 hover:text-green-300"
      onClick={() => {
        // TODO: 触发截图功能，可能会切换到形态2
        console.log("Take screenshot");
      }}
    />

    {/* 全屏按钮 - 默认颜色，点击进入形态3 */}
    <IconButton
      icon={<Maximize2 size={16} strokeWidth={2} />}
      title="展开"
      onClick={() => {
        // 切换到侧边栏模式（形态3）
        onModeChange?.(IslandMode.SIDEBAR);
      }}
    />
  </motion.div>
);

// --- 2. POPUP STATE: FreeTodo 风格的通知弹窗 ---
export const PopupContent: React.FC = () => (
  <motion.div
    variants={fadeVariants}
    initial="initial"
    animate="animate"
    exit="exit"
    className="w-full h-full p-4 flex items-center gap-4 relative overflow-hidden font-sans"
  >
    {/* Background Accent */}
    <div className="absolute -left-4 top-0 w-24 h-full bg-gradient-to-r from-cyan-500/10 to-transparent blur-lg" />

    {/* Logo */}
    <div className="relative shrink-0">
      <div className="w-14 h-14 rounded-2xl border border-white/10 overflow-hidden shadow-lg bg-zinc-800/50 flex items-center justify-center">
        <Image
          src="/free-todo-logos/free_todo_icon_4_with_grid.png"
          alt="Free Todo Logo"
          width={36}
          height={36}
          className="object-contain"
        />
      </div>
      <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 bg-emerald-500 border-2 border-[#121212] rounded-full z-10 flex items-center justify-center">
        <CheckCircle2 size={10} className="text-white" />
      </div>
    </div>

    {/* Message Content */}
    <div className="flex flex-col flex-1 min-w-0 justify-center">
      <div className="flex items-center justify-between mb-1">
        <span className="text-base font-semibold text-white tracking-tight">
          待办提醒
        </span>
        <span className="text-[10px] text-white/40 font-medium">刚刚</span>
      </div>
      <p className="text-sm text-white/70 leading-snug line-clamp-2">
        您有 3 个任务即将到期，点击查看详情
      </p>
      <div className="flex items-center gap-2 mt-2.5">
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-colors cursor-pointer">
          <MessageCircle size={12} className="text-cyan-400" />
          <span className="text-[11px] text-white/70 font-medium">查看详情</span>
        </div>
      </div>
    </div>
  </motion.div>
);
