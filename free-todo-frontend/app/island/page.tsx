"use client";

import { useEffect, useState } from "react";
import DynamicIsland from "@/components/island/DynamicIsland";
import { IslandMode } from "@/lib/island/types";

/**
 * Island 页面组件
 * 作为 Dynamic Island 窗口的入口点
 */
export default function IslandPage() {
  const [mode, setMode] = useState<IslandMode>(IslandMode.FLOAT);

  // 键盘快捷键监听
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "1":
          setMode(IslandMode.FLOAT);
          break;
        case "2":
          setMode(IslandMode.POPUP);
          break;
        case "3":
          setMode(IslandMode.SIDEBAR);
          break;
        case "4":
          setMode(IslandMode.FULLSCREEN);
          break;
        case "Escape":
          // 逐级退出：全屏 -> 侧边栏 -> 悬浮
          if (mode === IslandMode.FULLSCREEN) {
            setMode(IslandMode.SIDEBAR);
          } else if (mode === IslandMode.SIDEBAR || mode === IslandMode.POPUP) {
            setMode(IslandMode.FLOAT);
          }
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mode]);

  // 监听来自主窗口的模式切换消息
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "island:set-mode" && event.data?.mode) {
        const newMode = event.data.mode as IslandMode;
        if (Object.values(IslandMode).includes(newMode)) {
          setMode(newMode);
        }
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  return (
    <div className="island-container">
      <DynamicIsland mode={mode} onClose={() => setMode(IslandMode.FLOAT)} />
    </div>
  );
}
