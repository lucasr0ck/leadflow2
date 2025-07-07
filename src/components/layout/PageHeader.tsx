import { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}

export const PageHeader = ({ title, description, actions, className = "" }: PageHeaderProps) => {
  return (
    <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border ${className}`}>
      <div className="flex-1">
        <h1 className="text-2xl lg:text-3xl font-bold text-foreground">{title}</h1>
        {description && (
          <p className="text-sm lg:text-base text-muted-foreground mt-1">{description}</p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2">
          {actions}
        </div>
      )}
    </div>
  );
};