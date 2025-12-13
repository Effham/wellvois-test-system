import { Button } from '@/components/ui/button';
import { Link } from '@inertiajs/react';
import { BreadcrumbItem } from '@/types';

interface PageHeaderProps {
  title: string;
  breadcrumbs?: BreadcrumbItem[];
  createRoute?: string;
  createLabel?: string;
  onCreateClick?: () => void;
  description?:string;
  actions?:any
}

export default function PageHeader({ title, breadcrumbs, createRoute, createLabel = 'New', onCreateClick }: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <h1 className="text-2xl font-bold">{title}</h1>
      {(createRoute || onCreateClick) && (
        <Button asChild={!!createRoute} onClick={onCreateClick}>
          {createRoute ? (
            <Link href={createRoute}>{createLabel}</Link>
          ) : (
            <span>{createLabel}</span>
          )}
        </Button>
      )}
    </div>
  );
}