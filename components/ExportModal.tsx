import React from 'react';
import type { ProjectData } from '../types';
import { generateGameHTML } from '../services/exportService';

interface ExportModalProps {
  onClose: () => void;
  projectData?: ProjectData | null;
}

export const ExportModal: React.FC<ExportModalProps> = ({ onClose, projectData }) => {
  
  const handleExport = (platform: string) => {
      if (platform === 'HTML5') {
          const htmlContent = generateGameHTML(projectData);
          if (!htmlContent) {
              alert("No hay datos de proyecto para exportar.");
              return;
          }
          const blob = new Blob([htmlContent], { type: 'text/html' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'game.html';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          onClose();
      }
  };
  
  const ExportOption: React.FC<{ 
    title: string; 
    description: string; 
    icon: React.ReactNode; 
    onExport: () => void; 
  }> = ({ title, description, icon, onExport }) => {
    return (
        <div className="p-4 rounded-lg flex items-center gap-4 transition-all bg-gray-700">
            <div className="p-3 rounded-md bg-indigo-600">
                {icon}
            </div>
            <div className="flex-grow">
                <h4 className="font-bold text-white">
                    {title}
                </h4>
                <p className="text-sm text-gray-400">{description}</p>
            </div>
            <button 
                onClick={onExport} 
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 py-2 rounded-md"
            >
                Exportar
            </button>
        </div>
    );
};

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-gray-800 rounded-lg shadow-2xl w-full max-w-2xl flex flex-col border border-gray-700" onClick={e => e.stopPropagation()}>
        <header className="flex items-center justify-between p-4 border-b border-gray-700 shrink-0">
          <h2 className="text-xl font-bold">Exportar Proyecto</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl font-bold">&times;</button>
        </header>
        <main className="p-6 space-y-4">
            <p className="text-gray-400">Elige tu plataforma de destino.</p>
            <ExportOption 
                title="HTML5"
                description="Exporta una versión de tu juego lista para la web."
                icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>}
                onExport={() => handleExport('HTML5')}
            />
        </main>
      </div>
    </div>
  );
};