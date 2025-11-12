import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { Project, ProjectData, GameObject, Scene, GameAsset, Animation, Variable, CollisionProperties } from './types';

import SplashScreen from './components/SplashScreen';
import ProjectLoadingScreen from './components/ProjectLoadingScreen';
import StartScreen from './components/StartScreen';
import Header from './components/Header';
import SceneHierarchy from './components/SceneHierarchy';
import SceneEditor from './components/SceneEditor';
import PropertiesInspector from './components/PropertiesInspector';
import GameView from './components/GameView';
// FIX: Changed to named import as ExportModal is not a default export.
import { ExportModal } from './components/ExportModal';
import EventEditor from './components/EventEditor';
import AnimationEditor from './components/AnimationEditor';
// FIX: Changed to named import as SpriteEditor is not a default export.
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
      { id: 1, name: 'Player', x: 100, y: 450, width: 30, height: 50, color: '#3b82f6', zIndex: 10, behaviors: [{ name: 'PlatformerCharacter', properties: { speed: 150, jumpForce: 350, gravity: 500 } }], variables: [], direction: 'right', rotation: 0, scaleX: 1, scaleY: 1, stats: { hp: 100, maxHp: 100, attack: 10} },
      { id: 2, name: 'Ground', x: 50, y: 500, width: 600, height: 30, color: '#16a34a', zIndex: 1, behaviors: [{ name: 'Solid', properties: {} }], variables: [], direction: 'right', rotation: 0, scaleX: 1, scaleY: 1 }
    ];
    
    return {
        scenes: [starterScene],
        activeSceneId: starterScene.id,
        assets: [],
        animations: [],
        globalVariables: [{ name: 'score', value: 0 }],
        orientation: 'landscape',
        gameWidth: 1024,
        gameHeight: 768,
        joystick: { enabled: false, position: 'left', size: 120, opacity: 0.5 },
    };
};

const App: React.FC = () => {
    const [isLoading, setIsLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    const [projects, setProjects] = useState<Project[]>([]);
    const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
    const [activeProjectData, setActiveProjectData] = useState<ProjectData | null>(null);
    const [selectedObjectId, setSelectedObjectId] = useState<number | null>(null);
    const [showNotice, setShowNotice] = useState(false);
    
    // Editor view states
    const [isPlaying, setIsPlaying] = useState(false);
    const [showExportModal, setShowExportModal] = useState(false);
    const [showEventEditor, setShowEventEditor] = useState(false);
    const [showAnimationEditor, setShowAnimationEditor] = useState(false);
    const [showSpriteEditor, setShowSpriteEditor] = useState<{asset: GameAsset | null} | null>(null);
    const [showAudioLab, setShowAudioLab] = useState(false);
    const [showSoundtrackEditor, setShowSoundtrackEditor] = useState(false);
    
    const [leftPanelWidth, setLeftPanelWidth] = useState(280);
    const [rightPanelWidth, setRightPanelWidth] = useState(320);
    
    const [toast, setToast] = useState({ show: false, message: '' });

    const [mobileTab, setMobileTab] = useState<'hierarchy' | 'editor' | 'inspector'>('editor');
    const prevProjectIdRef = useRef<string | null>(null);

    // Load projects from localStorage on initial mount
    useEffect(() => {
        const noticeAccepted = localStorage.getItem(NOTICE_ACCEPTED_KEY);
        if (noticeAccepted !== 'true') {
            setShowNotice(true);
        }

        // Simulate loading assets, parsing data, etc. for a better UX
        const timer = setTimeout(() => {
            try {
                const savedProjects = localStorage.getItem(PROJECTS_STORAGE_KEY);
                if (savedProjects) {
                    setProjects(JSON.parse(savedProjects));
                }
            } catch (error) {
                console.error("Failed to load projects from localStorage", error);
            }
            setIsLoading(false);
        }, 1500); // Show splash screen for 1.5s

        return () => clearTimeout(timer); // Cleanup timer on unmount
    }, []);

    // Save projects to localStorage whenever the projects array changes
    useEffect(() => {
        if (!isLoading) {
            try {
                localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(projects));
            } catch (error) {
                console.error("Failed to save projects to localStorage", error);
            }
        }
    }, [projects, isLoading]);
    
    // Set active project data when active project ID changes or projects array is updated
    useEffect(() => {
        if (activeProjectId) {
            const project = projects.find(p => p.id === activeProjectId);
            if (project) {
                setActiveProjectData(JSON.parse(JSON.stringify(project.data)));
                // Only reset selection if the project ID has actually changed
                if (prevProjectIdRef.current !== activeProjectId) {
                    setSelectedObjectId(null);
                }
            }
        } else {
            setActiveProjectData(null);
        }
        // Update the ref for the next render
        prevProjectIdRef.current = activeProjectId;
    }, [activeProjectId, projects]);
    
    const handleAcceptNotice = () => {
        localStorage.setItem(NOTICE_ACCEPTED_KEY, 'true');
        setShowNotice(false);
    };

    const showToastMessage = (message: string) => {
      setToast({ show: true, message });
      setTimeout(() => setToast({ show: false, message: '' }), 3000);
    };

    const handleUpdateProjectData = (newData: ProjectData, save: boolean = false) => {
        setActiveProjectData(newData);
        if (save) {
            setProjects(currentProjects =>
                currentProjects.map(p =>
                    p.id === activeProjectId ? { ...p, data: newData, lastModified: Date.now() } : p
                )
            );
        }
    };
    
    // Project Management Handlers
    const handleCreateProject = (name: string) => {
        setIsCreating(true); // Show loading screen

        // Simulate project creation delay for a better UX
        setTimeout(() => {
            const newProject: Project = {
                id: `proj_${Date.now()}`,
                name,
                lastModified: Date.now(),
                data: createNewProjectData(),
            };
            setProjects(prev => [...prev, newProject]);
            setActiveProjectId(newProject.id);
            setIsCreating(false); // Hide loading screen and show editor
        }, 1500);
    };
    const handleLoadProject = (projectId: string) => setActiveProjectId(projectId);
    const handleDeleteProject = (projectId: string) => setProjects(prev => prev.filter(p => p.id !== projectId));
    const handleReturnToStart = () => setActiveProjectId(null);
    const handleSaveProject = () => {
        if (!activeProjectData) return;
        setProjects(currentProjects =>
            currentProjects.map(p =>
                p.id === activeProjectId ? { ...p, data: activeProjectData, lastModified: Date.now() } : p
            )
        );
        showToastMessage("Proyecto Guardado!");
    };

    // Editor Handlers
    const handleUpdateObjectName = (newName: string) => {
        if (!activeProjectData) return;
        setProjects(currentProjects =>
            currentProjects.map(p =>
                p.id === activeProjectId ? { ...p, name: newName, lastModified: Date.now() } : p
            )
        );
    };

    const handleUpdateObject = (id: number, updates: Partial<GameObject>) => {
        if (!activeProjectData) return;
        const newScenes = activeProjectData.scenes.map(scene => ({
            ...scene,
            gameObjects: scene.gameObjects.map(obj => obj.id === id ? { ...obj, ...updates } : obj)
        }));
        handleUpdateProjectData({ ...activeProjectData, scenes: newScenes }, true);
    };

    const handleSelectObject = (id: number | null) => setSelectedObjectId(id);

    const activeScene = activeProjectData?.scenes.find(s => s.id === activeProjectData.activeSceneId);

    const handleAddObject = (initialProps?: Partial<GameObject>) => {
        if (!activeProjectData || !activeScene) return;
        const newId = Date.now();
        const newObject: GameObject = {
            id: newId,
            name: `Objeto_${newId}`,
            x: 100, y: 100, width: 50, height: 50, color: '#8b5cf6', zIndex: 1,
            stats: { hp: 100, maxHp: 100, attack: 10 },
            ...initialProps
        };
        const newScenes = activeProjectData.scenes.map(s => s.id === activeScene.id ? {...s, gameObjects: [...s.gameObjects, newObject] } : s);
        handleUpdateProjectData({ ...activeProjectData, scenes: newScenes }, true);
        setSelectedObjectId(newId);
    };
    
    const handleDeleteObject = (id: number) => {
        if (!activeProjectData) return;
        const newScenes = activeProjectData.scenes.map(scene => ({
            ...scene,
            gameObjects: scene.gameObjects.filter(obj => obj.id !== id)
        }));
        handleUpdateProjectData({ ...activeProjectData, scenes: newScenes }, true);
        setSelectedObjectId(null);
    };
    
    const handleCloneObject = (id: number) => {
        if (!activeProjectData || !activeScene) return;
        const objectToClone = activeScene.gameObjects.find(o => o.id === id);
        if (!objectToClone) return;
        const newId = Date.now();
        const newObject = { ...JSON.parse(JSON.stringify(objectToClone)), id: newId, name: `${objectToClone.name}_copia`, x: objectToClone.x + 20, y: objectToClone.y + 20 };
        const newScenes = activeProjectData.scenes.map(s => s.id === activeScene.id ? {...s, gameObjects: [...s.gameObjects, newObject] } : s);
        handleUpdateProjectData({ ...activeProjectData, scenes: newScenes }, true);
        setSelectedObjectId(newId);
    };
    
    const handleAddAsset = (asset: GameAsset) => {
      if (!activeProjectData) return;
      const newAssets = [...activeProjectData.assets, asset];
      handleUpdateProjectData({ ...activeProjectData, assets: newAssets }, true);
    };

    const handleSaveSprite = (asset: GameAsset) => {
        if (!activeProjectData) return;
        const existing = activeProjectData.assets.find(a => a.id === asset.id);
        const newAssets = existing 
            ? activeProjectData.assets.map(a => a.id === asset.id ? asset : a)
            : [...activeProjectData.assets, asset];
        handleUpdateProjectData({ ...activeProjectData, assets: newAssets }, true);
        setShowSpriteEditor(null);
    };
    
    const MobileTabButton: React.FC<{
        tab: 'hierarchy' | 'editor' | 'inspector';
        label: string;
        icon: React.ReactNode;
    }> = ({ tab, label, icon }) => (
        <button
            onClick={() => setMobileTab(tab)}
            className={`flex flex-col items-center justify-center p-1 w-24 rounded-md transition-colors ${
                mobileTab === tab ? 'text-indigo-400 bg-gray-800' : 'text-gray-400'
            }`}
        >
            {icon}
            <span className="text-xs mt-1">{label}</span>
        </button>
    );

    if (isLoading) return <SplashScreen />;

    if (isCreating) return <ProjectLoadingScreen message="Creando tu nuevo proyecto..." />;

    if (!activeProjectData || !activeProjectId) {
        return <StartScreen projects={projects} onLoadProject={handleLoadProject} onCreateProject={handleCreateProject} onDeleteProject={handleDeleteProject} />;
    }

    const selectedObject = activeScene?.gameObjects.find(o => o.id === selectedObjectId) || null;
    
    return (
        <div className="flex flex-col h-screen bg-gray-950 text-white font-sans">
            {showNotice && <NoticeModal onAccept={handleAcceptNotice} />}
            <Header
                projectName={projects.find(p=>p.id === activeProjectId)?.name || 'Sin Título'}
                onUpdateProjectName={handleUpdateObjectName}
                onSave={handleSaveProject}
                isPlaying={isPlaying}
                onTogglePlay={() => setIsPlaying(!isPlaying)}
                onExport={() => setShowExportModal(true)}
                onReturnToStart={handleReturnToStart}
            />
            <main className="flex-grow flex flex-col md:flex-row overflow-hidden">
                <div className={`${mobileTab === 'hierarchy' ? 'flex' : 'hidden'} md:flex w-full h-full md:w-auto md:h-auto`}>
                    <SceneHierarchy
                        width={leftPanelWidth}
                        onToggleCollapse={() => setLeftPanelWidth(w => w > 0 ? 0 : 280)}
                        scenes={activeProjectData.scenes}
                        activeSceneId={activeProjectData.activeSceneId}
                        onSelectScene={id => handleUpdateProjectData({...activeProjectData, activeSceneId: id}, true)}
                        onAddScene={() => {
                            const newScene = createNewScene(`Escena ${activeProjectData.scenes.length + 1}`);
                            handleUpdateProjectData({...activeProjectData, scenes: [...activeProjectData.scenes, newScene], activeSceneId: newScene.id }, true);
                        }}
                        onCloneScene={(id) => {
                            const sceneToClone = activeProjectData.scenes.find(s=>s.id === id);
                            if (!sceneToClone) return;
                            const newScene = JSON.parse(JSON.stringify(sceneToClone));
                            newScene.id = `scene_${Date.now()}`;
                            newScene.name = `${sceneToClone.name} Copia`;
                            handleUpdateProjectData({...activeProjectData, scenes: [...activeProjectData.scenes, newScene], activeSceneId: newScene.id}, true);
                        }}
                        objects={activeScene?.gameObjects || []}
                        selectedId={selectedObjectId}
                        onSelect={handleSelectObject}
                        onUpdateObject={handleUpdateObject}
                        assets={activeProjectData.assets}
                        onAddAsset={handleAddAsset}
                        onUpdateAsset={(asset) => {}}
                        onOpenAnimationEditor={() => setShowAnimationEditor(true)}
                        onOpenSpriteEditor={(assetId) => setShowSpriteEditor({asset: activeProjectData.assets.find(a=>a.id === assetId) || null})}
                        onOpenAudioLab={() => setShowAudioLab(true)}
                        onOpenSoundtrackEditor={() => setShowSoundtrackEditor(true)}
                    />
                </div>
                <div className={`${mobileTab === 'editor' ? 'flex' : 'hidden'} md:flex flex-grow w-full h-full`}>
                    <SceneEditor
                        scene={activeScene}
                        objects={activeScene?.gameObjects || []}
                        selectedId={selectedObjectId}
                        onSelect={handleSelectObject}
                        onUpdateObject={handleUpdateObject}
                        onAddObject={handleAddObject}
                        onOpenEventEditor={() => setShowEventEditor(true)}
                        gameWidth={activeProjectData.gameWidth || 1024}
                        gameHeight={activeProjectData.gameHeight || 768}
                    />
                </div>
                 <div className={`${mobileTab === 'inspector' ? 'flex' : 'hidden'} md:flex w-full h-full md:w-auto md:h-auto`}>
                    <PropertiesInspector
                        width={rightPanelWidth}
                        onToggleCollapse={() => setRightPanelWidth(w => w > 0 ? 0 : 320)}
                        selectedObject={selectedObject}
                        projectData={activeProjectData}
                        onUpdateProjectData={(updates) => handleUpdateProjectData({...activeProjectData, ...updates}, true)}
                        onUpdateObject={handleUpdateObject}
                        onDeleteObject={handleDeleteObject}
                        onCloneObject={handleCloneObject}
                        onAddAsset={handleAddAsset}
                    />
                </div>
            </main>
            
            <div className="md:hidden flex justify-around p-2 bg-black border-t border-gray-800 shrink-0">
                <MobileTabButton tab="hierarchy" label="Jerarquía" icon={<HierarchyIcon />} />
                <MobileTabButton tab="editor" label="Editor" icon={<EditorIcon />} />
                <MobileTabButton tab="inspector" label="Propiedades" icon={<InspectorIcon />} />
            </div>


            {isPlaying && activeScene && (
                <GameView
                    scene={activeScene}
                    allScenes={activeProjectData.scenes}
                    animations={activeProjectData.animations}
                    assets={activeProjectData.assets}
                    globalVariables={activeProjectData.globalVariables || []}
                    gameWidth={activeProjectData.gameWidth || 1024}
                    gameHeight={activeProjectData.gameHeight || 768}
                    joystick={activeProjectData.joystick}
                    onExit={() => setIsPlaying(false)}
                    onGoToScene={(sceneName) => {
                        const nextScene = activeProjectData.scenes.find(s => s.name === sceneName);
                        if (nextScene) {
                            handleUpdateProjectData({...activeProjectData, activeSceneId: nextScene.id});
                        }
                    }}
                />
            )}
            
            {showExportModal && <ExportModal onClose={() => setShowExportModal(false)} projectData={activeProjectData} />}
            
            {showEventEditor && activeScene && <EventEditor 
                onClose={() => setShowEventEditor(false)}
                scene={activeScene}
                allScenes={activeProjectData.scenes}
                animations={activeProjectData.animations}
                assets={activeProjectData.assets}
                globalVariables={activeProjectData.globalVariables || []}
                onAddEvent={(event) => {
                    const newScenes = activeProjectData.scenes.map(s => s.id === activeScene.id ? {...s, events: [...s.events, event]} : s);
                    handleUpdateProjectData({...activeProjectData, scenes: newScenes }, true);
                }}
                onUpdateEvent={(event) => {
                    const newScenes = activeProjectData.scenes.map(s => s.id === activeScene.id ? {...s, events: s.events.map(e => e.id === event.id ? event : e)} : s);
                    handleUpdateProjectData({...activeProjectData, scenes: newScenes }, true);
                }}
                onDeleteEvent={(eventId) => {
                     const newScenes = activeProjectData.scenes.map(s => s.id === activeScene.id ? {...s, events: s.events.filter(e => e.id !== eventId)} : s);
                    handleUpdateProjectData({...activeProjectData, scenes: newScenes }, true);
                }}
            />}

            {showAnimationEditor && <AnimationEditor
                onClose={() => setShowAnimationEditor(false)}
                animations={activeProjectData.animations}
                assets={activeProjectData.assets}
                onSave={(anims) => handleUpdateProjectData({...activeProjectData, animations: anims}, true)}
            />}

            {showSpriteEditor && <SpriteEditor 
                assetToEdit={showSpriteEditor.asset}
                onClose={() => setShowSpriteEditor(null)}
                onSave={handleSaveSprite}
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
