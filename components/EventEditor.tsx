
import React, { useState, useMemo } from 'react';
import type { GameEvent, Condition, Action, Scene, Animation, Variable, GameAsset } from '../types';
import { TrashIcon } from './icons/TrashIcon';
import { GeminiIcon } from './icons/GeminiIcon';
import { generateEventLogic } from '../services/geminiService';
import { EditIcon } from './icons/EditIcon';

interface EventEditorProps {
  onClose: () => void;
  onAddEvent: (event: GameEvent) => void;
  onDeleteEvent: (eventId: string) => void;
  onUpdateEvent: (event: GameEvent) => void;
  scene: Scene | undefined;
  animations: Animation[];
  assets: GameAsset[];
  globalVariables: Variable[];
  allScenes: Scene[];
}

// FIX: Explicitly type categorizedTriggerOptions to avoid type widening of string literals and ensure optional properties are recognized.
const categorizedTriggerOptions: {
    category: string;
    options: {
        value: Condition['trigger'];
        label: string;
        needsParams?: string[];
        needsTarget?: boolean;
    }[];
}[] = [
    { category: 'Núcleo', options: [
        { value: 'OnStart', label: 'Al Iniciar la Escena' },
        { value: 'Always', label: 'Bucle Infinito (Siempre)' },
    ]},
    { category: 'Entrada', options: [
        { value: 'OnKeyPress', label: 'Al Pulsar Tecla', needsParams: ['key'] },
        { value: 'OnAnyKeyPress', label: 'Al Pulsar Cualquier Tecla' },
        { value: 'OnObjectClicked', label: 'Al Hacer Clic en Objeto' },
        { value: 'OnJoystickMove', label: 'Al Mover Joystick (Cualquier dir.)' },
        { value: 'OnJoystickUp', label: 'Al Mover Joystick Hacia Arriba' },
        { value: 'OnJoystickDown', label: 'Al Mover Joystick Hacia Abajo' },
        { value: 'OnJoystickLeft', label: 'Al Mover Joystick a la Izquierda' },
        { value: 'OnJoystickRight', label: 'Al Mover Joystick a la Derecha' },
    ]},
    { category: 'Colisión', options: [
        { value: 'OnCollisionWith', label: 'Al Colisionar Con (Cualquier Lado)', needsTarget: true },
        { value: 'OnVerticalCollision', label: 'En Colisión Vertical', needsTarget: true },
        { value: 'OnHorizontalCollision', label: 'En Colisión Horizontal', needsTarget: true },
    ]},
    { category: 'Estado Objeto', options: [
        { value: 'IsIdle', label: 'Al Estar Quieto' },
        { value: 'IsRunning', label: 'Al Correr' },
        { value: 'IsJumping', label: 'Al Saltar' },
        { value: 'IsOnGround', label: 'Al Estar en el Suelo' },
        { value: 'IsMoving', label: 'Al Moverse' },
        { value: 'OnAttack', label: 'Al Atacar' },
    ]},
    { category: 'Variables y Datos', options: [
        { value: 'CompareVariable', label: 'Comparar Variable Global', needsParams: ['variable', 'operator', 'value']},
        { value: 'CompareObjectVariable', label: 'Comparar Variable de Objeto', needsParams: ['variable', 'operator', 'value']},
        { value: 'CompareStat', label: 'Comparar Estadística (RPG)', needsParams: ['stat', 'operator', 'value']},
    ]},
    { category: 'Tiempo', options: [
        { value: 'OnTimerElapsed', label: 'Al Finalizar Temporizador', needsParams: ['timerName'] },
        { value: 'EveryXSeconds', label: 'Cada X Segundos', needsParams: ['interval'] },
    ]},
    { category: 'Audio', options: [{ value: 'IsMusicPlaying', label: 'Si la Música de Fondo está Sonando' }] },
    { category: 'Red', options: [
        { value: 'OnMatchFound', label: 'Al Encontrar Partida Online' },
        { value: 'OnPlayerJoined', label: 'Cuando un Jugador se Une' },
        { value: 'OnPlayerLeft', label: 'Cuando un Jugador se Va' },
        { value: 'OnReceiveNetworkMessage', label: 'Al Recibir Mensaje de Red', needsParams: ['message'] },
    ] },
];
const triggerOptions = categorizedTriggerOptions.flatMap(c => c.options);

// FIX: Explicitly type categorizedActionOptions to avoid type widening of string literals.
const categorizedActionOptions: {
    category: string;
    options: {
        value: Action['action'];
        label: string;
        needsParams?: string[];
    }[];
}[] = [
    { category: 'Objeto', options: [
        { value: 'Destroy', label: 'Destruir Objeto' },
        { value: 'CreateObject', label: 'Crear Objeto' },
        { value: 'SetObjectPosition', label: 'Establecer Posición', needsParams: ['x', 'y']},
        { value: 'MoveObject', label: 'Mover en una Dirección', needsParams: ['direction', 'speed'] },
        { value: 'OscillateObject', label: 'Oscilar (Movimiento Va y Viene)', needsParams: ['axis', 'distance', 'speed'] },
        { value: 'OscillateScale', label: 'Oscilar Tamaño (Latido)', needsParams: ['distance', 'speed'] },
        { value: 'RotateContinuously', label: 'Rotar Continuamente (Hélice)', needsParams: ['speed'] },
        { value: 'RotateObject', label: 'Rotar (Girar)', needsParams: ['rotation'] },
        { value: 'ScaleObject', label: 'Escalar (Multiplicar Tamaño)', needsParams: ['scaleX', 'scaleY'] },
        { value: 'SetScale', label: 'Establecer Escala (Tamaño Fijo)', needsParams: ['scaleX', 'scaleY'] },
        { value: 'GenerateObjectAt', label: 'Generar Objeto en Posición de Otro', needsParams: ['templateObjectName', 'targetObjectName'] },
        { value: 'ForceJump', label: 'Forzar Salto', needsParams: ['jumpForce'] },
        { value: 'TriggerAttack', label: 'Activar Ataque' },
        { value: 'SetParent', label: 'Unir Objeto a (Establecer Padre)', needsParams: ['parentName'] },
    ]},
    { category: 'Visuales', options: [
        { value: 'PlayAnimation', label: 'Reproducir Animación', needsParams: ['animationId'] },
        { value: 'PlayVideo', label: 'Reproducir Vídeo' },
        { value: 'PauseVideo', label: 'Pausar Vídeo' },
        { value: 'StopVideo', label: 'Detener Vídeo' },
    ]},
    { category: 'Variables y Datos', options: [
        { value: 'AddToVariable', label: 'Añadir a Variable Global', needsParams: ['variable', 'value'] },
        { value: 'SetVariable', label: 'Establecer Variable Global', needsParams: ['variable', 'value'] },
        { value: 'AddToObjectVariable', label: 'Añadir a Variable de Objeto', needsParams: ['variable', 'value'] },
        { value: 'SetObjectVariable', label: 'Establecer Variable de Objeto', needsParams: ['variable', 'value'] },
        { value: 'ModifyStat', label: 'Modificar Estadística (RPG)', needsParams: ['stat', 'operation', 'value'] },
        { value: 'SaveGame', label: 'Guardar Partida', needsParams: ['slot'] },
        { value: 'LoadGame', label: 'Cargar Partida', needsParams: ['slot'] },
    ]},
    { category: 'Escena y Cámara', options: [
        { value: 'GoToScene', label: 'Ir a Escena', needsParams: ['sceneName'] },
        { value: 'SetBackgroundColor', label: 'Establecer Color de Fondo', needsParams: ['color']},
        { value: 'SetCameraZoom', label: 'Establecer Zoom de Cámara', needsParams: ['zoomLevel']},
    ]},
    { category: 'UI y Texto', options: [
        { value: 'SetUIText', label: 'Establecer Texto UI', needsParams: ['text'] },
        { value: 'ShowDialogue', label: 'Mostrar Diálogo (RPG)', needsParams: ['dialogueText'] },
    ]},
    { category: 'Audio', options: [
        { value: 'PlaySound', label: 'Reproducir Sonido (Efecto)', needsParams: ['soundId']},
        { value: 'SetBackgroundMusic', label: 'Establecer Música de Fondo', needsParams: ['soundId']},
        { value: 'PauseBackgroundMusic', label: 'Pausar Música de Fondo' },
        { value: 'ResumeBackgroundMusic', label: 'Reanudar Música de Fondo' },
        { value: 'StopBackgroundMusic', label: 'Detener Música de Fondo' },
        { value: 'SetBackgroundMusicVolume', label: 'Ajustar Volumen Música Fondo', needsParams: ['volume']},
    ]},
    { category: 'Tiempo', options: [
        { value: 'StartTimer', label: 'Iniciar Temporizador', needsParams: ['timerName', 'duration'] },
        { value: 'StopTimer', label: 'Detener Temporizador', needsParams: ['timerName'] },
    ]},
    { category: 'RPG/Avanzado', options: [
        { value: 'SetQuestState', label: 'Establecer Estado de Misión (RPG)', needsParams: ['questId', 'questState'] },
    ]},
    { category: 'Red', options: [
        { value: 'CreateMatch', label: 'Crear Partida Online', needsParams: ['maxPlayers'] },
        { value: 'JoinMatch', label: 'Unirse a Partida Online', needsParams: ['matchId'] },
        { value: 'SendNetworkMessage', label: 'Enviar Mensaje de Red', needsParams: ['message'] },
        { value: 'SetPlayerName', label: 'Establecer Nombre de Jugador', needsParams: ['name'] },
    ]},
];
const actionOptions = categorizedActionOptions.flatMap(c => c.options);

const SelectorModal: React.FC<{
  title: string;
  categorizedItems: { category: string, options: { value: string, label: string }[] }[];
  onSelect: (value: string) => void;
  onClose: () => void;
}> = ({ title, categorizedItems, onSelect, onClose }) => {
    const [activeCategory, setActiveCategory] = useState(categorizedItems[0].category);
    
    return (
        <div className="absolute inset-0 bg-gray-900/80 z-20 flex items-center justify-center" onClick={onClose}>
            <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl h-96 flex flex-col border border-gray-700" onClick={e => e.stopPropagation()}>
                <h4 className="text-md font-bold p-3 text-center border-b border-gray-700 shrink-0">{title}</h4>
                <div className="flex-grow flex min-h-0">
                    <aside className="w-1/3 border-r border-gray-700 p-2 overflow-y-auto">
                        {categorizedItems.map(group => (
                            <button key={group.category} onClick={() => setActiveCategory(group.category)} 
                                className={`w-full text-left text-sm p-2 rounded-md transition-colors ${activeCategory === group.category ? 'bg-indigo-600 text-white' : 'hover:bg-gray-700 text-gray-300'}`}>
                                {group.category}
                            </button>
                        ))}
                    </aside>
                    <main className="w-2/3 p-2 overflow-y-auto">
                        <ul>
                        {(categorizedItems.find(g => g.category === activeCategory)?.options || []).map(option => (
                            <li key={option.value} onClick={() => onSelect(option.value)} 
                                className="p-2 rounded-md hover:bg-indigo-600 cursor-pointer text-gray-200">
                                <h5 className="font-semibold text-sm">{option.label}</h5>
                            </li>
                        ))}
                        </ul>
                    </main>
                </div>
            </div>
        </div>
    );
};

const EventEditor: React.FC<EventEditorProps> = ({ onClose, onAddEvent, onDeleteEvent, onUpdateEvent, scene, animations, assets, globalVariables, allScenes }) => {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [conditions, setConditions] = useState<Partial<Condition>[]>([{}]);
  const [actions, setActions] = useState<Partial<Action>[]>([{}]);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [selectorOpen, setSelectorOpen] = useState<{type: 'condition' | 'action', index: number} | null>(null);
  
  const objectNames = useMemo(() => scene?.gameObjects.map(obj => obj.name) ?? [], [scene]);
  const audioAssets = useMemo(() => assets.filter(a => a.type === 'audio'), [assets]);
  const globalVariableNames = useMemo(() => globalVariables.map(v => v.name), [globalVariables]);
  const sceneNames = useMemo(() => allScenes.map(s => s.name), [allScenes]);

  const handleGenerateWithAI = async () => {
    if (!aiPrompt.trim()) return;

    setIsGenerating(true);
    setGenerationError(null);

    try {
        const result = await generateEventLogic(aiPrompt);
        if (result.events && result.events.length > 0) {
            result.events.forEach(onAddEvent);
            setAiPrompt('');
        } else {
            setGenerationError("La IA no generó ningún evento. Intenta ser más específico.");
        }
    } catch (error) {
        console.error("AI Generation Error:", error);
        setGenerationError(error instanceof Error ? error.message : "Un error desconocido ocurrió.");
    } finally {
        setIsGenerating(false);
    }
  };
  
  const handleEditEvent = (event: GameEvent) => {
    setEditingEventId(event.id);
    // Deep copy to avoid mutating the original state directly
    setConditions(JSON.parse(JSON.stringify(event.conditions)));
    setActions(JSON.parse(JSON.stringify(event.actions)));
    setIsFormOpen(true);
  };
  
  const handleAddNewEventClick = () => {
    setEditingEventId(null);
    setConditions([{}]);
    setActions([{}]);
    setIsFormOpen(true);
  };

  const handleCancel = () => {
    setEditingEventId(null);
    setIsFormOpen(false);
    setConditions([{}]);
    setActions([{}]);
  };

  const handleSaveEvent = () => {
    const finalEventData = {
        conditions: conditions.filter(c => c.object && c.trigger) as Condition[],
        actions: actions.filter(a => a.object && a.action) as Action[],
    };

    if (finalEventData.conditions.length === 0 || finalEventData.actions.length === 0) {
        alert("Un evento debe tener al menos una condición y una acción válidas.");
        return;
    }

    if (editingEventId) {
        onUpdateEvent({ ...finalEventData, id: editingEventId });
    } else {
        onAddEvent({ ...finalEventData, id: `evt_${Date.now()}` });
    }
    handleCancel();
  };
  
  const updateCondition = (index: number, update: Partial<Condition>) => {
      const newConditions = [...conditions];
      const oldTrigger = newConditions[index].trigger;
      newConditions[index] = { ...newConditions[index], ...update };
      if (update.trigger && update.trigger !== oldTrigger) newConditions[index].params = {};
      setConditions(newConditions);
  };
  
  const updateAction = (index: number, update: Partial<Action>) => {
      const newActions = [...actions];
      const oldAction = newActions[index].action;
      newActions[index] = { ...newActions[index], ...update };
      if (update.action && update.action !== oldAction) newActions[index].params = {};
      setActions(newActions);
  };
  
  const renderParamInput = (
    type: 'condition' | 'action', 
    item: Partial<Condition> | Partial<Action>, 
    index: number
  ) => {
    const options = type === 'condition' ? triggerOptions : actionOptions;
    const key = type === 'condition' ? (item as Partial<Condition>).trigger : (item as Partial<Action>).action;
    const selectedOption = options.find(opt => opt.value === key);
    
    const updater = type === 'condition' ? updateCondition : updateAction;
    const updateParams = (newParams: Record<string, any>) => updater(index, { params: {...item.params, ...newParams} });

    if (key === 'CreateObject') {
        const positionType = item.params?.positionType || 'absolute';
        return <div key="create-obj-params" className="w-full bg-gray-700/50 p-2 rounded-md mt-1 space-y-2">
            <select className="input-field w-full" value={item.params?.templateObjectName ?? ''} onChange={e => updateParams({templateObjectName: e.target.value})}>
                <option value="">Seleccionar Plantilla de Objeto</option>
                {objectNames.map((name, index) => <option key={`${name}-${index}`} value={name}>{name}</option>)}
            </select>
            <div className="flex gap-4 text-sm">
                <label><input type="radio" value="absolute" checked={positionType === 'absolute'} onChange={() => updateParams({positionType: 'absolute'})} /> Posición Absoluta</label>
                <label><input type="radio" value="relativeToObject" checked={positionType === 'relativeToObject'} onChange={() => updateParams({positionType: 'relativeToObject'})} /> Relativa a Objeto</label>
            </div>
            {positionType === 'absolute' ? (
                <div className="flex gap-2">
                    <input type="number" placeholder="X" className="input-field w-1/2" value={item.params?.x ?? ''} onChange={e => updateParams({x: e.target.value})} />
                    <input type="number" placeholder="Y" className="input-field w-1/2" value={item.params?.y ?? ''} onChange={e => updateParams({y: e.target.value})} />
                </div>
            ) : (
                <div className="space-y-2">
                    <select className="input-field w-full" value={item.params?.relativeToObjectName ?? ''} onChange={e => updateParams({relativeToObjectName: e.target.value})}>
                        <option value="">Seleccionar Objeto Relativo</option>
                        {objectNames.map((name, index) => <option key={`${name}-${index}`} value={name}>{name}</option>)}
                    </select>
                    <div className="flex gap-2">
                        <input type="number" placeholder="Offset X" className="input-field w-1/2" value={item.params?.offsetX ?? ''} onChange={e => updateParams({offsetX: e.target.value})} />
                        <input type="number" placeholder="Offset Y" className="input-field w-1/2" value={item.params?.offsetY ?? ''} onChange={e => updateParams({offsetY: e.target.value})} />
                    </div>
                </div>
            )}
        </div>;
    }
    
    if (!selectedOption?.needsParams) return null;
    
    return selectedOption.needsParams.map(param => {
        switch (param) {
            case 'animationId':
                return ( <select key={param} className="input-field" value={item.params?.[param] ?? ''} onChange={e => updateParams({[param]: e.target.value})}>
                    <option value="">Seleccionar Animación</option>
                    {animations.map(anim => <option key={anim.id} value={anim.id}>{anim.name}</option>)}
                </select>);
            case 'soundId':
                return ( <select key={param} className="input-field" value={item.params?.[param] ?? ''} onChange={e => updateParams({[param]: e.target.value})}>
                    <option value="">Seleccionar Sonido</option>
                    {audioAssets.map(asset => <option key={asset.id} value={asset.id}>{asset.name}</option>)}
                </select>);
            case 'variable':
                if (key === 'CompareVariable' || key === 'AddToVariable' || key === 'SetVariable') {
                    return ( <select key={param} className="input-field" value={item.params?.[param] ?? ''} onChange={e => updateParams({[param]: e.target.value})}>
                        <option value="">Variable Global</option>
                        {globalVariableNames.map((name, index) => <option key={`${name}-${index}`} value={name}>{name}</option>)}
                    </select>);
                }
                return <input key={param} type="text" placeholder="Nombre Variable" className="input-field" value={item.params?.[param] ?? ''} onChange={e => updateParams({[param]: e.target.value})} />;
            case 'operator':
                 return ( <select key={param} className="input-field" value={item.params?.[param] ?? ''} onChange={e => updateParams({[param]: e.target.value})}>
                    <option value="==">== (igual a)</option>
                    <option value="!=">!= (no es igual)</option>
                    <option value=">">&gt; (mayor que)</option>
                    <option value="<">&lt; (menor que)</option>
                    <option value=">=">&gt;= (mayor/igual)</option>
                    <option value="<=">&lt;= (menor/igual)</option>
                </select>);
            case 'sceneName':
                return ( <select key={param} className="input-field" value={item.params?.[param] ?? ''} onChange={e => updateParams({[param]: e.target.value})}>
                    <option value="">Seleccionar Escena</option>
                    {sceneNames.map((name, index) => <option key={`${name}-${index}`} value={name}>{name}</option>)}
                </select>);
            case 'key':
                return (
                    <div key={param} className="flex flex-col gap-1">
                        <input 
                            type="text" 
                            placeholder="Haz clic y pulsa una tecla..." 
                            className="input-field w-48 text-center font-mono cursor-pointer hover:bg-gray-700 transition-colors" 
                            value={item.params?.[param] ?? ''} 
                            onKeyDown={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                let keyName = e.key.toLowerCase();
                                if (keyName === ' ') keyName = 'space';
                                updateParams({[param]: keyName});
                            }}
                            readOnly
                        />
                        <span className="text-[10px] text-gray-400 text-center">Captura automática al pulsar</span>
                    </div>
                );
            case 'parentName':
                return ( <select key={param} className="input-field" value={item.params?.[param] ?? ''} onChange={e => updateParams({[param]: e.target.value})}>
                    <option value="">Ninguno (Liberar)</option>
                    {objectNames.map(name => <option key={name} value={name}>{name}</option>)}
                </select>);
            case 'direction':
                return ( <select key={param} className="input-field" value={item.params?.[param] ?? 'right'} onChange={e => updateParams({[param]: e.target.value})}>
                    <option value="right">Derecha</option>
                    <option value="left">Izquierda</option>
                    <option value="up">Arriba</option>
                    <option value="down">Abajo</option>
                </select>);
            case 'axis':
                return ( <select key={param} className="input-field" value={item.params?.[param] ?? 'x'} onChange={e => updateParams({[param]: e.target.value})}>
                    <option value="x">Horizontal (X)</option>
                    <option value="y">Vertical (Y)</option>
                </select>);
            case 'color':
                return <input key={param} type="color" className="input-field h-8" value={item.params?.[param] ?? '#000000'} onChange={e => updateParams({[param]: e.target.value})} />;
            case 'x':
            case 'y':
            case 'maxPlayers':
            case 'slot':
            case 'zoomLevel':
            case 'speed':
            case 'distance':
            case 'jumpForce':
            case 'duration':
            case 'interval':
            case 'rotation':
            case 'scaleX':
            case 'scaleY':
                return <input key={param} type="number" placeholder={param} className="input-field w-20" value={item.params?.[param] ?? ''} onChange={e => updateParams({[param]: e.target.value})} />;
            case 'templateObjectName':
            case 'targetObjectName':
                return ( <select key={param} className="input-field" value={item.params?.[param] ?? ''} onChange={e => updateParams({[param]: e.target.value})}>
                    <option value="">Seleccionar Objeto</option>
                    {objectNames.map((name, index) => <option key={`${name}-${index}`} value={name}>{name}</option>)}
                </select>);
            case 'volume':
                return <input key={param} type="number" placeholder="Volumen (0-100)" className="input-field" min="0" max="100" value={item.params?.[param] ?? '100'} onChange={e => updateParams({[param]: e.target.value})} />;
            case 'dialogueText':
                return <textarea key={param} placeholder="Texto del diálogo..." className="input-field w-full" value={item.params?.[param] ?? ''} onChange={e => updateParams({[param]: e.target.value})} />;
            case 'stat':
                return (<select key={param} className="input-field" value={item.params?.[param] ?? ''} onChange={e => updateParams({[param]: e.target.value})}>
                    <option value="">Estadística</option>
                    <option value="hp">HP</option>
                    <option value="maxHp">HP Máx</option>
                    <option value="attack">Ataque</option>
                </select>);
            case 'operation':
                return (<select key={param} className="input-field" value={item.params?.[param] ?? ''} onChange={e => updateParams({[param]: e.target.value})}>
                    <option value="add">Aumentar</option>
                    <option value="subtract">Disminuir</option>
                    <option value="set">Establecer</option>
                </select>);
            default:
                return <input key={param} type="text" placeholder={param} className="input-field" value={item.params?.[param] ?? ''} onChange={e => updateParams({[param]: e.target.value})} />;
        }
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-gray-900 rounded-lg shadow-2xl w-full max-w-4xl h-[90vh] flex flex-col border border-gray-800" onClick={e => e.stopPropagation()}>
        {selectorOpen && <SelectorModal
            title={selectorOpen.type === 'condition' ? 'Seleccionar Disparador' : 'Seleccionar Acción'}
            categorizedItems={selectorOpen.type === 'condition' ? categorizedTriggerOptions : categorizedActionOptions}
            onClose={() => setSelectorOpen(null)}
            onSelect={(value) => {
                if (selectorOpen.type === 'condition') {
                    updateCondition(selectorOpen.index, { trigger: value as Condition['trigger'] });
                } else {
                    updateAction(selectorOpen.index, { action: value as Action['action'] });
                }
                setSelectorOpen(null);
            }}
        />}
        <style>{`
            .input-field { background-color: #1f2937; border: 1px solid #374151; border-radius: 0.375rem; padding: 0.25rem 0.5rem; font-size: 0.875rem; }
        `}</style>
        <header className="flex items-center justify-between p-4 border-b border-gray-800 shrink-0">
          <h2 className="text-xl font-bold">Editor de Eventos Globales</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">&times;</button>
        </header>
        
        <main className="flex-grow p-4 overflow-y-auto space-y-4">
            <div className="bg-black/50 p-4 rounded-lg border border-gray-800">
              <h3 className="text-lg font-semibold text-indigo-300 mb-2 flex items-center gap-2">
                <GeminiIcon />
                Generar Lógica con IA
              </h3>
              <p className="text-sm text-gray-400 mb-3">
                Describe la mecánica que quieres en lenguaje natural. Por ejemplo: "cuando el jugador choca con un enemigo, el jugador pierde 10 de vida y el enemigo desaparece".
              </p>
              <textarea
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="Describe la lógica aquí..."
                className="w-full h-20 p-2 rounded-md bg-gray-800 border border-gray-700 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm"
                disabled={isGenerating}
              />
              <div className="flex items-center justify-end mt-3 gap-4">
                {generationError && <span className="text-red-400 text-sm">{generationError}</span>}
                <button 
                  onClick={handleGenerateWithAI}
                  disabled={isGenerating || !aiPrompt.trim()}
                  className="px-4 py-2 bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:bg-gray-700 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isGenerating ? (
                    <>
                      <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Generando...
                    </>
                  ) : 'Generar con IA'}
                </button>
              </div>
            </div>
            {!isFormOpen && scene?.events.map((event, index) => (
            <div key={event.id || index} className="bg-black/50 p-3 rounded-lg border border-gray-800 relative group">
              <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                 <button 
                  onClick={() => handleEditEvent(event)} 
                  title="Editar Evento" 
                  className="p-1.5 bg-gray-700/80 rounded-full text-gray-300 hover:bg-indigo-600"
                 >
                    <EditIcon />
                </button>
                <button 
                  onClick={() => onDeleteEvent(event.id)} 
                  title="Eliminar Evento" 
                  className="p-1.5 bg-red-900/50 rounded-full text-red-300 hover:bg-red-700"
                >
                  <TrashIcon />
                </button>
              </div>
              <div className="flex gap-4">
                <div className="w-1/2 space-y-2">
                  <h4 className="text-xs uppercase font-bold text-red-400 tracking-wider">Condiciones</h4>
                  {event.conditions.map((cond, cIndex) => <div key={cIndex} className="text-sm bg-red-900/50 p-2 rounded-md">{`${cond.object} ${cond.trigger} ${cond.target || ''}`}</div>)}
                </div>
                <div className="w-1/2 space-y-2">
                  <h4 className="text-xs uppercase font-bold text-blue-400 tracking-wider">Acciones</h4>
                  {event.actions.map((act, aIndex) => <div key={aIndex} className="text-sm bg-blue-900/50 p-2 rounded-md">{`${act.object} ${act.action}`}</div>)}
                </div>
              </div>
            </div>
            ))}
            {isFormOpen && (
                <div className="bg-black/50 p-4 rounded-lg border border-indigo-500">
                    <h3 className="font-bold mb-4 text-lg text-indigo-300">{editingEventId ? 'Editar Evento' : 'Crear Nuevo Evento'}</h3>
                    <div className="flex gap-4">
                         <div className="w-1/2 space-y-3">
                            <h4 className="font-semibold text-red-400">Condiciones (CUANDO)</h4>
                            {conditions.map((cond, i) => (
                                <div key={i} className="flex gap-1 items-start flex-wrap p-2 bg-gray-800/50 rounded-md">
                                    <select className="input-field" value={cond.object ?? ''} onChange={e => updateCondition(i, { object: e.target.value })}>
                                        <option value="">Seleccionar Objeto</option>
                                        {['System', ...objectNames].map((name, index) => <option key={`${name}-${index}`} value={name}>{name}</option>)}
                                    </select>
                                    <button onClick={() => setSelectorOpen({type: 'condition', index: i})} className="input-field text-left flex-grow min-w-[120px] hover:bg-gray-600">
                                        {triggerOptions.find(opt => opt.value === cond.trigger)?.label || 'Seleccionar Disparador'}
                                    </button>
                                    {triggerOptions.find(o => o.value === cond.trigger)?.needsTarget && 
                                      <select className="input-field" value={cond.target ?? ''} onChange={e => updateCondition(i, { target: e.target.value })}>
                                        <option value="">Seleccionar Objetivo</option>
                                        {objectNames.map((name, index) => <option key={`${name}-${index}`} value={name}>{name}</option>)}
                                      </select>}
                                    {renderParamInput('condition', cond, i)}
                                </div>
                            ))}
                         </div>
                         <div className="w-1/2 space-y-3">
                            <h4 className="font-semibold text-blue-400">Acciones (HACER)</h4>
                            {actions.map((act, i) => (
                                <div key={i} className="flex gap-1 items-start flex-wrap p-2 bg-gray-800/50 rounded-md">
                                    <select className="input-field" value={act.object ?? ''} onChange={e => updateAction(i, { object: e.target.value })}>
                                        <option value="">Seleccionar Objeto</option>
                                        {['System', ...objectNames].map((name, index) => <option key={`${name}-${index}`} value={name}>{name}</option>)}
                                    </select>
                                    <button onClick={() => setSelectorOpen({type: 'action', index: i})} className="input-field text-left flex-grow min-w-[120px] hover:bg-gray-600">
                                        {actionOptions.find(opt => opt.value === act.action)?.label || 'Seleccionar Acción'}
                                    </button>
                                    {renderParamInput('action', act, i)}
                                </div>
                            ))}
                         </div>
                    </div>
                </div>
            )}
        </main>
        
        <footer className="p-4 border-t border-gray-800 shrink-0">
           {isFormOpen ? (
               <div className="flex justify-end gap-2">
                   <button onClick={handleCancel} className="px-4 py-2 bg-gray-700 rounded-md hover:bg-gray-800">Cancelar</button>
                   <button onClick={handleSaveEvent} className="px-4 py-2 bg-indigo-600 rounded-md hover:bg-indigo-700">Guardar Evento</button>
               </div>
           ) : (
                <button onClick={handleAddNewEventClick} className="px-4 py-2 bg-indigo-600 rounded-md hover:bg-indigo-700">
                    Añadir Nuevo Evento
                </button>
           )}
        </footer>
      </div>
    </div>
  );
};

export default EventEditor;