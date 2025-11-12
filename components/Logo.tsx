import React from 'react';

export const Logo: React.FC<{className?: string; simple?: boolean}> = ({className, simple}) => (
    <div className={`flex items-center gap-3 text-indigo-400 ${className}`}>
        <svg xmlns="http://www.w3.org/2000/svg" className="h-full w-auto" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2L2 7v10l10 5 10-5V7L12 2zM12 4.236L19.053 8 12 11.764 4.947 8 12 4.236zM4 9.127l8 4.536 8-4.536V14.88L12 19.412 4 14.88V9.127z"/>
        </svg>
        {!simple && (
            <div className="flex flex-col justify-center">
                <span className="text-4xl font-bold tracking-wider leading-none">RETURN</span>
                <span className="text-xl font-light tracking-widest leading-none">2D ENGINE</span>
            </div>
        )}
         {simple && (
             <span className="text-xl font-bold">Return 2D</span>
         )}
    </div>
);