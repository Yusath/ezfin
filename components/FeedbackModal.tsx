
import React from 'react';
import { MessageSquare, Mail, X } from 'lucide-react';

interface FeedbackModalProps {
  onClose: () => void;
}

const FeedbackModal: React.FC<FeedbackModalProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-ios-fade-in">
      <div className="bg-white dark:bg-[#1C1C1E] w-full max-w-sm rounded-[2rem] p-6 shadow-2xl relative animate-ios-slide-up border border-gray-100 dark:border-white/10">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 transition-colors text-gray-400 dark:text-gray-500 ios-touch-target"
        >
          <X size={20} />
        </button>

        <div className="flex flex-col items-center text-center space-y-4 pt-4">
          <div className="w-16 h-16 bg-orange-50 dark:bg-orange-900/20 rounded-[1.5rem] flex items-center justify-center text-orange-500 mb-2 shadow-sm border border-orange-100 dark:border-orange-500/20">
             <MessageSquare size={32} strokeWidth={1.5} />
          </div>
          
          <div>
            <h3 className="text-xl font-extrabold text-gray-900 dark:text-white tracking-tight">Kirim Masukan</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed mt-2 font-medium">
              Punya ide fitur baru atau menemukan bug?<br/>
              Bantu kami membuat EZFin lebih baik!
            </p>
          </div>
          
          <a 
            href="mailto:yusath.official@gmail.com?subject=Feedback%20EZFin%20AutoMate"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full bg-gradient-to-r from-orange-500 to-red-500 text-white py-3.5 rounded-2xl font-bold shadow-lg shadow-orange-500/30 flex items-center justify-center gap-2 transition-all active:scale-95 mt-2 hover:opacity-90"
          >
            <Mail size={18} />
            <span>Kirim via Gmail</span>
          </a>
        </div>
      </div>
    </div>
  );
};

export default FeedbackModal;
