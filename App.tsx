import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { Project, ProjectData, GameObject, Scene, GameAsset, Animation, Variable, CollisionProperties } from './types';

import SplashScreen from './components/SplashScreen';
import ProjectLoadingScreen from './components/ProjectLoadingScreen';
import StartScreen from './components/StartScreen';
import Header from './components/Header';
import SceneHierarchy from './components/SceneHierarchy';
import SceneEditor from './components/SceneEditor';
import PropertiesInspector from './components/PropertiesInspector';
import GameView, { type GameState } from './components/GameView';
import { ExportModal } from './components/ExportModal';
import EventEditor from './components/EventEditor';
import AnimationEditor from './components/AnimationEditor';
import { SpriteEditor } from './components/SpriteEditor';
import AudioLab from './components/AudioLab';
import SoundtrackEditor from './components/SoundtrackEditor';
import Toast from './components/Toast';
import { HierarchyIcon } from './components/icons/HierarchyIcon';
import { EditorIcon } from './components/icons/EditorIcon';
import { InspectorIcon } from './components/icons/InspectorIcon';
import { get, set } from 'idb-keyval';
import { motion, AnimatePresence } from 'motion/react';


import { LanguageProvider, useLanguage } from './LanguageContext';

const PROJECTS_STORAGE_KEY = 'return2d-projects';
const NOTICE_ACCEPTED_KEY = 'return2d-notice-accepted';

const NoticeModal: React.FC<{ onAccept: () => void }> = ({ onAccept }) => {
    const { t } = useLanguage();
    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4">
            <div className="bg-gray-900 rounded-lg shadow-2xl border border-gray-800 w-full max-w-md p-6 text-center">
                <h2 className="text-xl font-bold mb-4 text-yellow-400">{t('notice.title')}</h2>
                <p className="text-gray-300 mb-6">
                    {t('notice.message')}
                </p>
                <button
                    onClick={onAccept}
                    className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-md transition-colors text-white font-semibold"
                >
                    {t('notice.accept')}
                </button>
            </div>
        </div>
    );
};


const createNewScene = (name: string): Scene => {
    const sceneId = `scene_${Date.now()}`;
    return {
      id: sceneId,
      name,
      backgroundColor: '#111827',
      defaultZoom: 1,
      cameraBounds: { enabled: false, x: 0, y: 0, width: 1024, height: 768 },
      gameObjects: [],
      events: [],
    };
};

const createNewProjectData = (t: (key: string) => string): ProjectData => {
    const starterScene = createNewScene(t('starter.sceneName'));
    
    starterScene.gameObjects = [
      { id: 1, name: 'Player', x: 100, y: 450, width: 30, height: 50, color: '#3b82f6', zIndex: 10, behaviors: [{ name: 'PlatformerCharacter', properties: { speed: 150, jumpForce: 350, gravity: 500 } }, { name: 'FollowCamera', properties: {} }], variables: [], direction: 'right', rotation: 0, scaleX: 1, scaleY: 1, stats: { hp: 100, maxHp: 100, attack: 10} },
      { id: 2, name: 'Ground', x: 0, y: 500, width: 1024, height: 50, color: '#4b5563', zIndex: 1, behaviors: [{ name: 'Solid', properties: {} }] },
      { id: 3, name: 'ScoreText', isUI: true, x: 10, y: 10, width: 200, height: 30, color: 'transparent', zIndex: 1000, text: t('starter.score') },
    ];
    return {
        scenes: [starterScene],
        activeSceneId: starterScene.id,
        assets: [],
        animations: [],
        globalVariables: [{name: 'score', value: 0}],
        orientation: window.innerWidth > window.innerHeight ? 'landscape' : 'portrait',
        gameWidth: window.innerWidth,
        gameHeight: window.innerHeight,
        joystick: {
            enabled: true,
            position: 'left',
            size: 120,
            opacity: 0.5
        }
    };
};

type AppState = 'loading' | 'start' | 'editor' | 'playing';

const App: React.FC = () => {
  return (
    <LanguageProvider>
      <AppContent />
    </LanguageProvider>
  );
};

const AppContent: React.FC = () => {
  const { t } = useLanguage();
  const [appState, setAppState] = useState<AppState>('loading');
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectData, setProjectData] = useState<ProjectData | null>(null);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [noticeAccepted, setNoticeAccepted] = useState(true);
  const [toast, setToast] = useState<{ message: string; show: boolean }>({ message: '', show: false });

  const [selectedObjectId, setSelectedObjectId] = useState<number | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportModalInitialShowCode, setExportModalInitialShowCode] = useState(false);
  const [showEventEditor, setShowEventEditor] = useState(false);
  const [showAnimationEditor, setShowAnimationEditor] = useState(false);
  const [showSpriteEditor, setShowSpriteEditor] = useState(false);
  const [editingSpriteAssetId, setEditingSpriteAssetId] = useState<string | null>(null);
  const [showAudioLab, setShowAudioLab] = useState(false);
  const [showSoundtrackEditor, setShowSoundtrackEditor] = useState(false);
  
  const [hierarchyWidth, setHierarchyWidth] = useState(280);
  const [inspectorWidth, setInspectorWidth] = useState(320);
  const [isHierarchyCollapsed, setIsHierarchyCollapsed] = useState(false);
  const [isInspectorCollapsed, setIsInspectorCollapsed] = useState(false);
  const [activeMobilePanel, setActiveMobilePanel] = useState<'hierarchy' | 'editor' | 'inspector'>('editor');
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false);
  const [isResizingHierarchy, setIsResizingHierarchy] = useState(false);
  const [isResizingInspector, setIsResizingInspector] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const startResizingHierarchy = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingHierarchy(true);
  }, []);

  const startResizingInspector = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingInspector(true);
  }, []);

  const stopResizing = useCallback(() => {
    setIsResizingHierarchy(false);
    setIsResizingInspector(false);
  }, []);

  const resize = useCallback((e: MouseEvent) => {
    if (isResizingHierarchy) {
      const newWidth = Math.max(150, Math.min(600, e.clientX));
      setHierarchyWidth(newWidth);
    } else if (isResizingInspector) {
      const newWidth = Math.max(200, Math.min(600, window.innerWidth - e.clientX));
      setInspectorWidth(newWidth);
    }
  }, [isResizingHierarchy, isResizingInspector]);

  useEffect(() => {
    if (isResizingHierarchy || isResizingInspector) {
      window.addEventListener('mousemove', resize);
      window.addEventListener('mouseup', stopResizing);
    }
    return () => {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
    };
  }, [isResizingHierarchy, isResizingInspector, resize, stopResizing]);

  const debounceTimeout = useRef<number | null>(null);

  const showToast = useCallback((message: string) => {
    setToast({ message, show: true });
    setTimeout(() => setToast({ message: '', show: false }), 3000);
  }, []);

  useEffect(() => {
    const loadData = async () => {
        try {
            // Try loading from IndexedDB first
            let storedProjects = await get(PROJECTS_STORAGE_KEY);
            
            // If not in IndexedDB, check localStorage for migration
            if (!storedProjects) {
                const legacyProjects = localStorage.getItem(PROJECTS_STORAGE_KEY);
                if (legacyProjects) {
                    storedProjects = JSON.parse(legacyProjects);
                    // Migrate to IndexedDB
                    await set(PROJECTS_STORAGE_KEY, storedProjects);
                    // Clear legacy storage to free up space
                    localStorage.removeItem(PROJECTS_STORAGE_KEY);
                }
            }

            if (storedProjects) {
                setProjects(storedProjects);
            }

            const notice = localStorage.getItem(NOTICE_ACCEPTED_KEY);
            setNoticeAccepted(notice === 'true');
        } catch (error) {
            console.error("Error loading projects:", error);
            showToast("Error al cargar los proyectos");
        }
        setTimeout(() => setAppState('start'), 1000);
    };

    loadData();
  }, [showToast]);

  const handleSaveProjects = useCallback(async (updatedProjects: Project[]) => {
      try {
          await set(PROJECTS_STORAGE_KEY, updatedProjects);
          setProjects(updatedProjects);
      } catch (error) {
          console.error("Error saving projects to IndexedDB:", error);
          showToast("Error al guardar: Espacio insuficiente o error de base de datos");
      }
  }, [showToast]);
  
  const handleSaveCurrentProject = useCallback((showNotification = false) => {
    if (!activeProjectId || !projectData) return;

    if (debounceTimeout.current) {
        clearTimeout(debounceTimeout.current);
    }

    debounceTimeout.current = window.setTimeout(() => {
        const updatedProjects = projects.map(p => 
            p.id === activeProjectId 
            ? { ...p, data: projectData, lastModified: Date.now() } 
            : p
        );
        handleSaveProjects(updatedProjects);
        if (showNotification) {
            showToast("Proyecto guardado");
        }
    }, 500);
  }, [activeProjectId, projectData, projects, handleSaveProjects, showToast]);
  
  const handleCreateProject = () => {
    const name = `Proyecto Sin Título ${projects.length + 1}`;
    const newProject: Project = {
        id: `proj_${Date.now()}`,
        name,
        lastModified: Date.now(),
        data: createNewProjectData(t),
    };
    const updatedProjects = [...projects, newProject];
    handleSaveProjects(updatedProjects);
    handleLoadProject(newProject.id);
  };
  
  const handleLoadProject = (projectId: string) => {
    const projectToLoad = projects.find(p => p.id === projectId);
    if (projectToLoad) {
        setAppState('loading');
        setTimeout(() => {
            setActiveProjectId(projectId);
            setProjectData(projectToLoad.data);
            setAppState('editor');
            setSelectedObjectId(null);
        }, 500);
    }
  };

  const handleDeleteProject = (projectId: string) => {
    const updatedProjects = projects.filter(p => p.id !== projectId);
    handleSaveProjects(updatedProjects);
  };
  
  const handleImportProject = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const importedData = JSON.parse(event.target?.result as string);
        if (importedData.scenes && importedData.assets) {
          const newProject: Project = {
            id: `proj_${Date.now()}`,
            name: importedData.name || `Importado_${Date.now()}`,
            lastModified: Date.now(),
            data: importedData.data || importedData, // Handle both project-only and full-project formats
          };
          const updatedProjects = [...projects, newProject];
          handleSaveProjects(updatedProjects);
          showToast("Proyecto importado con éxito");
        } else {
          showToast("Formato de archivo no válido");
        }
      } catch (error) {
        console.error("Error importing project:", error);
        showToast("Error al importar el archivo");
      }
    };
    reader.readAsText(file);
  };

  const handleReturnToStart = () => {
    handleSaveCurrentProject();
    setActiveProjectId(null);
    setProjectData(null);
    setAppState('start');
  };
  
  const updateProjectData = useCallback((updates: Partial<ProjectData>) => {
      setProjectData(prev => prev ? { ...prev, ...updates } : null);
  }, []);
  
  const activeScene = projectData?.scenes.find(s => s.id === projectData.activeSceneId);

  const handleUpdateObject = useCallback((id: number, updates: Partial<GameObject>) => {
    updateProjectData({
        scenes: projectData?.scenes.map(scene => 
            scene.id === projectData.activeSceneId 
            ? { ...scene, gameObjects: scene.gameObjects.map(obj => obj.id === id ? { ...obj, ...updates } : obj) }
            : scene
        )
    });
  }, [projectData?.activeSceneId, projectData?.scenes, updateProjectData]);
  
  const handleAddObject = useCallback((initialProps?: Partial<GameObject>) => {
      if (!activeScene) return;
      const newObject: GameObject = {
          id: Date.now(),
          name: `Objeto_${activeScene.gameObjects.length + 1}`,
          x: 200, y: 200, width: 50, height: 50,
          color: '#eab308', zIndex: 1,
          ...initialProps
      };
      const updatedObjects = [...activeScene.gameObjects, newObject];
      const updatedScene = { ...activeScene, gameObjects: updatedObjects };
       updateProjectData({
            scenes: projectData?.scenes.map(s => s.id === projectData.activeSceneId ? updatedScene : s)
       });
       setSelectedObjectId(newObject.id);
  }, [activeScene, projectData?.activeSceneId, projectData?.scenes, updateProjectData]);
  
  const handleDeleteObject = useCallback((id: number) => {
      if (!activeScene) return;
      const updatedObjects = activeScene.gameObjects.filter(obj => obj.id !== id);
      const updatedScene = { ...activeScene, gameObjects: updatedObjects };
       updateProjectData({
            scenes: projectData?.scenes.map(s => s.id === projectData.activeSceneId ? updatedScene : s)
       });
       setSelectedObjectId(null);
  }, [activeScene, projectData?.activeSceneId, projectData?.scenes, updateProjectData]);

  const handleCloneObject = (id: number) => {
    if (!activeScene) return;
    const objectToClone = activeScene.gameObjects.find(o => o.id === id);
    if (!objectToClone) return;
    const newObject = {
        ...objectToClone,
        id: Date.now(),
        name: `${objectToClone.name}_Copia`,
        x: objectToClone.x + 20,
        y: objectToClone.y + 20,
    };
    handleAddObject(newObject);
  };
  
  const handleAddAsset = useCallback((asset: GameAsset) => {
      updateProjectData({ assets: [...(projectData?.assets ?? []), asset] });
  }, [projectData?.assets, updateProjectData]);

  const handleUpdateAsset = useCallback((asset: GameAsset) => {
      updateProjectData({ assets: (projectData?.assets ?? []).map(a => a.id === asset.id ? asset : a) });
  }, [projectData?.assets, updateProjectData]);

  const handleOpenSpriteEditor = (assetId: string | null) => {
      setEditingSpriteAssetId(assetId);
      setShowSpriteEditor(true);
  };
  
  const handleSaveSprite = (asset: GameAsset) => {
    const existing = projectData?.assets.find(a => a.id === asset.id);
    if (existing) {
        handleUpdateAsset(asset);
    } else {
        handleAddAsset(asset);
    }
    setShowSpriteEditor(false);
  };

  useEffect(() => {
      if (appState === 'editor') {
          handleSaveCurrentProject();
      }
  }, [projectData, appState, handleSaveCurrentProject]);

  if (appState === 'loading') return <SplashScreen />;
  if (appState === 'start') {
      return (
          <>
            {!noticeAccepted && <NoticeModal onAccept={() => { localStorage.setItem(NOTICE_ACCEPTED_KEY, 'true'); setNoticeAccepted(true); }} />}
            <StartScreen projects={projects} onLoadProject={handleLoadProject} onCreateProject={handleCreateProject} onDeleteProject={handleDeleteProject} />
          </>
      );
  }
  
  const selectedObject = activeScene?.gameObjects.find(obj => obj.id === selectedObjectId) || null;
  const editingSpriteAsset = projectData?.assets.find(a => a.id === editingSpriteAssetId) || null;

  const handleGoToScene = (sceneName: string) => {
      const scene = projectData?.scenes.find(s => s.name === sceneName);
      if (scene) {
          updateProjectData({ activeSceneId: scene.id });
          setAppState('editor');
      }
  };

  const handleExitPlay = (finalState: GameState) => {
    // We don't save the state on exit to ensure next run starts fresh from editor state
    setAppState('editor');
  };


  if (appState === 'playing') {
    return activeScene ? (
        <GameView 
            scene={activeScene}
            allScenes={projectData?.scenes ?? []}
            animations={projectData?.animations ?? []}
            assets={projectData?.assets ?? []}
            globalVariables={projectData?.globalVariables ?? []}
            gameWidth={projectData?.gameWidth ?? 1024}
            gameHeight={projectData?.gameHeight ?? 768}
            responsive={projectData?.responsive}
            joystick={projectData?.joystick}
            onExit={handleExitPlay}
            onGoToScene={handleGoToScene}
        />
    ) : null;
  }

  return (
    <div className="flex flex-col h-screen bg-black text-white font-sans">
        <Header 
            onSave={() => handleSaveCurrentProject(true)}
            isPlaying={false}
            onTogglePlay={() => setAppState('playing')}
            onExport={() => {
                setExportModalInitialShowCode(false);
                setShowExportModal(true);
            }}
            onViewCode={() => {
                setExportModalInitialShowCode(true);
                setShowExportModal(true);
            }}
            onReturnToStart={handleReturnToStart}
            onImportProject={handleImportProject}
            projectName={projects.find(p => p.id === activeProjectId)?.name ?? 'Sin Título'}
            onUpdateProjectName={(newName) => {
                const updatedProjects = projects.map(p => p.id === activeProjectId ? { ...p, name: newName } : p);
                setProjects(updatedProjects); // Local state update for responsiveness
            }}
        />
        <main className={`flex-grow flex h-full overflow-hidden md:flex-row flex-col relative ${isResizingHierarchy || isResizingInspector ? 'cursor-col-resize' : ''}`}>
            <div className={`${activeMobilePanel === 'hierarchy' ? 'flex' : 'hidden'} md:flex h-full absolute inset-0 z-40 md:relative md:inset-auto bg-gray-900 overflow-hidden`}>
                <motion.div 
                    className="w-full h-full flex flex-col"
                    initial={isMobile ? { y: '100%' } : false}
                    animate={isMobile ? (activeMobilePanel === 'hierarchy' ? { y: 0 } : { y: '100%' }) : { y: 0 }}
                    transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                    drag={isMobile ? "y" : false}
                    dragConstraints={{ top: 0 }}
                    dragElastic={0.2}
                    onDragEnd={(_e, info) => {
                        if (info.offset.y > 100) setActiveMobilePanel('editor');
                    }}
                >
                    <div className="md:hidden w-full h-8 flex items-center justify-center shrink-0 cursor-row-resize touch-none">
                        <div className="w-12 h-1.5 bg-gray-700 rounded-full" />
                    </div>
                    <SceneHierarchy 
                        scenes={projectData?.scenes ?? []}
                        activeSceneId={projectData?.activeSceneId ?? null}
                        onSelectScene={(id) => updateProjectData({ activeSceneId: id })}
                        onAddScene={() => {
                            const newScene = createNewScene(`Escena ${projectData!.scenes.length + 1}`);
                            updateProjectData({ scenes: [...projectData!.scenes, newScene], activeSceneId: newScene.id });
                        }}
                        onCloneScene={(id) => {
                            const sceneToClone = projectData?.scenes.find(s => s.id === id);
                            if(sceneToClone) {
                                const newScene = {
                                    ...JSON.parse(JSON.stringify(sceneToClone)),
                                    id: `scene_${Date.now()}`,
                                    name: `${sceneToClone.name} Copia`
                                };
                                updateProjectData({ scenes: [...projectData!.scenes, newScene], activeSceneId: newScene.id });
                            }
                        }}
                        objects={activeScene?.gameObjects ?? []}
                        selectedId={selectedObjectId}
                        onSelect={setSelectedObjectId}
                        onUpdateObject={handleUpdateObject}
                        assets={projectData?.assets ?? []}
                        onAddAsset={handleAddAsset}
                        onUpdateAsset={handleUpdateAsset}
                        onOpenAnimationEditor={() => setShowAnimationEditor(true)}
                        onOpenSpriteEditor={handleOpenSpriteEditor}
                        onOpenAudioLab={() => setShowAudioLab(true)}
                        onOpenSoundtrackEditor={() => setShowSoundtrackEditor(true)}
                        width={isHierarchyCollapsed ? 40 : hierarchyWidth}
                        onToggleCollapse={() => setIsHierarchyCollapsed(!isHierarchyCollapsed)}
                    />
                </motion.div>
            </div>
            {/* Hierarchy Resizer */}
            {!isMobile && !isHierarchyCollapsed && (
                <div 
                    className={`w-1 bg-gray-800 hover:bg-indigo-500 cursor-col-resize transition-colors shrink-0 z-10 ${isResizingHierarchy ? 'bg-indigo-500' : ''}`}
                    onMouseDown={startResizingHierarchy}
                />
            )}
            <div className={`flex-grow flex-col relative ${activeMobilePanel === 'editor' ? 'flex' : 'hidden'} md:flex`} id="editor-area">
                <SceneEditor
                    scene={activeScene}
                    objects={activeScene?.gameObjects ?? []}
                    selectedId={selectedObjectId}
                    onSelect={setSelectedObjectId}
                    onUpdateObject={handleUpdateObject}
                    onAddObject={handleAddObject}
                    onOpenEventEditor={() => setShowEventEditor(true)}
                    gameWidth={projectData?.gameWidth ?? 1024}
                    gameHeight={projectData?.gameHeight ?? 768}
                />
            </div>
            {/* Inspector Resizer */}
            {!isMobile && !isInspectorCollapsed && (
                <div 
                    className={`w-1 bg-gray-800 hover:bg-indigo-500 cursor-col-resize transition-colors shrink-0 z-10 ${isResizingInspector ? 'bg-indigo-500' : ''}`}
                    onMouseDown={startResizingInspector}
                />
            )}
            <div className={`${activeMobilePanel === 'inspector' ? 'flex' : 'hidden'} md:flex absolute inset-0 z-40 md:relative md:inset-auto bg-gray-900 overflow-hidden`}>
                <motion.div 
                    className="w-full h-full flex flex-col"
                    initial={isMobile ? { y: '100%' } : false}
                    animate={isMobile ? (activeMobilePanel === 'inspector' ? { y: 0 } : { y: '100%' }) : { y: 0 }}
                    transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                    drag={isMobile ? "y" : false}
                    dragConstraints={{ top: 0 }}
                    dragElastic={0.2}
                    onDragEnd={(_e, info) => {
                        if (info.offset.y > 100) setActiveMobilePanel('editor');
                    }}
                >
                    <div className="md:hidden w-full h-8 flex items-center justify-center shrink-0 cursor-row-resize touch-none">
                        <div className="w-12 h-1.5 bg-gray-700 rounded-full" />
                    </div>
                    <PropertiesInspector 
                        selectedObject={selectedObject}
                        projectData={projectData!}
                        onUpdateProjectData={updateProjectData}
                        onUpdateObject={handleUpdateObject}
                        onDeleteObject={handleDeleteObject}
                        onCloneObject={handleCloneObject}
                        onAddAsset={handleAddAsset}
                        width={isInspectorCollapsed ? 40 : inspectorWidth}
                        onToggleCollapse={() => setIsInspectorCollapsed(!isInspectorCollapsed)}
                    />
                </motion.div>
            </div>

            {/* Mobile Navigation Bar */}
            <div className="md:hidden flex bg-gray-900 border-t border-gray-800 h-16 shrink-0 z-50">
                <button 
                    onClick={() => setActiveMobilePanel('hierarchy')}
                    className={`flex-1 flex flex-col items-center justify-center gap-1 ${activeMobilePanel === 'hierarchy' ? 'text-indigo-400 bg-gray-800' : 'text-gray-400'}`}
                >
                    <HierarchyIcon />
                    <span className="text-[10px] uppercase font-bold">{t('editor.mobile.hierarchy')}</span>
                </button>
                <button 
                    onClick={() => setActiveMobilePanel('editor')}
                    className={`flex-1 flex flex-col items-center justify-center gap-1 ${activeMobilePanel === 'editor' ? 'text-indigo-400 bg-gray-800' : 'text-gray-400'}`}
                >
                    <EditorIcon />
                    <span className="text-[10px] uppercase font-bold">{t('editor.mobile.editor')}</span>
                </button>
                <button 
                    onClick={() => setActiveMobilePanel('inspector')}
                    className={`flex-1 flex flex-col items-center justify-center gap-1 ${activeMobilePanel === 'inspector' ? 'text-indigo-400 bg-gray-800' : 'text-gray-400'}`}
                >
                    <InspectorIcon />
                    <span className="text-[10px] uppercase font-bold">{t('editor.mobile.inspector')}</span>
                </button>
            </div>
        </main>
        
        {showExportModal && <ExportModal 
            onClose={() => setShowExportModal(false)} 
            projectData={projectData} 
            initialShowCode={exportModalInitialShowCode}
        />}
        {showEventEditor && <EventEditor 
            onClose={() => setShowEventEditor(false)}
            scene={activeScene}
            allScenes={projectData?.scenes ?? []}
            animations={projectData?.animations ?? []}
            assets={projectData?.assets ?? []}
            globalVariables={projectData?.globalVariables ?? []}
            onAddEvent={(event) => {
                if(!activeScene) return;
                const updatedScene = {...activeScene, events: [...activeScene.events, event]};
                updateProjectData({ scenes: projectData!.scenes.map(s => s.id === activeScene.id ? updatedScene : s)});
            }}
            onDeleteEvent={(eventId) => {
                 if(!activeScene) return;
                const updatedScene = {...activeScene, events: activeScene.events.filter(e => e.id !== eventId)};
                updateProjectData({ scenes: projectData!.scenes.map(s => s.id === activeScene.id ? updatedScene : s)});
            }}
            onUpdateEvent={(event) => {
                if(!activeScene) return;
                const updatedScene = {...activeScene, events: activeScene.events.map(e => e.id === event.id ? event : e)};
                updateProjectData({ scenes: projectData!.scenes.map(s => s.id === activeScene.id ? updatedScene : s)});
            }}
        />}
        {showAnimationEditor && <AnimationEditor
            onClose={() => setShowAnimationEditor(false)}
            animations={projectData?.animations ?? []}
            assets={projectData?.assets ?? []}
            onSave={(animations) => updateProjectData({ animations })}
        />}
        {showSpriteEditor && <SpriteEditor 
            assetToEdit={editingSpriteAsset}
            onSave={handleSaveSprite}
            onClose={() => setShowSpriteEditor(false)}
        />}
        {showAudioLab && <AudioLab
            onClose={() => setShowAudioLab(false)}
            onAddAsset={handleAddAsset}
        />}
        {showSoundtrackEditor && <SoundtrackEditor
            onClose={() => setShowSoundtrackEditor(false)}
            onAddAsset={handleAddAsset}
        />}
        <Toast message={toast.message} show={toast.show} />
    </div>
  );
};

export default App;