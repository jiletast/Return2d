import React from 'react';
import { PlayIcon } from './icons/PlayIcon';
import { SaveIcon } from './icons/SaveIcon';
import { ExportIcon } from './icons/ExportIcon';
import { StopIcon } from './StopIcon';
import { BackButtonIcon } from './icons/BackButtonIcon';
import { CodeIcon } from './icons/CodeIcon';
import { Logo } from './Logo';

interface HeaderProps {
  onSave: () => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onExport: () => void;
  onViewCode: () => void;
  onReturnToStart: () => void;
  projectName: string;
  onUpdateProjectName: (newName: string) => void;
}

const Header: React.FC<HeaderProps> = ({ onSave, isPlaying, onTogglePlay, onExport, onViewCode, onReturnToStart, projectName, onUpdateProjectName }) => {
  const iconButtonStyle = "p-2 bg-gray-800 hover:bg-indigo-600 rounded-md transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed";
  const playButtonStyle = "p-2 bg-green-600 hover:bg-green-500 rounded-md transition-colors duration-200";
  const stopButtonStyle = "p-2 bg-red-600 hover:bg-red-500 rounded-md transition-colors duration-200";
  
  return (
    <header className="flex items-center justify-between p-2 bg-black border-b border-gray-800 shadow-lg shrink-0 h-16">
      <div className="flex items-center gap-2 flex-1">
        <button onClick={onReturnToStart} title="Volver a Proyectos" className="p-2 hover:bg-gray-800 rounded-md transition-colors">
            <BackButtonIcon />
        </button>
        <div className="flex items-center gap-2 text-xl font-bold text-indigo-400">
            <Logo className="h-8 hidden md:flex" simple />
        </div>
        <input 
          type="text" 
          value={projectName} 
          onChange={(e) => onUpdateProjectName(e.target.value)}
          className="bg-gray-900 border border-gray-700 rounded-md px-3 py-1.5 text-sm w-64 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
        />
      </div>

      <div className="flex justify-center flex-1">
        {/* Placeholder for future center elements */}
      </div>
      
      <div className="flex items-center justify-end gap-3 flex-1">
        <button 
          className={isPlaying ? stopButtonStyle : playButtonStyle} 
          title={isPlaying ? "Detener Vista Previa" : "Vista Previa del Juego"}
          onClick={onTogglePlay}
        >
          {isPlaying ? <StopIcon /> : <PlayIcon />}
        </button>
        <button 
          className={iconButtonStyle} 
          title="Ver Código HTML"
          onClick={onViewCode}
        >
          <CodeIcon />
        </button>
        <button 
          className={iconButtonStyle} 
          title="Guardar Proyecto"
          onClick={onSave}
        >
          <SaveIcon />
        </button>
        <button 
          className={iconButtonStyle} 
          title="Exportar a Web"
          onClick={onExport}
        >
          <ExportIcon />
        </button>
      </div>
    </header>
  );
};

export default Header;
