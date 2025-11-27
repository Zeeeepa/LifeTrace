'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Check, Copy, ExternalLink } from 'lucide-react';

interface MarkdownPreviewProps {
  content: string;
  className?: string;
}

// 复制按钮组件
function CopyButton({ code }: { code: string }) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="p-1.5 rounded-md hover:bg-white/10 transition-colors"
      title="复制代码"
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-green-400" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
    </button>
  );
}

export default function MarkdownPreview({ content, className = '' }: MarkdownPreviewProps) {
  return (
    <div className={`markdown-preview ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
        // 标题样式
        h1: ({ children }) => (
          <h1 className="text-3xl font-bold mt-8 mb-4 pb-2 border-b border-border text-foreground first:mt-0">
            {children}
          </h1>
        ),
        h2: ({ children }) => (
          <h2 className="text-2xl font-semibold mt-6 mb-3 pb-2 border-b border-border/50 text-foreground">
            {children}
          </h2>
        ),
        h3: ({ children }) => (
          <h3 className="text-xl font-semibold mt-5 mb-2 text-foreground">
            {children}
          </h3>
        ),
        h4: ({ children }) => (
          <h4 className="text-lg font-semibold mt-4 mb-2 text-foreground">
            {children}
          </h4>
        ),
        h5: ({ children }) => (
          <h5 className="text-base font-semibold mt-3 mb-1 text-foreground">
            {children}
          </h5>
        ),
        h6: ({ children }) => (
          <h6 className="text-sm font-semibold mt-3 mb-1 text-muted-foreground">
            {children}
          </h6>
        ),

        // 段落
        p: ({ children }) => (
          <p className="my-3 leading-7 text-foreground">{children}</p>
        ),

        // 链接
        a: ({ href, children }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:text-primary/80 underline decoration-primary/30 hover:decoration-primary/60 underline-offset-2 transition-colors inline-flex items-center gap-0.5"
          >
            {children}
            <ExternalLink className="h-3 w-3 inline-block ml-0.5" />
          </a>
        ),

        // 强调
        strong: ({ children }) => (
          <strong className="font-semibold text-foreground">{children}</strong>
        ),
        em: ({ children }) => (
          <em className="italic text-foreground">{children}</em>
        ),
        del: ({ children }) => (
          <del className="line-through text-muted-foreground">{children}</del>
        ),

        // 引用块
        blockquote: ({ children }) => (
          <blockquote className="my-4 pl-4 border-l-4 border-primary/50 bg-muted/30 py-2 pr-4 rounded-r-md italic text-muted-foreground">
            {children}
          </blockquote>
        ),

        // 行内代码
        code: ({ className, children, ...props }) => {
          const match = /language-(\w+)/.exec(className || '');
          const isInline = !match && !className;

          if (isInline) {
            return (
              <code
                className="px-1.5 py-0.5 mx-0.5 rounded text-sm font-mono bg-muted text-primary border border-border/50"
                {...props}
              >
                {children}
              </code>
            );
          }

          return (
            <code className={className} {...props}>
              {children}
            </code>
          );
        },

        // 代码块
        pre: ({ children, node, ...props }) => {
          // 从 children 中获取代码元素
          const childArray = React.Children.toArray(children);
          const codeChild = childArray.find(
            (child) => React.isValidElement(child) && (child.type === 'code' || child.props?.node?.tagName === 'code')
          );

          // 获取语言和代码内容
          let language = '';
          let codeContent: React.ReactNode = children;

          if (React.isValidElement(codeChild)) {
            const codeProps = codeChild.props as { className?: string; children?: React.ReactNode };
            const className = codeProps.className || '';
            const match = /language-(\w+)/.exec(className);
            language = match ? match[1] : '';
            codeContent = codeProps.children;
          }

          // 提取纯文本用于复制功能
          const extractText = (node: React.ReactNode): string => {
            if (typeof node === 'string') return node;
            if (typeof node === 'number') return String(node);
            if (!node) return '';
            if (Array.isArray(node)) return node.map(extractText).join('');
            if (React.isValidElement(node)) {
              const nodeProps = node.props as { children?: React.ReactNode };
              return extractText(nodeProps.children);
            }
            return '';
          };
          const codeString = extractText(codeContent);

          return (
            <div className="my-4 rounded-lg overflow-hidden border border-border bg-[#0d1117] dark:bg-[#0d1117]">
              {/* 代码块头部 */}
              <div className="flex items-center justify-between px-4 py-2 bg-[#161b22] border-b border-[#30363d]">
                <span className="text-xs font-medium text-[#8b949e]">
                  {language || 'code'}
                </span>
                <CopyButton code={codeString} />
              </div>
              {/* 代码内容 */}
              <pre className="overflow-x-auto p-4 m-0 bg-transparent" {...props}>
                <code className="block text-sm font-mono text-[#e6edf3] leading-relaxed whitespace-pre">
                  {codeContent}
                </code>
              </pre>
            </div>
          );
        },

        // 列表
        ul: ({ children, className }) => {
          // 检查是否为任务列表
          const isTaskList = React.Children.toArray(children).some(
            (child) =>
              React.isValidElement(child) &&
              child.props?.className?.includes('task-list-item')
          );

          return (
            <ul
              className={`my-3 space-y-1.5 ${
                isTaskList ? 'list-none pl-0' : 'list-disc pl-6'
              } ${className || ''}`}
            >
              {children}
            </ul>
          );
        },
        ol: ({ children }) => (
          <ol className="my-3 list-decimal pl-6 space-y-1.5">{children}</ol>
        ),
        li: ({ children, className }) => {
          const isTaskItem = className?.includes('task-list-item');

          return (
            <li
              className={`leading-7 text-foreground ${
                isTaskItem ? 'flex items-start gap-2 list-none' : ''
              }`}
            >
              {children}
            </li>
          );
        },

        // 任务列表复选框
        input: ({ type, checked, disabled }) => {
          if (type === 'checkbox') {
            return (
              <span
                className={`inline-flex items-center justify-center w-4 h-4 mt-1.5 rounded border ${
                  checked
                    ? 'bg-primary border-primary text-primary-foreground'
                    : 'border-border bg-background'
                }`}
              >
                {checked && <Check className="h-3 w-3" />}
              </span>
            );
          }
          return <input type={type} checked={checked} disabled={disabled} />;
        },

        // 表格
        table: ({ children }) => (
          <div className="my-4 overflow-x-auto rounded-lg border border-border">
            <table className="w-full border-collapse text-sm">{children}</table>
          </div>
        ),
        thead: ({ children }) => (
          <thead className="bg-muted/50 border-b border-border">{children}</thead>
        ),
        tbody: ({ children }) => <tbody className="divide-y divide-border">{children}</tbody>,
        tr: ({ children }) => (
          <tr className="hover:bg-muted/30 transition-colors">{children}</tr>
        ),
        th: ({ children }) => (
          <th className="px-4 py-3 text-left font-semibold text-foreground whitespace-nowrap">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="px-4 py-3 text-foreground">{children}</td>
        ),

        // 分割线
        hr: () => (
          <hr className="my-6 border-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
        ),

        // 图片
        img: ({ src, alt }) => (
          <span className="block my-4">
            <img
              src={src}
              alt={alt || ''}
              className="max-w-full h-auto rounded-lg border border-border shadow-sm"
              loading="lazy"
            />
            {alt && (
              <span className="block text-center text-sm text-muted-foreground mt-2 italic">
                {alt}
              </span>
            )}
          </span>
        ),
      }}
    >
      {content}
      </ReactMarkdown>
    </div>
  );
}
