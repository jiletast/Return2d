import React, { useState } from 'react';
import type { ProjectData } from '../types';
import { generateGameHTML } from '../services/exportService';

interface ExportModalProps {
  onClose: () => void;
  projectData?: ProjectData | null;
  initialShowCode?: boolean;
}

export const ExportModal: React.FC<ExportModalProps> = ({ onClose, projectData, initialShowCode = false }) => {
  const [showCode, setShowCode] = useState(initialShowCode);
  const [generatedCode, setGeneratedCode] = useState(initialShowCode ? generateGameHTML(projectData) : '');
  
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

  const handleViewCode = () => {
    const htmlContent = generateGameHTML(projectData);
    if (!htmlContent) {
        alert("No hay datos de proyecto para visualizar.");
        return;
    }
    setGeneratedCode(htmlContent);
    setShowCode(true);
  };
  
  const ExportOption: React.FC<{ 
    title: string; 
    description: string; 
    icon: React.ReactNode; 
    onExport: () => void; 
    onViewCode?: () => void;
  }> = ({ title, description, icon, onExport, onViewCode }) => {
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
            <div className="flex gap-2">
                {onViewCode && (
                    <button 
                        onClick={onViewCode} 
                        className="bg-gray-600 hover:bg-gray-500 text-white font-semibold px-4 py-2 rounded-md"
                    >
                        Ver Código
                    </button>
                )}
                <button 
                    onClick={onExport} 
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 py-2 rounded-md"
                >
                    Exportar
                </button>
            </div>
        </div>
    );
};

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-gray-800 rounded-lg shadow-2xl w-full max-w-2xl flex flex-col border border-gray-700 max-h-[90vh]" onClick={e => e.stopPropagation()}>
        <header className="flex items-center justify-between p-4 border-b border-gray-700 shrink-0">
          <h2 className="text-xl font-bold">{showCode ? 'Código HTML Generado' : 'Exportar Proyecto'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl font-bold">&times;</button>
        </header>
        <main className="p-6 space-y-4 overflow-y-auto">
            {showCode ? (
                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <p className="text-gray-400 text-sm">Este es el código HTML completo que se genera para tu juego.</p>
                        <button 
                            onClick={() => {
                                navigator.clipboard.writeText(generatedCode);
                                alert("Código copiado al portapapeles");
                            }}
                            className="text-xs bg-indigo-600 hover:bg-indigo-500 px-2 py-1 rounded text-white"
                        >
                            Copiar Código
                        </button>
                    </div>
                    <pre className="bg-black p-4 rounded-md overflow-x-auto text-xs font-mono text-green-400 border border-gray-700 max-h-[50vh]">
                        {generatedCode}
                    </pre>
                    <button 
                        onClick={() => setShowCode(false)}
                        className="w-full py-2 bg-gray-700 hover:bg-gray-600 rounded-md text-white font-semibold"
                    >
                        Volver a Opciones de Exportación
                    </button>
                </div>
            ) : (
                <>
                    <p className="text-gray-400">Elige tu plataforma de destino.</p>
                    <ExportOption 
                        title="HTML5"
                        description="Exporta una versión de tu juego lista para la web."
                        icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>}
                        onExport={() => handleExport('HTML5')}
                        onViewCode={handleViewCode}
                    />
                </>
            )}
        </main>
      </div>
    </div>
  );
};
