import { Activity, ChartNoAxesCombined, Compass, Flame, Zap } from 'lucide-react';
import type { WorkoutDay } from '../types';

interface BottomNavProps {
  days: WorkoutDay[];
  activeTab: string;
  onSelectTab: (tabId: string) => void;
}

const icons = [Activity, Flame, Compass, Zap];

export default function BottomNav({ days, activeTab, onSelectTab }: BottomNavProps) {
  const tabs = [
    { id: 'resumen', label: 'Resumen', sub: 'Tu avance', icon: ChartNoAxesCombined },
    ...days.map((day, index) => ({
      id: day.id,
      label: day.name,
      sub: day.tag || day.subtitle,
      icon: icons[index % icons.length],
    })),
  ];
  const activeIndex = Math.max(0, tabs.findIndex((tab) => tab.id === activeTab));
  const tabWidth = 100 / tabs.length;

  return (
    <div className="absolute bottom-[calc(env(safe-area-inset-bottom,0px)+12px)] left-3 right-3 z-30 max-w-[calc(448px-24px)] mx-auto">
      <nav className="liquid-nav" aria-label="Navegación principal">
        <div className="relative z-10 flex items-center select-none">
          <div
            aria-hidden="true"
            className="liquid-nav-indicator"
            style={{
              width: `calc(${tabWidth}% - 4px)`,
              left: `calc(${activeIndex * tabWidth}% + 2px)`,
            }}
          />

          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onSelectTab(tab.id)}
                className="liquid-nav-tab flex flex-col items-center justify-center flex-1 gap-1.5 h-14 z-10 relative min-w-0 rounded-full"
                aria-label={`${tab.label} — ${tab.sub}${isActive ? ' (activo)' : ''}`}
                aria-current={isActive ? 'page' : undefined}
                data-active={isActive}
              >
                <Icon className="w-5 h-5" strokeWidth={isActive ? 2.2 : 1.8} aria-hidden="true" />
                <span className="max-w-full truncate px-1 text-[10px] font-sans font-semibold tracking-wide leading-tight">
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
