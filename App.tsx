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


const PROJECTS_STORAGE_KEY = 'return2d-projects';
const NOTICE_ACCEPTED_KEY = 'return2d-notice-accepted';

const NoticeModal: React.FC<{ onAccept: () => void }> = ({ onAccept }) => (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4">
        <div className="bg-gray-900 rounded-lg shadow-2xl border border-gray-800 w-full max-w-md p-6 text-center">
            <h2 className="text-xl font-bold mb-4 text-yellow-400">Aviso Importante</h2>
            <p className="text-gray-300 mb-6">
                Este programa es un prototipo y tiene algunos errores que se mejorarán en el futuro. Si encuentras uno, por favor, ¡ponlo en los comentarios! Gracias por tu ayuda.
            </p>
            <button
                onClick={onAccept}
                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-md transition-colors text-white font-semibold"
            >
                Aceptar
            </button>
        </div>
    </div>
);


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

const createNewProjectData = (): ProjectData => {
    const starterScene = createNewScene('Escena de Inicio');
    
    starterScene.gameObjects = [
      { id: 1, name: 'Player', x: 100, y: 450, width: 30, height: 50, color: '#3b82f6', zIndex: 10, behaviors: [{ name: 'PlatformerCharacter', properties: { speed: 150, jumpForce: 350, gravity: 500 } }, { name: 'FollowCamera', properties: {} }], variables: [], direction: 'right', rotation: 0, scaleX: 1, scaleY: 1, stats: { hp: 100, maxHp: 100, attack: 10} },
      { id: 2, name: 'Ground', x: 0, y: 500, width: 1024, height: 50, color: '#4b5563', zIndex: 1, behaviors: [{ name: 'Solid', properties: {} }] },
      { id: 3, name: 'ScoreText', isUI: true, x: 10, y: 10, width: 200, height: 30, color: 'transparent', zIndex: 1000, text: 'Score: {score}' },
    ];
    return {
        scenes: [starterScene],
        activeSceneId: starterScene.id,
        assets: [],
        animations: [],
        globalVariables: [{name: 'score', value: 0}],
        orientation: 'landscape',
        gameWidth: 1024,
        gameHeight: 768,
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
  const [appState, setAppState] = useState<AppState>('loading');
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectData, setProjectData] = useState<ProjectData | null>(null);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [noticeAccepted, setNoticeAccepted] = useState(true);
  const [toast, setToast] = useState<{ message: string; show: boolean }>({ message: '', show: false });

  const [selectedObjectId, setSelectedObjectId] = useState<number | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);
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

  const debounceTimeout = useRef<number | null>(null);

  useEffect(() => {
    try {
        const storedProjects = localStorage.getItem(PROJECTS_STORAGE_KEY);
        if (storedProjects) {
            setProjects(JSON.parse(storedProjects));
        }
        const notice = localStorage.getItem(NOTICE_ACCEPTED_KEY);
        setNoticeAccepted(notice === 'true');
    } catch (error) {
        console.error("Error loading from localStorage:", error);
    }
    setTimeout(() => setAppState('start'), 1000);
  }, []);

  const showToast = useCallback((message: string) => {
    setToast({ message, show: true });
    setTimeout(() => setToast({ message: '', show: false }), 3000);
  }, []);
  
  const handleSaveProjects = useCallback((updatedProjects: Project[]) => {
      try {
          localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(updatedProjects));
          setProjects(updatedProjects);
      } catch (error) {
          console.error("Error saving projects to localStorage:", error);
      }
  }, []);
  
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
        data: createNewProjectData(),
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
            onExport={() => setShowExportModal(true)}
            onReturnToStart={handleReturnToStart}
            projectName={projects.find(p => p.id === activeProjectId)?.name ?? 'Sin Título'}
            onUpdateProjectName={(newName) => {
                const updatedProjects = projects.map(p => p.id === activeProjectId ? { ...p, name: newName } : p);
                setProjects(updatedProjects); // Local state update for responsiveness
            }}
        />
        <main className="flex-grow flex h-full overflow-hidden md:flex-row flex-col">
            <div className={`${activeMobilePanel === 'hierarchy' ? 'flex' : 'hidden'} md:flex`}>
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
            </div>
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
            <div className={`${activeMobilePanel === 'inspector' ? 'flex' : 'hidden'} md:flex`}>
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
            </div>
        </main>
        
        <div className="md:hidden flex bg-black border-t border-gray-800">
            <button onClick={() => setActiveMobilePanel('hierarchy')} className={`flex-1 p-2 flex flex-col items-center ${activeMobilePanel === 'hierarchy' ? 'text-indigo-400' : ''}`}><HierarchyIcon/> <span className="text-xs">Jerarquía</span></button>
            <button onClick={() => setActiveMobilePanel('editor')} className={`flex-1 p-2 flex flex-col items-center ${activeMobilePanel === 'editor' ? 'text-indigo-400' : ''}`}><EditorIcon/> <span className="text-xs">Editor</span></button>
            <button onClick={() => setActiveMobilePanel('inspector')} className={`flex-1 p-2 flex flex-col items-center ${activeMobilePanel === 'inspector' ? 'text-indigo-400' : ''}`}><InspectorIcon/> <span className="text-xs">Inspector</span></button>
        </div>

        {showExportModal && <ExportModal onClose={() => setShowExportModal(false)} projectData={projectData} />}
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