'use client';

import { useState, useEffect } from 'react';
import { Screenshot, Statistics, VectorStats } from '@/lib/types';
import { api } from '@/lib/api';
import SearchBar from '@/components/search/SearchBar';
import ScreenshotCard from '@/components/screenshot/ScreenshotCard';
import ScreenshotModal from '@/components/screenshot/ScreenshotModal';
import Pagination from '@/components/common/Pagination';
import Loading from '@/components/common/Loading';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/common/Card';
import Button from '@/components/common/Button';
import { RefreshCw } from 'lucide-react';

export default function Home() {
  const [screenshots, setScreenshots] = useState<Screenshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [vectorStats, setVectorStats] = useState<VectorStats | null>(null);
  const [selectedScreenshot, setSelectedScreenshot] = useState<Screenshot | null>(null);
  const [searchMode, setSearchMode] = useState(false);

  const pageSize = 50;

  // 加载统计信息
  const loadStatistics = async () => {
    try {
      const response = await api.getStatistics();
      setStatistics(response.data);
    } catch (error) {
      console.error('加载统计信息失败:', error);
    }
  };

  // 加载向量数据库状态
  const loadVectorStats = async () => {
    try {
      const response = await api.getVectorStats();
      setVectorStats(response.data);
    } catch (error) {
      console.error('加载向量数据库状态失败:', error);
    }
  };

  // 加载截图列表
  const loadScreenshots = async (page = 1) => {
    setLoading(true);
    try {
      const response = await api.getScreenshots({
        limit: pageSize,
        offset: (page - 1) * pageSize,
      });
      console.log('截图列表响应:', response.data?.length || 0, '条记录');
      setScreenshots(response.data || []);

      // 计算总页数
      if (statistics) {
        setTotalPages(Math.ceil(statistics.total_screenshots / pageSize));
      }
    } catch (error: any) {
      console.error('加载截图失败:', error);
      console.error('错误详情:', error?.response?.data || error?.message);
      // 确保即使出错也设置空数组，避免显示异常
      setScreenshots([]);
    } finally {
      setLoading(false);
    }
  };

  // 执行搜索
  const handleSearch = async (params: any) => {
    setLoading(true);
    setSearchMode(true);
    setCurrentPage(1);

    try {
      let response;

      if (params.searchType === 'event') {
        // 事件搜索
        response = await api.eventSearch({
          query: params.query,
          limit: 50,
        });
      } else if (params.searchType === 'semantic') {
        // 语义搜索
        response = await api.semanticSearch({
          query: params.query,
          top_k: 50,
          use_rerank: true,
        });
      } else if (params.searchType === 'multimodal') {
        // 多模态搜索
        response = await api.multimodalSearch({
          query: params.query,
          top_k: 50,
          text_weight: 0.6,
          image_weight: 0.4,
        });
      } else {
        // 传统搜索
        response = await api.search({
          query: params.query,
          start_date: params.startDate ? params.startDate + 'T00:00:00' : undefined,
          end_date: params.endDate ? params.endDate + 'T23:59:59' : undefined,
          app_name: params.appName,
        });
      }

      setScreenshots(response.data);
      setTotalPages(Math.ceil(response.data.length / pageSize));
    } catch (error) {
      console.error('搜索失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 同步向量数据库
  const handleSyncVector = async (forceReset = false) => {
    try {
      const response = await api.syncVectorDatabase(forceReset);
      alert(`同步成功！已同步 ${response.data.synced_count || 0} 条记录`);
      loadVectorStats();
    } catch (error) {
      console.error('同步失败:', error);
      alert('同步失败，请检查网络连接');
    }
  };

  useEffect(() => {
    loadStatistics();
    loadVectorStats();
    loadScreenshots();
  }, []);

  useEffect(() => {
    if (!searchMode) {
      loadScreenshots(currentPage);
    }
  }, [currentPage]);

  return (
    <div className="container mx-auto px-4 py-8">
      {/* 向量数据库状态 */}
      {vectorStats && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>向量数据库状态</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-foreground">状态:</span>
                <span
                  className={`rounded-full px-3 py-1 text-sm font-medium ${
                    vectorStats.enabled
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                  }`}
                >
                  {vectorStats.enabled ? '已启用' : '未启用'}
                </span>
              </div>
              {vectorStats.enabled && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground">文档数量:</span>
                    <span className="font-semibold text-foreground">{vectorStats.document_count || 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground">集合名称:</span>
                    <span className="font-semibold text-foreground">{vectorStats.collection_name || 'N/A'}</span>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSyncVector(false)}
                    >
                      <RefreshCw className="mr-2 h-4 w-4" />
                      智能同步
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSyncVector(true)}
                    >
                      强制重置
                    </Button>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 搜索栏 */}
      <SearchBar onSearch={handleSearch} />

      {/* 统计信息 */}
      {statistics && (
        <div className="my-6 grid grid-cols-2 gap-4 md:grid-cols-5">
          <Card>
            <CardContent className="pt-6 text-center">
              <div className="text-3xl font-bold text-primary">
                {statistics.total_screenshots}
              </div>
              <div className="mt-1 text-sm font-medium text-muted-foreground">总截图数</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <div className="text-3xl font-bold text-primary">
                {statistics.processed_screenshots}
              </div>
              <div className="mt-1 text-sm font-medium text-muted-foreground">已处理</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <div className="text-3xl font-bold text-primary">
                {statistics.pending_tasks}
              </div>
              <div className="mt-1 text-sm font-medium text-muted-foreground">待处理</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <div className="text-3xl font-bold text-primary">
                {statistics.today_screenshots}
              </div>
              <div className="mt-1 text-sm font-medium text-muted-foreground">今日截图</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <div className="text-3xl font-bold text-primary">
                {statistics.processing_rate.toFixed(1)}%
              </div>
              <div className="mt-1 text-sm font-medium text-muted-foreground">处理进度</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 截图列表 */}
      <Card>
        <CardHeader>
          <CardTitle>{searchMode ? '搜索结果' : '最新截图'}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Loading text="加载中..." />
          ) : screenshots.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground font-medium">
              没有找到截图
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {screenshots.map((screenshot) => (
                  <ScreenshotCard
                    key={screenshot.id}
                    screenshot={screenshot}
                    onClick={() => setSelectedScreenshot(screenshot)}
                  />
                ))}
              </div>

              {/* 分页 */}
              <div className="mt-6">
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={setCurrentPage}
                />
        </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* 截图详情模态框 */}
      {selectedScreenshot && (
        <ScreenshotModal
          screenshot={selectedScreenshot}
          onClose={() => setSelectedScreenshot(null)}
        />
      )}
    </div>
  );
}
