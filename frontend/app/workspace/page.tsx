"use client";

import { useLocaleStore } from "@/lib/store/locale";
import { useTranslations } from "@/lib/i18n";
import { SimpleEditor } from "@/components/editor/markdownEditor/tiptap-templates/simple/simple-editor";
import { ChatBot } from "@/components/editor/chatBot/ChatBot";

export default function WorkspacePage() {
  const { locale } = useLocaleStore();
  const t = useTranslations(locale);

  return (
    <div className="flex max-h-screen flex-col gap-6 bg-muted/20 p-6">

      <div className="flex flex-1 flex-col gap-6 xl:flex-row xl:gap-4">
        <section className="flex flex-1 flex-col rounded-3xl border border-border/60 bg-background/80 p-6 shadow-sm">
          <div className="flex flex-1 flex-col rounded-2xl border border-dashed border-border/50 bg-card/90 p-4">
            <div className="mx-auto flex w-full max-h-[80vh] max-w-5xl flex-1">
              <SimpleEditor />
            </div>
          </div>
        </section>

        <aside className="w-full">
          <ChatBot copy={t.workspace.chatPanel} />
        </aside>
      </div>
    </div>
  );
}
