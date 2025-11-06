'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/common/Card';
import Input from '@/components/common/Input';
import Button from '@/components/common/Button';
import Loading from '@/components/common/Loading';
import { Plus, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';

interface TodoItem {
  id: string;
  content: string;
  completed: boolean;
}

interface Plan {
  plan_id: string;
  title: string;
  created_at: string;
}

export default function PlanPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [currentPlan, setCurrentPlan] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [todos, setTodos] = useState<TodoItem[]>([]);

  // 加载计划列表
  const loadPlans = async () => {
    try {
      const response = await api.listPlans();
      setPlans(response.data.plans || []);
    } catch (error) {
      console.error('加载计划列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 加载计划详情
  const loadPlan = async (planId: string) => {
    try {
      const response = await api.loadPlan(planId);
      const data = response.data;
      setCurrentPlan(data);
      setTitle(data.title || '');
      // 转换后端格式到前端格式
      const convertedTodos = (data.todos || []).map((todo: any) => ({
        id: todo.id || Date.now().toString(),
        content: todo.title || todo.content || '',
        completed: todo.checked || false,
      }));
      setTodos(convertedTodos);
    } catch (error) {
      console.error('加载计划失败:', error);
    }
  };

  // 保存计划
  const savePlan = async () => {
    try {
      // 转换前端格式到后端格式
      const convertedTodos = todos.map((todo) => ({
        id: todo.id,
        title: todo.content,
        checked: todo.completed,
        content: todo.content,
      }));

      await api.savePlan({
        title,
        todos: convertedTodos,
      });
      alert('保存成功！');
      loadPlans();
    } catch (error) {
      console.error('保存计划失败:', error);
      alert('保存失败，请重试');
    }
  };

  // 添加待办事项
  const addTodo = () => {
    setTodos([
      ...todos,
      {
        id: Date.now().toString(),
        content: '',
        completed: false,
      },
    ]);
  };

  // 删除待办事项
  const deleteTodo = (id: string) => {
    setTodos(todos.filter((todo) => todo.id !== id));
  };

  // 更新待办事项
  const updateTodo = (id: string, updates: Partial<TodoItem>) => {
    setTodos(
      todos.map((todo) => (todo.id === id ? { ...todo, ...updates } : todo))
    );
  };

  useEffect(() => {
    loadPlans();
  }, []);

  return (
    <div className="p-6">
      <div className="mx-auto max-w-4xl">
        <h1 className="mb-6 text-3xl font-bold text-foreground">工作计划</h1>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* 左侧：计划列表 */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle>计划列表</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Loading text="加载中..." />
                ) : (
                  <div className="space-y-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => {
                        setCurrentPlan(null);
                        setTitle('');
                        setTodos([]);
                      }}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      新建计划
                    </Button>
                    {plans.map((plan) => (
                      <button
                        key={plan.plan_id}
                        onClick={() => loadPlan(plan.plan_id)}
                        className="w-full rounded-lg border border-border bg-background p-3 text-left text-sm font-medium text-foreground transition-colors hover:bg-muted"
                      >
                        <div className="font-semibold">{plan.title}</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {plan.created_at}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* 右侧：计划编辑器 */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>计划编辑器</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* 标题 */}
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-foreground">
                      计划标题
                    </label>
                    <Input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="输入计划标题..."
                      className="px-4 py-2"
                    />
                  </div>

                  {/* 待办事项 */}
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <label className="text-sm font-semibold text-foreground">
                        待办事项
                      </label>
                      <Button variant="outline" size="sm" onClick={addTodo}>
                        <Plus className="mr-2 h-4 w-4" />
                        添加
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {todos.map((todo) => (
                        <div
                          key={todo.id}
                          className="flex items-center gap-2 rounded-lg border border-border bg-background p-3"
                        >
                          <input
                            type="checkbox"
                            checked={todo.completed}
                            onChange={(e) =>
                              updateTodo(todo.id, { completed: e.target.checked })
                            }
                            className="h-4 w-4 rounded border-input text-primary focus:ring-2 focus:ring-ring cursor-pointer"
                          />
                          <Input
                            type="text"
                            value={todo.content}
                            onChange={(e) =>
                              updateTodo(todo.id, { content: e.target.value })
                            }
                            placeholder="输入待办事项..."
                            className="flex-1 border-0 bg-transparent px-2 py-1 text-sm shadow-none focus-visible:ring-0"
                          />
                          <button
                            onClick={() => deleteTodo(todo.id)}
                            className="rounded-lg p-1 text-destructive transition-colors hover:bg-muted"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                      {todos.length === 0 && (
                        <div className="py-8 text-center text-sm text-muted-foreground">
                          暂无待办事项，点击"添加"按钮创建
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 保存按钮 */}
                  <div className="flex justify-end">
                    <Button onClick={savePlan}>保存计划</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
