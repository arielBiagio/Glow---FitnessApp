import React from 'react';
import { Activity, Flame, Zap, Compass, Calendar } from 'lucide-react';

interface BottomNavProps {
  activeTab: string;
  onSelectTab: (tabId: string) => void;
}

export default function BottomNav({ activeTab, onSelectTab }: BottomNavProps) {
  const tabs = [
    { id: 'dia-a', label: 'Día A', sub: 'Glúteo', icon: Activity },
    { id: 'dia-b', label: 'Día B', sub: 'Empuje', icon: Flame },
    { id: 'dia-c', label: 'Día C', sub: 'Jalón', icon: Compass },
    { id: 'dia-d', label: 'Día D', sub: 'Full Body', icon: Zap },
    { id: 'semana', label: 'Semana', sub: 'Programa', icon: Calendar }
  ];

  const activeIndex = tabs.findIndex(tab => tab.id === activeTab);

  return (
    <div className="fixed bottom-5 left-3 right-3 z-30 max-w-[calc(448px-24px)] mx-auto">

      <div
        className="relative rounded-[2rem] overflow-hidden"
        style={{
          background: 'linear-gradient(180deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.03) 40%, rgba(0,0,0,0.15) 100%)',
          boxShadow: `
            0 24px 48px rgba(0,0,0,0.55),
            0 8px 16px rgba(0,0,0,0.35),
            inset 0 1px 0 rgba(255,255,255,0.22),
            inset 0 -1px 0 rgba(0,0,0,0.15)
          `
        }}
      >
        <div
          className="absolute inset-0 backdrop-blur-[28px] rounded-[2rem]"
          style={{
            WebkitBackdropFilter: 'blur(28px) saturate(180%)',
            backdropFilter: 'blur(28px) saturate(180%)',
            background: 'rgba(18, 18, 28, 0.45)'
          }}
        ></div>

        <div
          className="absolute top-0 left-[10%] right-[10%] h-[1px] rounded-full pointer-events-none"
          style={{
            background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.35) 30%, rgba(255,255,255,0.4) 50%, rgba(255,255,255,0.35) 70%, transparent 100%)'
          }}
        ></div>

        <div className="relative z-10 flex items-center justify-around py-2.5 px-1 select-none">

          <div
            className="absolute top-1.5 bottom-1.5 rounded-[1.5rem] pointer-events-none transition-all duration-500 ease-[cubic-bezier(0.175,0.885,0.32,1.15)]"
            style={{
              width: 'calc(20% - 6px)',
              left: `calc(${activeIndex * 20}% + 3px)`,
              background: 'linear-gradient(180deg, rgba(123,97,255,0.22) 0%, rgba(123,97,255,0.08) 100%)',
              border: '1px solid rgba(123,97,255,0.3)',
              boxShadow: `
                0 0 20px rgba(123,97,255,0.12),
                inset 0 1px 0 rgba(255,255,255,0.12),
                inset 0 -1px 0 rgba(0,0,0,0.08)
              `
            }}
          ></div>

          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => onSelectTab(tab.id)}
                className="flex flex-col items-center justify-center flex-1 py-0.5 z-10 transition-all duration-300 relative"
                style={{
                  transform: isActive ? 'scale(1.08)' : 'scale(1)',
                  filter: isActive ? 'drop-shadow(0 0 4px rgba(123,97,255,0.4))' : 'none'
                }}
                aria-label={`${tab.label} — ${tab.sub}${isActive ? ' (activo)' : ''}`}
              >
                <Icon
                  className="w-[22px] h-[22px] transition-colors duration-300"
                  style={{ color: isActive ? '#A78BFA' : '#52525B' }}
                  strokeWidth={isActive ? 2.2 : 1.8}
                />
                <span
                  className="text-[9px] font-sans font-semibold tracking-wide mt-1 transition-colors duration-300"
                  style={{ color: isActive ? '#C4B5FD' : '#71717A' }}
                >
                  {tab.label}
                </span>
                <span className="text-[6px] font-sans text-zinc-600 uppercase tracking-[0.12em] leading-none">
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
