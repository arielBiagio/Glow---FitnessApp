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
    <div className="fixed bottom-[calc(env(safe-area-inset-bottom,0px)+12px)] left-3 right-3 z-30 max-w-[calc(448px-24px)] mx-auto">

      {/* Outer shell — Liquid Glass Capsule */}
      <div
        className="relative rounded-[2.25rem] overflow-hidden"
        style={{
          background: 'linear-gradient(180deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.03) 40%, rgba(0,0,0,0.2) 100%)',
          boxShadow: `
            0 24px 48px rgba(0,0,0,0.65),
            0 8px 16px rgba(0,0,0,0.4),
            inset 0 1px 0 rgba(255,255,255,0.25),
            inset 0 -1px 0 rgba(0,0,0,0.2)
          `
        }}
      >
        {/* Inner blur layer (Glass Refraction Effect) */}
        <div
          className="absolute inset-0 backdrop-blur-[28px] rounded-[2.25rem]"
          style={{
            WebkitBackdropFilter: 'blur(28px) saturate(180%)',
            backdropFilter: 'blur(28px) saturate(180%)',
            background: 'rgba(14, 14, 24, 0.65)'
          }}
        ></div>

        {/* Specular highlight line */}
        <div
          className="absolute top-0 left-[10%] right-[10%] h-[1px] rounded-full pointer-events-none"
          style={{
            background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.35) 30%, rgba(255,255,255,0.45) 50%, rgba(255,255,255,0.35) 70%, transparent 100%)'
          }}
        ></div>

        {/* Content layer */}
        <div className="relative z-10 flex items-center justify-around py-3 px-1 select-none">

          {/* Sliding Liquid Bubble Active Indicator */}
          <div
            className="absolute top-1.5 bottom-1.5 rounded-[1.6rem] pointer-events-none transition-all duration-500 ease-[cubic-bezier(0.175,0.885,0.32,1.15)]"
            style={{
              width: 'calc(20% - 6px)',
              left: `calc(${activeIndex * 20}% + 3px)`,
              background: 'linear-gradient(180deg, rgba(123,97,255,0.28) 0%, rgba(123,97,255,0.1) 100%)',
              border: '1px solid rgba(123,97,255,0.35)',
              boxShadow: `
                0 0 20px rgba(123,97,255,0.18),
                inset 0 1px 0 rgba(255,255,255,0.15),
                inset 0 -1px 0 rgba(0,0,0,0.1)
              `
            }}
          ></div>

          {/* Tab Buttons */}
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => onSelectTab(tab.id)}
                className="flex flex-col items-center justify-center flex-1 py-0.5 z-10 transition-all duration-300 relative"
                style={{
                  transform: isActive ? 'scale(1.06)' : 'scale(1)',
                  filter: isActive ? 'drop-shadow(0 0 4px rgba(123,97,255,0.4))' : 'none'
                }}
                aria-label={`${tab.label} — ${tab.sub}${isActive ? ' (activo)' : ''}`}
              >
                <Icon
                  className="w-[20px] h-[20px] transition-colors duration-300"
                  style={{ color: isActive ? '#A78BFA' : '#646470' }}
                  strokeWidth={isActive ? 2.2 : 1.8}
                />
                <span
                  className="text-[9px] font-sans font-semibold tracking-wide mt-1 transition-colors duration-300"
                  style={{ color: isActive ? '#C4B5FD' : '#858594' }}
                >
                  {tab.label}
                </span>
                <span className="text-[6.5px] font-sans text-zinc-500 uppercase tracking-[0.12em] leading-none mt-0.5">
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
