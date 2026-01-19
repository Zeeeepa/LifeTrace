"use client";

import { motion, type Variants } from "framer-motion";
import {
  Hexagon,
  MessageCircle,
} from "lucide-react";
import type React from "react";
import { IslandFullscreenContent } from "./IslandFullscreenContent";
import { IslandSidebarContent } from "./IslandSidebarContent";

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

// --- 1. FLOAT STATE: Screen Rec | Voice Rec | Logo ---
export const FloatContent: React.FC = () => (
  <motion.div
    variants={fadeVariants}
    initial="initial"
    animate="animate"
    exit="exit"
    className="w-full h-full flex items-center justify-between px-5 relative cursor-pointer group"
  >
    {/* Left: Screen Recording Animation */}
    <div className="flex items-center gap-2 group/rec">
      <div className="relative flex items-center justify-center">
        <motion.div
          className="absolute w-full h-full bg-red-500/30 rounded-full"
          animate={{ scale: [1, 1.8, 1], opacity: [0.3, 0, 0.3] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeOut" }}
        />
        <div className="w-2.5 h-2.5 bg-red-500 rounded-full shadow-[0_0_8px_rgba(239,68,68,0.6)] z-10" />
      </div>
      <div className="w-0 overflow-hidden group-hover/rec:w-auto transition-all duration-300">
        <span className="text-[10px] font-medium text-white/50 pl-1 whitespace-nowrap">
          REC
        </span>
      </div>
    </div>

    {/* Divider */}
    <div className="w-[1px] h-3 bg-white/10" />

    {/* Center: Voice Recording Waveform */}
    <div className="flex items-center gap-0.5 h-3">
      {[1, 0.6, 1, 0.5, 0.8].map((h, i) => (
        <motion.div
          key={`waveform-${i}-${h}`}
          className="w-0.5 bg-orange-400 rounded-full"
          animate={{ height: [4, h * 12, 4] }}
          transition={{
            duration: 0.5,
            repeat: Infinity,
            delay: i * 0.1,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>

    {/* Divider */}
    <div className="w-[1px] h-3 bg-white/10" />

    {/* Right: Logo */}
    <div className="flex items-center justify-center text-white/80">
      <Hexagon
        size={18}
        strokeWidth={2.5}
        className="text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.4)]"
      />
    </div>
  </motion.div>
);

// --- 2. POPUP STATE: Message Box ---
export const PopupContent: React.FC = () => (
  <motion.div
    variants={fadeVariants}
    initial="initial"
    animate="animate"
    exit="exit"
    className="w-full h-full p-5 flex items-center gap-4 relative overflow-hidden font-sans"
  >
    {/* Background Accent */}
    <div className="absolute -left-4 top-0 w-20 h-full bg-gradient-to-r from-blue-500/10 to-transparent blur-md" />

    {/* Avatar */}
    <div className="relative shrink-0">
      <div className="w-14 h-14 rounded-full border border-white/10 overflow-hidden shadow-lg bg-zinc-800">
        {/* Placeholder avatar */}
        <div className="w-full h-full bg-gradient-to-br from-cyan-500 to-blue-600" />
      </div>
      <div className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 border-2 border-[#121212] rounded-full z-10" />
    </div>

    {/* Message Content */}
    <div className="flex flex-col flex-1 min-w-0 justify-center">
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-base font-semibold text-white tracking-wide">
          待办提醒
        </span>
        <span className="text-[10px] text-white/40">刚刚</span>
      </div>
      <p className="text-sm text-white/80 leading-tight truncate">
        您有 3 个任务即将到期，点击查看详情
      </p>
      <div className="flex items-center gap-2 mt-2">
        <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/5 border border-white/5">
          <MessageCircle size={10} className="text-white/40" />
          <span className="text-[10px] text-white/40">查看</span>
        </div>
      </div>
    </div>
  </motion.div>
);

// --- 3. SIDEBAR STATE: 使用 FreeTodo 组件 ---
export const SidebarContent: React.FC = () => (
  <motion.div
    variants={fadeVariants}
    initial="initial"
    animate="animate"
    exit="exit"
    className="w-full h-full relative"
  >
    <IslandSidebarContent />
  </motion.div>
);

// --- 4. FULLSCREEN STATE: 使用 FreeTodo 组件 ---
export const FullScreenContent: React.FC = () => (
  <motion.div
    variants={fadeVariants}
    initial="initial"
    animate="animate"
    exit="exit"
    className="w-full h-full relative"
  >
    <IslandFullscreenContent />
  </motion.div>
);
