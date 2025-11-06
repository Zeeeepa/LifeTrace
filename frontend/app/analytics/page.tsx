'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/common/Card';
import { FormField } from '@/components/common/Input';
import Button from '@/components/common/Button';
import Loading from '@/components/common/Loading';

interface AnalyticsData {
  daily_stats?: Array<{
    date: string;
    total_screenshots: number;
    active_time: number;
  }>;
  top_apps?: Array<{
    app_name: string;
    count: number;
  }>;
  productivity_score?: number;
}

export default function AnalyticsPage() {
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData>({});
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;

      const response = await api.getAnalytics(params);
      setAnalyticsData(response.data);
    } catch (error) {
      console.error('加载分析数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadAnalytics();
  };

  useEffect(() => {
    // 设置默认日期（最近7天）
    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(today.getDate() - 7);

    setEndDate(today.toISOString().split('T')[0]);
    setStartDate(weekAgo.toISOString().split('T')[0]);

    loadAnalytics();
  }, []);

  return (
    <div className="p-6">
      <h1 className="mb-6 text-3xl font-bold text-foreground">行为分析</h1>

      {/* 搜索表单 */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <form onSubmit={handleSearch} className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <FormField
              label="开始日期"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <FormField
              label="结束日期"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
            <div className="flex items-end">
              <Button type="submit" className="w-full">
                查询
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {loading ? (
        <Loading text="加载中..." />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* 生产力评分 */}
          {analyticsData.productivity_score !== undefined && (
            <Card>
              <CardHeader>
                <CardTitle>生产力评分</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center">
                  <div className="text-6xl font-bold text-primary">
                    {analyticsData.productivity_score.toFixed(0)}
                  </div>
                  <div className="mt-2 font-medium text-muted-foreground">/ 100</div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 热门应用 */}
          {analyticsData.top_apps && analyticsData.top_apps.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>热门应用</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {analyticsData.top_apps.slice(0, 10).map((app, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <span className="font-semibold text-foreground">{app.app_name}</span>
                      <span className="font-medium text-muted-foreground">{app.count} 次</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* 每日统计 */}
          {analyticsData.daily_stats && analyticsData.daily_stats.length > 0 && (
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>每日统计</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {analyticsData.daily_stats.map((day, index) => (
                    <div
                      key={index}
                      className="grid grid-cols-3 gap-4 rounded-lg border border-border p-3"
                    >
                      <div className="font-semibold text-foreground">{day.date}</div>
                      <div className="font-medium text-muted-foreground">
                        截图: {day.total_screenshots}
                      </div>
                      <div className="font-medium text-muted-foreground">
                        活跃: {Math.round(day.active_time / 60)} 小时
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
