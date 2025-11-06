'use client';

import { X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './Card';
import Input from './Input';
import Button from './Button';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg bg-background shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 flex items-center justify-between border-b bg-background px-6 py-4">
          <h2 className="text-xl font-bold text-foreground">设置</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-foreground transition-colors hover:bg-muted"
            aria-label="关闭"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* 基本设置 */}
          <Card>
            <CardHeader>
              <CardTitle>基本设置</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-foreground">
                    截图间隔（秒）
                  </label>
                  <Input
                    type="number"
                    className="px-4 py-2"
                    defaultValue={5}
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-foreground">
                    OCR 语言
                  </label>
                  <select className="w-full rounded-lg border border-input bg-background px-4 py-2 text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20">
                    <option value="zh-cn">中文</option>
                    <option value="en">英文</option>
                    <option value="mixed">中英混合</option>
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* AI 设置 */}
          <Card>
            <CardHeader>
              <CardTitle>AI 设置</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-foreground">
                    API Key
                  </label>
                  <Input
                    type="password"
                    className="px-4 py-2"
                    placeholder="输入您的 API Key"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-foreground">
                    模型选择
                  </label>
                  <select className="w-full rounded-lg border border-input bg-background px-4 py-2 text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20">
                    <option value="gpt-4">GPT-4</option>
                    <option value="gpt-3.5">GPT-3.5</option>
                    <option value="claude">Claude</option>
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 存储设置 */}
          <Card>
            <CardHeader>
              <CardTitle>存储设置</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-foreground">
                    自动清理天数
                  </label>
                  <Input
                    type="number"
                    className="px-4 py-2"
                    defaultValue={30}
                  />
                  <p className="mt-1 text-sm font-medium text-muted-foreground">
                    超过指定天数的截图将被自动删除
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 操作按钮 */}
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={onClose}>
              取消
            </Button>
            <Button onClick={onClose}>
              保存
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
