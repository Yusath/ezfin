import React from 'react';
import { Home, History, Plus, PieChart, Settings } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';

const Navbar: React.FC = () => {
  const location = useLocation();
  const isActive = (path: string) => location.pathname === path;
  const { t } = useLanguage();

  const NavItem = ({ to, icon: Icon, label, active }: { to: string, icon: any, label: string, active: boolean }) => (
    <Link 
      to={to} 
      className={`flex flex-col items-center justify-center w-full gap-1 pt-3 pb-1 transition-all duration-300 active:scale-90 ${active ? 'text-primary' : 'text-gray-400 hover:text-gray-500 dark:text-gray-500 dark:hover:text-gray-400'}`}
    >
      <Icon size={24} strokeWidth={active ? 2.5 : 2} className={active ? "drop-shadow-sm" : ""} />
      <span className={`text-[10px] font-medium tracking-tight ${active ? 'font-bold' : ''}`}>{label}</span>
    </Link>
  );

  return (
    // Fixed ensures it sticks to the viewport bottom regardless of scroll
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
      
      {/* Background Layer */}
      <div className="absolute inset-0 bg-white/95 dark:bg-[#1C1C1E]/95 backdrop-blur-xl border-t-[0.5px] border-gray-200 dark:border-white/10 shadow-[0_-5px_20px_rgba(0,0,0,0.03)]"></div>
      
      {/* Content Container - Uses calc to ensure minimum padding even if safe-area is 0 */}
      <div 
        className="relative flex justify-between items-end w-full px-2 pt-2"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)' }}
      >
        
        {/* Left Group */}
        <div className="flex-1 flex justify-evenly">
          <NavItem to="/" icon={Home} label={t('nav.dashboard')} active={isActive('/')} />
          <NavItem to="/history" icon={History} label={t('nav.history')} active={isActive('/history')} />
        </div>

        {/* Center Button Container (Docked Style) */}
        <div className="relative w-16 -top-6 flex justify-center z-10 shrink-0">
           <Link 
             to="/add" 
             className="flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-tr from-primary to-blue-500 text-white shadow-lg shadow-blue-500/40 border-4 border-[#F2F2F7] dark:border-[#000000] transform transition-all active:scale-90 hover:-translate-y-1"
           >
              <Plus size={28} strokeWidth={3} />
           </Link>
        </div>

        {/* Right Group */}
        <div className="flex-1 flex justify-evenly">
          <NavItem to="/stats" icon={PieChart} label={t('nav.stats')} active={isActive('/stats')} />
          <NavItem to="/settings" icon={Settings} label={t('nav.settings')} active={isActive('/settings')} />
        </div>

      </div>
    </nav>
  );
};

export default Navbar;