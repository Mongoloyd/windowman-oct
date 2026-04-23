import React from 'react';
import {
  AlertCircle,
  User,
  Briefcase,
  DollarSign,
  ArrowDown,
  GitBranch,
  TrendingUp,
  ShieldCheck
} from 'lucide-react';

const ArbCard = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`bg-slate-900/80 backdrop-blur-md rounded-xl transition-all duration-300 hover:-translate-y-1 ${className}`}>
    {children}
  </div>
);

const variants: Record<string, string> = {
  default: 'bg-slate-800 text-slate-200',
  warning: 'bg-orange-500/20 text-orange-400 border border-orange-500/30',
  success: 'bg-green-500/20 text-green-400 border border-green-500/30',
  info: 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30',
  purple: 'bg-purple-500/20 text-purple-400 border border-purple-500/30',
  gold: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
};

const ArbBadge = ({ children, variant = 'default', className = '' }: { children: React.ReactNode; variant?: string; className?: string }) => (
  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] sm:text-xs font-bold tracking-wider ${variants[variant] || variants.default} ${className}`}>
    {children}
  </span>
);

const Connector = ({ icon: Icon }: { icon: React.ElementType }) => (
  <div className="flex flex-col items-center justify-center my-2">
    <div className="w-px h-8 bg-gradient-to-b from-slate-300/50 to-slate-300/10" />
    <div className="bg-slate-800 border border-slate-700 p-2 rounded-full text-slate-300 z-10 shadow-lg">
      <Icon size={18} />
    </div>
    <div className="w-px h-8 bg-gradient-to-b from-slate-300/10 to-slate-300/50" />
  </div>
);

interface ArbitrageModelSectionProps {
  onOpenQualification?: () => void;
}

const ArbitrageModelSection = ({ onOpenQualification }: ArbitrageModelSectionProps) => {
  return (
    <section className="py-24 bg-black">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        <div className="relative w-full bg-slate-950 p-6 sm:p-12 rounded-3xl [background-image:linear-gradient(#0a192f_1px,transparent_1px),linear-gradient(90deg,#0a192f_1px,transparent_1px)] [background-size:20px_20px] shadow-2xl border border-slate-800/50">

          {/* Header */}
          <div className="text-center mb-12 sm:mb-16">
            <ArbBadge variant="info" className="mb-4">SYSTEM ARCHITECTURE</ArbBadge>
            <h2 className="text-white text-3xl sm:text-4xl font-extrabold tracking-tight">
              OUR <span className="text-cyan-400 drop-shadow-[0_0_15px_rgba(34,211,238,0.5)]">ARBITRAGE MODEL</span>
            </h2>
            <p className="text-slate-200 mt-4 max-w-lg mx-auto text-sm sm:text-base">
              Capturing the spread between high customer acquisition costs and wholesale fulfillment pricing.
            </p>
          </div>

          <div className="flex flex-col items-center relative z-10">

            {/* CONTRACTOR A */}
            <ArbCard className="w-full max-w-lg p-6 sm:p-8 border border-orange-500/50 [box-shadow:0_0_40px_rgba(249,115,22,0.15)] relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/10 rounded-full blur-3xl -mr-10 -mt-10" />
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-orange-500/20 rounded-lg text-orange-400">
                    <Briefcase size={24} />
                  </div>
                  <h3 className="text-white font-bold text-lg sm:text-xl">CONTRACTOR A</h3>
                </div>
                <ArbBadge variant="warning">
                  <AlertCircle size={14} /> SUNK COST
                </ArbBadge>
              </div>
              <p className="text-slate-200 mt-4 text-sm sm:text-base leading-relaxed">
                Incurs high Customer Acquisition Cost (CAC) spending on marketing, performs initial discovery, and delivers a premium retail proposal.
              </p>
            </ArbCard>

            <Connector icon={ArrowDown} />

            {/* HOMEOWNER */}
            <ArbCard className="w-full max-w-lg p-6 sm:p-8 border border-cyan-500/50 [box-shadow:0_0_40px_rgba(6,182,212,0.15)] relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 rounded-full blur-3xl -mr-10 -mt-10" />
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-cyan-500/20 rounded-lg text-cyan-400">
                    <User size={24} />
                  </div>
                  <h3 className="text-white font-bold text-lg sm:text-xl">HOMEOWNER</h3>
                </div>
                <ArbBadge variant="info">
                  <ShieldCheck size={14} /> PRICE SENSITIVE
                </ArbBadge>
              </div>
              <p className="text-slate-200 mt-4 text-sm sm:text-base leading-relaxed">
                Receives the high retail quote from Contractor A. Experiences sticker shock and seeks alternative solutions to fulfill the identical scope of work.
              </p>
            </ArbCard>

            <Connector icon={ArrowDown} />

            {/* WINDOWMAN */}
            <ArbCard className="w-full max-w-lg p-6 sm:p-8 border border-purple-500/50 [box-shadow:0_0_40px_rgba(168,85,247,0.15)] relative overflow-hidden z-20">
              <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl -mr-10 -mt-10" />
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-500/20 rounded-lg text-purple-400">
                    <GitBranch size={24} />
                  </div>
                  <h3 className="text-white font-bold text-lg sm:text-xl">WINDOWMAN</h3>
                </div>
                <ArbBadge variant="purple">
                  <TrendingUp size={14} /> THE ARBITRAGE
                </ArbBadge>
              </div>
              <p className="text-slate-200 mt-4 text-sm sm:text-base leading-relaxed">
                Intercepts the demand. Uses the existing diagnostic/scope from Contractor A to bypass discovery. Connects homeowner to wholesale fulfillment.
              </p>
            </ArbCard>

            {/* SPLIT BRANCHES */}
            <div className="w-full max-w-3xl flex flex-col md:flex-row gap-8 md:gap-12 mt-8 md:mt-12 relative pt-8">
              <div className="hidden md:block absolute top-0 left-1/2 w-1/2 h-10 border-t border-r border-slate-600 rounded-tr-3xl" />
              <div className="hidden md:block absolute top-0 right-1/2 w-1/2 h-10 border-t border-l border-slate-600 rounded-tl-3xl" />
              <div className="md:hidden absolute top-0 left-1/2 w-px h-8 bg-slate-600" />

              {/* CONTRACTOR B */}
              <div className="flex-1">
                <ArbCard className="h-full p-6 sm:p-8 border border-green-500/50 [box-shadow:0_0_40px_rgba(34,197,94,0.15)] relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-green-500/10 rounded-full blur-2xl -mr-8 -mt-8" />
                  <div className="flex flex-col gap-3 mb-4">
                    <div className="p-2 bg-green-500/20 rounded-lg text-green-400 w-fit">
                      <Briefcase size={20} />
                    </div>
                    <h3 className="text-white font-bold text-lg">CONTRACTOR B</h3>
                    <ArbBadge variant="success" className="w-fit">ZERO CAC</ArbBadge>
                  </div>
                  <p className="text-slate-200 text-sm leading-relaxed">
                    Secures immediate installation work without spending on marketing, sales, or scoping. Happy to work at wholesale rates.
                  </p>
                </ArbCard>
              </div>

              {/* REVENUE SPREAD */}
              <div className="flex-1">
                <ArbCard className="h-full p-6 sm:p-8 border border-yellow-500/50 [box-shadow:0_0_40px_rgba(234,179,8,0.15)] relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-yellow-500/10 rounded-full blur-2xl -mr-8 -mt-8" />
                  <div className="flex flex-col gap-3 mb-4">
                    <div className="p-2 bg-yellow-500/20 rounded-lg text-yellow-400 w-fit">
                      <DollarSign size={20} />
                    </div>
                    <h3 className="text-white font-bold text-lg">PROFIT MARGIN</h3>
                    <ArbBadge variant="gold" className="w-fit">ARBITRAGE SPREAD</ArbBadge>
                  </div>
                  <p className="text-slate-200 text-sm leading-relaxed">
                    Captures the margin difference between Contractor A's retail quote and Contractor B's wholesale fulfillment cost.
                  </p>
                </ArbCard>
              </div>
            </div>

          </div>

          {onOpenQualification && (
            <div className="mt-12 pt-8 border-t border-slate-700/50 flex justify-center">
              <button
                type="button"
                onClick={onOpenQualification}
                className="inline-flex items-center justify-center rounded-xl bg-white text-slate-950 font-semibold text-sm px-7 py-3.5 hover:bg-white/90 transition-colors"
              >
                Capture This Margin
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default ArbitrageModelSection;
