import React from 'react';
import { Home, History, Plus, PieChart, Settings, Wallet } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';

const Sidebar: React.FC = () => {
  const location = useLocation();
  const isActive = (path: string) => location.pathname === path;
  const { t } = useLanguage();

  const NavItem = ({ to, icon: Icon, label }: { to: string, icon: any, label: string }) => (
    <Link 
      to={to} 
      className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 group ${
        isActive(to) 
          ? 'bg-primary text-white shadow-lg shadow-blue-500/30' 
          : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-white/10 dark:text-gray-400'
      }`}
    >
      <Icon size={18} className={isActive(to) ? '' : 'group-hover:scale-110 transition-transform'} />
      <span className="font-semibold text-xs tracking-wide">{label}</span>
    </Link>
  );

  return (
    <aside className="w-64 h-full bg-white dark:bg-[#1C1C1E] border-r border-gray-200 dark:border-white/10 flex flex-col p-5 shadow-xl z-30">
      
      {/* Brand */}
      <div className="flex items-center gap-3 mb-8 px-2">
        <div className="w-8 h-8 bg-primary rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-500/30">
          <Wallet size={16} strokeWidth={2.5} />
        </div>
        <div>
          <h1 className="text-lg font-bold tracking-tight text-gray-900 dark:text-white">EZFin</h1>
          <p className="text-[8px] font-medium text-gray-400 uppercase tracking-widest">AutoMate</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1.5">
        <NavItem to="/" icon={Home} label={t('nav.dashboard')} />
        <NavItem to="/history" icon={History} label={t('nav.history')} />
        <NavItem to="/stats" icon={PieChart} label={t('nav.stats')} />
        <NavItem to="/settings" icon={Settings} label={t('nav.settings')} />
      </nav>

      {/* CTA Button */}
      <div className="mt-auto pt-6">
        <Link 
          to="/add" 
          className="flex items-center justify-center gap-2 w-full bg-black dark:bg-white dark:text-black text-white py-3 rounded-2xl font-bold shadow-lg active:scale-95 transition-all hover:opacity-90 text-sm"
        >
          <Plus size={18} />
          <span>{t('nav.add')}</span>
        </Link>
      </div>
    </aside>
  );
};

export default Sidebar;