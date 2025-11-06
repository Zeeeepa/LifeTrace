'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/common/Card';
import Input from '@/components/common/Input';

export default function SettingsPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="mb-6 text-3xl font-bold text-foreground">设置</h1>

      <div className="space-y-6">
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
      </div>
    </div>
  );
}
