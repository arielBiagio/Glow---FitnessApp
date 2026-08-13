import React from 'react';
import { Activity, Calendar, Compass, Flame, Zap } from 'lucide-react';
import type { WorkoutDay } from '../types';

interface BottomNavProps {
  days: WorkoutDay[];
  activeTab: string;
  onSelectTab: (tabId: string) => void;
}

const icons = [Activity, Flame, Compass, Zap];

export default function BottomNav({ days, activeTab, onSelectTab }: BottomNavProps) {
  const tabs = [
    ...days.map((day, index) => ({
      id: day.id,
      label: day.name,
      sub: day.tag || day.subtitle,
      icon: icons[index % icons.length],
    })),
    { id: 'semana', label: 'Semana', sub: 'Programa', icon: Calendar },
  ];
  const activeIndex = Math.max(0, tabs.findIndex((tab) => tab.id === activeTab));
  const tabWidth = 100 / tabs.length;

  return (
    <div className="absolute bottom-[calc(env(safe-area-inset-bottom,0px)+12px)] left-3 right-3 z-30 max-w-[calc(448px-24px)] mx-auto">
      <div
        className="relative rounded-[2.25rem] overflow-hidden"
        style={{
          background: 'linear-gradient(180deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.03) 40%, rgba(0,0,0,0.2) 100%)',
          boxShadow: '0 24px 48px rgba(0,0,0,0.65), 0 8px 16px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.25), inset 0 -1px 0 rgba(0,0,0,0.2)',
        }}
      >
        <div
          className="absolute inset-0 backdrop-blur-[28px] rounded-[2.25rem]"
          style={{ WebkitBackdropFilter: 'blur(28px) saturate(180%)', backdropFilter: 'blur(28px) saturate(180%)', background: 'rgba(14, 14, 24, 0.65)' }}
        />
        <div className="absolute top-0 left-[10%] right-[10%] h-px rounded-full pointer-events-none bg-gradient-to-r from-transparent via-white/40 to-transparent" />

        <div className="relative z-10 flex items-center justify-around py-3 px-1 select-none">
          <div
            className="absolute top-1.5 bottom-1.5 rounded-[1.6rem] pointer-events-none transition-all duration-500 ease-[cubic-bezier(0.175,0.885,0.32,1.15)]"
            style={{
              width: `calc(${tabWidth}% - 6px)`,
              left: `calc(${activeIndex * tabWidth}% + 3px)`,
              background: 'linear-gradient(180deg, rgba(123,97,255,0.28) 0%, rgba(123,97,255,0.1) 100%)',
              border: '1px solid rgba(123,97,255,0.35)',
              boxShadow: '0 0 20px rgba(123,97,255,0.18), inset 0 1px 0 rgba(255,255,255,0.15), inset 0 -1px 0 rgba(0,0,0,0.1)',
            }}
          />

          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => onSelectTab(tab.id)}
                className="flex flex-col items-center justify-center flex-1 py-0.5 z-10 transition-all duration-300 relative min-w-0"
                style={{ transform: isActive ? 'scale(1.06)' : 'scale(1)', filter: isActive ? 'drop-shadow(0 0 4px rgba(123,97,255,0.4))' : 'none' }}
                aria-label={`${tab.label} — ${tab.sub}${isActive ? ' (activo)' : ''}`}
              >
                <Icon className="w-5 h-5 transition-colors duration-300" style={{ color: isActive ? '#A78BFA' : '#646470' }} strokeWidth={isActive ? 2.2 : 1.8} />
                <span className="max-w-full truncate text-[9px] font-sans font-semibold tracking-wide mt-1 transition-colors duration-300" style={{ color: isActive ? '#C4B5FD' : '#858594' }}>
                  {tab.label}
                </span>
                <span className="max-w-full truncate text-[6.5px] font-sans text-zinc-500 uppercase tracking-[0.12em] leading-none mt-0.5">
                  {tab.sub}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
