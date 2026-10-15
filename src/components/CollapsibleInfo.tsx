import { useId, useState, type ReactNode } from 'react';
import { ChevronDown, Info, type LucideIcon } from 'lucide-react';

interface Props {
  context: string;
  children: ReactNode;
  icon?: LucideIcon;
  tone?: 'plasma' | 'emerald';
  className?: string;
}

export default function CollapsibleInfo({ context, children, icon: Icon = Info, tone = 'plasma', className = '' }: Props) {
  const [expanded, setExpanded] = useState(true);
  const contentId = `info-${useId()}`;
  const emerald = tone === 'emerald';

  return (
    <div
      className={`info-panel rounded-2xl border text-xs ${emerald ? 'bg-emerald-500/5 border-emerald-500/15' : 'bg-plasma/5 border-plasma/15'} ${className}`}
      data-expanded={expanded}
    >
      <button
        type="button"
        className={`info-panel-toggle flex w-full items-center gap-2.5 px-3.5 py-3 text-left rounded-2xl ${emerald ? 'text-emerald-300' : 'text-plasma-ink'}`}
        aria-label={`Información: ${context}`}
        aria-expanded={expanded}
        aria-controls={contentId}
        onClick={() => setExpanded(value => !value)}
      >
        <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
        <span className="flex-1 font-sans font-medium">Información</span>
        <ChevronDown className="info-panel-chevron w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      </button>
      <div id={contentId} className="info-panel-body" aria-hidden={!expanded} inert={!expanded}>
        <div className="info-panel-clip">
          <div className="px-3.5 pb-3.5 text-zinc-300 font-sans leading-relaxed">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
