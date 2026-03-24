import React, { useState, useRef } from 'react';
import type { GameObject, GameAsset, Behavior, Variable, Scene, ProjectData, ObjectScript, Action, ObjectTrigger, Animation, CollisionProperties } from '../types';
import { BehaviorDefinition, availableBehaviors } from '../behaviors/definitions';
import { BehaviorModal } from './BehaviorModal';
import { TrashIcon } from './icons/TrashIcon';
import { PlusIcon } from './icons/PlusIcon';
import { useLanguage } from '../LanguageContext';

const CollapseIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
    </svg>
);

const ExpandIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
    </svg>
);

const UpArrowIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 15l7-7 7 7" /></svg>;
const DownArrowIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg>;

const CloneIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
        <path d="M7 9a2 2 0 012-2h6a2 2 0 012 2v6a2 2 0 01-2 2H9a2 2 0 01-2-2V9z" />
        <path d="M5 3a2 2 0 00-2 2v6a2 2 0 002 2V5h6a2 2 0 00-2-2H5z" />
    </svg>
);

const FolderIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
        <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
    </svg>
);


interface PropertiesInspectorProps {
  selectedObject: GameObject | null;
  projectData: ProjectData;
  onUpdateProjectData: (updates: Partial<ProjectData>) => void;
  onUpdateObject: (id: number, updates: Partial<GameObject>) => void;
  onDeleteObject: (id: number) => void;
  onCloneObject: (id: number) => void;
  onAddAsset: (asset: GameAsset) => void;
  width: number;
  onToggleCollapse: () => void;
}

const ItemSelectorModal: React.FC<{
  title: string;
  categorizedItems: { category: string, options: { value: string, label: string }[] }[];
  onSelect: (value: string) => void;
  onClose: () => void;
}> = ({ title, categorizedItems, onSelect, onClose }) => {
    const [activeCategory, setActiveCategory] = useState(categorizedItems[0].category);
    
    return (
        <div className="absolute inset-0 bg-gray-900 bg-opacity-80 z-20 flex flex-col p-2" onClick={onClose}>
            <div className="bg-gray-800 rounded-lg p-2 border border-gray-700 flex flex-col max-h-full" onClick={e => e.stopPropagation()}>
                <h4 className="text-sm font-bold mb-2 p-2 text-center border-b border-gray-700">{title}</h4>
                <div className="flex-grow flex min-h-[200px]">
                    <aside className="w-1/3 border-r border-gray-700 pr-2 overflow-y-auto">
                        {categorizedItems.map(group => (
                            <button key={group.category} onClick={() => setActiveCategory(group.category)} 
                                className={`w-full text-left text-sm p-2 rounded-md ${activeCategory === group.category ? 'bg-indigo-600' : 'hover:bg-gray-700'}`}>
                                {group.category}
                            </button>
                        ))}
                    </aside>
                    <main className="w-2/3 pl-2 overflow-y-auto">
                        <ul>
                        {(categorizedItems.find(g => g.category === activeCategory)?.options || []).map(option => (
                            <li key={option.value} onClick={() => onSelect(option.value)} 
                                className="p-2 rounded-md hover:bg-indigo-600 cursor-pointer">
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

const PropertyInput: React.FC<{ label: string; value: string | number; onChange: (value: string | number) => void; type?: string; step?: number }> = ({ label, value, onChange, type = 'text', step = 1 }) => (
  <div className="flex flex-col">
    <label className="text-xs text-gray-400 mb-1">{label}</label>
    <input
      type={type}
      step={step}
      value={value}
      onChange={(e) => onChange(type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value)}
      className="bg-gray-800 border border-gray-700 rounded-md px-2 py-1.5 text-sm w-full focus:ring-2 focus:ring-indigo-500 focus:outline-none"
    />
  </div>
);

const AssetPickerModal: React.FC<{assets: GameAsset[], onSelect: (asset: GameAsset) => void, onClose: () => void}> = ({assets, onSelect, onClose}) => {
    const { t } = useLanguage();
    const imageAssets = assets.filter(a => a.type === 'image');
    return (
        <div className="absolute inset-0 bg-black bg-opacity-80 z-10 flex flex-col p-2" onClick={onClose}>
            <div className="bg-gray-900 rounded-lg p-2 border border-gray-800 flex flex-col max-h-full" onClick={e => e.stopPropagation()}>
                <h4 className="text-sm font-bold mb-2 text-center">{t('properties.selectAsset')}</h4>
                <div className="grid grid-cols-3 gap-2 overflow-y-auto">
                    {imageAssets.map(asset => (
                        <div key={asset.id} className="flex flex-col items-center p-1 bg-gray-800 rounded-md cursor-pointer hover:bg-indigo-600" onClick={() => onSelect(asset)}>
                            <img src={asset.url} alt={asset.name} className="w-16 h-16 object-cover rounded-sm" />
                            <span className="text-xs mt-1 truncate w-full text-center">{asset.name}</span>
                        </div>
                    ))}
                    {imageAssets.length === 0 && <p className="col-span-3 text-xs text-gray-500 text-center py-4">{t('properties.noAssets')}</p>}
                </div>
            </div>
        </div>
    );
};

const parseValue = (value: string): string | number | boolean => {
    const trimmedValue = value.trim();
    if (trimmedValue.toLowerCase() === 'true') return true;
    if (trimmedValue.toLowerCase() === 'false') return false;
    const num = Number(trimmedValue);
    if (trimmedValue !== '' && !isNaN(num)) return num;
    return value;
};

const ObjectVariablesEditor: React.FC<{
    variables: Variable[], 
    onUpdate: (vars: Variable[]) => void
}> = ({ variables, onUpdate }) => {
    const { t } = useLanguage();
    const handleAdd = () => {
        const newName = `miVar${variables.length}`;
        onUpdate([...variables, { name: newName, value: 0 }]);
    };
    const handleUpdate = (index: number, newVar: Variable) => {
        const newVars = [...variables];
        newVars[index] = newVar;
        onUpdate(newVars);
    };
    const handleRemove = (index: number) => {
        onUpdate(variables.filter((_, i) => i !== index));
    };

    return (
        <div className="pt-4 border-t border-gray-800 space-y-2">
            <div className="flex justify-between items-center">
                <h3 className="font-semibold text-xs uppercase tracking-wider">{t('properties.objectVariables')}</h3>
                <button onClick={handleAdd} className="p-1.5 bg-gray-800 hover:bg-indigo-600 rounded-md"><PlusIcon /></button>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {variables.map((v, i) => (
                    <div key={i} className="bg-gray-800/50 p-2 rounded-md border border-gray-700 space-y-2">
                        <div className="flex items-center gap-2">
                            <input 
                                type="text"
                                value={v.name}
                                onChange={e => handleUpdate(i, {...v, name: e.target.value})}
                                className="bg-gray-700 flex-grow border border-gray-600 rounded-md px-2 py-1 text-sm focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                                placeholder={t('properties.variableName')}
                            />
                             <button onClick={() => handleRemove(i)} className="p-1 hover:bg-red-500/50 rounded-full"><TrashIcon /></button>
                        </div>
                        <input 
                            type="text"
                            value={String(v.value)}
                            onChange={e => handleUpdate(i, {...v, value: parseValue(e.target.value)})}
                            className="bg-gray-700 w-full border border-gray-600 rounded-md px-2 py-1 text-sm focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                            placeholder={t('properties.variableValue')}
                        />
                    </div>
                ))}
                {variables.length === 0 && <p className="text-xs text-gray-500 text-center py-2">{t('properties.noVariables')}</p>}
            </div>
        </div>
    );
};

const ObjectScriptsEditor: React.FC<{
    scripts: ObjectScript[];
    onUpdate: (scripts: ObjectScript[]) => void;
    projectData: ProjectData;
}> = ({ scripts, onUpdate, projectData }) => {
    const { t } = useLanguage();
    const [selectorState, setSelectorState] = useState<{type: 'trigger' | 'action', scriptId: string, actionIndex?: number} | null>(null);
    
    const { scenes, assets, animations, globalVariables } = projectData;
    const objectNames = scenes.find(s => s.id === projectData.activeSceneId)?.gameObjects.map(o => o.name) ?? [];

    // FIX: Explicitly type categorizedTriggerOptions to avoid type widening of string literals.
    const categorizedTriggerOptions: {
      category: string;
      options: {
          value: ObjectTrigger;
          label: string;
          needsTarget?: boolean;
          needsParams?: string[];
      }[];
    }[] = [
      { category: t('properties.system'), options: [
          { value: 'OnStart', label: t('properties.onStart') },
          { value: 'OnUpdate', label: t('properties.onUpdate') },
      ]},
      { category: t('trigger.onClick'), options: [{ value: 'OnClick', label: t('properties.onClick') }] },
      { category: t('properties.onCollision'), options: [{ value: 'OnCollisionWith', label: t('properties.collisionWith'), needsTarget: true }] },
      { category: t('properties.variables'), options: [{ value: 'CompareObjectVariable', label: t('properties.compareVariable'), needsParams: ['variable', 'operator', 'value'] }] },
    ];
    const triggerOptions: { value: ObjectTrigger, label: string, needsTarget?: boolean, needsParams?: string[] }[] = categorizedTriggerOptions.flatMap(c => c.options);

    // FIX: Explicitly type categorizedActionOptions to avoid type widening of string literals.
    const categorizedActionOptions: {
        category: string;
        options: {
            value: Action['action'];
            label: string;
            needsParams?: string[];
        }[];
    }[] = [
      { category: t('hierarchy.objects'), options: [
        { value: 'Destroy', label: t('properties.destroy') },
        { value: 'CreateObject', label: t('properties.createObject') },
        { value: 'SetObjectPosition', label: t('properties.setPosition'), needsParams: ['x', 'y'] },
        { value: 'PlayAnimation', label: t('properties.playAnimation'), needsParams: ['animationId'] },
      ]},
      { category: t('sidebar.scenes'), options: [{ value: 'GoToScene', label: t('properties.goToScene'), needsParams: ['sceneName'] }] },
      { category: t('sidebar.variables'), options: [
        { value: 'ModifyStat', label: t('properties.modifyStat'), needsParams: ['stat', 'operation', 'value'] },
        { value: 'AddToVariable', label: t('properties.addToVariable'), needsParams: ['variable', 'value'] },
        { value: 'SetVariable', label: t('properties.setVariable'), needsParams: ['variable', 'value'] },
        { value: 'AddToObjectVariable', label: t('properties.addToObjectVariable'), needsParams: ['variable', 'value'] },
        { value: 'SetObjectVariable', label: t('properties.setObjectVariable'), needsParams: ['variable', 'value'] },
      ]},
    ];
    const actionOptions: { value: Action['action'], label: string, needsParams?: string[] }[] = categorizedActionOptions.flatMap(c => c.options);

    const addScript = () => {
        const newScript: ObjectScript = { id: `script_${Date.now()}`, trigger: 'OnClick', actions: [] };
        onUpdate([...(scripts || []), newScript]);
    };

    const removeScript = (scriptId: string) => onUpdate(scripts.filter(s => s.id !== scriptId));

    const updateScript = (scriptId: string, updates: Partial<ObjectScript>) => {
        onUpdate(scripts.map(s => s.id === scriptId ? { ...s, ...updates } : s));
    };
    
    const addAction = (scriptId: string) => {
        const newAction: Action = { object: 'Self', action: 'Destroy', params: {} };
        onUpdate(scripts.map(s => s.id === scriptId ? { ...s, actions: [...s.actions, newAction] } : s));
    };

    const removeAction = (scriptId: string, actionIndex: number) => {
        onUpdate(scripts.map(s => s.id === scriptId ? { ...s, actions: s.actions.filter((_, i) => i !== actionIndex) } : s));
    };
    
    const updateAction = (scriptId: string, actionIndex: number, updates: Partial<Action>) => {
        onUpdate(scripts.map(s => {
            if (s.id === scriptId) {
                const newActions = [...s.actions];
                const oldAction = newActions[actionIndex];
                newActions[actionIndex] = { ...oldAction, ...updates };
                // Reset params if action type changes
                if (updates.action && updates.action !== oldAction.action) {
                    newActions[actionIndex].params = {};
                }
                return { ...s, actions: newActions };
            }
            return s;
        }));
    };

    const renderActionParams = (scriptId: string, actionIndex: number, action: Action) => {
        const selectedOption = actionOptions.find(opt => opt.value === action.action);
        if (!selectedOption?.needsParams) return null;

        const updateParams = (newParams: Record<string, any>) => {
            updateAction(scriptId, actionIndex, { params: {...action.params, ...newParams} });
        };

        return <div className="w-full bg-gray-700/50 p-1.5 rounded-md mt-1 space-y-1.5 text-xs">
            {selectedOption.needsParams.map(param => {
                 switch (param) {
                    case 'sceneName':
                        return <select key={param} className="input-field-sm" value={action.params?.[param] ?? ''} onChange={e => updateParams({[param]: e.target.value})}>
                            <option value="">{t('properties.selectScene')}</option>
                            {scenes.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                        </select>;
                    case 'animationId':
                         return <select key={param} className="input-field-sm" value={action.params?.[param] ?? ''} onChange={e => updateParams({[param]: e.target.value})}>
                            <option value="">{t('properties.selectAnimation')}</option>
                            {animations.map(anim => <option key={anim.id} value={anim.id}>{anim.name}</option>)}
                        </select>;
                     case 'variable':
                         if (action.action === 'SetVariable' || action.action === 'AddToVariable') {
                            return <select key={param} className="input-field-sm" value={action.params?.[param] ?? ''} onChange={e => updateParams({[param]: e.target.value})}>
                                <option value="">{t('properties.globalVariable')}</option>
                                {(globalVariables || []).map(v => <option key={v.name} value={v.name}>{v.name}</option>)}
                            </select>;
                         }
                         return <input key={param} type="text" placeholder={t('properties.variableName')} className="input-field-sm" value={action.params?.[param] ?? ''} onChange={e => updateParams({[param]: e.target.value})} />;
                    case 'stat':
                        return <select key={param} className="input-field-sm" value={action.params?.[param] ?? ''} onChange={e => updateParams({[param]: e.target.value})}>
                            <option value="">{t('properties.stat')}</option><option value="hp">HP</option><option value="maxHp">{t('properties.maxHp')}</option><option value="attack">{t('properties.attack')}</option>
                        </select>;
                    case 'operation':
                        return <select key={param} className="input-field-sm" value={action.params?.[param] ?? ''} onChange={e => updateParams({[param]: e.target.value})}>
                            <option value="add">{t('properties.increase')}</option><option value="subtract">{t('properties.decrease')}</option><option value="set">{t('properties.set')}</option>
                        </select>;
                    case 'x': case 'y':
                        return <input key={param} type="number" placeholder={param.toUpperCase()} className="input-field-sm w-16" value={action.params?.[param] ?? ''} onChange={e => updateParams({[param]: e.target.value})} />;
                    default:
                        return <input key={param} type="text" placeholder={param} className="input-field-sm" value={action.params?.[param] ?? ''} onChange={e => updateParams({[param]: e.target.value})} />;
                }
            })}
        </div>
    }
    
    const renderTriggerParams = (script: ObjectScript) => {
        const selectedOption = triggerOptions.find(opt => opt.value === script.trigger);
        if (!selectedOption?.needsParams) return null;
        
        const updateParams = (newParams: Record<string, any>) => {
            updateScript(script.id, { params: {...script.params, ...newParams} });
        };
        
        return <div className="w-full bg-gray-700/50 p-1.5 rounded-md mt-1 space-y-1.5 text-xs">
            {selectedOption.needsParams.map(param => {
                 switch (param) {
                    case 'variable':
                        return <input key={param} type="text" placeholder={t('properties.variableName')} className="input-field-sm" value={script.params?.[param] ?? ''} onChange={e => updateParams({[param]: e.target.value})} />;
                    case 'operator':
                         return <select key={param} className="input-field-sm" value={script.params?.[param] ?? ''} onChange={e => updateParams({[param]: e.target.value})}>
                            <option value="==">== ({t('properties.operator')} ==)</option>
                            <option value="!=">!= ({t('properties.operator')} !=)</option>
                            <option value=">">&gt; ({t('properties.operator')} &gt;)</option>
                            <option value="<">&lt; ({t('properties.operator')} &lt;)</option>
                            <option value=">=">&gt;= ({t('properties.operator')} &gt;=)</option>
                            <option value="<=">&lt;= ({t('properties.operator')} &lt;=)</option>
                        </select>;
                    default:
                        return <input key={param} type="text" placeholder={param} className="input-field-sm" value={script.params?.[param] ?? ''} onChange={e => updateParams({[param]: e.target.value})} />;
                }
            })}
        </div>
    }

    return (
        <div className="pt-4 border-t border-gray-800 space-y-2 relative">
             {selectorState && <ItemSelectorModal 
                title={selectorState.type === 'trigger' ? t('properties.selectTrigger') : t('properties.selectAction')}
                categorizedItems={selectorState.type === 'trigger' ? categorizedTriggerOptions : categorizedActionOptions}
                onClose={() => setSelectorState(null)}
                onSelect={(value) => {
                    if (selectorState.type === 'trigger') {
                        updateScript(selectorState.scriptId, { trigger: value as ObjectTrigger, params: {} });
                    } else if (selectorState.type === 'action' && selectorState.actionIndex !== undefined) {
                        updateAction(selectorState.scriptId, selectorState.actionIndex, { action: value as Action['action'] })
                    }
                    setSelectorState(null);
                }}
             />}
            <style>{`.input-field-sm { background-color: #374151; border: 1px solid #4b5563; border-radius: 0.25rem; padding: 0.125rem 0.25rem; font-size: 0.75rem; width: 100%; }`}</style>
            <div className="flex justify-between items-center">
                <h3 className="font-semibold text-xs uppercase tracking-wider">{t('properties.logicScripts')}</h3>
                <button onClick={addScript} className="p-1.5 bg-gray-800 hover:bg-indigo-600 rounded-md"><PlusIcon /></button>
            </div>
             <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                {(scripts || []).map(script => (
                    <div key={script.id} className="bg-gray-800/50 p-2 rounded-md border border-gray-700 space-y-2">
                        <div className="flex items-center gap-2">
                            <button 
                                onClick={() => setSelectorState({type: 'trigger', scriptId: script.id})}
                                className="bg-gray-700 flex-grow border border-gray-600 rounded-md px-2 py-1 text-sm text-left hover:bg-gray-600"
                            >
                                {triggerOptions.find(opt => opt.value === script.trigger)?.label || t('properties.selectTrigger')}
                            </button>
                            <button onClick={() => removeScript(script.id)} className="p-1 hover:bg-red-500/50 rounded-full"><TrashIcon /></button>
                        </div>
                        {triggerOptions.find(o => o.value === script.trigger)?.needsTarget && (
                            <select 
                                value={script.params?.targetObjectName ?? ''} 
                                onChange={e => updateScript(script.id, { params: { targetObjectName: e.target.value } })}
                                className="bg-gray-700 w-full border border-gray-600 rounded-md px-2 py-1 text-sm"
                            >
                                <option value="">{t('properties.selectTargetObject')}</option>
                                {objectNames.map(name => <option key={name} value={name}>{name}</option>)}
                            </select>
                        )}
                        {renderTriggerParams(script)}
                        <div className="pl-2 border-l-2 border-gray-700 space-y-2">
                            {script.actions.map((action, i) => (
                                <div key={i} className="bg-gray-700/30 p-1.5 rounded">
                                    <div className="flex items-center gap-1 text-xs">
                                        <select value={action.object} onChange={e => updateAction(script.id, i, { object: e.target.value })} className="input-field-sm flex-1">
                                            <option value="Self">Self ({t('properties.thisObject')})</option>
                                            <option value="System">System</option>
                                            {objectNames.map(name => <option key={name} value={name}>{name}</option>)}
                                        </select>
                                        <span className="text-gray-400">-&gt;</span>
                                         <button 
                                            onClick={() => setSelectorState({type: 'action', scriptId: script.id, actionIndex: i})}
                                            className="input-field-sm flex-1 text-left hover:bg-gray-600"
                                        >
                                            {actionOptions.find(opt => opt.value === action.action)?.label || t('properties.selectAction')}
                                        </button>
                                        <button onClick={() => removeAction(script.id, i)} className="p-1 hover:text-red-400 text-lg leading-none">&times;</button>
                                    </div>
                                    {renderActionParams(script.id, i, action)}
                                </div>
                            ))}
                            <button onClick={() => addAction(script.id)} className="text-xs text-indigo-400 hover:text-indigo-300">+ {t('properties.addAction')}</button>
                        </div>
                    </div>
                ))}
                 {(scripts || []).length === 0 && <p className="text-xs text-gray-500 text-center py-2">{t('properties.noScripts')}</p>}
            </div>
        </div>
    );
};


const GlobalVariablesEditor: React.FC<{variables: Variable[], onUpdate: (vars: Variable[]) => void }> = ({ variables, onUpdate }) => {
    const handleAdd = () => {
        const newName = `var${variables.length}`;
        onUpdate([...variables, { name: newName, value: 0 }]);
    };
    const handleUpdate = (index: number, newVar: Variable) => {
        const newVars = [...variables];
        newVars[index] = newVar;
        onUpdate(newVars);
    };
    const handleRemove = (index: number) => {
        onUpdate(variables.filter((_, i) => i !== index));
    };

    return (
        <div className="border-t border-gray-800">
            <div className="p-2 flex justify-between items-center">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400">Variables Globales</h2>
                <button onClick={handleAdd} className="p-1.5 bg-gray-800 hover:bg-indigo-600 rounded-md"><PlusIcon /></button>
            </div>
            <div className="p-4 pt-0 space-y-3 overflow-y-auto max-h-48">
                {variables.map((v, i) => (
                    <div key={i} className="bg-gray-800/50 p-2 rounded-md border border-gray-700 space-y-2">
                        <div className="flex items-center gap-2">
                            <input 
                                type="text"
                                value={v.name}
                                onChange={e => handleUpdate(i, {...v, name: e.target.value})}
                                className="bg-gray-700 flex-grow border border-gray-600 rounded-md px-2 py-1 text-sm focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                                placeholder="Nombre de Variable"
                            />
                             <button onClick={() => handleRemove(i)} className="p-1 hover:bg-red-500/50 rounded-full"><TrashIcon /></button>
                        </div>
                        <input 
                            type="text"
                            value={String(v.value)}
                            onChange={e => handleUpdate(i, {...v, value: parseValue(e.target.value)})}
                            className="bg-gray-700 w-full border border-gray-600 rounded-md px-2 py-1 text-sm focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                            placeholder="Valor Inicial"
                        />
                    </div>
                ))}
                {variables.length === 0 && <p className="text-sm text-gray-500 text-center py-4">No hay variables globales.</p>}
            </div>
        </div>
    );
};

const ScenePropertiesEditor: React.FC<{
    scene: Scene;
    onUpdate: (updates: Partial<Scene>) => void;
    assets: GameAsset[];
}> = ({ scene, onUpdate, assets }) => {
    const { t } = useLanguage();
    const audioAssets = assets.filter(a => a.type === 'audio');
    
    return (
        <div className="space-y-4">
            <PropertyInput 
                label={t('properties.sceneName')} 
                value={scene.name} 
                onChange={(val) => onUpdate({ name: val as string })} 
            />
            <div className="flex flex-col">
                <label className="text-xs text-gray-400 mb-1">{t('properties.backgroundColor')}</label>
                <input 
                    type="color" 
                    value={scene.backgroundColor} 
                    onChange={(e) => onUpdate({ backgroundColor: e.target.value })} 
                    className="w-full h-8 bg-gray-800 border border-gray-700 rounded-md cursor-pointer" 
                />
            </div>
            <div className="flex flex-col">
                <label className="text-xs text-gray-400 mb-1">{t('properties.backgroundMusic')}</label>
                <select
                    value={scene.backgroundMusicId || ''}
                    onChange={(e) => onUpdate({ backgroundMusicId: e.target.value || undefined })}
                    className="bg-gray-800 border border-gray-700 rounded-md px-2 py-1.5 text-sm w-full focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                >
                    <option value="">{t('properties.none')}</option>
                    {audioAssets.map(asset => (
                        <option key={asset.id} value={asset.id}>{asset.name}</option>
                    ))}
                </select>
            </div>
            <PropertyInput 
                label={t('properties.defaultZoom')} 
                type="number"
                step={0.1}
                value={scene.defaultZoom || 1} 
                onChange={(val) => onUpdate({ defaultZoom: val as number })} 
            />
            <div className="pt-4 border-t border-gray-800 space-y-2">
                 <h3 className="font-semibold text-xs uppercase tracking-wider text-gray-400">{t('properties.cameraBounds')}</h3>
                 <label className="flex items-center gap-2 text-sm text-gray-300 bg-gray-800/50 p-2 rounded-md">
                    <input 
                        type="checkbox" 
                        checked={scene.cameraBounds?.enabled || false} 
                        onChange={(e) => onUpdate({ cameraBounds: { ...scene.cameraBounds!, enabled: e.target.checked } })}
                        className="form-checkbox bg-gray-700 border-gray-600 text-indigo-500 focus:ring-indigo-500" />
                    {t('properties.enableBounds')}
                </label>
                {scene.cameraBounds?.enabled && (
                    <div className="grid grid-cols-2 gap-2">
                        <PropertyInput label="X" type="number" value={scene.cameraBounds.x} onChange={(val) => onUpdate({ cameraBounds: { ...scene.cameraBounds!, x: val as number } })} />
                        <PropertyInput label="Y" type="number" value={scene.cameraBounds.y} onChange={(val) => onUpdate({ cameraBounds: { ...scene.cameraBounds!, y: val as number } })} />
                        <PropertyInput label={t('common.width')} type="number" value={scene.cameraBounds.width} onChange={(val) => onUpdate({ cameraBounds: { ...scene.cameraBounds!, width: val as number } })} />
                        <PropertyInput label={t('common.height')} type="number" value={scene.cameraBounds.height} onChange={(val) => onUpdate({ cameraBounds: { ...scene.cameraBounds!, height: val as number } })} />
                    </div>
                )}
            </div>
        </div>
    );
};

const GameSettingsEditor: React.FC<{
    projectData: ProjectData;
    onUpdate: (updates: Partial<ProjectData>) => void;
}> = ({ projectData, onUpdate }) => {
    const { t } = useLanguage();
    const { orientation = 'landscape', gameWidth = 1024, gameHeight = 768, joystick } = projectData;

    const handleOrientationChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newOrientation = e.target.value as 'landscape' | 'portrait';
        const isLandscape = gameWidth > gameHeight;
        
        let newWidth = gameWidth;
        let newHeight = gameHeight;

        if (newOrientation === 'landscape' && !isLandscape) {
            [newWidth, newHeight] = [newHeight, newWidth];
        } else if (newOrientation === 'portrait' && isLandscape) {
            [newWidth, newHeight] = [newHeight, newWidth];
        }

        onUpdate({ 
            orientation: newOrientation,
            gameWidth: newWidth,
            gameHeight: newHeight,
        });
    };
    
    const landscapeResolutions = [
        { name: "SD (16:9)", width: 640, height: 360 },
        { name: "FWVGA (16:9)", width: 854, height: 480 },
        { name: "qHD (16:9)", width: 960, height: 540 },
        { name: "XGA (4:3)", width: 1024, height: 768 },
        { name: "HD (16:9)", width: 1280, height: 720 },
        { name: "Full HD (16:9)", width: 1920, height: 1080 },
    ];

    const portraitResolutions = [
        { name: "SD (9:16)", width: 360, height: 640 },
        { name: "FWVGA (9:16)", width: 480, height: 854 },
        { name: "qHD (9:16)", width: 540, height: 960 },
        { name: "XGA (3:4)", width: 768, height: 1024 },
        { name: "HD (9:16)", width: 720, height: 1280 },
        { name: "Full HD (9:16)", width: 1080, height: 1920 },
    ];

    const availableResolutions = orientation === 'landscape' ? landscapeResolutions : portraitResolutions;
    const currentResValue = `${gameWidth}x${gameHeight}`;
    const isCustom = !availableResolutions.some(r => r.width === gameWidth && r.height === gameHeight);

    const handleResolutionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const value = e.target.value;
        if (value === 'custom') return;
        
        const [width, height] = value.split('x').map(Number);
        onUpdate({ gameWidth: width, gameHeight: height });
    };

    return (
        <div className="space-y-4 pt-4 border-t border-gray-800">
            <h3 className="font-semibold text-xs uppercase tracking-wider text-gray-400">{t('properties.gameSettings')}</h3>
             <div className="flex flex-col">
                <label className="text-xs text-gray-400 mb-1">{t('properties.orientation')}</label>
                <select
                    value={orientation}
                    onChange={handleOrientationChange}
                    className="bg-gray-800 border border-gray-700 rounded-md px-2 py-1.5 text-sm w-full focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                >
                    <option value="landscape">{t('properties.landscape')}</option>
                    <option value="portrait">{t('properties.portrait')}</option>
                </select>
            </div>
            <div className="flex flex-col">
                <label className="text-xs text-gray-400 mb-1">{t('properties.screenResolution')}</label>
                <div className="flex gap-2 mb-2">
                    <select
                        value={isCustom ? 'custom' : currentResValue}
                        onChange={handleResolutionChange}
                        className="bg-gray-800 border border-gray-700 rounded-md px-2 py-1.5 text-sm flex-grow focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    >
                        {isCustom && <option value="custom">{t('properties.custom')} ({gameWidth}x{gameHeight})</option>}
                        {availableResolutions.map(res => (
                            <option key={`${res.width}x${res.height}`} value={`${res.width}x${res.height}`}>
                                {res.width} x {res.height} ({res.name})
                            </option>
                        ))}
                    </select>
                    <button 
                        onClick={() => onUpdate({ gameWidth: window.innerWidth, gameHeight: window.innerHeight })}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white px-2 py-1 rounded-md text-xs transition-colors"
                        title={t('properties.adaptToScreen')}
                    >
                        {t('properties.adapt')}
                    </button>
                </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
                <PropertyInput label={t('properties.gameWidth')} type="number" value={gameWidth} onChange={(val) => onUpdate({ gameWidth: val as number })} />
                <PropertyInput label={t('properties.gameHeight')} type="number" value={gameHeight} onChange={(val) => onUpdate({ gameHeight: val as number })} />
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-300 bg-gray-800/50 p-2 rounded-md cursor-pointer">
                <input 
                    type="checkbox" 
                    checked={projectData.responsive || false} 
                    onChange={(e) => onUpdate({ responsive: e.target.checked })} 
                    className="form-checkbox bg-gray-700 border-gray-600 text-indigo-500 focus:ring-indigo-500" 
                />
                {t('properties.responsiveFullscreen')}
            </label>
            <p className="text-xs text-gray-500 px-2">{t('properties.responsiveDescription')}</p>
            <div className="pt-4 border-t border-gray-700/50 space-y-2">
                <h3 className="font-semibold text-xs uppercase tracking-wider text-gray-400">{t('properties.touchControls')}</h3>
                <label className="flex items-center gap-2 text-sm text-gray-300 bg-gray-800/50 p-2 rounded-md">
                    <input 
                        type="checkbox" 
                        checked={joystick?.enabled || false} 
                        onChange={(e) => {
                            const enabled = e.target.checked;
                            const currentJoystick = projectData.joystick || {};
                            onUpdate({ 
                                joystick: { 
                                    position: 'left', 
                                    size: 120, 
                                    opacity: 0.5,
                                    ...currentJoystick,
                                    enabled 
                                } 
                            });
                        }}
                        className="form-checkbox bg-gray-700 border-gray-600 text-indigo-500 focus:ring-indigo-500" />
                    {t('properties.enableJoystick')}
                </label>
                {joystick?.enabled && (
                    <div className="space-y-2">
                        <div className="flex flex-col bg-gray-800/50 p-2 rounded-md">
                             <label className="text-xs text-gray-400 mb-1">{t('properties.joystickPosition')}</label>
                             <div className="flex bg-gray-700 rounded-md p-1">
                                <button
                                    onClick={() => onUpdate({ joystick: { ...joystick, position: 'left' }})}
                                    className={`flex-1 py-1 text-sm rounded transition-colors ${joystick.position !== 'right' ? 'bg-indigo-600 text-white' : 'hover:bg-gray-600'}`}
                                >{t('properties.left')}</button>
                                <button
                                    onClick={() => onUpdate({ joystick: { ...joystick, position: 'right' }})}
                                    className={`flex-1 py-1 text-sm rounded transition-colors ${joystick.position === 'right' ? 'bg-indigo-600 text-white' : 'hover:bg-gray-600'}`}
                                >{t('properties.right')}</button>
                            </div>
                        </div>
                        <div className="bg-gray-800/50 p-2 rounded-md grid grid-cols-2 gap-2">
                             <PropertyInput 
                                label={t('properties.sizePx')} 
                                type="number" 
                                value={joystick.size ?? 120} 
                                onChange={v => onUpdate({ joystick: { ...joystick, size: v as number }})} 
                            />
                            <PropertyInput 
                                label={t('properties.opacity')} 
                                type="number" 
                                step={0.1}
                                value={joystick.opacity ?? 0.5} 
                                onChange={v => onUpdate({ joystick: { ...joystick, opacity: Math.max(0, Math.min(1, v as number)) }})} 
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};


const PropertiesInspector: React.FC<PropertiesInspectorProps> = ({ selectedObject, projectData, onUpdateProjectData, onUpdateObject, onDeleteObject, onCloneObject, onAddAsset, width, onToggleCollapse }) => {
  const { t } = useLanguage();
  const [isDragOver, setIsDragOver] = useState(false);
  const [isBehaviorModalOpen, setIsBehaviorModalOpen] = useState(false);
  const [isAssetPickerOpen, setIsAssetPickerOpen] = useState(false);
  const appearanceFileInputRef = useRef<HTMLInputElement>(null);
  
  const assets = projectData.assets;
  const globalVariables = projectData.globalVariables ?? [];
  const activeScene = projectData.scenes.find(s => s.id === projectData.activeSceneId) ?? null;

  const onUpdateScene = (sceneId: string, updates: Partial<Scene>) => {
      const newScenes = projectData.scenes.map(s => s.id === sceneId ? {...s, ...updates} : s);
      onUpdateProjectData({ scenes: newScenes });
  };
  
  const onUpdateGlobalVariables = (variables: Variable[]) => {
      onUpdateProjectData({ globalVariables: variables });
  };

  if (width < 50 && width > 0) {
    return (
        <aside className="bg-gray-900 border-l border-gray-800 flex-col shrink-0 transition-all duration-300 ease-in-out p-2 hidden md:flex" style={{ width: `${width}px` }}>
             <button onClick={onToggleCollapse} title="Expandir Panel" className="p-2 hover:bg-gray-800 rounded-md">
                <ExpandIcon />
            </button>
        </aside>
    )
  }

  const handleUpdate = (updates: Partial<GameObject>) => {
    if (!selectedObject) return;
    onUpdateObject(selectedObject.id, updates);
  };
  
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.types.includes('application/game-asset')) {
      e.dataTransfer.dropEffect = 'copy';
      setIsDragOver(true);
    }
  };

  const handleDragLeave = () => setIsDragOver(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const assetString = e.dataTransfer.getData('application/game-asset');
    if (!assetString) return;

    try {
      const asset: GameAsset = JSON.parse(assetString);
      if (asset.type === 'image') {
        handleUpdate({ imageUrl: asset.url, color: 'transparent', videoUrl: undefined });
      } else if (asset.type === 'video') {
        handleUpdate({ videoUrl: asset.url, color: 'transparent', imageUrl: undefined, videoLoop: true, videoAutoplay: true });
      }
    } catch (error) {
      console.error("Failed to parse dropped asset for appearance:", error);
    }
  };

    const handleAppearanceFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || !selectedObject) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const fileType = file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : null;
            if (!fileType) return;

            const newAsset: GameAsset = {
            id: `asset_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
            name: file.name,
            type: fileType,
            url: e.target?.result as string,
            };
            onAddAsset(newAsset);
            
            if (fileType === 'image') {
            handleUpdate({ imageUrl: newAsset.url, color: 'transparent', videoUrl: undefined });
            } else if (fileType === 'video') {
            handleUpdate({ videoUrl: newAsset.url, color: 'transparent', imageUrl: undefined, videoLoop: true, videoAutoplay: true });
            }
        };
        reader.readAsDataURL(file);
        event.target.value = '';
    };

  const handleAddBehavior = (behaviorDef: BehaviorDefinition) => {
    if (!selectedObject) return;
    const currentBehaviors = selectedObject.behaviors || [];
    if (currentBehaviors.some(b => b.name === behaviorDef.name)) {
        alert(`Object already has the "${behaviorDef.name}" behavior.`);
        return;
    }
    const newBehavior: Behavior = {
        name: behaviorDef.name,
        properties: { ...behaviorDef.defaultProperties },
    };
    handleUpdate({ behaviors: [...currentBehaviors, newBehavior] });
    setIsBehaviorModalOpen(false);
  };

  const handleRemoveBehavior = (behaviorName: string) => {
    if (!selectedObject) return;
    const updatedBehaviors = selectedObject.behaviors?.filter(b => b.name !== behaviorName) || [];
    handleUpdate({ behaviors: updatedBehaviors });
  };

  const handleUpdateBehaviorProperty = (behaviorName: string, propName: string, value: any) => {
    if (!selectedObject) return;
    const updatedBehaviors = selectedObject.behaviors?.map(b => 
        b.name === behaviorName ? { ...b, properties: { ...b.properties, [propName]: value } } : b
    ) || [];
    handleUpdate({ behaviors: updatedBehaviors });
  };

  const handleUpdateObjectVariables = (newVariables: Variable[]) => {
    handleUpdate({ variables: newVariables });
  };
   const handleUpdateObjectScripts = (newScripts: ObjectScript[]) => {
    handleUpdate({ scripts: newScripts });
  };
  
  const handleUpdateStats = (newStats: Partial<GameObject['stats']>) => {
    handleUpdate({ stats: { ...(selectedObject?.stats || {hp:0, maxHp:100, attack:10}), ...newStats } });
  };

  const handleToggleSolid = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedObject) return;
    const isSolid = e.target.checked;
    let currentBehaviors = selectedObject.behaviors || [];

    if (isSolid) {
        if (!currentBehaviors.some(b => b.name === 'Solid')) {
            const solidBehavior: Behavior = { name: 'Solid', properties: {} };
            handleUpdate({ behaviors: [...currentBehaviors, solidBehavior] });
        }
    } else {
        handleUpdate({ behaviors: currentBehaviors.filter(b => b.name !== 'Solid') });
    }
  };

  const handleToggleTouchable = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!selectedObject) return;
      handleUpdate({ isTouchable: e.target.checked });
  };

  const handleToggleCustomCollision = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!selectedObject) return;
      const useCustom = e.target.checked;
      let collisionData: CollisionProperties | undefined = selectedObject.collision;
      if (useCustom && !collisionData) {
          collisionData = {
              width: selectedObject.width,
              height: selectedObject.height,
              offsetX: 0,
              offsetY: 0,
          };
      }
      handleUpdate({ useCustomCollision: useCustom, collision: collisionData });
  };

  const handleUpdateCollisionProp = (prop: keyof CollisionProperties, value: number) => {
      if (!selectedObject) return;
      const newCollision = { ...selectedObject.collision!, [prop]: value };
      handleUpdate({ collision: newCollision });
  };
  
  const handleSelectExistingAsset = (asset: GameAsset) => {
    handleUpdate({ imageUrl: asset.url, color: 'transparent', videoUrl: undefined });
    setIsAssetPickerOpen(false);
  };
  
  const PALETTE = ['#000000', '#1D2B53', '#7E2553', '#008751', '#AB5236', '#5F574F', '#C2C3C7', '#FFF1E8', '#FF004D', '#FFA300', '#FFEC27', '#00E436', '#29ADFF', '#83769C', '#FF77A8', '#FFCCAA'];


  return (
    <aside className="bg-gray-900 border-l border-gray-800 flex flex-col shrink-0 h-full md:h-auto md:w-auto" style={{ width: `${width}px` }}>
        {selectedObject ? (
            <>
                <div className="p-2 border-b border-gray-800 flex justify-between items-center">
                    <button onClick={onToggleCollapse} title="Colapsar Panel" className="p-2 -ml-2 hover:bg-gray-800 rounded-md hidden md:block">
                        <CollapseIcon />
                    </button>
                    <h2 className="text-lg font-semibold truncate px-2">{selectedObject.name}</h2>
                    <div className="flex items-center gap-1">
                        <button onClick={() => onCloneObject(selectedObject.id)} title="Clonar Objeto" className="p-1.5 text-gray-400 hover:text-white hover:bg-indigo-600/50 rounded-md">
                            <CloneIcon />
                        </button>
                        <button onClick={() => onDeleteObject(selectedObject.id)} title="Eliminar Objeto" className="p-1.5 text-gray-400 hover:text-white hover:bg-red-600/50 rounded-md">
                            <TrashIcon />
                        </button>
                    </div>
                </div>
                <div className="flex-grow p-4 space-y-4 overflow-y-auto relative">
                    {isBehaviorModalOpen && <BehaviorModal onClose={() => setIsBehaviorModalOpen(false)} onAddBehavior={handleAddBehavior} />}
                    {isAssetPickerOpen && (
                        <AssetPickerModal
                            assets={assets}
                            onSelect={handleSelectExistingAsset}
                            onClose={() => setIsAssetPickerOpen(false)}
                        />
                    )}
                    
                    <PropertyInput label={t('common.name')} value={selectedObject.name} onChange={(val) => handleUpdate({ name: val as string })} />
                    
                    <div className="pt-4 border-t border-gray-800 space-y-2">
                        <h3 className="font-semibold text-xs uppercase tracking-wider">{t('properties.transformation')}</h3>
                        <div className="grid grid-cols-2 gap-2">
                            <PropertyInput label="X" type="number" step={0.1} value={selectedObject.x} onChange={(val) => handleUpdate({ x: val as number })} />
                            <PropertyInput label="Y" type="number" step={0.1} value={selectedObject.y} onChange={(val) => handleUpdate({ y: val as number })} />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <PropertyInput label={t('common.width')} type="number" value={selectedObject.width} onChange={(val) => handleUpdate({ width: val as number })} />
                            <PropertyInput label={t('common.height')} type="number" value={selectedObject.height} onChange={(val) => handleUpdate({ height: val as number })} />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <PropertyInput label={t('properties.scaleX')} type="number" value={selectedObject.scaleX ?? 1} onChange={(val) => handleUpdate({ scaleX: val as number })} />
                            <PropertyInput label={t('properties.scaleY')} type="number" value={selectedObject.scaleY ?? 1} onChange={(val) => handleUpdate({ scaleY: val as number })} />
                        </div>
                        <PropertyInput label={t('properties.rotation')} type="number" value={selectedObject.rotation ?? 0} onChange={(val) => handleUpdate({ rotation: val as number })} />
                    </div>

                    <div className="pt-4 border-t border-gray-800 space-y-2">
                        <h3 className="font-semibold text-xs uppercase tracking-wider">{t('properties.appearance')}</h3>
                        <div className="flex items-end gap-2">
                            <div className="flex-grow">
                                <label className="text-xs text-gray-400 mb-1 block">{t('properties.solidColor')}</label>
                                <input 
                                    type="color" 
                                    value={selectedObject.color} 
                                    onChange={(e) => handleUpdate({ color: e.target.value, imageUrl: undefined, videoUrl: undefined })} 
                                    className="w-full h-8 bg-gray-800 border border-gray-700 rounded-md cursor-pointer" 
                                />
                            </div>
                        </div>
                         <div className="grid grid-cols-8 gap-1 pt-2">
                            {PALETTE.map(color => (
                                <button
                                    key={color}
                                    onClick={() => handleUpdate({ color: color, imageUrl: undefined, videoUrl: undefined })}
                                    className={`w-full h-6 rounded-sm border-2 transition-all ${selectedObject.color === color ? 'border-white scale-110' : 'border-transparent'} hover:border-white/50`}
                                    style={{ backgroundColor: color }}
                                    title={color}
                                />
                            ))}
                            <button
                                onClick={() => handleUpdate({ color: 'transparent', imageUrl: undefined, videoUrl: undefined })}
                                className={`w-full h-6 col-span-2 rounded-sm border-2 transition-all ${selectedObject.color === 'transparent' ? 'border-white scale-110' : 'border-transparent'} hover:border-white/50 bg-cover`}
                                style={{backgroundImage: 'linear-gradient(45deg, #4a5568 25%, transparent 25%), linear-gradient(-45deg, #4a5568 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #4a5568 75%), linear-gradient(-45deg, transparent 75%, #4a5568 75%)', backgroundSize: '10px 10px', backgroundPosition: '0 0, 0 5px, 5px -5px, -5px 0px'}}
                                title="Transparent"
                            />
                        </div>
                        <div className="text-center text-xs text-gray-500 my-1">O</div>
                        <div 
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                            className={`relative flex items-center justify-center w-full h-24 bg-gray-800 rounded-md border-2 border-dashed ${isDragOver ? 'border-indigo-500' : 'border-gray-700'}`}
                        >
                            {selectedObject.videoUrl ? (
                                <>
                                    <video src={selectedObject.videoUrl} muted loop autoPlay playsInline className="max-w-full max-h-full object-contain rounded-sm pointer-events-none" />
                                    <button onClick={() => handleUpdate({ videoUrl: undefined })} className="absolute top-1 right-1 bg-red-600/80 hover:bg-red-500 text-white rounded-full h-5 w-5 flex items-center justify-center text-xs font-bold">&times;</button>
                                </>
                            ) : selectedObject.imageUrl ? (
                                <>
                                    <img src={selectedObject.imageUrl} alt="Sprite" className="max-w-full max-h-full object-contain rounded-sm" />
                                    <button onClick={() => handleUpdate({ imageUrl: undefined })} className="absolute top-1 right-1 bg-red-600/80 hover:bg-red-500 text-white rounded-full h-5 w-5 flex items-center justify-center text-xs font-bold">&times;</button>
                                </>
                            ) : (
                                <span className="text-xs text-gray-500 text-center p-2">Suelta una imagen o vídeo aquí</span>
                            )}
                             <button 
                                onClick={() => setIsAssetPickerOpen(true)}
                                className="absolute bottom-1 left-1 bg-gray-700 hover:bg-indigo-600 text-white rounded-full p-1.5 transition-colors"
                                title="Seleccionar recurso existente"
                            >
                                <FolderIcon />
                            </button>
                            <button 
                                onClick={() => appearanceFileInputRef.current?.click()}
                                className="absolute bottom-1 right-1 bg-gray-700 hover:bg-indigo-600 text-white rounded-full p-1.5 transition-colors"
                                title="Importar y asignar recurso"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                            </button>
                        </div>
                        {selectedObject.videoUrl && (
                            <div className="space-y-2 bg-gray-800/50 p-2 rounded-md">
                                <label className="flex items-center gap-2 text-sm text-gray-300">
                                    <input type="checkbox" checked={selectedObject.videoAutoplay ?? true} onChange={(e) => handleUpdate({ videoAutoplay: e.target.checked })} className="form-checkbox bg-gray-700 border-gray-600 text-indigo-500" />
                                    Autoreproducir
                                </label>
                                <label className="flex items-center gap-2 text-sm text-gray-300">
                                    <input type="checkbox" checked={selectedObject.videoLoop ?? true} onChange={(e) => handleUpdate({ videoLoop: e.target.checked })} className="form-checkbox bg-gray-700 border-gray-600 text-indigo-500" />
                                    Bucle
                                </label>
                            </div>
                        )}
                    </div>
                    
                    <div className="pt-4 border-t border-gray-800 space-y-2">
                        <h3 className="font-semibold text-xs uppercase tracking-wider">{t('properties.physicsAndCollisions')}</h3>
                        <label className="flex items-center gap-2 text-sm text-gray-300 bg-gray-800/50 p-2 rounded-md cursor-pointer">
                            <input 
                                type="checkbox" 
                                checked={selectedObject.behaviors?.some(b => b.name === 'Solid') || false} 
                                onChange={handleToggleSolid} 
                                className="form-checkbox bg-gray-700 border-gray-600 text-indigo-500 focus:ring-indigo-500" 
                            />
                            {t('properties.solid')}
                        </label>
                        <p className="text-xs text-gray-500 px-2">{t('properties.solidDescription')}</p>

                        <label className="flex items-center gap-2 text-sm text-gray-300 bg-gray-800/50 p-2 rounded-md cursor-pointer mt-2">
                            <input 
                                type="checkbox" 
                                checked={selectedObject.isTouchable ?? true}
                                onChange={handleToggleTouchable} 
                                className="form-checkbox bg-gray-700 border-gray-600 text-indigo-500 focus:ring-indigo-500" 
                            />
                            {t('properties.touchable')}
                        </label>
                        <p className="text-xs text-gray-500 px-2">{t('properties.touchableDescription')}</p>
                        
                         <div className="pt-2 border-t border-gray-700/50 mt-2 space-y-2">
                            <label className="flex items-center gap-2 text-sm text-gray-300 bg-gray-800/50 p-2 rounded-md cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    checked={selectedObject.useCustomCollision || false}
                                    onChange={handleToggleCustomCollision}
                                    className="form-checkbox bg-gray-700 border-gray-600 text-indigo-500 focus:ring-indigo-500" 
                                />
                                {t('properties.useCustomCollision')}
                            </label>
                            {selectedObject.useCustomCollision && (
                                <div className="bg-gray-800/50 p-2 rounded-md space-y-2">
                                     <p className="text-xs text-gray-500 px-2">{t('properties.customCollisionDescription')}</p>
                                    <div className="grid grid-cols-2 gap-2">
                                        <PropertyInput label={t('common.width')} type="number" value={selectedObject.collision?.width ?? selectedObject.width} onChange={v => handleUpdateCollisionProp('width', v as number)} />
                                        <PropertyInput label={t('common.height')} type="number" value={selectedObject.collision?.height ?? selectedObject.height} onChange={v => handleUpdateCollisionProp('height', v as number)} />
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <PropertyInput label={t('properties.offsetX')} type="number" value={selectedObject.collision?.offsetX ?? 0} onChange={v => handleUpdateCollisionProp('offsetX', v as number)} />
                                        <PropertyInput label={t('properties.offsetY')} type="number" value={selectedObject.collision?.offsetY ?? 0} onChange={v => handleUpdateCollisionProp('offsetY', v as number)} />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex flex-col">
                        <label className="text-xs text-gray-400 mb-1">{t('properties.direction')}</label>
                        <div className="flex bg-gray-800 rounded-md p-1">
                            <button
                                onClick={() => handleUpdate({ direction: 'left' })}
                                className={`flex-1 py-1 text-sm rounded transition-colors ${selectedObject.direction === 'left' ? 'bg-indigo-600 text-white' : 'hover:bg-gray-700'}`}
                            >{t('properties.left')}</button>
                            <button
                                onClick={() => handleUpdate({ direction: 'right' })}
                                className={`flex-1 py-1 text-sm rounded transition-colors ${selectedObject.direction !== 'left' ? 'bg-indigo-600 text-white' : 'hover:bg-gray-700'}`}
                            >{t('properties.right')}</button>
                        </div>
                    </div>
                    <div className="flex items-end gap-2">
                        <div className="flex-grow">
                            <PropertyInput label={t('properties.zIndex')} type="number" value={selectedObject.zIndex} onChange={(val) => handleUpdate({ zIndex: val as number })} />
                        </div>
                        <div className="flex flex-col gap-1">
                            <button onClick={() => handleUpdate({ zIndex: selectedObject.zIndex + 1 })} className="p-1.5 bg-gray-800 hover:bg-indigo-600 rounded-md" title={t('properties.bringForward')}>
                                <UpArrowIcon />
                            </button>
                            <button onClick={() => handleUpdate({ zIndex: selectedObject.zIndex - 1 })} className="p-1.5 bg-gray-800 hover:bg-indigo-600 rounded-md" title={t('properties.sendBackward')}>
                                <DownArrowIcon />
                            </button>
                        </div>
                    </div>
                    
                     <div className="pt-4 border-t border-gray-800 space-y-2">
                        <h3 className="font-semibold text-xs uppercase tracking-wider">{t('properties.rpgStats')}</h3>
                        <div className="grid grid-cols-2 gap-2">
                            <PropertyInput label="HP" type="number" value={selectedObject.stats?.hp ?? 0} onChange={val => handleUpdateStats({ hp: val as number })} />
                            <PropertyInput label={t('properties.maxHp')} type="number" value={selectedObject.stats?.maxHp ?? 0} onChange={val => handleUpdateStats({ maxHp: val as number })} />
                            <PropertyInput label={t('properties.attack')} type="number" value={selectedObject.stats?.attack ?? 0} onChange={val => handleUpdateStats({ attack: val as number })} />
                        </div>
                    </div>


                    <div className="pt-4 border-t border-gray-800 space-y-2">
                        <h3 className="font-semibold text-xs uppercase tracking-wider mb-2">{t('properties.visualizationAndUI')}</h3>
                        <label className="flex items-center gap-2 text-sm text-gray-300 bg-gray-800/50 p-2 rounded-md">
                            <input type="checkbox" checked={selectedObject.isUI || false} onChange={(e) => handleUpdate({ isUI: e.target.checked })} className="form-checkbox bg-gray-700 border-gray-600 text-indigo-500 focus:ring-indigo-500" />
                            {t('properties.isUI')}
                        </label>
                        {selectedObject.isUI && (
                            <>
                            <PropertyInput label={t('properties.textContent')} value={selectedObject.text || ''} onChange={(val) => handleUpdate({ text: val as string })} />
                             <div className="flex flex-col">
                                <label className="text-xs text-gray-400 mb-1">{t('properties.buttonAction')}</label>
                                <select
                                    value={selectedObject.controlAction || 'none'}
                                    onChange={(e) => handleUpdate({ controlAction: e.target.value as any })}
                                    className="bg-gray-800 border border-gray-700 rounded-md px-2 py-1.5 text-sm w-full focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                >
                                    <option value="none">{t('properties.none')}</option>
                                    <option value="moveLeft">{t('properties.moveLeft')}</option>
                                    <option value="moveRight">{t('properties.moveRight')}</option>
                                    <option value="moveUp">{t('properties.moveUp')}</option>
                                    <option value="moveDown">{t('properties.moveDown')}</option>
                                    <option value="jump">{t('properties.jump')}</option>
                                    <option value="attack">{t('properties.attack')}</option>
                                </select>
                            </div>
                            </>
                        )}
                    </div>

                    <ObjectVariablesEditor 
                        variables={selectedObject.variables || []}
                        onUpdate={handleUpdateObjectVariables}
                    />

                    <ObjectScriptsEditor 
                        scripts={selectedObject.scripts || []} 
                        onUpdate={handleUpdateObjectScripts}
                        projectData={projectData}
                    />


                    <div className="pt-4 border-t border-gray-800 space-y-2">
                        <h3 className="font-semibold mb-2">{t('properties.behaviors')}</h3>
                        {selectedObject.behaviors?.map(behavior => (
                            <div key={behavior.name} className="bg-gray-800/50 p-2 rounded-md border border-gray-700">
                                <div className="flex justify-between items-center mb-2">
                                    <h4 className="text-sm font-bold text-indigo-300">{behavior.name}</h4>
                                    <button onClick={() => handleRemoveBehavior(behavior.name)} title={t('common.delete')} className="p-1 hover:bg-red-500/50 rounded-full"><TrashIcon /></button>
                                </div>
                                <div className="space-y-2">
                                    {Object.entries(behavior.properties).map(([key, value]) => {
                                        if (behavior.name === 'Tilemap' && key === 'collisionData') {
                                            return (
                                                <div key={key} className="flex flex-col">
                                                    <label className="text-xs text-gray-400 mb-1">{key}</label>
                                                    <textarea
                                                        value={value}
                                                        onChange={(e) => handleUpdateBehaviorProperty(behavior.name, key, e.target.value)}
                                                        className="bg-gray-800 border border-gray-700 rounded-md px-2 py-1.5 text-sm w-full h-32 font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                                        placeholder={t('properties.tilemapPlaceholder')}
                                                    />
                                                </div>
                                            )
                                        }
                                        return (
                                            <PropertyInput 
                                                key={key}
                                                label={key}
                                                value={value}
                                                type={typeof value === 'number' ? 'number' : 'text'}
                                                onChange={(val) => handleUpdateBehaviorProperty(behavior.name, key, val)}
                                            />
                                        )
                                    })}
                                </div>
                            </div>
                        ))}
                        <button 
                        className="w-full flex items-center justify-center gap-2 bg-gray-800 hover:bg-indigo-600 px-3 py-2 rounded-md transition-colors text-sm"
                        onClick={() => setIsBehaviorModalOpen(true)}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg>
                            {t('properties.addBehavior')}
                        </button>
                    </div>
                </div>
            </>
        ) : (
             <>
                <div className="p-2 border-b border-gray-800 flex justify-between items-center">
                    <button onClick={onToggleCollapse} title={t('common.close')} className="p-2 -ml-2 hover:bg-gray-800 rounded-md hidden md:block">
                        <CollapseIcon />
                    </button>
                    <h2 className="text-lg font-semibold">{t('sidebar.properties')}</h2>
                    <div className="w-8"></div>
                </div>
                <div className="flex-grow p-4 overflow-y-auto">
                    {activeScene ? (
                        <>
                           <ScenePropertiesEditor scene={activeScene} onUpdate={(updates) => onUpdateScene(activeScene.id, updates)} assets={assets} />
                           <GameSettingsEditor projectData={projectData} onUpdate={onUpdateProjectData} />
                        </>
                    ) : (
                        <p className="text-sm text-gray-500 text-center">{t('properties.noActiveScene')}</p>
                    )}
                </div>
             </>
        )}
        <GlobalVariablesEditor variables={globalVariables} onUpdate={onUpdateGlobalVariables} />
    </aside>
  );
};

export default PropertiesInspector;
