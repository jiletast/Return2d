import React, { useRef } from 'react';
import { PlayIcon } from './icons/PlayIcon';
import { SaveIcon } from './icons/SaveIcon';
import { ExportIcon } from './icons/ExportIcon';
import { StopIcon } from './StopIcon';
import { BackButtonIcon } from './icons/BackButtonIcon';
import { CodeIcon } from './icons/CodeIcon';
import { Logo } from './Logo';
import { useLanguage } from '../LanguageContext';
import { Language } from '../translations';

interface HeaderProps {
  onSave: () => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onExport: () => void;
  onViewCode: () => void;
  onReturnToStart: () => void;
  onImportProject: (e: React.ChangeEvent<HTMLInputElement>) => void;
  projectName: string;
  onUpdateProjectName: (newName: string) => void;
}

const Header: React.FC<HeaderProps> = ({ onSave, isPlaying, onTogglePlay, onExport, onViewCode, onReturnToStart, onImportProject, projectName, onUpdateProjectName }) => {
  const { t, language, setLanguage } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const iconButtonStyle = "p-2 bg-gray-800 hover:bg-indigo-600 rounded-md transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed";
  const playButtonStyle = "p-2 bg-green-600 hover:bg-green-500 rounded-md transition-colors duration-200";
  const stopButtonStyle = "p-2 bg-red-600 hover:bg-red-500 rounded-md transition-colors duration-200";
  
  const languages: { code: Language; label: string }[] = [
    { code: 'es', label: 'Español' },
    { code: 'en', label: 'English' },
    { code: 'pt-BR', label: 'Português' },
    { code: 'ca', label: 'Català' },
    { code: 'fr', label: 'Français' },
    { code: 'it', label: 'Italiano' },
    { code: 'ru', label: 'Русский' },
  ];

  return (
    <header className="flex items-center justify-between p-2 bg-black border-b border-gray-800 shadow-lg shrink-0 h-16">
      <div className="flex items-center gap-2 flex-1">
        <button onClick={onReturnToStart} title={t('header.return')} className="p-2 hover:bg-gray-800 rounded-md transition-colors">
            <BackButtonIcon />
        </button>
        <div className="flex items-center gap-2 text-xl font-bold text-indigo-400">
            <Logo className="h-8 hidden md:flex" simple />
        </div>
        <input 
          type="text" 
          value={projectName} 
          onChange={(e) => onUpdateProjectName(e.target.value)}
          className="bg-gray-900 border border-gray-700 rounded-md px-3 py-1.5 text-sm w-48 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
        />
      </div>

      <div className="flex justify-center flex-1 gap-2">
        <select 
          value={language} 
          onChange={(e) => setLanguage(e.target.value as Language)}
          className="bg-gray-800 border border-gray-700 rounded-md px-2 py-1 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
        >
          {languages.map(lang => (
            <option key={lang.code} value={lang.code}>{lang.label}</option>
          ))}
        </select>
        <button 
          onClick={() => fileInputRef.current?.click()}
          className="text-xs bg-gray-800 hover:bg-gray-700 px-3 py-1 rounded-md border border-gray-700 transition-colors"
        >
          {t('header.import')}
        </button>
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={onImportProject} 
          accept=".json" 
          className="hidden" 
        />
      </div>
      
      <div className="flex items-center justify-end gap-3 flex-1">
        <button 
          className={isPlaying ? stopButtonStyle : playButtonStyle} 
          title={isPlaying ? t('header.stop') : t('header.play')}
          onClick={onTogglePlay}
        >
          {isPlaying ? <StopIcon /> : <PlayIcon />}
        </button>
        <button 
          className={iconButtonStyle} 
          title={t('header.viewCode')}
          onClick={onViewCode}
        >
          <CodeIcon />
        </button>
        <button 
          className={iconButtonStyle} 
          title={t('header.save')}
          onClick={onSave}
        >
          <SaveIcon />
        </button>
        <button 
          className={iconButtonStyle} 
          title={t('header.export')}
          onClick={onExport}
        >
          <ExportIcon />
        </button>
      </div>
    </header>
  );
};

export default Header;
