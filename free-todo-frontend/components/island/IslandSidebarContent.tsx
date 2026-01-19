"use client";

/**
 * Island 侧边栏内容组件
 * 在 SIDEBAR 模式下显示 FreeTodo 的待办列表
 */

import { MoreHorizontal, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { TodoList } from "@/apps/todo-list";
import { GlobalDndProvider } from "@/lib/dnd";

export function IslandSidebarContent() {
  const t = useTranslations("page");

  return (
    <div className="w-full h-full flex flex-col overflow-hidden island-sidebar-theme">
      {/* Header */}
      <div className="flex items-center justify-between px-6 pt-6 pb-4 shrink-0">
        <div className="flex flex-col">
          <h2 className="text-2xl font-light text-white tracking-tight">
            {t("todosLabel")}
          </h2>
          <span className="text-xs text-white/40 uppercase tracking-widest font-medium mt-0.5">
            FreeTodo
          </span>
        </div>
        <div className="w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-colors cursor-pointer">
          <MoreHorizontal size={18} className="text-white/60" />
        </div>
      </div>

      {/* Todo List Content */}
      <div className="flex-1 min-h-0 overflow-hidden px-2">
        <GlobalDndProvider>
          <div className="h-full overflow-y-auto scrollbar-hide">
            <TodoList />
          </div>
        </GlobalDndProvider>
      </div>

      {/* Bottom Search/Input */}
      <div className="px-4 py-4 shrink-0">
        <div className="w-full h-12 bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 flex items-center px-2 gap-2 hover:border-white/20 transition-colors">
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-white/40">
            <Search size={16} />
          </div>
          <input
            type="text"
            placeholder="搜索待办..."
            className="flex-1 bg-transparent border-none outline-none text-white text-sm placeholder:text-white/30"
          />
        </div>
      </div>
    </div>
  );
}
