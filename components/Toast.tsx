import React, { useEffect } from 'react';
import { ToastMessage } from '../types';
import { CheckCircle, AlertCircle, Info, ChevronRight } from 'lucide-react';

interface ToastProps {
  toasts: ToastMessage[];
  removeToast: (id: string) => void;
}

export const ToastContainer: React.FC<ToastProps> = ({ toasts, removeToast }) => {
  return (
    <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-[999] flex flex-col gap-2 w-full max-w-sm px-4">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} removeToast={removeToast} />
      ))}
    </div>
  );
};

const ToastItem: React.FC<{ toast: ToastMessage; removeToast: (id: string) => void }> = ({ toast, removeToast }) => {
  useEffect(() => {
    // If there is an action, make it stick longer (6s), otherwise 3s
    const duration = toast.action ? 6000 : 3000;
    const timer = setTimeout(() => {
      removeToast(toast.id);
    }, duration);
    return () => clearTimeout(timer);
  }, [toast.id, toast.action, removeToast]);

  const getStyles = () => {
    switch (toast.type) {
      case 'success': return 'bg-secondary/95 text-white shadow-green-500/20';
      case 'error': return 'bg-accent/95 text-white shadow-red-500/20';
      default: return 'bg-blue-500/95 text-white shadow-blue-500/20';
    }
  };

  const getIcon = () => {
    switch (toast.type) {
      case 'success': return <CheckCircle size={20} />;
      case 'error': return <AlertCircle size={20} />;
      default: return <Info size={20} />;
    }
  };

  return (
    <div className={`pl-4 pr-3 py-3.5 rounded-2xl shadow-xl backdrop-blur-md flex items-center gap-3 text-sm font-medium animate-ios-fade-in ${getStyles()} border border-white/10`}>
      <div className="shrink-0">
        {getIcon()}
      </div>
      <div className="flex-1 mr-2">
        <p className="leading-tight">{toast.message}</p>
      </div>
      {toast.action && (
         <button 
           onClick={() => {
             toast.action?.onClick();
             removeToast(toast.id);
           }}
           className="bg-white text-black px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap active:scale-95 transition-transform flex items-center gap-1 shadow-sm"
         >
           {toast.action.label}
           <ChevronRight size={12} strokeWidth={3} />
         </button>
      )}
    </div>
  );
};