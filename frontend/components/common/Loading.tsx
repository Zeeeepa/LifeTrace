import { cn } from '@/lib/utils';

interface LoadingProps {
  className?: string;
  text?: string;
  size?: 'sm' | 'md' | 'lg';
}

export default function Loading({ className, text = '加载中...', size = 'md' }: LoadingProps) {
  const sizes = {
    sm: 'h-4 w-4 border-2',
    md: 'h-8 w-8 border-3',
    lg: 'h-12 w-12 border-4',
  };

  return (
    <div className={cn('flex flex-col items-center justify-center py-8', className)}>
      <div
        className={cn(
          'animate-spin rounded-full border-border border-t-primary',
          sizes[size]
        )}
      />
      {text && <p className="mt-4 font-medium text-muted-foreground">{text}</p>}
    </div>
  );
}
