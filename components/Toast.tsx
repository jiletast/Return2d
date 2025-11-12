import React, { useState, useEffect } from 'react';

interface ToastProps {
  message: string;
  show: boolean;
}

const Toast: React.FC<ToastProps> = ({ message, show }) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (show) {
      setIsVisible(true);
    } else {
      // Allow fade-out animation to complete before hiding
      const timer = setTimeout(() => setIsVisible(false), 300);
      return () => clearTimeout(timer);
    }
  }, [show]);
  
  if (!isVisible) return null;

  return (
    <div
      className={`fixed bottom-5 right-5 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg transition-opacity duration-300 ${
        show ? 'opacity-100' : 'opacity-0'
      }`}
    >
      {message}
    </div>
  );
};

export default Toast;
