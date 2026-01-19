"use client";

import { AnimatePresence, motion } from "framer-motion";
import type React from "react";
import { useEffect, useRef } from "react";
import { IslandMode } from "@/lib/island/types";
import {
  FloatContent,
  PopupContent,
} from "./IslandContent";

interface DynamicIslandProps {
  mode: IslandMode;
  onModeChange?: (mode: IslandMode) => void;
}

const DynamicIsland: React.FC<DynamicIslandProps> = ({ mode, onModeChange }) => {
  const prevModeRef = useRef<IslandMode | null>(null);

  // Electron Click-Through Handling & Window Resizing
  useEffect(() => {
    const setIgnoreMouse = (ignore: boolean) => {
      // 使用 electronAPI（通过 preload 暴露）
      if (typeof window !== "undefined" && window.electronAPI) {
        try {
          if (ignore) {
            window.electronAPI.setIgnoreMouseEvents(true, { forward: true });
          } else {
            window.electronAPI.setIgnoreMouseEvents(false);
          }
        } catch (e) {
          console.error("Electron API call failed", e);
        }
      }
    };

    // Resize window based on mode
    const resizeWindow = () => {
      if (typeof window !== "undefined" && prevModeRef.current !== mode) {
        try {
          // 尝试使用 electronAPI
          if (window.electronAPI?.islandResizeWindow) {
            window.electronAPI.islandResizeWindow(mode);
          }
          // 降级：使用 require('electron')
          else if (typeof window !== "undefined" && "require" in window) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            const electron = (window as { require: (module: string) => { ipcRenderer: { send: (channel: string, ...args: unknown[]) => void } } }).require("electron");
            electron.ipcRenderer.send("resize-window", mode);
          }
          prevModeRef.current = mode;
        } catch (e) {
          console.error("Failed to resize window", e);
        }
      }
    };

    // Resize window when mode changes
    if (prevModeRef.current !== null) {
      resizeWindow();
    } else {
      if (mode !== IslandMode.FLOAT) {
        resizeWindow();
      } else {
        prevModeRef.current = mode;
      }
    }

    // Always allow mouse events
    setIgnoreMouse(false);
  }, [mode]);

  const getLayoutState = (mode: IslandMode) => {
    switch (mode) {
      case IslandMode.FLOAT:
        return {
          width: "100%",
          height: "100%",
          borderRadius: 24,
        };
      case IslandMode.POPUP:
        return {
          width: "100%",
          height: "100%",
          borderRadius: 32,
        };
      case IslandMode.SIDEBAR:
        return {
          width: "100%",
          height: "100%",
          borderRadius: 48,
        };
      case IslandMode.FULLSCREEN:
        return {
          width: "100%",
          height: "100%",
          borderRadius: 0,
        };
      default:
        return {
          width: "100%",
          height: "100%",
          borderRadius: 24,
        };
    }
  };

  const layoutState = getLayoutState(mode);
  const isFullscreen = mode === IslandMode.FULLSCREEN;

  return (
    <div className="relative w-full h-full pointer-events-none overflow-hidden">
      <motion.div
        layout
        initial={false}
        animate={{
          width: layoutState.width,
          height: layoutState.height,
          borderRadius: layoutState.borderRadius,
        }}
        transition={{
          type: "spring",
          stiffness: 340,
          damping: 28,
          mass: 0.6,
          restDelta: 0.001,
        }}
        className="absolute overflow-hidden pointer-events-auto bg-[#0a0a0a]"
        style={{
          right: 0,
          bottom: 0,
          // @ts-expect-error - WebkitAppRegion is a valid CSS property in Electron
          WebkitAppRegion: mode !== IslandMode.FULLSCREEN ? "drag" : "no-drag",
          cursor: mode !== IslandMode.FULLSCREEN ? "move" : "default",
          boxShadow: isFullscreen
            ? "none"
            : "0px 20px 50px -10px rgba(0, 0, 0, 0.5), 0px 10px 20px -10px rgba(0,0,0,0.3)",
        }}
      >
        {/* 背景层 */}
        <div
          className={`absolute inset-0 bg-[#080808]/90 backdrop-blur-[80px] transition-colors duration-700 ease-out ${
            isFullscreen ? "bg-[#030303]/98" : ""
          }`}
        />

        {/* 噪点纹理 */}
        <div className="absolute inset-0 opacity-[0.035] bg-[url('https://grainy-gradients.vercel.app/noise.svg')] pointer-events-none mix-blend-overlay" />

        {/* 光晕效果 */}
        <div
          className={`absolute inset-0 transition-opacity duration-1000 ${
            mode === IslandMode.FLOAT ? "opacity-0" : "opacity-100"
          }`}
        >
          <div className="absolute top-[-50%] left-[-20%] w-[100%] h-[100%] rounded-full bg-indigo-500/10 blur-[120px] mix-blend-screen" />
          <div className="absolute bottom-[-20%] right-[-20%] w-[80%] h-[80%] rounded-full bg-purple-500/10 blur-[120px] mix-blend-screen" />
        </div>

        {/* 边框 */}
        <div
          className={`absolute inset-0 rounded-[inherit] border border-white/10 pointer-events-none shadow-[inset_0_0_20px_rgba(255,255,255,0.03)] transition-opacity duration-500 ${
            isFullscreen ? "opacity-0" : "opacity-100"
          }`}
        />

        {/* 内容区域 */}
        <div className="absolute inset-0 w-full h-full text-white font-sans antialiased overflow-hidden">
          <AnimatePresence>
            {mode === IslandMode.FLOAT && (
              <motion.div key="float" className="absolute inset-0 w-full h-full">
                <FloatContent onModeChange={onModeChange} />
              </motion.div>
            )}
            {mode === IslandMode.POPUP && (
              <motion.div key="popup" className="absolute inset-0 w-full h-full">
                <PopupContent />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
};

export default DynamicIsland;
