
import React, { useState, useMemo } from 'react';
import type { GameEvent, Condition, Action, Scene, Animation, Variable, GameAsset } from '../types';
import { TrashIcon } from './icons/TrashIcon';
import { GeminiIcon } from './icons/GeminiIcon';
import { generateEventLogic } from '../services/geminiService';
import { EditIcon } from './icons/EditIcon';
import { useLanguage } from '../LanguageContext';

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
    { category: 'event.category.core', options: [
        { value: 'OnStart', label: 'event.trigger.onStart' },
        { value: 'Always', label: 'event.trigger.always' },
    ]},
    { category: 'event.category.input', options: [
        { value: 'OnKeyPress', label: 'event.trigger.onKeyPress', needsParams: ['key'] },
        { value: 'OnAnyKeyPress', label: 'event.trigger.onAnyKeyPress' },
        { value: 'OnObjectClicked', label: 'event.trigger.onObjectClicked' },
        { value: 'OnJoystickMove', label: 'event.trigger.onJoystickMove' },
        { value: 'OnJoystickUp', label: 'event.trigger.onJoystickUp' },
        { value: 'OnJoystickDown', label: 'event.trigger.onJoystickDown' },
        { value: 'OnJoystickLeft', label: 'event.trigger.onJoystickLeft' },
        { value: 'OnJoystickRight', label: 'event.trigger.onJoystickRight' },
    ]},
    { category: 'event.category.collision', options: [
        { value: 'OnCollisionWith', label: 'event.trigger.onCollisionWith', needsTarget: true },
        { value: 'OnVerticalCollision', label: 'event.trigger.onVerticalCollision', needsTarget: true },
        { value: 'OnHorizontalCollision', label: 'event.trigger.onHorizontalCollision', needsTarget: true },
    ]},
    { category: 'event.category.objectState', options: [
        { value: 'IsIdle', label: 'event.trigger.isIdle' },
        { value: 'IsRunning', label: 'event.trigger.isRunning' },
        { value: 'IsJumping', label: 'event.trigger.isJumping' },
        { value: 'IsOnGround', label: 'event.trigger.isOnGround' },
        { value: 'IsMoving', label: 'event.trigger.isMoving' },
        { value: 'OnAttack', label: 'event.trigger.onAttack' },
    ]},
    { category: 'event.category.variables', options: [
        { value: 'CompareVariable', label: 'event.trigger.compareVariable', needsParams: ['variable', 'operator', 'value']},
        { value: 'CompareObjectVariable', label: 'event.trigger.compareObjectVariable', needsParams: ['variable', 'operator', 'value']},
        { value: 'CompareStat', label: 'event.trigger.compareStat', needsParams: ['stat', 'operator', 'value']},
    ]},
    { category: 'event.category.time', options: [
        { value: 'OnTimerElapsed', label: 'event.trigger.onTimerElapsed', needsParams: ['timerName'] },
        { value: 'EveryXSeconds', label: 'event.trigger.everyXSeconds', needsParams: ['interval'] },
    ]},
    { category: 'event.category.audio', options: [{ value: 'IsMusicPlaying', label: 'event.trigger.isMusicPlaying' }] },
    { category: 'event.category.network', options: [
        { value: 'OnMatchFound', label: 'event.trigger.onMatchFound' },
        { value: 'OnPlayerJoined', label: 'event.trigger.onPlayerJoined' },
        { value: 'OnPlayerLeft', label: 'event.trigger.onPlayerLeft' },
        { value: 'OnReceiveNetworkMessage', label: 'event.trigger.onReceiveNetworkMessage', needsParams: ['message'] },
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
    { category: 'event.category.object', options: [
        { value: 'Destroy', label: 'event.action.destroy' },
        { value: 'CreateObject', label: 'event.action.createObject' },
        { value: 'SetObjectPosition', label: 'event.action.setPosition', needsParams: ['x', 'y']},
        { value: 'MoveObject', label: 'event.action.moveDirection', needsParams: ['direction', 'speed'] },
        { value: 'OscillateObject', label: 'event.action.oscillate', needsParams: ['axis', 'distance', 'speed'] },
        { value: 'OscillateScale', label: 'event.action.oscillateScale', needsParams: ['distance', 'speed'] },
        { value: 'RotateContinuously', label: 'event.action.rotateContinuously', needsParams: ['speed'] },
        { value: 'RotateObject', label: 'event.action.rotate', needsParams: ['rotation'] },
        { value: 'ScaleObject', label: 'event.action.scale', needsParams: ['scaleX', 'scaleY'] },
        { value: 'SetScale', label: 'event.action.setScale', needsParams: ['scaleX', 'scaleY'] },
        { value: 'GenerateObjectAt', label: 'event.action.generateAt', needsParams: ['templateObjectName', 'targetObjectName'] },
        { value: 'ForceJump', label: 'event.action.forceJump', needsParams: ['jumpForce'] },
        { value: 'TriggerAttack', label: 'event.action.triggerAttack' },
        { value: 'SetParent', label: 'event.action.setParent', needsParams: ['parentName'] },
    ]},
    { category: 'event.category.visuals', options: [
        { value: 'PlayAnimation', label: 'event.action.playAnimation', needsParams: ['animationId'] },
        { value: 'PlayVideo', label: 'event.action.playVideo' },
        { value: 'PauseVideo', label: 'event.action.pauseVideo' },
        { value: 'StopVideo', label: 'event.action.stopVideo' },
    ]},
    { category: 'event.category.variables', options: [
        { value: 'AddToVariable', label: 'event.action.addToVariable', needsParams: ['variable', 'value'] },
        { value: 'SetVariable', label: 'event.action.setVariable', needsParams: ['variable', 'value'] },
        { value: 'AddToObjectVariable', label: 'event.action.addToObjectVariable', needsParams: ['variable', 'value'] },
        { value: 'SetObjectVariable', label: 'event.action.setObjectVariable', needsParams: ['variable', 'value'] },
        { value: 'ModifyStat', label: 'event.action.modifyStat', needsParams: ['stat', 'operation', 'value'] },
        { value: 'SaveGame', label: 'event.action.saveGame', needsParams: ['slot'] },
        { value: 'LoadGame', label: 'event.action.loadGame', needsParams: ['slot'] },
    ]},
    { category: 'event.category.sceneAndCamera', options: [
        { value: 'GoToScene', label: 'event.action.goToScene', needsParams: ['sceneName'] },
        { value: 'SetBackgroundColor', label: 'event.action.setBackgroundColor', needsParams: ['color']},
        { value: 'SetCameraZoom', label: 'event.action.setCameraZoom', needsParams: ['zoomLevel']},
    ]},
    { category: 'event.category.ui', options: [
        { value: 'SetUIText', label: 'event.action.setUIText', needsParams: ['text'] },
        { value: 'ShowDialogue', label: 'event.action.showDialogue', needsParams: ['dialogueText'] },
    ]},
    { category: 'event.category.audio', options: [
        { value: 'PlaySound', label: 'event.action.playSound', needsParams: ['soundId']},
        { value: 'SetBackgroundMusic', label: 'event.action.setBackgroundMusic', needsParams: ['soundId']},
        { value: 'PauseBackgroundMusic', label: 'event.action.pauseBackgroundMusic' },
        { value: 'ResumeBackgroundMusic', label: 'event.action.resumeBackgroundMusic' },
        { value: 'StopBackgroundMusic', label: 'event.action.stopBackgroundMusic' },
        { value: 'SetBackgroundMusicVolume', label: 'event.action.setBackgroundMusicVolume', needsParams: ['volume']},
    ]},
    { category: 'event.category.time', options: [
        { value: 'StartTimer', label: 'event.action.startTimer', needsParams: ['timerName', 'duration'] },
        { value: 'StopTimer', label: 'event.action.stopTimer', needsParams: ['timerName'] },
    ]},
    { category: 'event.category.rpg', options: [
        { value: 'SetQuestState', label: 'event.action.setQuestState', needsParams: ['questId', 'questState'] },
    ]},
    { category: 'event.category.network', options: [
        { value: 'CreateMatch', label: 'event.action.createMatch', needsParams: ['maxPlayers'] },
        { value: 'JoinMatch', label: 'event.action.joinMatch', needsParams: ['matchId'] },
        { value: 'SendNetworkMessage', label: 'event.action.sendNetworkMessage', needsParams: ['message'] },
        { value: 'SetPlayerName', label: 'event.action.setPlayerName', needsParams: ['name'] },
    ]},
];
const actionOptions = categorizedActionOptions.flatMap(c => c.options);

const SelectorModal: React.FC<{
  title: string;
  categorizedItems: { category: string, options: { value: string, label: string }[] }[];
  onSelect: (value: string) => void;
  onClose: () => void;
}> = ({ title, categorizedItems, onSelect, onClose }) => {
    const { t } = useLanguage();
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
                                {t(group.category)}
                            </button>
                        ))}
                    </aside>
                    <main className="w-2/3 p-2 overflow-y-auto">
                        <ul>
                        {(categorizedItems.find(g => g.category === activeCategory)?.options || []).map(option => (
                            <li key={option.value} onClick={() => onSelect(option.value)} 
                                className="p-2 rounded-md hover:bg-indigo-600 cursor-pointer text-gray-200">
                                <h5 className="font-semibold text-sm">{t(option.label)}</h5>
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
  const { t } = useLanguage();
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
            setGenerationError(t('event.aiNoEvents'));
        }
    } catch (error) {
        console.error("AI Generation Error:", error);
        setGenerationError(error instanceof Error ? t('event.aiError', { error: error.message }) : t('event.aiError', { error: 'Unknown' }));
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
        alert(t('event.invalidEvent'));
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
                <option value="">{t('event.selectTemplate')}</option>
                {objectNames.map((name, index) => <option key={`${name}-${index}`} value={name}>{name}</option>)}
            </select>
            <div className="flex gap-4 text-sm">
                <label><input type="radio" value="absolute" checked={positionType === 'absolute'} onChange={() => updateParams({positionType: 'absolute'})} /> {t('event.absolutePosition')}</label>
                <label><input type="radio" value="relativeToObject" checked={positionType === 'relativeToObject'} onChange={() => updateParams({positionType: 'relativeToObject'})} /> {t('event.relativeToObject')}</label>
            </div>
            {positionType === 'absolute' ? (
                <div className="flex gap-2">
                    <input type="number" placeholder="X" className="input-field w-1/2" value={item.params?.x ?? ''} onChange={e => updateParams({x: e.target.value})} />
                    <input type="number" placeholder="Y" className="input-field w-1/2" value={item.params?.y ?? ''} onChange={e => updateParams({y: e.target.value})} />
                </div>
            ) : (
                <div className="space-y-2">
                    <select className="input-field w-full" value={item.params?.relativeToObjectName ?? ''} onChange={e => updateParams({relativeToObjectName: e.target.value})}>
                        <option value="">{t('event.selectRelativeObject')}</option>
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
                    <option value="">{t('event.selectAnimation')}</option>
                    {animations.map(anim => <option key={anim.id} value={anim.id}>{anim.name}</option>)}
                </select>);
            case 'soundId':
                return ( <select key={param} className="input-field" value={item.params?.[param] ?? ''} onChange={e => updateParams({[param]: e.target.value})}>
                    <option value="">{t('event.selectSound')}</option>
                    {audioAssets.map(asset => <option key={asset.id} value={asset.id}>{asset.name}</option>)}
                </select>);
            case 'variable':
                if (key === 'CompareVariable' || key === 'AddToVariable' || key === 'SetVariable') {
                    return ( <select key={param} className="input-field" value={item.params?.[param] ?? ''} onChange={e => updateParams({[param]: e.target.value})}>
                        <option value="">{t('event.globalVariable')}</option>
                        {globalVariableNames.map((name, index) => <option key={`${name}-${index}`} value={name}>{name}</option>)}
                    </select>);
                }
                return <input key={param} type="text" placeholder={t('event.variableName')} className="input-field" value={item.params?.[param] ?? ''} onChange={e => updateParams({[param]: e.target.value})} />;
            case 'operator':
                 return ( <select key={param} className="input-field" value={item.params?.[param] ?? ''} onChange={e => updateParams({[param]: e.target.value})}>
                    <option value="==">== ({t('properties.operator.equal') || 'igual a'})</option>
                    <option value="!=">!= ({t('properties.operator.notEqual') || 'no es igual'})</option>
                    <option value=">">&gt; ({t('properties.operator.greaterThan') || 'mayor que'})</option>
                    <option value="<">&lt; ({t('properties.operator.lessThan') || 'menor que'})</option>
                    <option value=">=">&gt;= ({t('properties.operator.greaterEqual') || 'mayor/igual'})</option>
                    <option value="<=">&lt;= ({t('properties.operator.lessEqual') || 'menor/igual'})</option>
                </select>);
            case 'sceneName':
                return ( <select key={param} className="input-field" value={item.params?.[param] ?? ''} onChange={e => updateParams({[param]: e.target.value})}>
                    <option value="">{t('event.selectScene')}</option>
                    {sceneNames.map((name, index) => <option key={`${name}-${index}`} value={name}>{name}</option>)}
                </select>);
            case 'key':
                return (
                    <div key={param} className="flex flex-col gap-1">
                        <input 
                            type="text" 
                            placeholder={t('event.keyPressPlaceholder')} 
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
                        <span className="text-[10px] text-gray-400 text-center">{t('event.autoCapture')}</span>
                    </div>
                );
            case 'parentName':
                return ( <select key={param} className="input-field" value={item.params?.[param] ?? ''} onChange={e => updateParams({[param]: e.target.value})}>
                    <option value="">{t('event.none')}</option>
                    {objectNames.map(name => <option key={name} value={name}>{name}</option>)}
                </select>);
            case 'direction':
                return ( <select key={param} className="input-field" value={item.params?.[param] ?? 'right'} onChange={e => updateParams({[param]: e.target.value})}>
                    <option value="right">{t('event.direction.right')}</option>
                    <option value="left">{t('event.direction.left')}</option>
                    <option value="up">{t('event.direction.up')}</option>
                    <option value="down">{t('event.direction.down')}</option>
                </select>);
            case 'axis':
                return ( <select key={param} className="input-field" value={item.params?.[param] ?? 'x'} onChange={e => updateParams({[param]: e.target.value})}>
                    <option value="x">{t('event.axis.x')}</option>
                    <option value="y">{t('event.axis.y')}</option>
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
                    <option value="">{t('event.selectObject')}</option>
                    {objectNames.map((name, index) => <option key={`${name}-${index}`} value={name}>{name}</option>)}
                </select>);
            case 'volume':
                return <input key={param} type="number" placeholder="Volumen (0-100)" className="input-field" min="0" max="100" value={item.params?.[param] ?? '100'} onChange={e => updateParams({[param]: e.target.value})} />;
            case 'dialogueText':
                return <textarea key={param} placeholder={t('event.dialoguePlaceholder')} className="input-field w-full" value={item.params?.[param] ?? ''} onChange={e => updateParams({[param]: e.target.value})} />;
            case 'stat':
                return (<select key={param} className="input-field" value={item.params?.[param] ?? ''} onChange={e => updateParams({[param]: e.target.value})}>
                    <option value="">{t('event.stat')}</option>
                    <option value="hp">HP</option>
                    <option value="maxHp">HP Máx</option>
                    <option value="attack">Ataque</option>
                </select>);
            case 'operation':
                return (<select key={param} className="input-field" value={item.params?.[param] ?? ''} onChange={e => updateParams({[param]: e.target.value})}>
                    <option value="add">{t('event.operation.add')}</option>
                    <option value="subtract">{t('event.operation.subtract')}</option>
                    <option value="set">{t('event.operation.set')}</option>
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
          <h2 className="text-xl font-bold">{t('event.editorTitle')}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">&times;</button>
        </header>
        
        <main className="flex-grow p-4 overflow-y-auto space-y-4">
            <div className="bg-black/50 p-4 rounded-lg border border-gray-800">
              <h3 className="text-lg font-semibold text-indigo-300 mb-2 flex items-center gap-2">
                <GeminiIcon />
                {t('event.generateLogicAI')}
              </h3>
              <p className="text-sm text-gray-400 mb-3">
                {t('event.aiDescription')}
              </p>
              <textarea
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder={t('event.aiPlaceholder')}
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
                      {t('event.generating')}
                    </>
                  ) : t('event.generateWithAI')}
                </button>
              </div>
            </div>
            {!isFormOpen && scene?.events.map((event, index) => (
            <div key={event.id || index} className="bg-black/50 p-3 rounded-lg border border-gray-800 relative group">
              <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                 <button 
                  onClick={() => handleEditEvent(event)} 
                  title={t('event.editEvent')} 
                  className="p-1.5 bg-gray-700/80 rounded-full text-gray-300 hover:bg-indigo-600"
                 >
                    <EditIcon />
                </button>
                <button 
                  onClick={() => onDeleteEvent(event.id)} 
                  title={t('event.deleteEvent')} 
                  className="p-1.5 bg-red-900/50 rounded-full text-red-300 hover:bg-red-700"
                >
                  <TrashIcon />
                </button>
              </div>
              <div className="flex gap-4">
                <div className="w-1/2 space-y-2">
                  <h4 className="text-xs uppercase font-bold text-red-400 tracking-wider">{t('event.conditions')}</h4>
                  {event.conditions.map((cond, cIndex) => <div key={cIndex} className="text-sm bg-red-900/50 p-2 rounded-md">{`${cond.object} ${t(triggerOptions.find(o => o.value === cond.trigger)?.label || '')} ${cond.target || ''}`}</div>)}
                </div>
                <div className="w-1/2 space-y-2">
                  <h4 className="text-xs uppercase font-bold text-blue-400 tracking-wider">{t('event.actions')}</h4>
                  {event.actions.map((act, aIndex) => <div key={aIndex} className="text-sm bg-blue-900/50 p-2 rounded-md">{`${act.object} ${t(actionOptions.find(o => o.value === act.action)?.label || '')}`}</div>)}
                </div>
              </div>
            </div>
            ))}
            {isFormOpen && (
                <div className="bg-black/50 p-4 rounded-lg border border-indigo-500">
                    <h3 className="font-bold mb-4 text-lg text-indigo-300">{editingEventId ? t('event.editEvent') : t('event.createEvent')}</h3>
                    <div className="flex gap-4">
                         <div className="w-1/2 space-y-3">
                            <h4 className="font-semibold text-red-400">{t('event.conditionsWhen')}</h4>
                            {conditions.map((cond, i) => (
                                <div key={i} className="flex gap-1 items-start flex-wrap p-2 bg-gray-800/50 rounded-md">
                                    <select className="input-field" value={cond.object ?? ''} onChange={e => updateCondition(i, { object: e.target.value })}>
                                        <option value="">{t('event.selectObject')}</option>
                                        {['System', ...objectNames].map((name, index) => <option key={`${name}-${index}`} value={name}>{name === 'System' ? t('properties.system') : name}</option>)}
                                    </select>
                                    <button onClick={() => setSelectorOpen({type: 'condition', index: i})} className="input-field text-left flex-grow min-w-[120px] hover:bg-gray-600">
                                        {t(triggerOptions.find(opt => opt.value === cond.trigger)?.label || 'event.selectTrigger')}
                                    </button>
                                    {triggerOptions.find(o => o.value === cond.trigger)?.needsTarget && 
                                      <select className="input-field" value={cond.target ?? ''} onChange={e => updateCondition(i, { target: e.target.value })}>
                                        <option value="">{t('event.selectTarget')}</option>
                                        {objectNames.map((name, index) => <option key={`${name}-${index}`} value={name}>{name}</option>)}
                                      </select>}
                                    {renderParamInput('condition', cond, i)}
                                </div>
                            ))}
                         </div>
                         <div className="w-1/2 space-y-3">
                            <h4 className="font-semibold text-blue-400">{t('event.actionsDo')}</h4>
                            {actions.map((act, i) => (
                                <div key={i} className="flex gap-1 items-start flex-wrap p-2 bg-gray-800/50 rounded-md">
                                    <select className="input-field" value={act.object ?? ''} onChange={e => updateAction(i, { object: e.target.value })}>
                                        <option value="">{t('event.selectObject')}</option>
                                        {['System', ...objectNames].map((name, index) => <option key={`${name}-${index}`} value={name}>{name === 'System' ? t('properties.system') : name}</option>)}
                                    </select>
                                    <button onClick={() => setSelectorOpen({type: 'action', index: i})} className="input-field text-left flex-grow min-w-[120px] hover:bg-gray-600">
                                        {t(actionOptions.find(opt => opt.value === act.action)?.label || 'event.selectAction')}
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
                   <button onClick={handleCancel} className="px-4 py-2 bg-gray-700 rounded-md hover:bg-gray-800">{t('common.cancel')}</button>
                   <button onClick={handleSaveEvent} className="px-4 py-2 bg-indigo-600 rounded-md hover:bg-indigo-700">{t('event.saveEvent')}</button>
               </div>
           ) : (
                <button onClick={handleAddNewEventClick} className="px-4 py-2 bg-indigo-600 rounded-md hover:bg-indigo-700">
                    {t('event.addNewEvent')}
                </button>
           )}
        </footer>
      </div>
    </div>
  );
};

export default EventEditor;