import React from 'react';
import { motion } from 'motion/react';
import { useMarket } from '../../context/MarketContext';
import { useLanguage } from '../../context/LanguageContext';
import { Category } from '../../types';
import { 
  Compass, 
  Trophy, 
  Coins, 
  LineChart, 
  Cpu, 
  CloudRain, 
  Coffee, 
  Film,
  Users
} from 'lucide-react';

interface CategoryFilterProps {
  showCounts?: boolean;
}

export const CategoryFilter: React.FC<CategoryFilterProps> = ({ showCounts = true }) => {
  const { selectedCategory, setSelectedCategory, markets } = useMarket();
  const { language, t } = useLanguage();

  const CATEGORIES: { id: Category | 'All'; label: string; icon: React.ReactNode }[] = [
    { id: 'All', label: language === 'es' ? 'Todos' : 'All Markets', icon: <Compass className="w-3.5 h-3.5" /> },
    { id: 'Friends', label: language === 'es' ? 'Retos del Grupo' : 'Friends & Group', icon: <Users className="w-3.5 h-3.5 text-amber-400" /> },
    { id: 'Sports', label: language === 'es' ? 'Deportes' : 'Sports', icon: <Trophy className="w-3.5 h-3.5 text-emerald-400" /> },
    { id: 'Crypto', label: language === 'es' ? 'Cripto' : 'Crypto', icon: <Coins className="w-3.5 h-3.5 text-cyan-400" /> },
    { id: 'Everyday Life', label: language === 'es' ? 'Vida Cotidiana' : 'Everyday Life', icon: <Coffee className="w-3.5 h-3.5 text-amber-300" /> },
    { id: 'Technology', label: language === 'es' ? 'Tecnología' : 'Technology', icon: <Cpu className="w-3.5 h-3.5 text-purple-400" /> },
    { id: 'Economy', label: language === 'es' ? 'Economía' : 'Economy', icon: <LineChart className="w-3.5 h-3.5 text-blue-400" /> },
    { id: 'Entertainment', label: language === 'es' ? 'Entretenimiento' : 'Entertainment', icon: <Film className="w-3.5 h-3.5 text-pink-400" /> },
    { id: 'Weather', label: language === 'es' ? 'Clima' : 'Weather', icon: <CloudRain className="w-3.5 h-3.5 text-sky-400" /> },
  ];

  const getCategoryCount = (catId: Category | 'All') => {
    if (catId === 'All') return markets.length;
    return markets.filter((m) => m.category === catId).length;
  };

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto py-2 scrollbar-none no-scrollbar">
      {CATEGORIES.map((cat) => {
        const count = getCategoryCount(cat.id);
        const isSelected = selectedCategory === cat.id;

        return (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(isSelected && cat.id !== 'All' ? 'All' : cat.id)}
            className="relative flex items-center gap-2 px-3.5 py-1.5 min-h-[38px] rounded-xl text-xs font-medium whitespace-nowrap btn-tactile z-10 cursor-pointer"
          >
            {isSelected && (
              <motion.div
                layoutId="category-active-pill"
                className="absolute inset-0 bg-[#0c1626] border border-[#00d2ff]/40 rounded-xl shadow-[0_0_14px_rgba(0,210,255,0.18)]"
                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              />
            )}
            {!isSelected && (
              <div className="absolute inset-0 bg-[#050811] border border-[#151e2e] rounded-xl hover:border-slate-700 hover:bg-[#090f1d] transition-colors" />
            )}

            <span className={`relative z-10 flex items-center gap-1.5 ${isSelected ? 'text-white font-semibold' : 'text-slate-400'}`}>
              <span className={`shrink-0 flex items-center ${isSelected ? 'text-[#00d2ff]' : 'text-slate-500'}`}>
                {cat.icon}
              </span>
              <span>{cat.label}</span>
            </span>

            {showCounts && (
              <span
                className={`relative z-10 px-1.5 py-0.5 rounded-md text-[10px] font-mono tabular-nums font-semibold ${
                  isSelected
                    ? 'bg-[#00d2ff]/20 text-[#00d2ff]'
                    : 'bg-[#0c1322] text-slate-500'
                }`}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
