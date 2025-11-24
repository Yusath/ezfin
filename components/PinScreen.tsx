import React, { useState, useEffect } from 'react';
import { Lock } from 'lucide-react';

interface PinScreenProps {
  correctPin: string;
  onSuccess: () => void;
}

const PinScreen: React.FC<PinScreenProps> = ({ correctPin, onSuccess }) => {
  const [input, setInput] = useState('');
  const [isError, setIsError] = useState(false);

  const handleNumberClick = (num: string) => {
    if (input.length < 6) {
      const newInput = input + num;
      setInput(newInput);
      
      if (newInput.length === 6) {
        verifyPin(newInput);
      }
    }
  };

  const handleDelete = () => {
    setInput(input.slice(0, -1));
    setIsError(false);
  };

  const verifyPin = (enteredPin: string) => {
    if (enteredPin === correctPin) {
      onSuccess();
    } else {
      setIsError(true);
      if (navigator.vibrate) navigator.vibrate(200); // Haptic feedback
      setTimeout(() => {
        setInput('');
        setIsError(false);
      }, 500);
    }
  };

  return (
    <div className="absolute inset-0 bg-primary dark:bg-dark z-50 flex flex-col items-center justify-center text-white p-6">
      <div className="mb-8 flex flex-col items-center">
        <div className="bg-white/20 p-4 rounded-full mb-4 backdrop-blur-md">
          <Lock size={32} className="text-white" />
        </div>
        <h1 className="text-2xl font-bold">EZFin Security</h1>
        <p className="text-white/60 text-sm mt-2">Masukkan PIN Anda untuk masuk</p>
      </div>

      {/* PIN Dots */}
      <div className={`flex gap-4 mb-12 ${isError ? 'animate-shake' : ''}`}>
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className={`w-4 h-4 rounded-full transition-all duration-300 ${
              i < input.length ? 'bg-white scale-110 shadow-[0_0_10px_rgba(255,255,255,0.8)]' : 'bg-white/20'
            }`}
          />
        ))}
      </div>

      {/* Keypad */}
      <div className="grid grid-cols-3 gap-x-8 gap-y-6 w-full max-w-xs">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
          <button
            key={num}
            onClick={() => handleNumberClick(num.toString())}
            className="w-16 h-16 rounded-full text-2xl font-medium bg-white/10 hover:bg-white/20 transition active:scale-95 flex items-center justify-center backdrop-blur-sm"
          >
            {num}
          </button>
        ))}
        <div className="w-16 h-16" /> {/* Spacer */}
        <button
          onClick={() => handleNumberClick('0')}
          className="w-16 h-16 rounded-full text-2xl font-medium bg-white/10 hover:bg-white/20 transition active:scale-95 flex items-center justify-center backdrop-blur-sm"
        >
          0
        </button>
        <button
          onClick={handleDelete}
          className="w-16 h-16 rounded-full text-lg font-medium text-white/80 hover:text-white transition active:scale-95 flex items-center justify-center"
        >
          Hapus
        </button>
      </div>
    </div>
  );
};

export default PinScreen;