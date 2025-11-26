
import React, { useState, useEffect, useRef } from 'react';
import { hashPin } from '../utils/security';

interface PinScreenProps {
  correctPin: string;
  onSuccess: () => void;
}

const PinScreen: React.FC<PinScreenProps> = ({ correctPin, onSuccess }) => {
  const [input, setInput] = useState('');
  const [isError, setIsError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    // Focus automatically on mount with a slight delay to ensure UI is ready
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    
    // Ensure only numbers are entered
    if (val && !/^\d+$/.test(val)) return;
    
    setInput(val);

    if (val.length === 6) {
      setIsChecking(true);
      // Security Fix: Hash input before comparing to stored PIN
      const hashedInput = await hashPin(val);
      
      const isValid = hashedInput === correctPin || val === correctPin;

      if (isValid) {
        // Small delay for visual feedback before unmounting
        setTimeout(() => {
          onSuccess();
        }, 100);
      } else {
        setIsChecking(false);
        setIsError(true);
        if (navigator.vibrate) navigator.vibrate(200);
        setTimeout(() => {
          setInput('');
          setIsError(false);
        }, 500);
      }
    }
  };

  const handleContainerClick = () => {
    inputRef.current?.focus();
  };

  return (
    <main 
      className="fixed inset-0 bg-blue-600 dark:bg-black z-[100] flex flex-col items-center justify-center text-white p-6 animate-ios-fade-in"
      onClick={handleContainerClick}
    >
      <div className="flex flex-col items-center mb-10 transition-all duration-500">
        <div className="bg-white/20 p-5 rounded-[2rem] mb-6 backdrop-blur-xl shadow-lg border border-white/10">
          <img 
            src="https://i.ibb.co.com/KcRpsp15/Untitled-design.png" 
            alt="Logo" 
            className="w-20 h-20 object-cover rounded-2xl drop-shadow-md" 
          />
        </div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">EZFin AutoMate</h1>
        {/* IMPROVED CONTRAST: text-white on blue-600 is WCAG compliant */}
        <p className="text-white text-base font-medium">Masukkan 6-digit PIN Anda</p>
      </div>

      {/* 
        Invisible Input covering the screen to capture taps and keystrokes 
        Added aria-label for accessibility
      */}
      <input
        ref={inputRef}
        type="tel" 
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={6}
        value={input}
        onChange={handleChange}
        disabled={isChecking}
        className="absolute inset-0 w-full h-full opacity-0 cursor-default"
        autoFocus
        autoComplete="off"
        aria-label="PIN Entry"
      />

      {/* Visual Dots Feedback */}
      <div className={`flex gap-6 mb-8 relative pointer-events-none ${isError ? 'animate-shake' : ''}`}>
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className={`w-4 h-4 rounded-full transition-all duration-300 border border-white/30 ${
              i < input.length 
                ? 'bg-white scale-125 shadow-[0_0_12px_rgba(255,255,255,0.8)] border-transparent' 
                : 'bg-white/10 scale-100'
            }`}
          />
        ))}
      </div>
      
      {/* Footer hint - Improved contrast */}
      <div className="absolute bottom-10 text-white/90 text-xs font-medium uppercase tracking-widest animate-pulse pointer-events-none">
        Build with &#x2764;&#xFE0F; by Yusathid
      </div>
    </main>
  );
};

export default PinScreen;
