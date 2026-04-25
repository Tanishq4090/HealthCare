import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { ArrowUpRight } from 'lucide-react';
import { cn } from '../lib/utils';

type SurfaceProps = ComponentPropsWithoutRef<'section'> & {
    padded?: boolean;
};

export function AdminPage({ className, ...props }: ComponentPropsWithoutRef<'div'>) {
    return <div className={cn('animate-slide-in space-y-6 p-4 sm:p-6 lg:p-8', className)} {...props} />;
}

export function Surface({ className, padded = true, children, ...props }: SurfaceProps) {
    return (
        <section className={cn('clinical-surface', padded && 'p-5 sm:p-6', className)} {...props}>
            <div className="clinical-content">{children}</div>
        </section>
    );
}

export function SectionHeader({
    title,
    description,
    eyebrow,
    action,
    className,
}: {
    title: string;
    description?: string;
    eyebrow?: string;
    action?: ReactNode;
    className?: string;
}) {
    return (
        <div className={cn('flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between', className)}>
            <div>
                {eyebrow && <p className="text-xs font-bold uppercase text-cyan-700">{eyebrow}</p>}
                <h2 className="text-lg font-bold text-slate-950">{title}</h2>
                {description && <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>}
            </div>
            {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
        </div>
    );
}

const iconTone = {
    cyan: 'bg-cyan-50 text-cyan-700 ring-cyan-100',
    emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
    amber: 'bg-amber-50 text-amber-700 ring-amber-100',
    rose: 'bg-rose-50 text-rose-700 ring-rose-100',
    blue: 'bg-blue-50 text-blue-700 ring-blue-100',
    slate: 'bg-slate-50 text-slate-600 ring-slate-100',
};

export function IconFrame({
    icon: Icon,
    tone = 'cyan',
    className,
}: {
    icon: LucideIcon;
    tone?: keyof typeof iconTone;
    className?: string;
}) {
    return (
        <div className={cn('medical-mark flex h-11 w-11 items-center justify-center rounded-lg ring-1', iconTone[tone], className)}>
            <Icon className="relative z-10 h-5 w-5" />
        </div>
    );
}

export function TrendPill({
    value,
    label = 'vs last month',
    positive = true,
}: {
    value: string;
    label?: string;
    positive?: boolean;
}) {
    return (
        <div className="flex flex-wrap items-center gap-2">
            <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold', positive ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700')}>
                <ArrowUpRight className={cn('h-3 w-3', !positive && 'rotate-90')} />
                {value}
            </span>
            <span className="text-xs font-medium text-slate-400">{label}</span>
        </div>
    );
}

export function StatusBadge({ children, className }: { children: ReactNode; className?: string }) {
    return <span className={cn('status-pill', className)}>{children}</span>;
}
