import { useState } from 'react';
import { ChevronDown, AlertTriangle, Info, Lock } from 'lucide-react';
import { guideList } from '@/components/launch/guideContent';

// The guide starts closed: only the launch types stay on screen as compact
// boxes, and each one opens its own detail on a tap.
export default function ServiceGuide({ service, services = ['curve', 'auto_pool', 'locked'] }) {
  const [open, setOpen] = useState(false);
  const [peek, setPeek] = useState(null);
  const guides = guideList(services);

  const toggleBox = (id) => {
    if (!open) {
      setOpen(true);
      setPeek(id);
      return;
    }
    setPeek(peek === id ? null : id);
  };

  return (
    <div className="bg-[#141518] rounded-2xl overflow-hidden">
      <button onClick={() => setOpen((v) => !v)} className="w-full flex items-center justify-between px-4 py-3">
        <span className="flex items-center gap-2 text-sm font-bold">
          <Info size={16} className="text-[#00ff88]" />
          Launch guide
        </span>
        <ChevronDown size={18} className={`text-white/40 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      <div className="px-4 pb-4 space-y-2">
        {guides.map((g) => {
          const active = g.id === service;
          const expanded = open && peek === g.id;
          return (
            <div
              key={g.id}
              className={`rounded-xl overflow-hidden border transition-colors ${
                active ? 'border-[#00ff88]/25 bg-[#00ff88]/[.03]' : 'border-white/5 bg-black/20'
              }`}
            >
              <button onClick={() => toggleBox(g.id)} className="w-full flex items-start gap-2 px-3 py-2.5 text-left">
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 flex-wrap">
                    <span className={`text-xs font-bold ${active ? 'text-[#00ff88]' : 'text-white/70'}`}>
                      {g.label}
                    </span>
                    {g.id === 'locked' && <Lock size={9} className="text-white/25" />}
                    {active && (
                      <span className="text-[8px] font-black uppercase tracking-[.12em] text-black bg-[#00ff88] rounded px-1 py-0.5">
                        selected
                      </span>
                    )}
                  </span>
                  {!expanded && <span className="block text-[10px] text-white/35 leading-snug mt-0.5">{g.summary}</span>}
                </span>
                <ChevronDown
                  size={13}
                  className={`text-white/25 shrink-0 mt-0.5 transition-transform ${expanded ? 'rotate-180' : ''}`}
                />
              </button>

              {expanded && (
                <div className="px-3 pb-3 space-y-2.5">
                  {g.sections.map((s) => (
                    <div key={s.title}>
                      <p className="text-[11px] font-bold text-white/75 mb-1">{s.title}</p>
                      <ul className="space-y-1">
                        {s.items.map((it, i) => (
                          <li key={i} className="flex gap-1.5 text-[11px] leading-relaxed text-white/50">
                            <span className="text-[#00ff88] mt-px shrink-0">•</span>
                            <span className="min-w-0">{it}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                  <div className="flex items-start gap-2 bg-[#ff3b5c]/5 border border-[#ff3b5c]/20 rounded-lg p-2">
                    <AlertTriangle size={12} className="text-[#ff3b5c] mt-px shrink-0" />
                    <p className="text-[10px] leading-relaxed text-white/55">{g.warning}</p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}