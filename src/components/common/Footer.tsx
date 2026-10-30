import React from 'react';
import { useMarket } from '../../context/MarketContext';
import { ShieldCheck, Cpu, Database, Award, ArrowUpRight } from 'lucide-react';

export const Footer: React.FC = () => {
  const { navigateTo, setAdminSubView, user } = useMarket();

  return (
    <footer className="bg-slate-950 border-t border-slate-800/80 text-slate-400 text-xs py-10 mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* System Health Indicators */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 rounded-xl bg-slate-900/60 border border-slate-800/60 mb-8 font-mono text-[11px]">
          <div className="flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <div>
              <span className="text-slate-200 font-semibold">LMSR Engine:</span>
              <span className="text-slate-400 ml-1">Deterministic Hanson C(q)</span>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <div>
              <span className="text-slate-200 font-semibold">Execution Desk:</span>
              <span className="text-slate-400 ml-1">Centralized Operator MM</span>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-full bg-blue-400" />
            <div>
              <span className="text-slate-200 font-semibold">Settlement:</span>
              <span className="text-slate-400 ml-1">Verified Real-World Oracles</span>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <div>
              <span className="text-slate-200 font-semibold">Environment:</span>
              <span className="text-amber-400 ml-1">Virtual Demo Credits</span>
            </div>
          </div>
        </div>

        {/* Footer Navigation Columns */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded bg-emerald-500 flex items-center justify-center text-slate-950 font-bold font-mono text-xs">
                C
              </div>
              <span className="font-extrabold text-sm text-white tracking-tight">
                CENTRA<span className="text-emerald-400">MARKETS</span>
              </span>
            </div>
            <p className="text-slate-400 text-xs leading-relaxed">
              A high-precision centralized prediction market platform. Users trade event risk contracts backed by algorithmic liquidity with centralized operator market making and verified oracle resolution.
            </p>
          </div>

          <div>
            <h4 className="text-slate-200 font-semibold text-xs uppercase tracking-wider mb-3">
              Market Types
            </h4>
            <ul className="space-y-2 text-xs">
              <li className="hover:text-slate-200 cursor-pointer" onClick={() => navigateTo('markets')}>
                Binary YES / NO Contracts
              </li>
              <li className="hover:text-slate-200 cursor-pointer" onClick={() => navigateTo('markets')}>
                Multi-Outcome Mutually Exclusive Events
              </li>
              <li className="hover:text-slate-200 cursor-pointer" onClick={() => navigateTo('markets')}>
                Range Bracket Contracts
              </li>
              <li className="hover:text-slate-200 cursor-pointer" onClick={() => navigateTo('markets')}>
                Weather & Everyday Real-world Markets
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-slate-200 font-semibold text-xs uppercase tracking-wider mb-3">
              Platform Architecture
            </h4>
            <ul className="space-y-2 text-xs">
              <li>Logarithmic Market Scoring Rule (LMSR)</li>
              <li>Dual-sided Spread & Commission Model</li>
              <li>Decoupled Deterministic Pricing Service</li>
              <li>Zero Blockchain / Zero Gas Slippage</li>
              <li>Ready for PostgreSQL & Auth Integration</li>
            </ul>
          </div>

          <div>
            {user?.role === 'admin' ? (
              <>
                <h4 className="text-amber-400 font-semibold text-xs uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Operator Access
                </h4>
                <div className="space-y-2 text-xs">
                  <button
                    onClick={() => {
                      navigateTo('admin');
                      setAdminSubView('overview');
                    }}
                    className="w-full text-left p-2 rounded bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-200 transition-colors flex items-center justify-between"
                  >
                    <span>Operator Dashboard</span>
                    <ArrowUpRight className="w-3.5 h-3.5 text-amber-400" />
                  </button>
                  <button
                    onClick={() => {
                      navigateTo('admin');
                      setAdminSubView('revenue');
                    }}
                    className="w-full text-left p-2 rounded bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-200 transition-colors flex items-center justify-between"
                  >
                    <span>Revenue Analytics</span>
                    <ArrowUpRight className="w-3.5 h-3.5 text-amber-400" />
                  </button>
                  <button
                    onClick={() => {
                      navigateTo('admin');
                      setAdminSubView('create');
                    }}
                    className="w-full text-left p-2 rounded bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-200 transition-colors flex items-center justify-between"
                  >
                    <span>Create New Market</span>
                    <ArrowUpRight className="w-3.5 h-3.5 text-amber-400" />
                  </button>
                </div>
              </>
            ) : (
              <>
                <h4 className="text-slate-200 font-semibold text-xs uppercase tracking-wider mb-3">
                  Market Rules & Security
                </h4>
                <ul className="space-y-2 text-xs text-slate-400">
                  <li>Binary YES/NO settle at $1.00 or $0.00</li>
                  <li>Multi-outcome mutually exclusive contracts</li>
                  <li>Continuous liquidity guaranteed by LMSR</li>
                  <li>Verified real-world oracle sources</li>
                  <li>Zero gas fees & instant settlement</li>
                </ul>
              </>
            )}
          </div>
        </div>

        {/* Bottom copyright & disclaimer */}
        <div className="pt-6 border-t border-slate-900 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-slate-400">
          <p>
            &copy; {new Date().getFullYear()} CentraMarkets Trading Technologies. Product prototype demonstration.
          </p>
          <div className="flex items-center gap-4 text-slate-400">
            <span>Algorithmic Liquidity</span>
            <span>&bull;</span>
            <span>Simulated Credits Only</span>
            <span>&bull;</span>
            <span>Centralized Clearing</span>
          </div>
        </div>

      </div>
    </footer>
  );
};
