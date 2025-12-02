'use client';

import { useState, useEffect } from 'react';
import { X, Sparkles, Wand2 } from 'lucide-react';
import Input from '@/components/common/Input';
import Button from '@/components/common/Button';
import { Project, ProjectCreate } from '@/lib/types';
import { api } from '@/lib/api';
import { toast } from '@/lib/toast';
import { useLocaleStore } from '@/lib/store/locale';
import { useTranslations } from '@/lib/i18n';

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  project?: Project; // 如果传入，则为编辑模式
}

export default function CreateProjectModal({
  isOpen,
  onClose,
  onSuccess,
  project,
}: CreateProjectModalProps) {
  const { locale } = useLocaleStore();
  const t = useTranslations(locale);
  const [formData, setFormData] = useState<ProjectCreate>({
    name: '',
    description: '',
    definition_of_done: '',
  });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<{ name?: string }>({});
  const [aiAction, setAiAction] = useState<string | null>(null); // 标记当前AI动作，避免并发

  const isEditMode = !!project;

  // 当模态框打开时，初始化表单数据
  useEffect(() => {
    if (isOpen) {
      if (project) {
        setFormData({
          name: project.name,
          description: project.description || '',
          definition_of_done: project.definition_of_done || '',
        });
      } else {
        setFormData({
          name: '',
          description: '',
          definition_of_done: '',
        });
      }
      setErrors({});
    }
  }, [isOpen, project]);

  const validateForm = (): boolean => {
    const newErrors: { name?: string } = {};

    if (!formData.name.trim()) {
      newErrors.name = t.project.nameRequired;
    } else if (formData.name.length > 200) {
      newErrors.name = t.project.nameTooLong;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const buildProjectContext = () => {
    return [
      formData.name ? `项目名称：${formData.name}` : null,
      formData.description ? `项目描述：${formData.description}` : null,
      formData.definition_of_done ? `最终交付物 / 完成标准：${formData.definition_of_done}` : null,
    ]
      .filter(Boolean)
      .join('\n');
  };

  const runAiForField = async (
    field: 'description' | 'definition_of_done',
    mode: 'generate' | 'polish',
    options?: { silent?: boolean }
  ) => {
    if (aiAction) {
      return;
    }
    const { silent } = options || {};

    const baseContext = buildProjectContext();
    const targetLabel =
      field === 'description' ? t.project.description : t.project.definitionOfDone;

    let instruction = '';
    if (mode === 'generate') {
      instruction =
        field === 'description'
          ? `请基于上述已填写的信息，帮我用简洁专业的中文生成一段「项目描述」，不超过120字，只输出项目描述本身。`
          : `请基于上述已填写的信息，帮我用简洁专业的中文描述这个项目的「最终交付物 / 完成标准」，不超过120字，只输出该字段本身。`;
    } else {
      const currentText =
        field === 'description' ? formData.description : formData.definition_of_done;
      if (!currentText || !currentText.trim()) {
        if (!silent) {
          toast.error(`${targetLabel} 为空，无法润色`);
        }
        return;
      }
      instruction =
        `上面是项目的基本信息。\n\n` +
        `请对当前的「${targetLabel}」文本进行润色，使其更清晰、条理更好、语气自然专业，保持原意，不要过度扩写，只输出润色后的该字段内容。`;
    }

    const message =
      (baseContext ? `${baseContext}\n\n` : '') +
      instruction;

    const actionKey = `${field}-${mode}`;
    setAiAction(actionKey);
    try {
      const res = await api.sendChatMessage({
        message,
      });
      const text = (res.data?.response as string | undefined)?.trim();
      if (!text) {
        if (!silent) {
          toast.error(t.common.unknownError);
        }
        return;
      }
      setFormData((prev) => ({
        ...prev,
        [field]: text,
      }));
      if (!silent) {
        toast.success(t.common.success);
      }
    } catch (error) {
      console.error('AI 生成失败:', error);
      if (!silent) {
        toast.error(t.common.error);
      }
    } finally {
      setAiAction(null);
    }
  };

  const handleAiFillAll = async () => {
    if (aiAction) return;

    const fieldsToFill: Array<'description' | 'definition_of_done'> = [];
    if (!formData.description?.trim()) {
      fieldsToFill.push('description');
    }
    if (!formData.definition_of_done?.trim()) {
      fieldsToFill.push('definition_of_done');
    }

    if (fieldsToFill.length === 0) {
      toast.error('没有需要补全的字段');
      return;
    }

    setAiAction('fill-all');
    try {
      for (const field of fieldsToFill) {
        // 使用 silent 避免多次 toast
        await runAiForField(field, 'generate', { silent: true });
      }
      toast.success(t.common.success);
    } finally {
      setAiAction(null);
    }
  };

  const handleAiPolishAll = async () => {
    if (aiAction) return;

    const fieldsToPolish: Array<'description' | 'definition_of_done'> = [];
    if (formData.description?.trim()) {
      fieldsToPolish.push('description');
    }
    if (formData.definition_of_done?.trim()) {
      fieldsToPolish.push('definition_of_done');
    }

    if (fieldsToPolish.length === 0) {
      toast.error('没有需要润色的字段');
      return;
    }

    setAiAction('polish-all');
    try {
      for (const field of fieldsToPolish) {
        await runAiForField(field, 'polish', { silent: true });
      }
      toast.success(t.common.success);
    } finally {
      setAiAction(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setSaving(true);
    try {
      if (isEditMode && project) {
        // 编辑模式
        await api.updateProject(project.id, {
          name: formData.name.trim(),
          description: formData.description?.trim() || undefined,
          definition_of_done: formData.definition_of_done?.trim() || undefined,
        });
        toast.success(t.project.updateSuccess);
      } else {
        // 创建模式
        await api.createProject({
          name: formData.name.trim(),
          description: formData.description?.trim() || undefined,
          definition_of_done: formData.definition_of_done?.trim() || undefined,
        });
        toast.success(t.project.createSuccess);
      }

      onSuccess?.();
      onClose();
    } catch (error) {
      console.error('保存项目失败:', error);
      const errorMsg = error instanceof Error ? error.message : t.common.unknownError;
      toast.error(isEditMode ? `${t.project.updateFailed}: ${errorMsg}` : `${t.project.createFailed}: ${errorMsg}`);
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field: keyof ProjectCreate, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // 清除该字段的错误
    if (field === 'name' && errors.name) {
      setErrors((prev) => ({ ...prev, name: undefined }));
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md rounded-lg bg-background shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="text-lg font-bold text-foreground">
            {isEditMode ? t.project.edit : t.project.create}
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-foreground transition-colors hover:bg-muted"
            aria-label={t.common.close}
            disabled={saving}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-foreground">
              {t.project.name} <span className="text-red-500">*</span>
            </label>
            <Input
              type="text"
              placeholder={t.project.namePlaceholder}
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              disabled={saving}
              className={errors.name ? 'border-destructive' : ''}
            />
            {errors.name && (
              <p className="mt-1 text-sm text-destructive">{errors.name}</p>
            )}
          </div>

          {/* 项目描述 */}
          <div>
            <label className="mb-2 flex items-center justify-between text-sm font-medium text-foreground">
              <span>
                {t.project.description}{' '}
                <span className="text-muted-foreground text-xs">({t.common.optional})</span>
              </span>
              <span className="flex items-center gap-1">
                <button
                  type="button"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  title="AI 生成项目描述"
                  onClick={() => runAiForField('description', 'generate')}
                  disabled={saving || !!aiAction}
                >
                  <Sparkles className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  title="AI 润色项目描述"
                  onClick={() => runAiForField('description', 'polish')}
                  disabled={saving || !!aiAction}
                >
                  <Wand2 className="h-3 w-3" />
                </button>
              </span>
            </label>
            <textarea
              placeholder={t.project.descriptionPlaceholder}
              value={formData.description || ''}
              onChange={(e) => handleChange('description', e.target.value)}
              disabled={saving}
              rows={3}
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none"
            />
          </div>

          {/* 最终交付物 / 完成标准 */}
          <div>
            <label className="mb-2 flex items-center justify-between text-sm font-medium text-foreground">
              <span>
                {t.project.definitionOfDone}{' '}
                <span className="text-muted-foreground text-xs">({t.common.optional})</span>
              </span>
              <span className="flex items-center gap-1">
                <button
                  type="button"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  title="AI 生成最终交付物 / 完成标准"
                  onClick={() => runAiForField('definition_of_done', 'generate')}
                  disabled={saving || !!aiAction}
                >
                  <Sparkles className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  title="AI 润色最终交付物 / 完成标准"
                  onClick={() => runAiForField('definition_of_done', 'polish')}
                  disabled={saving || !!aiAction}
                >
                  <Wand2 className="h-3 w-3" />
                </button>
              </span>
            </label>
            <textarea
              placeholder={t.project.definitionOfDonePlaceholder}
              value={formData.definition_of_done || ''}
              onChange={(e) => handleChange('definition_of_done', e.target.value)}
              disabled={saving}
              rows={3}
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none"
            />
          </div>

          {/* 操作按钮 */}
          <div className="flex items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                title="AI 一键补全空白字段（项目名称除外）"
                onClick={handleAiFillAll}
                disabled={saving || !!aiAction}
              >
                <Sparkles className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                title="AI 一键润色所有字段（项目名称除外）"
                onClick={handleAiPolishAll}
                disabled={saving || !!aiAction}
              >
                <Wand2 className="h-4 w-4" />
              </button>
            </div>
            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={saving || !!aiAction}
              >
                {t.common.cancel}
              </Button>
              <Button type="submit" disabled={saving || !!aiAction}>
                {saving ? t.common.saving : isEditMode ? t.common.save : t.common.create}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
