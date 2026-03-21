export function ProductPreview() {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="rounded-2xl shadow-glow overflow-hidden gradient-border">
        {/* Window chrome */}
        <div className="flex items-center gap-2 px-4 py-3 bg-[#0f172a]">
          <span className="w-3 h-3 rounded-full bg-[#ef4444]" />
          <span className="w-3 h-3 rounded-full bg-[#f59e0b]" />
          <span className="w-3 h-3 rounded-full bg-[#10b981]" />
          <span className="ml-3 text-xs text-white/60 font-mono select-none">
            Flint Glass
          </span>
        </div>

        {/* Content area */}
        <div className="flex bg-[#0f172a] min-h-[320px]">
          {/* Left panel -- Layers */}
          <div className="w-40 border-r border-white/[0.06] p-4 flex flex-col gap-3 shrink-0">
            <span className="text-[10px] font-semibold text-white/40 uppercase tracking-wider">
              Layers
            </span>
            <div className="flex flex-col gap-2 mt-1">
              <div className="h-3 w-full rounded-sm bg-indigo-500/30" />
              <div className="h-3 w-3/4 rounded-sm bg-purple-500/25" />
              <div className="h-3 w-5/6 rounded-sm bg-slate-500/20" />
              <div className="h-3 w-2/3 rounded-sm bg-indigo-400/20" />
              <div className="h-3 w-4/5 rounded-sm bg-slate-600/25" />
            </div>
            <div className="mt-auto flex flex-col gap-1.5">
              <div className="h-2 w-full rounded-sm bg-white/[0.04]" />
              <div className="h-2 w-2/3 rounded-sm bg-white/[0.04]" />
            </div>
          </div>

          {/* Center panel -- Canvas */}
          <div className="flex-1 p-5 flex flex-col gap-3 min-w-0">
            {/* Mock canvas area */}
            <div className="flex-1 rounded-lg border border-white/[0.06] bg-[#111827] p-4 flex flex-col gap-3 relative">
              {/* Mock component card */}
              <div className="w-48 rounded-lg border border-white/[0.08] bg-[#1e293b] p-3 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-white/70">
                    Button
                  </span>
                  <span className="w-5 h-5 rounded-full bg-red-500/80 text-[10px] font-bold text-white flex items-center justify-center leading-none">
                    3
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded bg-blue-500" />
                  <div className="h-2.5 flex-1 rounded-sm bg-white/10" />
                </div>
                <div className="h-2 w-3/4 rounded-sm bg-white/[0.06]" />
              </div>

              {/* Violation annotations */}
              <div className="flex flex-col gap-1.5 mt-auto">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-orange-400/80">
                    MITH-001
                  </span>
                  <span className="text-[10px] text-white/40">color-drift</span>
                  <span className="text-[10px] font-mono text-white/20 ml-auto">
                    {'\u0394'}E 5.2
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-orange-400/80">
                    A11Y-002
                  </span>
                  <span className="text-[10px] text-white/40">missing aria-label</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-orange-400/80">
                    MITH-003
                  </span>
                  <span className="text-[10px] text-white/40">hardcoded hex</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right panel -- Health */}
          <div className="w-44 border-l border-white/[0.06] p-4 flex flex-col gap-4 shrink-0">
            <span className="text-[10px] font-semibold text-white/40 uppercase tracking-wider">
              Health
            </span>

            {/* Grade */}
            <div className="flex flex-col items-center py-3">
              <span className="text-4xl font-semibold text-indigo-400 leading-none">
                B+
              </span>
              <span className="text-[10px] text-white/40 mt-1.5">Grade</span>
            </div>

            {/* Bar chart */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-white/40 w-10 shrink-0">
                  Token
                </span>
                <div className="flex-1 h-2 rounded-full bg-white/[0.06] overflow-hidden">
                  <div className="h-full w-4/5 rounded-full bg-indigo-500/70" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-white/40 w-10 shrink-0">
                  A11y
                </span>
                <div className="flex-1 h-2 rounded-full bg-white/[0.06] overflow-hidden">
                  <div className="h-full w-[90%] rounded-full bg-emerald-500/70" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-white/40 w-10 shrink-0">
                  Brand
                </span>
                <div className="flex-1 h-2 rounded-full bg-white/[0.06] overflow-hidden">
                  <div className="h-full w-3/5 rounded-full bg-orange-500/70" />
                </div>
              </div>
            </div>

            {/* Score */}
            <div className="mt-auto text-center">
              <span className="text-xs text-white/50 font-mono">Score: 72</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
