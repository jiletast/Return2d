
import React, { useEffect, useRef, useState, useCallback } from 'react';
import type { Scene, GameObject, Animation, GameAsset, Behavior, Variable, Action, Condition, CollisionProperties, ProjectData } from '../types';

export interface GameState {
  gameObjects: GameObject[];
  gameVariables: Record<string, any>;
}

interface GameViewProps {
  scene: Scene;
  allScenes: Scene[];
  animations: Animation[];
  assets: GameAsset[];
  globalVariables: Variable[];
  gameWidth: number;
  gameHeight: number;
  joystick?: ProjectData['joystick'];
  initialState?: GameState;
  onExit: (finalState: GameState) => void;
  onGoToScene: (sceneName: string) => void;
}

interface ActiveAnimation {
    animation: Animation;
    startTime: number;
}

const getObjectAbsolutePosition = (objectId: number, objectsById: Map<number, GameObject>): { x: number; y: number } => {
    let currentId: number | null | undefined = objectId;
    let totalX = 0;
    let totalY = 0;
    let safety = 100; // Prevent infinite loops
    while(currentId && safety-- > 0) {
        const obj = objectsById.get(currentId);
        if (!obj) break;
        totalX += obj.x;
        totalY += obj.y;
        currentId = obj.parentId;
    }
    return { x: totalX, y: totalY };
};

const getCollisionBox = (objWithAbsPos: GameObject & {x: number, y: number}): {x: number, y: number, width: number, height: number} => {
    const scaleX = Math.abs(objWithAbsPos.scaleX ?? 1);
    const scaleY = Math.abs(objWithAbsPos.scaleY ?? 1);
    
    // Calculate the top-left corner of the object as if it were scaled from its center
    const scaledVisualWidth = objWithAbsPos.width * scaleX;
    const scaledVisualHeight = objWithAbsPos.height * scaleY;
    const visualX = objWithAbsPos.x + (objWithAbsPos.width - scaledVisualWidth) / 2;
    const visualY = objWithAbsPos.y + (objWithAbsPos.height - scaledVisualHeight) / 2;

    if (objWithAbsPos.useCustomCollision && objWithAbsPos.collision) {
        // If there's a custom collision box, scale it and position it relative to the scaled visual bounds
        const scaledCollisionWidth = objWithAbsPos.collision.width * scaleX;
        const scaledCollisionHeight = objWithAbsPos.collision.height * scaleY;
        const scaledOffsetX = objWithAbsPos.collision.offsetX * scaleX;
        const scaledOffsetY = objWithAbsPos.collision.offsetY * scaleY;

        return {
            x: visualX + scaledOffsetX,
            y: visualY + scaledOffsetY,
            width: scaledCollisionWidth,
            height: scaledCollisionHeight,
        };
    }

    // Otherwise, use the scaled visual bounds as the collision box
    return { x: visualX, y: visualY, width: scaledVisualWidth, height: scaledVisualHeight };
};


const GameView: React.FC<GameViewProps> = ({ scene, allScenes, animations, assets, globalVariables, gameWidth, gameHeight, joystick, initialState, onExit, onGoToScene }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameObjectsRef = useRef<GameObject[]>([]);
  const keysPressed = useRef<Record<string, boolean>>({});
  const actionsPressed = useRef<Record<string, any>>({});
  const gameVariables = useRef<Record<string, string | number | boolean>>({});
  const activeAnimations = useRef<Map<number, ActiveAnimation>>(new Map());
  const imageCache = useRef<Map<string, HTMLImageElement>>(new Map());
  const audioCache = useRef<Map<string, HTMLAudioElement>>(new Map());
  const videoCache = useRef<Map<string, HTMLVideoElement>>(new Map());
  const camera = useRef({ x: 0, y: 0, zoom: 1 });
  const [uiObjects, setUiObjects] = useState<GameObject[]>([]);
  const backgroundMusicPlayer = useRef<HTMLAudioElement | null>(null);
  const currentBackgroundMusicId = useRef<string | null>(null);
  const [runtimeBackgroundColor, setRuntimeBackgroundColor] = useState(scene.backgroundColor);
  const [dialogue, setDialogue] = useState<{ text: string; speaker?: string } | null>(null);
  
  const frameCollisions = useRef<{obj1Name: string, obj2Name: string, type: string}[]>([]);
  const frameClicks = useRef<string[]>([]);
  const frameJoystickEvents = useRef<string[]>([]);
  const frameTimerEvents = useRef<string[]>([]);
  const frameAttacks = useRef<string[]>([]);
  const frameKeyPresses = useRef<string[]>([]);
  const timersRef = useRef<Map<string, { startTime: number; duration: number }>>(new Map());
  const intervalsRef = useRef<Map<string, { interval: number; lastTriggerTime: number }>>(new Map());

  const joystickState = useRef({ active: false, angle: 0, distance: 0 });
  const joystickBaseRef = useRef<HTMLDivElement>(null);
  const joystickHandleRef = useRef<HTMLDivElement>(null);
  const joystickTouchId = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const joystickUpPreviousFrame = useRef(false);

    const executeAction = (action: Action, self?: GameObject, forceRestart: boolean = false) => {
      let targetObj : GameObject | undefined;
      if (action.object === 'Self' && self) {
          targetObj = gameObjectsRef.current.find(o => o.id === self.id);
      } else {
          targetObj = gameObjectsRef.current.find(o => o.name === action.object);
      }

      if (!targetObj && action.object !== 'System') return;


      switch (action.action) {
          case 'Destroy':
              if (targetObj) gameObjectsRef.current = gameObjectsRef.current.filter(o => o.id !== targetObj!.id);
              break;
          case 'SetVariable':
              if (action.params?.variable) gameVariables.current[action.params.variable] = action.params.value;
              break;
          case 'AddToVariable':
              if (action.params?.variable) {
                  const currentVal = Number(gameVariables.current[action.params.variable] || 0);
                  const toAdd = Number(action.params.value || 0);
                  gameVariables.current[action.params.variable] = currentVal + toAdd;
              }
              break;
          case 'SetObjectVariable':
              if (targetObj && action.params?.variable) {
                  if (!targetObj.variables) targetObj.variables = [];
                  const v = targetObj.variables.find(v => v.name === action.params.variable);
                  if (v) v.value = action.params.value;
                  else targetObj.variables.push({ name: action.params.variable, value: action.params.value });
              }
              break;
          case 'AddToObjectVariable':
              if (targetObj && action.params?.variable) {
                  if (!targetObj.variables) targetObj.variables = [];
                  const v = targetObj.variables.find(v => v.name === action.params.variable);
                  const toAdd = Number(action.params.value || 0);
                  if (v) v.value = Number(v.value || 0) + toAdd;
                  else targetObj.variables.push({ name: action.params.variable, value: toAdd });
              }
              break;
          case 'GoToScene':
              if (action.params?.sceneName) onGoToScene(action.params.sceneName);
              break;
          case 'PlayAnimation':
              if(targetObj && action.params?.animationId) {
                  const animId = String(action.params.animationId);
                  const anim = animations.find(a => a.id === animId);
                  if (anim) {
                      const currentAnim = activeAnimations.current.get(targetObj.id);
                      if (forceRestart || !currentAnim || currentAnim.animation.id !== anim.id) {
                          activeAnimations.current.set(targetObj.id, {
                              animation: anim,
                              startTime: performance.now(),
                          });
                      }
                  }
              }
              break;
          case 'SetUIText':
              if (targetObj && targetObj.isUI && typeof action.params?.text === 'string') {
                  targetObj.text = action.params.text;
              }
              break;
          case 'SetObjectPosition':
              if (targetObj && action.params?.x != null && action.params?.y != null) {
                  targetObj.x = Number(action.params.x);
                  targetObj.y = Number(action.params.y);
              }
              break;
          case 'MoveObject':
                if (targetObj && action.params?.direction && action.params?.speed != null) {
                    const speed = Number(action.params.speed);
                    if (!targetObj.pendingMovements) targetObj.pendingMovements = [];
                    targetObj.pendingMovements.push({ direction: action.params.direction, speed });
                }
                break;
          case 'SetVelocityX':
                if (targetObj && action.params?.velocity != null) {
                    targetObj.vx = Number(action.params.velocity);
                }
                break;
          case 'SetVelocityY':
                if (targetObj && action.params?.velocity != null) {
                    targetObj.vy = Number(action.params.velocity);
                }
                break;
          case 'SetRotationSpeed':
                if (targetObj && action.params?.speed != null) {
                    targetObj.rotationSpeed = Number(action.params.speed);
                }
                break;
            case 'OscillateObject':
                if (targetObj && action.params?.axis && action.params?.distance != null && action.params?.speed != null) {
                    targetObj.oscillation = {
                        axis: action.params.axis as 'x' | 'y',
                        distance: Number(action.params.distance),
                        speed: Number(action.params.speed),
                        initialX: targetObj.initialX ?? targetObj.x,
                        initialY: targetObj.initialY ?? targetObj.y,
                        startTime: performance.now()
                    };
                    if (targetObj.initialX === undefined) targetObj.initialX = targetObj.x;
                    if (targetObj.initialY === undefined) targetObj.initialY = targetObj.y;
                }
                break;
            case 'OscillateScale':
                if (targetObj && action.params?.distance != null && action.params?.speed != null) {
                    targetObj.scaleOscillation = {
                        distance: Number(action.params.distance),
                        speed: Number(action.params.speed),
                        initialScaleX: targetObj.initialScaleX ?? (targetObj.scaleX || 1),
                        initialScaleY: targetObj.initialScaleY ?? (targetObj.scaleY || 1),
                        startTime: performance.now()
                    };
                    if (targetObj.initialScaleX === undefined) targetObj.initialScaleX = targetObj.scaleX || 1;
                    if (targetObj.initialScaleY === undefined) targetObj.initialScaleY = targetObj.scaleY || 1;
                }
                break;
            case 'RotateContinuously':
                if (targetObj && action.params?.speed != null) {
                    targetObj.rotationSpeed = Number(action.params.speed);
                }
                break;
            case 'RotateObject':
                if (targetObj && action.params?.rotation != null) {
                    const rotation = Number(action.params.rotation || 0);
                    targetObj.rotation = ((targetObj.rotation || 0) + rotation) % 360;
                    if (targetObj.rotation < 0) targetObj.rotation += 360;
                }
                break;
            case 'ScaleObject':
                if (targetObj && action.params?.scaleX != null && action.params?.scaleY != null) {
                    const scaleX = Number(action.params.scaleX || 1);
                    const scaleY = Number(action.params.scaleY || 1);
                    targetObj.scaleX = Math.max(0.01, (targetObj.scaleX ?? 1) * scaleX);
                    targetObj.scaleY = Math.max(0.01, (targetObj.scaleY ?? 1) * scaleY);
                }
                break;
            case 'SetScale':
                if (targetObj && action.params?.scaleX != null && action.params?.scaleY != null) {
                    targetObj.scaleX = Math.max(0.01, Number(action.params.scaleX));
                    targetObj.scaleY = Math.max(0.01, Number(action.params.scaleY));
                }
                break;
            case 'GenerateObjectAt':
                if (action.params?.templateObjectName && action.params?.targetObjectName) {
                    const templateObj = scene.gameObjects.find(o => o.name === action.params.templateObjectName);
                    const targetObjRef = gameObjectsRef.current.find(o => o.name === action.params.targetObjectName);
                    if (templateObj && targetObjRef) {
                        const newObj = {
                            ...JSON.parse(JSON.stringify(templateObj)),
                            id: Date.now() + Math.random(),
                            x: targetObjRef.x,
                            y: targetObjRef.y
                        };
                        gameObjectsRef.current.push(newObj);
                    }
                }
                break;
            case 'SetQuestState':
                if (action.params?.questId && action.params?.questState) {
                    gameVariables.current['quest_' + action.params.questId] = action.params.questState;
                }
                break;
            case 'ForceJump':
                if (targetObj && targetObj.behaviors?.some(b => ['PlatformerCharacter', 'Physics'].includes(b.name)) && action.params?.jumpForce != null) {
                    targetObj.vy = -Number(action.params.jumpForce);
                    targetObj.grounded = false;
                }
                break;
            case 'TriggerAttack':
                if (targetObj) {
                    frameAttacks.current.push(targetObj.name);
                }
                break;
            case 'SetParent':
                if (targetObj) {
                    if (!action.params?.parentName) {
                        targetObj.parentId = null;
                    } else {
                        const parentObj = gameObjectsRef.current.find(o => o.name === action.params.parentName);
                        if (parentObj) {
                            targetObj.parentId = parentObj.id;
                        }
                    }
                }
                break;
          case 'PlaySound':
                if (action.params?.soundId) {
                    const soundAsset = assets.find(a => a.id === action.params.soundId);
                    if (soundAsset) {
                        const cachedAudio = audioCache.current.get(soundAsset.url);
                        if (cachedAudio) {
                            const audioToPlay = cachedAudio.cloneNode() as HTMLAudioElement;
                            audioToPlay.play().catch(() => {});
                        }
                    }
                }
              break;
            case 'SetBackgroundMusic':
                if (action.params?.soundId) {
                    if (backgroundMusicPlayer.current) {
                        backgroundMusicPlayer.current.pause();
                        backgroundMusicPlayer.current = null;
                    }
                    const musicAsset = assets.find(a => a.id === action.params.soundId);
                    if (musicAsset) {
                        currentBackgroundMusicId.current = musicAsset.id;
                        const cachedAudio = audioCache.current.get(musicAsset.url);
                        if (cachedAudio) {
                            const audio = cachedAudio.cloneNode() as HTMLAudioElement;
                            audio.loop = true;
                            audio.play().catch(e => console.error("Error playing background music:", e));
                            backgroundMusicPlayer.current = audio;
                        }
                    }
                }
                break;
            case 'StopBackgroundMusic':
                if (backgroundMusicPlayer.current) {
                    backgroundMusicPlayer.current.pause();
                    backgroundMusicPlayer.current.currentTime = 0;
                    backgroundMusicPlayer.current = null;
                    currentBackgroundMusicId.current = null;
                }
                break;
            case 'PauseBackgroundMusic':
                if (backgroundMusicPlayer.current) {
                    backgroundMusicPlayer.current.pause();
                }
                break;
            case 'ResumeBackgroundMusic':
                if (backgroundMusicPlayer.current) {
                    backgroundMusicPlayer.current.play().catch(() => {});
                }
                break;
            case 'SetBackgroundMusicVolume':
                if (backgroundMusicPlayer.current && action.params?.volume != null) {
                    const volume = Math.max(0, Math.min(100, Number(action.params.volume))) / 100;
                    backgroundMusicPlayer.current.volume = volume;
                }
                break;
          case 'SetBackgroundColor':
                if(action.params?.color) setRuntimeBackgroundColor(action.params.color);
              break;
          case 'PlayVideo':
              if (targetObj?.videoUrl) {
                  const video = videoCache.current.get(targetObj.videoUrl);
                  if (video) video.play().catch(()=>{});
              }
              break;
          case 'PauseVideo':
              if (targetObj?.videoUrl) {
                  const video = videoCache.current.get(targetObj.videoUrl);
                  if (video) video.pause();
              }
              break;
          case 'StopVideo':
              if (targetObj?.videoUrl) {
                  const video = videoCache.current.get(targetObj.videoUrl);
                  if (video) {
                      video.pause();
                      video.currentTime = 0;
                  }
              }
              break;
          case 'SetCameraZoom':
              if (action.params?.zoomLevel) {
                  camera.current.zoom = Math.max(0.1, Number(action.params.zoomLevel));
              }
              break;
           case 'SaveGame':
              if (action.params?.slot) {
                  try {
                      const gameState = {
                          sceneName: scene.name,
                          gameObjects: gameObjectsRef.current,
                          gameVariables: gameVariables.current,
                          camera: camera.current,
                      };
                      localStorage.setItem('return-2d-save-slot-' + action.params.slot, JSON.stringify(gameState));
                      console.log('Game saved to slot ' + action.params.slot);
                  } catch (e) { console.error('Error saving game state:', e); }
              }
              break;
          case 'LoadGame':
              if (action.params?.slot) {
                  try {
                      const savedStateJSON = localStorage.getItem('return-2d-save-slot-' + action.params.slot);
                      if (savedStateJSON) {
                          const savedState = JSON.parse(savedStateJSON);
                          if (savedState.sceneName !== scene.name) {
                              onGoToScene(savedState.sceneName); 
                          }
                          gameObjectsRef.current = savedState.gameObjects;
                          gameVariables.current = savedState.gameVariables;
                          camera.current = savedState.camera;
                          console.log('Game loaded from slot ' + action.params.slot);
                      }
                  } catch(e) { console.error('Error loading game state:', e); }
              }
              break;
            case 'StartTimer':
                if (action.params?.timerName && action.params?.duration != null) {
                    timersRef.current.set(action.params.timerName, {
                        startTime: performance.now(),
                        duration: Number(action.params.duration) * 1000
                    });
                }
                break;
            case 'StopTimer':
                if (action.params?.timerName) {
                    timersRef.current.delete(action.params.timerName);
                }
                break;
          case 'ModifyStat':
              if (targetObj?.stats && action.params?.stat && action.params?.operation && action.params?.value != null) {
                  const stat = action.params.stat as keyof GameObject['stats'];
                  const operation = action.params.operation;
                  const value = Number(action.params.value);
                  let currentVal = targetObj.stats[stat] || 0;
                  
                  if (operation === 'add') currentVal += value;
                  else if (operation === 'subtract') currentVal -= value;
                  else if (operation === 'set') currentVal = value;
                  
                  if (stat === 'hp') {
                      targetObj.stats.hp = Math.max(0, Math.min(targetObj.stats.maxHp, currentVal));
                  } else {
                      targetObj.stats[stat] = currentVal;
                  }
              }
              break;
          case 'ShowDialogue':
              if (action.params?.dialogueText) {
                  setDialogue({ text: action.params.dialogueText, speaker: action.object });
              }
              break;
          case 'SetQuestState':
                if (action.params?.questId && action.params?.questState) {
                    gameVariables.current['quest_' + action.params.questId] = action.params.questState;
                }
                break;
          case 'CreateMatch':
              console.log('Action: CreateMatch triggered.', action.params);
              break;
          case 'JoinMatch':
              console.log('Action: JoinMatch triggered.', action.params);
              break;
          case 'SendNetworkMessage':
              console.log('Action: SendNetworkMessage triggered.', action.params);
              break;
          case 'SetPlayerName':
                console.log('Action: SetPlayerName triggered.', action.params);
              break;
          case 'CreateObject':
              if (!action.params || !action.params.templateObjectName) break;
              
              const template = scene.gameObjects.find(o => o.name === action.params.templateObjectName);
              if (!template) {
                  console.error('Template object "'+action.params.templateObjectName+'" not found in scene definition.');
                  break;
              }

              const newObject = JSON.parse(JSON.stringify(template));
              newObject.id = Date.now() + Math.random();
              
              let spawnX = 0;
              let spawnY = 0;

              if (action.params.positionType === 'relativeToObject' && action.params.relativeToObjectName) {
                  const relativeToObj = gameObjectsRef.current.find(o => o.name === action.params.relativeToObjectName);
                  if (relativeToObj) {
                      const objectsByIdMap = new Map<number, GameObject>(gameObjectsRef.current.map(o => [o.id, o]));
                      const parentAbsPos = getObjectAbsolutePosition(relativeToObj.id, objectsByIdMap);
                      spawnX = parentAbsPos.x + (Number(action.params.offsetX) || 0);
                      spawnY = parentAbsPos.y + (Number(action.params.offsetY) || 0);
                  }
              } else {
                  spawnX = Number(action.params.x) || 0;
                  spawnY = Number(action.params.y) || 0;
              }
              
              newObject.x = spawnX;
              newObject.y = spawnY;
              newObject.parentId = null;
              newObject.vx = 0;
              newObject.vy = 0;
              newObject.grounded = false;

              gameObjectsRef.current.push(newObject);
              break;
      }
  };

  const checkCondition = (cond: Condition) => {
    const { variable, operator, value } = cond.params || {};
    const obj = gameObjectsRef.current.find(o => o.name === cond.object);
    
    switch (cond.trigger) {
        case 'Always':
            return true;
        case 'OnCollisionWith':
        case 'OnVerticalCollision':
        case 'OnHorizontalCollision':
            return frameCollisions.current.some(c => {
                const pairMatch = ((c.obj1Name === cond.object && c.obj2Name === cond.target) || (c.obj2Name === cond.object && c.obj1Name === cond.target));
                if (!pairMatch) return false;

                if (cond.trigger === 'OnCollisionWith') {
                    // Generic 'OnCollisionWith' matches any collision type
                    return true;
                } else {
                    // Specific triggers must match specific collision types
                    return c.type === cond.trigger;
                }
            });
        case 'OnObjectClicked':
            return frameClicks.current.includes(cond.object);
        case 'OnKeyPress':
            return cond.params?.key && frameKeyPresses.current.includes(cond.params.key.toLowerCase());
        case 'OnAnyKeyPress':
            return frameKeyPresses.current.length > 0;
        case 'OnAttack':
            return frameAttacks.current.includes(cond.object);
        case 'OnTimerElapsed':
            return frameTimerEvents.current.includes(cond.params?.timerName);
        case 'CompareVariable':
             if (!variable) return false;
            const varValue = gameVariables.current[variable];
            const compareValue = isNaN(Number(value)) ? value : Number(value);
            switch (operator) {
                case '==': return varValue == compareValue;
                case '!=': return varValue != compareValue;
                case '>': return varValue > compareValue;
                case '<': return varValue < compareValue;
                case '>=': return varValue >= compareValue;
                case '<=': return varValue <= compareValue;
                default: return false;
            }
        case 'CompareObjectVariable': {
            if (!obj?.variables || !variable) return false;
            const objVar = obj.variables.find(v => v.name === variable);
            if (!objVar) return false;
            const objVarValue = objVar.value;
            const compareValue = isNaN(Number(value)) ? value : Number(value);
            switch (operator) {
                case '==': return objVarValue == compareValue;
                case '!=': return objVarValue != compareValue;
                case '>': return objVarValue > compareValue;
                case '<': return objVarValue < compareValue;
                case '>=': return objVarValue >= compareValue;
                case '<=': return objVarValue <= compareValue;
                default: return false;
            }
        }
        case 'CompareStat': {
            if (!obj?.stats || !cond.params?.stat) return false;
            const statName = cond.params.stat as keyof GameObject['stats'];
            const statValue = obj.stats[statName];
            if (statValue === undefined) return false;
            const compareValue = isNaN(Number(value)) ? value : Number(value);
            switch (operator) {
                case '==': return statValue == compareValue;
                case '!=': return statValue != compareValue;
                case '>': return statValue > compareValue;
                case '<': return statValue < compareValue;
                case '>=': return statValue >= compareValue;
                case '<=': return statValue <= compareValue;
                default: return false;
            }
        }
        case 'IsOnGround': return obj && !!obj.grounded;
        case 'IsMoving': return obj && ((obj.vx || 0) !== 0 || (obj.vy || 0) !== 0);
        case 'IsIdle': return obj && (obj.vx || 0) === 0 && (obj.vy || 0) === 0 && !!obj.grounded;
        case 'IsRunning': return obj && (obj.vx || 0) !== 0 && !!obj.grounded;
        case 'IsJumping': return obj && !obj.grounded;
        case 'IsMusicPlaying':
            const isPlaying = backgroundMusicPlayer.current && !backgroundMusicPlayer.current.paused;
            if (!isPlaying) return false;
            if (cond.params?.soundId) return currentBackgroundMusicId.current === cond.params.soundId;
            return true;
        case 'OnJoystickMove':
            return frameJoystickEvents.current.length > 0;
        case 'OnJoystickUp':
            return frameJoystickEvents.current.includes('up');
        case 'OnJoystickDown':
            return frameJoystickEvents.current.includes('down');
        case 'OnJoystickLeft':
            return frameJoystickEvents.current.includes('left');
        case 'OnJoystickRight':
            return frameJoystickEvents.current.includes('right');
        default: return false;
    }
};

  const evaluateEvents = () => {
      scene.events.forEach(event => {
        // These events are handled differently or are edge-triggered.
        if (event.conditions.some(c => c.trigger === 'OnStart' || c.trigger === 'EveryXSeconds')) {
            return;
        }
        const conditionsMet = event.conditions.every(checkCondition);
        if (conditionsMet) {
            const isEventTrigger = event.conditions.some(c => ['OnClick', 'OnCollisionWith', 'OnKeyPress', 'OnAttack', 'OnTimerElapsed'].includes(c.trigger));
            event.actions.forEach(action => executeAction(action, undefined, isEventTrigger));
        }
      });
  };

  useEffect(() => {
    setRuntimeBackgroundColor(scene.backgroundColor);
    camera.current.zoom = scene.defaultZoom || 1;
    
    if (initialState) {
        gameObjectsRef.current = JSON.parse(JSON.stringify(initialState.gameObjects));
        gameVariables.current = JSON.parse(JSON.stringify(initialState.gameVariables));
    } else {
        gameObjectsRef.current = JSON.parse(JSON.stringify(scene.gameObjects.map(o => ({
            ...o,
            vx: 0, vy: 0, grounded: false,
        }))));
        
        const initialVars: Record<string, string | number | boolean> = {};
        globalVariables.forEach(v => { initialVars[v.name] = v.value; });
        gameVariables.current = initialVars;
    }
    
    activeAnimations.current.clear();
    timersRef.current.clear();
    intervalsRef.current.clear();
    setDialogue(null);

    if (backgroundMusicPlayer.current) {
        backgroundMusicPlayer.current.pause();
        backgroundMusicPlayer.current = null;
        currentBackgroundMusicId.current = null;
    }
    if (scene.backgroundMusicId) {
        const musicAsset = assets.find(a => a.id === scene.backgroundMusicId);
        if (musicAsset) {
            currentBackgroundMusicId.current = musicAsset.id;
            const cachedAudio = audioCache.current.get(musicAsset.url);
            if(cachedAudio){
                const audio = cachedAudio.cloneNode() as HTMLAudioElement;
                audio.loop = true;
                audio.play().catch(e => console.error("Error playing background music:", e));
                backgroundMusicPlayer.current = audio;
            }
        }
    }

    // Handle OnStart events separately on load, only if it's not a resumed state
    if (!initialState) {
        scene.events.forEach(event => {
            const isAllOnStart = event.conditions.every(c => c.trigger === 'OnStart');
            if (isAllOnStart) {
                event.actions.forEach(action => executeAction(action, undefined));
            }
        });
        gameObjectsRef.current.forEach(obj => {
            obj.scripts?.forEach(script => {
                if (script.trigger === 'OnStart') {
                    script.actions.forEach(action => executeAction(action, obj));
                }
            });
        });
    }

    const handleKeyDown = (e: KeyboardEvent) => { 
        const key = e.key.toLowerCase();
        const code = e.code.toLowerCase();
        if (!keysPressed.current[key] && !keysPressed.current[code]) {
            frameKeyPresses.current.push(key);
            frameKeyPresses.current.push(code);
        }
        keysPressed.current[code] = true; 
        keysPressed.current[key] = true;
    };
    const handleKeyUp = (e: KeyboardEvent) => { 
        keysPressed.current[e.code.toLowerCase()] = false; 
        keysPressed.current[e.key.toLowerCase()] = false;
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    let lastTime = 0;
    let animationFrameId: number;

    const gameLoop = (timestamp: number) => {
      const now = performance.now();
      if (lastTime === 0) {
        lastTime = now;
        animationFrameId = requestAnimationFrame(gameLoop);
        return;
      }
      const deltaTime = Math.min(0.1, (now - lastTime) / 1000.0);
      lastTime = now;

      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      ctx.imageSmoothingEnabled = true;

      // Process timers and intervals
      timersRef.current.forEach((timer, name) => {
          if (now >= timer.startTime + timer.duration) {
              frameTimerEvents.current.push(name);
              timersRef.current.delete(name);
          }
      });
      scene.events.forEach((event, eventIndex) => {
          event.conditions.forEach((cond, condIndex) => {
              if (cond.trigger === 'EveryXSeconds' && cond.params?.interval) {
                  const key = `evt-${event.id || eventIndex}-cond-${condIndex}`;
                  const intervalData = intervalsRef.current.get(key);
                  const intervalMs = Number(cond.params.interval) * 1000;
                  if (!intervalData) {
                      intervalsRef.current.set(key, { interval: intervalMs, lastTriggerTime: now });
                  } else if (now >= intervalData.lastTriggerTime + intervalData.interval) {
                      const otherConditionsMet = event.conditions.filter(c => c !== cond).every(checkCondition);
                      if(otherConditionsMet) {
                          event.actions.forEach(action => executeAction(action));
                      }
                      intervalData.lastTriggerTime = now;
                  }
              }
          });
      });

      const objectsById = new Map<number, GameObject>(gameObjectsRef.current.map(o => [o.id, o]));
      
      const staticCollisionShapes: ({ x: number; y: number; width: number; height: number; owner: GameObject })[] = [];
        const allObjectsWithAbsPosForPhysics = gameObjectsRef.current.map(o => ({...o, ...getObjectAbsolutePosition(o.id, objectsById)}));
        
        allObjectsWithAbsPosForPhysics.forEach(obj => {
            if (obj.behaviors?.some(b => b.name === 'Solid')) {
                staticCollisionShapes.push({ ...getCollisionBox(obj), owner: obj });
            }
            const tilemapBehavior = obj.behaviors?.find(b => b.name === 'Tilemap');
            if (tilemapBehavior) {
                const { tileSize = 32, collisionData = '' } = tilemapBehavior.properties;
                const rows = String(collisionData).split('\n');
                rows.forEach((row, y) => {
                    for (let x = 0; x < row.length; x++) {
                        if (row[x] !== ' ' && row[x] !== '0') {
                            staticCollisionShapes.push({
                                x: obj.x + x * tileSize,
                                y: obj.y + y * tileSize,
                                width: tileSize,
                                height: tileSize,
                                owner: obj,
                            });
                        }
                    }
                });
            }
        });


      frameJoystickEvents.current = [];
      const actions = actionsPressed.current;
      
      // Reset non-UI actions and intensity
      ['moveLeft','moveRight','moveUp','moveDown','jump','attack'].forEach(act => {
        if (!actions[act+'_ui']) actions[act] = false;
      });
      actions.moveHorizontalIntensity = 0;

      const joystickUpNow = joystickState.current.active && joystickState.current.angle > -135 && joystickState.current.angle < -45;
      
      if (joystickUpNow && !joystickUpPreviousFrame.current) {
          actions.jump = true;
      }
      joystickUpPreviousFrame.current = joystickUpNow;

      if (joystickState.current.active) {
          const joystickSize = joystick?.size ?? 120;
          const maxDistance = joystickSize / 2;
          const intensity = joystickState.current.distance / maxDistance;
          const angle = joystickState.current.angle;
          const angleRad = angle * (Math.PI / 180);
          const horizontalProjection = Math.cos(angleRad);
          
          if (Math.abs(horizontalProjection) > 0.15) { // Threshold
             actions.moveHorizontalIntensity = horizontalProjection * intensity;
             if (horizontalProjection > 0) {
                 actions.moveRight = true;
                 if (!frameJoystickEvents.current.includes('right')) frameJoystickEvents.current.push('right');
             } else {
                 actions.moveLeft = true;
                 if (!frameJoystickEvents.current.includes('left')) frameJoystickEvents.current.push('left');
             }
          }

          // Keep vertical logic for events
          if (angle > 45 && angle < 135) {
             actions.moveDown = true;
             if (!frameJoystickEvents.current.includes('down')) frameJoystickEvents.current.push('down');
          }

          if (joystickUpNow) {
              actions.moveUp = true;
              if (!frameJoystickEvents.current.includes('up')) frameJoystickEvents.current.push('up');
          }
      }
      
      // Keyboard input overrides joystick for horizontal movement intensity
      let keyboardHorizontal = 0;
      if (keysPressed.current['arrowleft'] || keysPressed.current['keya']) keyboardHorizontal -= 1;
      if (keysPressed.current['arrowright'] || keysPressed.current['keyd']) keyboardHorizontal += 1;
      
      if (keyboardHorizontal !== 0) {
          actions.moveHorizontalIntensity = keyboardHorizontal;
      }

      // Set digital actions for events from keyboard
      if (keysPressed.current['arrowleft'] || keysPressed.current['keya']) actions.moveLeft = true;
      if (keysPressed.current['arrowright'] || keysPressed.current['keyd']) actions.moveRight = true;
      if (keysPressed.current['arrowup'] || keysPressed.current['keyw']) actions.moveUp = true;
      if (keysPressed.current['arrowdown'] || keysPressed.current['keys']) actions.moveDown = true;
      if (keysPressed.current['space']) actions.jump = true;
      if (keysPressed.current['keyx'] || actions.attack) actions.attack = true;
      
      // Handle single-press actions like jump and attack
      if (actions.jump) {
        if (!actions.jumpPressed) {
            actions.jumpAction = true;
            actions.jumpPressed = true;
        } else {
            actions.jumpAction = false;
        }
      } else {
          actions.jumpPressed = false;
          actions.jumpAction = false;
      }

      if (actions.attack) {
          if (!actions.attackPressed) {
              actions.attackAction = true;
              actions.attackPressed = true;
          } else {
              actions.attackAction = false;
          }
      } else {
          actions.attackPressed = false;
          actions.attackAction = false;
      }

      gameObjectsRef.current.forEach(obj => {
          obj.scripts?.forEach(script => {
            if (script.trigger === 'OnUpdate' || script.trigger === 'Always') {
                script.actions.forEach(action => executeAction(action, obj, false));
            } else if (!['OnStart', 'OnClick', 'OnCollisionWith', 'OnTimerElapsed'].includes(script.trigger)) {
                // Handle state-based triggers like IsRunning, IsJumping, CompareVariable, etc.
                const mockCondition: Condition = {
                    trigger: script.trigger as any,
                    object: obj.name,
                    params: script.params,
                    target: script.params?.targetObjectName
                };
                if (checkCondition(mockCondition)) {
                    script.actions.forEach(action => executeAction(action, obj, false));
                }
            }
          });

          if (obj.oscillation) {
              const time = (performance.now() - obj.oscillation.startTime) / 1000;
              const offset = Math.sin(time * obj.oscillation.speed) * obj.oscillation.distance;
              if (obj.oscillation.axis === 'x') {
                  obj.x = obj.oscillation.initialX + offset;
              } else {
                  obj.y = obj.oscillation.initialY + offset;
              }
          }

          if (obj.rotationSpeed) {
              obj.rotation = ((obj.rotation || 0) + obj.rotationSpeed * deltaTime) % 360;
              if (obj.rotation < 0) obj.rotation += 360;
          }

          if (obj.scaleOscillation) {
              const time = (performance.now() - obj.scaleOscillation.startTime) / 1000;
              const offset = Math.sin(time * obj.scaleOscillation.speed) * obj.scaleOscillation.distance;
              obj.scaleX = Math.max(0.01, obj.scaleOscillation.initialScaleX + offset);
              obj.scaleY = Math.max(0.01, obj.scaleOscillation.initialScaleY + offset);
          }

          if (obj.pendingMovements) {
              obj.pendingMovements.forEach(move => {
                  const speed = Number(move.speed || 0);
                  const direction = (move.direction || '').toLowerCase();
                  switch (direction) {
                      case 'right': obj.x += speed * deltaTime; break;
                      case 'left': obj.x -= speed * deltaTime; break;
                      case 'up': obj.y -= speed * deltaTime; break;
                      case 'down': obj.y += speed * deltaTime; break;
                  }
              });
              obj.pendingMovements = [];
          }

          if(obj.isUI) return;

          const hasRPGMovement = obj.behaviors?.some(b => b.name === 'TopDownRPGMovement');
          const platformer = obj.behaviors?.find(b => b.name === 'PlatformerCharacter');
          if (platformer && !hasRPGMovement) {
              const { speed, jumpForce } = platformer.properties;

              obj.vx = (actions.moveHorizontalIntensity || 0) * speed;
              
              if (obj.vx > 0) obj.direction = 'right';
              if (obj.vx < 0) obj.direction = 'left';

              if (actions.jumpAction && obj.grounded) {
                  obj.vy = -jumpForce;
              }
              if (actions.attackAction) {
                  frameAttacks.current.push(obj.name);
              }
          }

          const rpgMovement = obj.behaviors?.find(b => b.name === 'TopDownRPGMovement');
          if (rpgMovement) {
              const { speed } = rpgMovement.properties;
              obj.vx = 0;
              obj.vy = 0;
              
              if (joystickState.current.active) {
                  const joystickSize = joystick?.size ?? 120;
                  const maxDistance = joystickSize / 2;
                  const intensity = joystickState.current.distance / maxDistance;
                  const angleRad = joystickState.current.angle * Math.PI / 180;
                  obj.vx = speed * intensity * Math.cos(angleRad);
                  obj.vy = speed * intensity * Math.sin(angleRad);
                  if (Math.abs(joystickState.current.angle) > 90) {
                      obj.direction = 'left';
                  } else {
                      obj.direction = 'right';
                  }
              } else {
                  if (actions.moveLeft) { obj.vx = -speed; obj.direction = 'left'; }
                  if (actions.moveRight) { obj.vx = speed; obj.direction = 'right'; }
                  if (actions.moveUp) obj.vy = -speed;
                  if (actions.moveDown) obj.vy = speed;
                  
                  if (obj.vx !== 0 && obj.vy !== 0) {
                      obj.vx /= Math.sqrt(2);
                      obj.vy /= Math.sqrt(2);
                  }
              }
          }
          
          const physics = obj.behaviors?.find(b => ['Physics', 'PlatformerCharacter'].includes(b.name || ''));
          
          if (rpgMovement) {
            obj.x += (obj.vx || 0) * deltaTime;
            let currentAbsPos = getObjectAbsolutePosition(obj.id, objectsById);
            const objWithAbsPosH = {...obj, ...currentAbsPos};
            for (const solidShape of staticCollisionShapes) {
                if (obj.id !== solidShape.owner.id && isColliding(getCollisionBox(objWithAbsPosH), solidShape)) {
                     frameCollisions.current.push({ obj1Name: obj.name, obj2Name: solidShape.owner.name, type: 'OnHorizontalCollision' });
                     if ((obj.vx || 0) > 0) obj.x = solidShape.x - getCollisionBox(objWithAbsPosH).width - (currentAbsPos.x - obj.x);
                     else if ((obj.vx || 0) < 0) obj.x = solidShape.x + solidShape.width - (currentAbsPos.x - obj.x);
                     obj.vx = 0;
                     break;
                }
            }
            
            obj.y += (obj.vy || 0) * deltaTime;
            currentAbsPos = getObjectAbsolutePosition(obj.id, objectsById);
            const objWithAbsPosV = {...obj, ...currentAbsPos};
            for (const solidShape of staticCollisionShapes) {
                if (obj.id !== solidShape.owner.id && isColliding(getCollisionBox(objWithAbsPosV), solidShape)) {
                     frameCollisions.current.push({ obj1Name: obj.name, obj2Name: solidShape.owner.name, type: 'OnVerticalCollision' });
                     if ((obj.vy || 0) > 0) obj.y = solidShape.y - getCollisionBox(objWithAbsPosV).height - (currentAbsPos.y - obj.y);
                     else if ((obj.vy || 0) < 0) obj.y = solidShape.y + solidShape.height - (currentAbsPos.y - obj.y);
                     obj.vy = 0;
                     break;
                }
            }
          } else if (physics) {
              obj.x += (obj.vx || 0) * deltaTime;
              let currentAbsPos = getObjectAbsolutePosition(obj.id, objectsById);
              const objWithAbsPos = {...obj, ...currentAbsPos};

              for (const solidShape of staticCollisionShapes) {
                  if (obj.id !== solidShape.owner.id && isColliding(getCollisionBox(objWithAbsPos), solidShape)) {
                      frameCollisions.current.push({ obj1Name: obj.name, obj2Name: solidShape.owner.name, type: 'OnHorizontalCollision' });
                      if ((obj.vx || 0) > 0) {
                          obj.x = solidShape.x - getCollisionBox(objWithAbsPos).width - (currentAbsPos.x - obj.x);
                      } else if ((obj.vx || 0) < 0) {
                          obj.x = solidShape.x + solidShape.width - (currentAbsPos.x - obj.x);
                      }
                      obj.vx = 0;
                      break; 
                  }
              }

              obj.grounded = false;
              const { gravity } = physics.properties;
              obj.vy! += gravity * deltaTime;
              obj.y += obj.vy! * deltaTime;
              currentAbsPos = getObjectAbsolutePosition(obj.id, objectsById);
              const newObjWithAbsPos = {...obj, ...currentAbsPos};

              for (const solidShape of staticCollisionShapes) {
                  if (obj.id !== solidShape.owner.id && isColliding(getCollisionBox(newObjWithAbsPos), solidShape)) {
                      frameCollisions.current.push({ obj1Name: obj.name, obj2Name: solidShape.owner.name, type: 'OnVerticalCollision' });
                      if (obj.vy! > 0) {
                          obj.y = solidShape.y - getCollisionBox(newObjWithAbsPos).height - (currentAbsPos.y - obj.y);
                          obj.grounded = true;
                          obj.vy = 0;
                      } else if (obj.vy! < 0) {
                          obj.y = solidShape.y + solidShape.height - (currentAbsPos.y - obj.y);
                          obj.vy = 0;
                      }
                      break;
                  }
              }
          }
      });

      const allObjectsWithAbsPosForCollision = gameObjectsRef.current.map(o => ({...o, ...getObjectAbsolutePosition(o.id, objectsById)}));
      const nonUiObjects = allObjectsWithAbsPosForCollision.filter(o => !o.isUI && (o.isTouchable ?? true));

      for (let i = 0; i < nonUiObjects.length; i++) {
          for (let j = i + 1; j < nonUiObjects.length; j++) {
              const obj1 = nonUiObjects[i];
              const obj2 = nonUiObjects[j];

              if (isColliding(getCollisionBox(obj1), getCollisionBox(obj2))) {
                  frameCollisions.current.push({ obj1Name: obj1.name, obj2Name: obj2.name, type: 'OnCollisionWith' });
                  
                  const originalObj1 = gameObjectsRef.current.find(o => o.id === obj1.id);
                  const originalObj2 = gameObjectsRef.current.find(o => o.id === obj2.id);

                  if (originalObj1) {
                      originalObj1.scripts?.forEach(script => {
                          if (script.trigger === 'OnCollisionWith' && (!script.params?.targetObjectName || script.params.targetObjectName === originalObj2?.name)) {
                              script.actions.forEach(action => executeAction(action, originalObj1, true));
                          }
                      });
                  }

                  if (originalObj2) {
                      originalObj2.scripts?.forEach(script => {
                          if (script.trigger === 'OnCollisionWith' && (!script.params?.targetObjectName || script.params.targetObjectName === originalObj1?.name)) {
                              script.actions.forEach(action => executeAction(action, originalObj2, true));
                          }
                      });
                  }
              }
          }
      }

      evaluateEvents();
      frameKeyPresses.current = [];
      frameCollisions.current = [];
      frameClicks.current = [];
      frameTimerEvents.current = [];
      frameAttacks.current = [];

      activeAnimations.current.forEach((activeAnim, objId) => {
        const obj = gameObjectsRef.current.find(o => o.id === objId);
        if (!obj) {
            activeAnimations.current.delete(objId);
            return;
        }

        const totalDuration = activeAnim.animation.frames.reduce((sum, f) => sum + f.duration, 0);
        if (totalDuration <= 0) {
            activeAnimations.current.delete(objId);
            return;
        }

        const elapsed = now - activeAnim.startTime;

        if (elapsed >= totalDuration) {
            if (activeAnim.animation.loop) {
                activeAnim.startTime = now;
            } else {
                activeAnimations.current.delete(objId);
                const originalObject = scene.gameObjects.find(o => o.id === objId);
                if (originalObject) {
                    obj.imageUrl = originalObject.imageUrl;
                    obj.animOffsetX = 0;
                    obj.animOffsetY = 0;
                    obj.animRotation = 0;
                    obj.animScaleX = 1;
                    obj.animScaleY = 1;
                }
                return;
            }
        }

        const currentElapsed = (now - activeAnim.startTime) % totalDuration;
        let cumulativeTime = 0;
        let currentFrameIndex = 0;
        for (let i = 0; i < activeAnim.animation.frames.length; i++) {
            cumulativeTime += activeAnim.animation.frames[i].duration;
            if (currentElapsed < cumulativeTime) {
                currentFrameIndex = i;
                break;
            }
        }
        
        const frame = activeAnim.animation.frames[currentFrameIndex];
        if (frame) {
            const asset = assets.find(a => a.id === frame.assetId);
            if (asset) obj.imageUrl = asset.url;
            obj.animOffsetX = frame.x || 0;
            obj.animOffsetY = frame.y || 0;
            obj.animRotation = frame.rotation || 0;
            obj.animScaleX = frame.scaleX ?? 1;
            obj.animScaleY = frame.scaleY ?? 1;
        }
      });
      
      const currentUiObjects = gameObjectsRef.current.filter(o => o.isUI);
      if (currentUiObjects.length > 0) {
          setUiObjects([...currentUiObjects]);
      } else if (uiObjects.length > 0) {
          setUiObjects([]);
      }
      
      const followTarget = gameObjectsRef.current.find(o => o.behaviors?.some(b => b.name === 'FollowCamera'));
      if (followTarget) {
          const followTargetWithAbsPos = {...followTarget, ...getObjectAbsolutePosition(followTarget.id, objectsById)};
          const collisionBox = getCollisionBox(followTargetWithAbsPos);
          
          const idealCamX = collisionBox.x + collisionBox.width / 2;
          const idealCamY = collisionBox.y + collisionBox.height / 2;
      
          if (scene.cameraBounds?.enabled) {
              const bounds = scene.cameraBounds;
              const zoomedWidth = canvas.width / camera.current.zoom;
              const zoomedHeight = canvas.height / camera.current.zoom;
              
              if (bounds.width < zoomedWidth) {
                  camera.current.x = bounds.x + bounds.width / 2;
              } else {
                  const minCamX = bounds.x + zoomedWidth / 2;
                  const maxCamX = bounds.x + bounds.width - zoomedWidth / 2;
                  camera.current.x = Math.max(minCamX, Math.min(idealCamX, maxCamX));
              }

              if (bounds.height < zoomedHeight) {
                  camera.current.y = bounds.y + bounds.height / 2;
              } else {
                  const minCamY = bounds.y + zoomedHeight / 2;
                  const maxCamY = bounds.y + bounds.height - zoomedHeight / 2;
                  camera.current.y = Math.max(minCamY, Math.min(idealCamY, maxCamY));
              }
          } else {
              camera.current.x = idealCamX;
              camera.current.y = idealCamY;
          }
      }


      ctx.fillStyle = runtimeBackgroundColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      ctx.save();

      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.scale(camera.current.zoom, camera.current.zoom);
      ctx.translate(-camera.current.x, -camera.current.y);
      
      const allDrawableObjects = gameObjectsRef.current.map(o => ({...o, ...getObjectAbsolutePosition(o.id, objectsById)}));

      allDrawableObjects.filter(o => !o.isUI).sort((a,b) => a.zIndex - b.zIndex).forEach(obj => {
        const tilemapBehavior = obj.behaviors?.find(b => b.name === 'Tilemap');

        if (tilemapBehavior && obj.imageUrl) {
            const img = imageCache.current.get(obj.imageUrl);
            if (img && img.complete) {
                const { tileSize = 32, collisionData = '' } = tilemapBehavior.properties;
                const rows = String(collisionData).split('\n');
                rows.forEach((row, y) => {
                    for (let x = 0; x < row.length; x++) {
                        if (row[x] !== ' ' && row[x] !== '0') {
                            ctx.drawImage(img, obj.x + x * tileSize, obj.y + y * tileSize, tileSize, tileSize);
                        }
                    }
                });
            }
        } else {
            ctx.save();
            const centerX = obj.x + obj.width / 2;
            const centerY = obj.y + obj.height / 2;
            
            ctx.translate(centerX + (obj.animOffsetX || 0), centerY + (obj.animOffsetY || 0));
            ctx.rotate(((obj.rotation || 0) + (obj.animRotation || 0)) * Math.PI / 180);
            const scaleX = (obj.scaleX ?? 1) * (obj.animScaleX ?? 1) * (obj.direction === 'left' ? -1 : 1);
            const scaleY = (obj.scaleY ?? 1) * (obj.animScaleY ?? 1);
            ctx.scale(scaleX, scaleY);
            
            const drawX = -obj.width / 2;
            const drawY = -obj.height / 2;

            if (obj.videoUrl) {
                const video = videoCache.current.get(obj.videoUrl);
                if (video) {
                    if (video.paused && (obj.videoAutoplay ?? true)) {
                        video.play().catch(()=>{});
                    }
                    video.loop = obj.videoLoop ?? true;
                    try {
                        ctx.drawImage(video, drawX, drawY, obj.width, obj.height);
                    } catch (e) {
                        // Video might not be ready, ignore error
                    }
                }
            } else if (obj.imageUrl) {
                const img = imageCache.current.get(obj.imageUrl);
                if (img && img.complete) {
                    ctx.drawImage(img, drawX, drawY, obj.width, obj.height);
                } else if (obj.color && obj.color !== 'transparent') {
                    ctx.fillStyle = obj.color;
                    ctx.fillRect(drawX, drawY, obj.width, obj.height);
                }
            } else if (obj.color !== 'transparent') {
                ctx.fillStyle = obj.color;
                ctx.fillRect(drawX, drawY, obj.width, obj.height);
            }
            ctx.restore();
        }
      });
      
      ctx.restore();

      animationFrameId = requestAnimationFrame(gameLoop);
    };
    
    const imagePromises = assets.filter(a => a.type === 'image').map(asset => new Promise<void>((resolve) => {
        if (imageCache.current.has(asset.url)) return resolve();
        const img = new Image();
        img.onload = () => { imageCache.current.set(asset.url, img); resolve(); };
        img.onerror = () => { console.error(`Failed to load image: ${asset.url}`); resolve(); }; // Resolve anyway to not block game start
        img.src = asset.url;
    }));

    const audioPromises = assets.filter(a => a.type === 'audio').map(asset => new Promise<void>((resolve) => {
        if (audioCache.current.has(asset.url)) return resolve();
        const audio = new Audio();
        audio.oncanplaythrough = () => { audioCache.current.set(asset.url, audio); resolve(); };
        audio.onerror = () => { console.error(`Failed to load audio: ${asset.url}`); resolve(); };
        audio.src = asset.url;
    }));
    
    const videoPromises = assets.filter(a => a.type === 'video').map(asset => new Promise<void>((resolve) => {
        if (videoCache.current.has(asset.url)) return resolve();
        const video = document.createElement('video');
        video.oncanplaythrough = () => {
            video.muted = true;
            video.playsInline = true;
            video.play().finally(() => { videoCache.current.set(asset.url, video); resolve(); });
        };
        video.onerror = () => { console.error(`Failed to load video: ${asset.url}`); resolve(); };
        video.src = asset.url;
        video.load();
    }));

    Promise.allSettled([...imagePromises, ...audioPromises, ...videoPromises]).then(() => {
        animationFrameId = requestAnimationFrame(gameLoop);
    });

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      if (backgroundMusicPlayer.current) {
          backgroundMusicPlayer.current.pause();
          backgroundMusicPlayer.current = null;
      }
    };
  }, [scene, onGoToScene, globalVariables, assets, animations, initialState]);

  const isColliding = (box1: {x:number, y:number, width:number, height:number}, box2: {x:number, y:number, width:number, height:number}) => {
    return box1.x < box2.x + box2.width &&
           box1.x + box1.width > box2.x &&
           box1.y < box2.y + box2.height &&
           box1.y + box1.height > box2.y;
  };

  const renderUIText = (text: string) => {
      let newText = text;
      for (const key in gameVariables.current) {
          newText = newText.replace(new RegExp(`\\{${key}\\}`, 'g'), String(gameVariables.current[key]));
      }
      return newText;
  }
  
  const initAudio = () => {
    if (!audioContextRef.current) {
        try {
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        } catch (e) {
            console.error("Web Audio API is not supported in this browser");
        }
    }
    if (audioContextRef.current?.state === 'suspended') {
        audioContextRef.current.resume();
    }
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    initAudio();
    if (dialogue) {
        setDialogue(null);
        return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const mouseX = (e.clientX - rect.left) * scaleX;
    const mouseY = (e.clientY - rect.top) * scaleY;
    
    const objectsById = new Map<number, GameObject>(gameObjectsRef.current.map(o => [o.id, o]));
    const worldMouseX = (mouseX / camera.current.zoom) + camera.current.x - (canvas.width / (2*camera.current.zoom));
    const worldMouseY = (mouseY / camera.current.zoom) + camera.current.y - (canvas.height / (2*camera.current.zoom));
    
    const clickedObject = [...gameObjectsRef.current]
        .sort((a,b) => b.zIndex - a.zIndex)
        .find(obj => {
            if (obj.isUI) return false;
            const absPos = getObjectAbsolutePosition(obj.id, objectsById);
            const collisionBox = getCollisionBox({...obj, ...absPos});
            return worldMouseX >= collisionBox.x && worldMouseX <= collisionBox.x + collisionBox.width &&
                   worldMouseY >= collisionBox.y && worldMouseY <= collisionBox.y + collisionBox.height;
        });
    
    if (clickedObject) {
        frameClicks.current.push(clickedObject.name);
         clickedObject.scripts?.forEach(script => {
            if (script.trigger === 'OnClick') {
                script.actions.forEach(action => executeAction(action, clickedObject, true));
            }
        });
    }
  };
  
  const joystickSize = joystick?.size ?? 120;
  const joystickHandleSize = joystickSize / 2.4;

  const updateJoystickState = useCallback((touch: React.Touch | Touch) => {
    const base = joystickBaseRef.current;
    if (!base) return;
    const rect = base.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const dx = touch.clientX - centerX;
    const dy = touch.clientY - centerY;
    const angle = Math.atan2(dy, dx) * (180 / Math.PI);
    const distance = Math.min(joystickSize / 2, Math.hypot(dx, dy));
    joystickState.current = { active: true, angle, distance };

    if (joystickHandleRef.current) {
        const x = distance * Math.cos(angle * Math.PI / 180);
        const y = distance * Math.sin(angle * Math.PI / 180);
        joystickHandleRef.current.style.transform = `translate(${x}px, ${y}px)`;
    }
  }, [joystickSize]);
  
  const handleJoystickTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    e.preventDefault();
    initAudio();
    const touch = e.changedTouches[0];
    if (touch && joystickBaseRef.current) {
        joystickTouchId.current = touch.identifier;
        updateJoystickState(touch);
    }
  };

  useEffect(() => {
    const handleJoystickTouchMove = (e: TouchEvent) => {
        if (joystickTouchId.current !== null) {
            for (let i = 0; i < e.changedTouches.length; i++) {
                const touch = e.changedTouches[i];
                if (touch.identifier === joystickTouchId.current) {
                    e.preventDefault();
                    updateJoystickState(touch);
                    return;
                }
            }
        }
    };
    const handleJoystickTouchEnd = (e: TouchEvent) => {
        if (joystickTouchId.current !== null) {
            for (let i = 0; i < e.changedTouches.length; i++) {
                const touch = e.changedTouches[i];
                if (touch.identifier === joystickTouchId.current) {
                    e.preventDefault();
                    joystickState.current = { active: false, angle: 0, distance: 0 };
                    if (joystickHandleRef.current) {
                        joystickHandleRef.current.style.transform = 'translate(0, 0)';
                    }
                    joystickTouchId.current = null;
                    return;
                }
            }
        }
    };
    window.addEventListener('touchmove', handleJoystickTouchMove, { passive: false });
    window.addEventListener('touchend', handleJoystickTouchEnd, { passive: false });
    return () => {
        window.removeEventListener('touchmove', handleJoystickTouchMove);
        window.removeEventListener('touchend', handleJoystickTouchEnd);
    };
  }, [updateJoystickState]);

  return (
    <div className="absolute inset-0 bg-black z-50 flex flex-col">
      <header className="flex items-center justify-between p-2 bg-gray-900 text-white shrink-0">
        <span className="font-bold">Vista Previa del Juego</span>
        <button onClick={() => onExit({ gameObjects: gameObjectsRef.current, gameVariables: gameVariables.current })} className="px-4 py-1 bg-red-600 hover:bg-red-700 rounded-md">Salir</button>
      </header>
      <main className="flex-grow relative w-full h-full overflow-hidden flex justify-center items-center bg-black">
        <canvas
          ref={canvasRef}
          width={gameWidth}
          height={gameHeight}
          style={{ width: 'auto', height: 'auto', maxHeight: '100%', maxWidth: '100%'}}
          onClick={handleCanvasClick}
        />
        <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
            <div className="absolute bottom-0 left-0 w-full h-24 bg-black/20 pointer-events-none"></div>
            {uiObjects.map(obj => {
                const isControlButton = !!obj.controlAction && obj.controlAction !== 'none';
                
                const scaleX = (obj.scaleX ?? 1) * (obj.animScaleX ?? 1) * (obj.direction === 'left' ? -1 : 1);
                const scaleY = (obj.scaleY ?? 1) * (obj.animScaleY ?? 1);

                const style: React.CSSProperties = {
                    position: 'absolute',
                    left: obj.x + (obj.animOffsetX || 0), top: obj.y + (obj.animOffsetY || 0),
                    width: obj.width, height: obj.height,
                    color: obj.color,
                    zIndex: obj.zIndex,
                    backgroundImage: obj.imageUrl ? `url(${obj.imageUrl})` : 'none',
                    backgroundSize: 'contain',
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'center',
                    pointerEvents: isControlButton ? 'auto' : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: isControlButton ? '2px solid rgba(255,255,255,0.3)' : 'none',
                    borderRadius: '0.5rem',
                    backgroundColor: isControlButton ? 'rgba(0,0,0,0.4)' : (obj.color !== 'transparent' && !obj.imageUrl ? obj.color : 'transparent'),
                    userSelect: 'none',
                    transformOrigin: 'center',
                    transform: `rotate(${(obj.rotation || 0) + (obj.animRotation || 0)}deg) scale(${scaleX}, ${scaleY})`,
                };
                
                const handlePress = (e: React.MouseEvent | React.TouchEvent) => { 
                    e.preventDefault();
                    if(obj.controlAction) {
                      actionsPressed.current[obj.controlAction] = true; 
                      actionsPressed.current[obj.controlAction+'_ui'] = true;
                    }
                };
                const handleRelease = (e: React.MouseEvent | React.TouchEvent) => { 
                    e.preventDefault();
                     if(obj.controlAction) {
                      actionsPressed.current[obj.controlAction] = false; 
                      actionsPressed.current[obj.controlAction+'_ui'] = false;
                    }
                };

                if (isControlButton) {
                    return (
                        <button
                            key={obj.id}
                            style={style}
                            onMouseDown={handlePress}
                            onMouseUp={handleRelease}
                            onMouseLeave={handleRelease}
                            onTouchStart={handlePress}
                            onTouchEnd={handleRelease}
                            className="font-bold active:bg-indigo-500/70"
                        >
                            <span style={{ transform: scaleX < 0 ? 'scaleX(-1)' : 'none' }}>
                                {obj.text && renderUIText(obj.text)}
                            </span>
                        </button>
                    )
                }

                return (
                    <div key={obj.id} style={style}>
                        {obj.text && <div className="w-full h-full p-1 font-bold text-white text-center flex items-center justify-center" style={{ transform: scaleX < 0 ? 'scaleX(-1)' : 'none' }}>{renderUIText(obj.text)}</div>}
                    </div>
                );
            })}
            {joystick?.enabled && (
              <div
                  ref={joystickBaseRef}
                  onTouchStart={handleJoystickTouchStart}
                  style={{
                      position: 'absolute',
                      bottom: '40px',
                      [joystick.position || 'left']: '40px',
                      width: `${joystickSize}px`,
                      height: `${joystickSize}px`,
                      backgroundColor: `rgba(255, 255, 255, ${joystick.opacity ?? 0.1})`,
                      borderRadius: '50%',
                      pointerEvents: 'auto',
                      userSelect: 'none'
                  }}
              >
                  <div 
                      ref={joystickHandleRef}
                      style={{
                          position: 'absolute',
                          width: `${joystickHandleSize}px`,
                          height: `${joystickHandleSize}px`,
                          backgroundColor: 'rgba(255, 255, 255, 0.3)',
                          borderRadius: '50%',
                          left: `calc(50% - ${joystickHandleSize / 2}px)`,
                          top: `calc(50% - ${joystickHandleSize / 2}px)`,
                          transition: 'transform 50ms linear'
                      }}/>
              </div>
            )}
             {dialogue && (
                <div className="absolute bottom-28 left-1/2 -translate-x-1/2 w-3/4 max-w-2xl bg-black/80 text-white p-4 rounded-lg border-2 border-indigo-400 pointer-events-auto" onClick={() => setDialogue(null)}>
                    <p className="text-lg">{dialogue.text}</p>
                    <small className="text-indigo-300 block mt-2 text-right">Click para continuar...</small>
                </div>
            )}
        </div>
      </main>
    </div>
  );
};

export default GameView;