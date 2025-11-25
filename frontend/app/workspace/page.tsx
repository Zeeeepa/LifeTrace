"use client";

import { useState } from "react";
import { FileText, MessageSquare, Sparkles } from "lucide-react";
import { useLocaleStore } from "@/lib/store/locale";
import { useTranslations } from "@/lib/i18n";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/common/Card";
import Input from "@/components/common/Input";
import Button from "@/components/common/Button";
import { toast } from "sonner";

interface ChatMessage {
  id: string;
  role: "user" | "bot";
  text: string;
}

interface BotSuggestion {
  id: string;
  summary: string;
}

const createId = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2));

export default function WorkspacePage() {
  const { locale } = useLocaleStore();
  const t = useTranslations(locale);

  const [targetFile, setTargetFile] = useState("frontend/app/page.tsx");
  const [fileDraft, setFileDraft] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [suggestions, setSuggestions] = useState<BotSuggestion[]>([]);

  const isSendDisabled = chatInput.trim().length === 0;

  const handleLoadSnapshot = () => {
    const saved = localStorage.getItem("workspace-draft");
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as { targetFile?: string; fileDraft?: string };
        if (parsed.targetFile) {
          setTargetFile(parsed.targetFile);
        }
        if (parsed.fileDraft) {
          setFileDraft(parsed.fileDraft);
        }
        toast.success(t.workspace.controls.load);
        return;
      } catch (error) {
        console.error("Failed to parse workspace draft", error);
      }
    }

    if (!fileDraft.trim()) {
      setFileDraft(`// ${t.workspace.filePanel.placeholder}`);
    }
    toast.info(t.workspace.controls.load);
  };

  const handleSaveDraft = () => {
    localStorage.setItem("workspace-draft", JSON.stringify({ targetFile, fileDraft }));
    toast.success(t.workspace.controls.save);
  };

  const handleSendMessage = () => {
    if (isSendDisabled) {
      return;
    }

    const trimmed = chatInput.trim();
    const userMessage: ChatMessage = {
      id: createId(),
      role: "user",
      text: trimmed,
    };

    const botMessage: ChatMessage = {
      id: createId(),
      role: "bot",
      text: `${t.workspace.chatPanel.thinking} ${trimmed}`.trim(),
    };

    setChatMessages((prev) => [...prev, userMessage, botMessage]);
    setChatInput("");

    const suggestion: BotSuggestion = {
      id: createId(),
      summary: trimmed,
    };
    setSuggestions((prev) => [...prev, suggestion]);
  };

  const handleApplySuggestion = (suggestionId: string) => {
    const suggestion = suggestions.find((item) => item.id === suggestionId);
    if (!suggestion) {
      return;
    }

    setFileDraft((prev) => {
      const prefix = prev.trim().length > 0 ? `${prev}\n\n` : "";
      return `${prefix}// TODO: ${suggestion.summary}`;
    });
    setSuggestions((prev) => prev.filter((item) => item.id !== suggestionId));
    toast.success(t.workspace.actionsPanel.apply);
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="space-y-2">
        <div className="flex items-center gap-3 text-primary">
          <Sparkles className="h-5 w-5" />
          <span className="text-sm font-medium uppercase tracking-wide">{t.workspace.title}</span>
        </div>
        <h1 className="text-3xl font-bold text-foreground">{t.workspace.subtitle}</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">{t.workspace.notice}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 flex flex-col">
          <CardHeader>
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-primary" />
              <div>
                <CardTitle className="text-xl">{t.workspace.filePanel.title}</CardTitle>
                <CardDescription>{t.workspace.filePanel.description}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-muted-foreground" htmlFor="workspace-target-file">
                {t.workspace.filePanel.pathLabel}
              </label>
              <Input
                id="workspace-target-file"
                value={targetFile}
                onChange={(event) => setTargetFile(event.target.value)}
                placeholder="frontend/app/workspace/page.tsx"
              />
            </div>

            <div className="flex flex-wrap gap-3">
              <Button type="button" onClick={handleLoadSnapshot}>
                {t.workspace.controls.load}
              </Button>
              <Button type="button" variant="outline" onClick={handleSaveDraft}>
                {t.workspace.controls.save}
              </Button>
            </div>

            <textarea
              className="min-h-80 flex-1 rounded-lg border border-border bg-card/60 p-4 font-mono text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              value={fileDraft}
              onChange={(event) => setFileDraft(event.target.value)}
              placeholder={t.workspace.filePanel.placeholder}
            />
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6">
          <Card className="flex flex-1 flex-col">
            <CardHeader>
              <div className="flex items-center gap-3">
                <MessageSquare className="h-5 w-5 text-primary" />
                <div>
                  <CardTitle className="text-xl">{t.workspace.chatPanel.title}</CardTitle>
                  <CardDescription>{t.workspace.chatPanel.description}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col gap-4">
              <div className="flex-1 space-y-3 overflow-y-auto rounded-lg border border-dashed border-border/80 bg-muted/40 p-4 text-sm">
                {chatMessages.length === 0 ? (
                  <p className="text-muted-foreground">{t.workspace.chatPanel.empty}</p>
                ) : (
                  chatMessages.map((message) => (
                    <div key={message.id} className="space-y-1">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        {message.role === "user" ? "You" : "Bot"}
                      </p>
                      <p>{message.text}</p>
                    </div>
                  ))
                )}
              </div>
              <div className="flex gap-3">
                <Input
                  value={chatInput}
                  onChange={(event) => setChatInput(event.target.value)}
                  placeholder={t.workspace.chatPanel.inputPlaceholder}
                />
                <Button type="button" onClick={handleSendMessage} disabled={isSendDisabled}>
                  {t.workspace.chatPanel.send}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <Sparkles className="h-5 w-5 text-primary" />
                <div>
                  <CardTitle className="text-xl">{t.workspace.actionsPanel.title}</CardTitle>
                  <CardDescription>{t.workspace.actionsPanel.description}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {suggestions.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t.workspace.actionsPanel.empty}</p>
              ) : (
                suggestions.map((suggestion) => (
                  <div key={suggestion.id} className="rounded-lg border border-border bg-background/90 p-4">
                    <p className="text-sm text-foreground">{suggestion.summary}</p>
                    <div className="mt-3 flex justify-end">
                      <Button size="sm" onClick={() => handleApplySuggestion(suggestion.id)}>
                        {t.workspace.actionsPanel.apply}
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
