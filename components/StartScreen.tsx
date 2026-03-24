import React, { useState, useEffect, useRef } from 'react';
import type { Project } from '../types';
import { Logo } from './Logo';
import { PlusIcon } from './icons/PlusIcon';
import { TrashIcon } from './icons/TrashIcon';
import { useLanguage } from '../LanguageContext';

interface StartScreenProps {
  projects: Project[];
  onLoadProject: (projectId: string) => void;
  onCreateProject: () => void;
  onDeleteProject: (projectId: string) => void;
}

const StartScreen: React.FC<StartScreenProps> = ({ projects, onLoadProject, onCreateProject, onDeleteProject }) => {
  const { t } = useLanguage();
  const [projectToConfirmDelete, setProjectToConfirmDelete] = useState<Project | null>(null);
  const sortedProjects = [...projects].sort((a, b) => b.lastModified - a.lastModified);

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-black text-white font-sans p-4">
      {projectToConfirmDelete && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50" onClick={() => setProjectToConfirmDelete(null)}>
          <div className="bg-gray-900 rounded-lg shadow-2xl border border-gray-800 w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-bold mb-2">{t('startScreen.deleteProjectTitle')}</h2>
            <p className="text-gray-400 mb-6">{t('startScreen.deleteProjectConfirm', { name: projectToConfirmDelete.name })}</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setProjectToConfirmDelete(null)} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-md transition-colors">{t('common.cancel')}</button>
              <button 
                onClick={() => {
                  onDeleteProject(projectToConfirmDelete.id);
                  setProjectToConfirmDelete(null);
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 rounded-md transition-colors"
              >
                {t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="text-center mb-12">
        <Logo className="h-20" />
      </div>
      
      <div className="w-full max-w-4xl bg-gray-900 rounded-lg shadow-2xl border border-gray-800">
          <div className="p-4 border-b border-gray-800 flex justify-between items-center">
          <h2 className="text-xl font-semibold">{t('startScreen.yourProjects')}</h2>
          <button 
              onClick={onCreateProject}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 py-2 rounded-md shadow-lg transition-transform transform hover:scale-105"
          >
              <PlusIcon />
              {t('startScreen.newProject')}
          </button>
          </div>

          <div className="max-h-[50vh] overflow-y-auto">
          {sortedProjects.length > 0 ? (
              <ul>
              {sortedProjects.map(project => (
                  <li key={project.id} className="flex items-center justify-between p-4 border-b border-gray-800 last:border-b-0 hover:bg-gray-800/50 transition-colors group">
                  <div className="cursor-pointer flex-grow" onClick={() => onLoadProject(project.id)}>
                      <h3 className="font-bold text-lg group-hover:text-indigo-400">{project.name}</h3>
                      <p className="text-xs text-gray-400">{t('startScreen.lastModified', { date: new Date(project.lastModified).toLocaleString() })}</p>
                  </div>
                  <div className="flex items-center gap-2">
                      <button 
                      onClick={() => onLoadProject(project.id)}
                      className="px-4 py-2 text-sm bg-gray-700 hover:bg-green-600 rounded-md transition-colors"
                      >
                      {t('startScreen.open')}
                      </button>
                      <button 
                      onClick={(e) => {
                          e.stopPropagation();
                          setProjectToConfirmDelete(project);
                      }}
                      className="px-3 py-2 text-sm bg-gray-700 hover:bg-red-600 rounded-md transition-colors"
                      title={t('startScreen.deleteProjectTitle')}
                      >
                       <TrashIcon />
                      </button>
                  </div>
                  </li>
              ))}
              </ul>
          ) : (
              <div className="p-8 text-center text-gray-500">
              <p>{t('startScreen.noProjects')}</p>
              </div>
          )}
          </div>
      </div>
    </div>
  );
};

export default StartScreen;