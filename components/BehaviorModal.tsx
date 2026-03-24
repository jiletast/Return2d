
import React from 'react';
import { availableBehaviors, BehaviorDefinition } from '../behaviors/definitions';
import { useLanguage } from '../LanguageContext';

interface BehaviorModalProps {
  onClose: () => void;
  onAddBehavior: (behavior: BehaviorDefinition) => void;
}

export const BehaviorModal: React.FC<BehaviorModalProps> = ({ onClose, onAddBehavior }) => {
  const { t } = useLanguage();
  return (
    <div className="absolute inset-0 bg-gray-900 bg-opacity-80 z-20 flex flex-col p-2" onClick={onClose}>
        <div className="bg-gray-800 rounded-lg p-2 border border-gray-700 flex flex-col max-h-full" onClick={e => e.stopPropagation()}>
            <h4 className="text-sm font-bold mb-2 p-2 text-center border-b border-gray-700">{t('behaviorModal.title')}</h4>
            <ul className="flex-grow overflow-y-auto">
                {availableBehaviors.map(behavior => (
                    <li 
                        key={behavior.name} 
                        className="p-2 rounded-md hover:bg-indigo-600 cursor-pointer"
                        onClick={() => onAddBehavior(behavior)}
                    >
                        <h5 className="font-semibold">{t(`behavior.${behavior.name}.name`)}</h5>
                        <p className="text-xs text-gray-400">{t(`behavior.${behavior.name}.description`)}</p>
                    </li>
                ))}
            </ul>
        </div>
    </div>
  );
};