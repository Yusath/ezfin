import React from 'react';
import { Home, History, Plus, PieChart, Settings } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';

const Navbar: React.FC = () => {
  const location = useLocation();
  const isActive = (path: string) => location.pathname === path;
  const { t } = useLanguage();

  return (
    // Fixed to bottom, Hidden on Desktop
    <nav className="absolute bottom-0 left-0 w-full z-40 md:hidden">
      {/* Blur Background Layer */}
      <div className="absolute inset-0 bg-white/90 dark:bg-[#1C1C1E]/95 backdrop-blur-xl border-t-[0.5px] border-gray-200 dark:border-white/10 shadow-[0_-5px_20px_rgba(0,0,0,0.03)]"></div>
      
      {/* Content Layer with Safe Area Padding */}
      <div className="relative flex justify-between items-end pb-safe pt-2 px-6">
        
        {/* Nav Items */}
        <Link 
          to="/" 
          className={`flex flex-col items-center justify-center flex-1 gap-1 py-3 transition-all duration-300 active:scale-95 ${isActive('/') ? 'text-primary' : 'text-gray-400 hover:text-gray-500 dark:text-gray-500 dark:hover:text-gray-400'}`}
        >
          <Home size={24} strokeWidth={isActive('/') ? 2.5 : 2} className={isActive('/') ? "drop-shadow-sm" : ""} />
          <span className={`text-[10px] font-medium tracking-tight ${isActive('/') ? 'font-bold' : ''}`}>{t('nav.dashboard')}</span>
        </Link>

        <Link 
          to="/history" 
          className={`flex flex-col items-center justify-center flex-1 gap-1 py-3 transition-all duration-300 active:scale-95 ${isActive('/history') ? 'text-primary' : 'text-gray-400 hover:text-gray-500 dark:text-gray-500 dark:hover:text-gray-400'}`}
        >
          <History size={24} strokeWidth={isActive('/history') ? 2.5 : 2} className={isActive('/history') ? "drop-shadow-sm" : ""} />
          <span className={`text-[10px] font-medium tracking-tight ${isActive('/history') ? 'font-bold' : ''}`}>{t('nav.history')}</span>
        </Link>

        {/* Floating Action Button (Raised) */}
        <div className="relative flex-1 flex justify-center pointer-events-none">
          <Link 
            to="/add" 
            className="pointer-events-auto mb-8 flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-tr from-primary to-blue-500 text-white shadow-lg shadow-blue-500/40 border-[4px] border-[#F2F2F7] dark:border-black transform transition-all active:scale-90 hover:-translate-y-1"
          >
             <Plus size={30} strokeWidth={3} />
          </Link>
        </div>

        <Link 
          to="/stats" 
          className={`flex flex-col items-center justify-center flex-1 gap-1 py-3 transition-all duration-300 active:scale-95 ${isActive('/stats') ? 'text-primary' : 'text-gray-400 hover:text-gray-500 dark:text-gray-500 dark:hover:text-gray-400'}`}
        >
          <PieChart size={24} strokeWidth={isActive('/stats') ? 2.5 : 2} className={isActive('/stats') ? "drop-shadow-sm" : ""} />
          <span className={`text-[10px] font-medium tracking-tight ${isActive('/stats') ? 'font-bold' : ''}`}>{t('nav.stats')}</span>
        </Link>

        <Link 
          to="/settings" 
          className={`flex flex-col items-center justify-center flex-1 gap-1 py-3 transition-all duration-300 active:scale-95 ${isActive('/settings') ? 'text-primary' : 'text-gray-400 hover:text-gray-500 dark:text-gray-500 dark:hover:text-gray-400'}`}
        >
          <Settings size={24} strokeWidth={isActive('/settings') ? 2.5 : 2} className={isActive('/settings') ? "drop-shadow-sm" : ""} />
          <span className={`text-[10px] font-medium tracking-tight ${isActive('/settings') ? 'font-bold' : ''}`}>{t('nav.settings')}</span>
        </Link>

      </div>
    </nav>
  );
};

export default Navbar;