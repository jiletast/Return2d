
import type { ProjectData } from '../types';

export const generateGameHTML = (projectData?: ProjectData | null): string => {
    if (!projectData) return '';

    // This script is a self-contained game engine, adapted from GameView.tsx
    // to provide full feature parity with the in-editor preview.
    const gameEngineScript = `
        const canvas = document.getElementById('gameCanvas');
        if (!canvas) throw new Error("Canvas not found");
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error("Could not get 2D context");

        // Game State
        let gameObjects = [];
        let keysPressed = {};
        let actionsPressed = {};
        let gameVariables = {};
        let imageCache = new Map();
        let audioCache = new Map();
        let videoCache = new Map();
        let backgroundMusicPlayer = null;
        let currentBackgroundMusicId = null;
        let activeAnimations = new Map();
        let camera = { x: 0, y: 0, zoom: 1 };
        let currentScene = null;
        let runtimeBackgroundColor = '#111827';
        
        // Project Data
        let allScenes = [];
        let assets = [];
        let animations = [];
        
        // Loop and Event Management
        let animationFrameId;
        let dialogueElement = null;
        let frameCollisions = [];
        let frameClicks = [];
        let frameJoystickEvents = [];
        let frameTimerEvents = [];
        let frameAttacks = [];
        let timers = new Map();
        let intervals = new Map();
        let joystickState = { active: false, angle: 0, distance: 0 };
        let joystickTouchId = null;
        let joystickUpPreviousFrame = false;
        window.audioContext = null;
        let joystickSize = 120;

        const getObjectAbsolutePosition = (objectId, objectsById) => {
            let currentId = objectId;
            let totalX = 0;
            let totalY = 0;
            let safety = 100;
            while(currentId && safety-- > 0) {
                const obj = objectsById.get(currentId);
                if (!obj) break;
                totalX += obj.x;
                totalY += obj.y;
                currentId = obj.parentId;
            }
            return { x: totalX, y: totalY };
        };

        const getCollisionBox = (objWithAbsPos) => {
            const scaleX = Math.abs(objWithAbsPos.scaleX ?? 1);
            const scaleY = Math.abs(objWithAbsPos.scaleY ?? 1);
            
            const scaledVisualWidth = objWithAbsPos.width * scaleX;
            const scaledVisualHeight = objWithAbsPos.height * scaleY;
            const visualX = objWithAbsPos.x + (objWithAbsPos.width - scaledVisualWidth) / 2;
            const visualY = objWithAbsPos.y + (objWithAbsPos.height - scaledVisualHeight) / 2;

            if (objWithAbsPos.useCustomCollision && objWithAbsPos.collision) {
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

            return { x: visualX, y: visualY, width: scaledVisualWidth, height: scaledVisualHeight };
        };

        const isColliding = (box1, box2) => {
            return box1.x < box2.x + box2.width &&
                box1.x + box1.width > box2.x &&
                box1.y < box2.y + box2.height &&
                box1.y + box1.height > box2.y;
        };
        
        const showDialogue = (text) => {
            if (dialogueElement) dialogueElement.remove();
            dialogueElement = document.createElement('div');
            dialogueElement.style.position = 'fixed';
            dialogueElement.style.bottom = '10%';
            dialogueElement.style.left = '50%';
            dialogueElement.style.transform = 'translateX(-50%)';
            dialogueElement.style.width = '80%';
            dialogueElement.style.maxWidth = '600px';
            dialogueElement.style.padding = '1rem';
            dialogueElement.style.backgroundColor = 'rgba(0,0,0,0.8)';
            dialogueElement.style.color = 'white';
            dialogueElement.style.border = '2px solid #6366f1';
            dialogueElement.style.borderRadius = '8px';
            dialogueElement.style.cursor = 'pointer';
            dialogueElement.style.zIndex = '10000';
            dialogueElement.innerText = text;
            document.body.appendChild(dialogueElement);
            dialogueElement.addEventListener('click', () => {
                if (dialogueElement) dialogueElement.remove();
                dialogueElement = null;
            });
        };
        
        const executeAction = (action, self) => {
            let targetObj;
            if (action.object === 'Self' && self) {
                targetObj = gameObjects.find(o => o.id === self.id);
            } else {
                targetObj = gameObjects.find(o => o.name === action.object);
            }

            if (!targetObj && action.object !== 'System') return;

            switch (action.action) {
                case 'Destroy':
                    if (targetObj) gameObjects = gameObjects.filter(o => o.id !== targetObj.id);
                    break;
                case 'SetVariable':
                    if (action.params?.variable) gameVariables[action.params.variable] = action.params.value;
                    break;
                case 'AddToVariable':
                    if (action.params?.variable) {
                        const currentVal = Number(gameVariables[action.params.variable] || 0);
                        const toAdd = Number(action.params.value || 0);
                        gameVariables[action.params.variable] = currentVal + toAdd;
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
                    if (action.params?.sceneName) loadSceneByName(action.params.sceneName);
                    break;
                case 'PlayAnimation':
                    if (targetObj && action.params?.animationId) {
                        const anim = animations.find(a => a.id === action.params.animationId);
                        if (anim) activeAnimations.set(targetObj.id, { animation: anim, startTime: performance.now() });
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
                case 'ForceJump':
                    if (targetObj && targetObj.behaviors?.some(b => ['PlatformerCharacter', 'Physics'].includes(b.name)) && action.params?.jumpForce != null) {
                        targetObj.vy = -Number(action.params.jumpForce);
                        targetObj.grounded = false;
                    }
                    break;
                case 'TriggerAttack':
                    if (targetObj) {
                        frameAttacks.push(targetObj.name);
                    }
                    break;
                case 'SetParent':
                    if (targetObj) {
                        if (!action.params?.parentName) {
                            targetObj.parentId = null;
                        } else {
                            const parentObj = gameObjects.find(o => o.name === action.params.parentName);
                            if (parentObj) targetObj.parentId = parentObj.id;
                        }
                    }
                    break;
                case 'PlaySound':
                    if (action.params?.soundId) {
                        const soundAsset = assets.find(a => a.id === action.params.soundId);
                        if (soundAsset) {
                            const cachedAudio = audioCache.get(soundAsset.url);
                            if (cachedAudio) (cachedAudio.cloneNode()).play().catch(() => {});
                        }
                    }
                    break;
                case 'SetBackgroundMusic':
                    if (action.params?.soundId) {
                        if (backgroundMusicPlayer) backgroundMusicPlayer.pause();
                        const musicAsset = assets.find(a => a.id === action.params.soundId);
                        if (musicAsset) {
                            const cachedAudio = audioCache.get(musicAsset.url);
                            if (cachedAudio) {
                                backgroundMusicPlayer = cachedAudio.cloneNode();
                                backgroundMusicPlayer.loop = true;
                                backgroundMusicPlayer.play().catch(()=>{});
                                currentBackgroundMusicId = musicAsset.id;
                            }
                        }
                    }
                    break;
                case 'StopBackgroundMusic':
                    if (backgroundMusicPlayer) {
                        backgroundMusicPlayer.pause();
                        backgroundMusicPlayer.currentTime = 0;
                        currentBackgroundMusicId = null;
                    }
                    break;
                case 'PauseBackgroundMusic':
                    if (backgroundMusicPlayer) {
                        backgroundMusicPlayer.pause();
                    }
                    break;
                case 'ResumeBackgroundMusic':
                    if (backgroundMusicPlayer) {
                        backgroundMusicPlayer.play().catch(()=>{});
                    }
                    break;
                case 'SetBackgroundMusicVolume':
                    if (backgroundMusicPlayer && action.params?.volume != null) {
                        backgroundMusicPlayer.volume = Math.max(0, Math.min(100, Number(action.params.volume))) / 100;
                    }
                    break;
                case 'SetBackgroundColor':
                    if (action.params?.color) runtimeBackgroundColor = action.params.color;
                    break;
                case 'ModifyStat':
                    if (targetObj?.stats && action.params?.stat && action.params?.operation && action.params?.value != null) {
                        const { stat, operation, value } = action.params;
                        let currentVal = targetObj.stats[stat] || 0;
                        if (operation === 'add') currentVal += Number(value);
                        else if (operation === 'subtract') currentVal -= Number(value);
                        else if (operation === 'set') currentVal = Number(value);
                        if (stat === 'hp') targetObj.stats.hp = Math.max(0, Math.min(targetObj.stats.maxHp, currentVal));
                        else targetObj.stats[stat] = currentVal;
                    }
                    break;
                case 'ShowDialogue':
                    if (action.params?.dialogueText) showDialogue(action.params.dialogueText);
                    break;
                case 'SetQuestState':
                    if (action.params?.questId && action.params?.questState) gameVariables['quest_' + action.params.questId] = action.params.questState;
                    break;
                case 'PlayVideo':
                    if (targetObj?.videoUrl) videoCache.get(targetObj.videoUrl)?.play().catch(()=>{});
                    break;
                case 'PauseVideo':
                    if (targetObj?.videoUrl) videoCache.get(targetObj.videoUrl)?.pause();
                    break;
                case 'StopVideo':
                    if (targetObj?.videoUrl) {
                        const video = videoCache.get(targetObj.videoUrl);
                        if(video) { video.pause(); video.currentTime = 0; }
                    }
                    break;
                 case 'SaveGame':
                    if (action.params?.slot) {
                        try {
                            localStorage.setItem('return-2d-save-' + action.params.slot, JSON.stringify({
                                sceneName: currentScene.name, gameObjects, gameVariables, camera
                            }));
                        } catch (e) { console.error('Error saving game:', e); }
                    }
                    break;
                case 'LoadGame':
                    if (action.params?.slot) {
                        try {
                            const saved = JSON.parse(localStorage.getItem('return-2d-save-' + action.params.slot));
                            if (saved) loadSceneByName(saved.sceneName, saved);
                        } catch(e) { console.error('Error loading game:', e); }
                    }
                    break;
                case 'SetCameraZoom':
                    if (action.params?.zoomLevel) camera.zoom = Math.max(0.1, Number(action.params.zoomLevel));
                    break;
                case 'StartTimer':
                    if (action.params?.timerName && action.params?.duration != null) {
                        timers.set(action.params.timerName, { startTime: performance.now(), duration: Number(action.params.duration) * 1000 });
                    }
                    break;
                case 'StopTimer':
                    if (action.params?.timerName) {
                        timers.delete(action.params.timerName);
                    }
                    break;
                case 'CreateObject':
                    if (!action.params?.templateObjectName) break;
                    const template = currentScene.gameObjects.find(o => o.name === action.params.templateObjectName);
                    if (!template) break;
                    const newObject = JSON.parse(JSON.stringify(template));
                    newObject.id = Date.now() + Math.random();
                    let spawnX = Number(action.params.x) || 0;
                    let spawnY = Number(action.params.y) || 0;
                    if (action.params.positionType === 'relativeToObject' && action.params.relativeToObjectName) {
                        const relativeObj = gameObjects.find(o => o.name === action.params.relativeToObjectName);
                        if (relativeObj) {
                            const parentAbsPos = getObjectAbsolutePosition(relativeObj.id, new Map(gameObjects.map(o => [o.id, o])));
                            spawnX = parentAbsPos.x + (Number(action.params.offsetX) || 0);
                            spawnY = parentAbsPos.y + (Number(action.params.offsetY) || 0);
                        }
                    }
                    newObject.x = spawnX; newObject.y = spawnY;
                    newObject.parentId = null; newObject.vx = 0; newObject.vy = 0; newObject.grounded = false;
                    gameObjects.push(newObject);
                    break;
            }
        };

        const checkCondition = (cond) => {
            const { variable, operator, value, stat } = cond.params || {};
            const obj = gameObjects.find(o => o.name === cond.object);
            switch (cond.trigger) {
                case 'Always': return true;
                case 'OnCollisionWith': case 'OnVerticalCollision': case 'OnHorizontalCollision':
                    return frameCollisions.some(c => {
                        const pairMatch = ((c.obj1Name === cond.object && c.obj2Name === cond.target) || (c.obj2Name === cond.object && c.obj1Name === cond.target));
                        if (!pairMatch) return false;
                        if (cond.trigger === 'OnCollisionWith') return true;
                        return c.type === cond.trigger;
                    });
                case 'OnObjectClicked': return frameClicks.includes(cond.object);
                case 'OnKeyPress': return cond.params?.key && keysPressed[cond.params.key.toLowerCase()];
                case 'OnAnyKeyPress': return Object.values(keysPressed).some(v => v === true);
                case 'OnAttack': return frameAttacks.includes(cond.object);
                case 'OnTimerElapsed': return frameTimerEvents.includes(cond.params?.timerName);
                case 'CompareVariable': {
                    if (!variable) return false;
                    const varValue = gameVariables[variable];
                    const compareValue = isNaN(Number(value)) ? value : Number(value);
                    switch (operator) {
                        case '==': return varValue == compareValue; case '!=': return varValue != compareValue;
                        case '>': return varValue > compareValue; case '<': return varValue < compareValue;
                        case '>=': return varValue >= compareValue; case '<=': return varValue <= compareValue;
                        default: return false;
                    }
                }
                case 'CompareObjectVariable': {
                    if (!obj?.variables || !variable) return false;
                    const objVar = obj.variables.find(v => v.name === variable);
                    if (!objVar) return false;
                    const objVarValue = objVar.value;
                    const compareValue = isNaN(Number(value)) ? value : Number(value);
                    switch (operator) {
                        case '==': return objVarValue == compareValue; case '!=': return objVarValue != compareValue;
                        case '>': return objVarValue > compareValue; case '<': return objVarValue < compareValue;
                        case '>=': return objVarValue >= compareValue; case '<=': return objVarValue <= compareValue;
                        default: return false;
                    }
                }
                case 'CompareStat': {
                    if (!obj?.stats || !stat) return false;
                    const statValue = obj.stats[stat];
                    if (statValue === undefined) return false;
                    const compareValue = isNaN(Number(value)) ? value : Number(value);
                    switch (operator) {
                        case '==': return statValue == compareValue; case '!=': return statValue != compareValue;
                        case '>': return statValue > compareValue; case '<': return statValue < compareValue;
                        case '>=': return statValue >= compareValue; case '<=': return statValue <= compareValue;
                        default: return false;
                    }
                }
                case 'IsOnGround': return obj && !!obj.grounded; case 'IsMoving': return obj && (obj.vx !== 0 || obj.vy !== 0);
                case 'IsIdle': return obj && obj.vx === 0 && obj.vy === 0 && !!obj.grounded;
                case 'IsRunning': return obj && obj.vx !== 0 && !!obj.grounded; case 'IsJumping': return obj && !obj.grounded;
                case 'IsMusicPlaying':
                    const isPlaying = backgroundMusicPlayer && !backgroundMusicPlayer.paused;
                    if (!isPlaying) return false;
                    return cond.params?.soundId ? currentBackgroundMusicId === cond.params.soundId : true;
                case 'OnJoystickMove': return frameJoystickEvents.length > 0;
                case 'OnJoystickUp': return frameJoystickEvents.includes('up');
                case 'OnJoystickDown': return frameJoystickEvents.includes('down');
                case 'OnJoystickLeft': return frameJoystickEvents.includes('left');
                case 'OnJoystickRight': return frameJoystickEvents.includes('right');
                default: return false;
            }
        };
        
        const evaluateEvents = () => {
             if (!currentScene) return;
             currentScene.events.forEach(event => {
                if (event.conditions.some(c => c.trigger === 'OnStart' || c.trigger === 'EveryXSeconds')) return;
                if (event.conditions.every(checkCondition)) event.actions.forEach(a => executeAction(a, null));
             });
        };
        
        let lastTime = 0;
        function gameLoop(timestamp) {
            const now = performance.now();
            if (lastTime === 0) lastTime = now;
            const deltaTime = (now - lastTime) / 1000.0;
            lastTime = now;

            timers.forEach((timer, name) => {
                if (now >= timer.startTime + timer.duration) {
                    frameTimerEvents.push(name);
                    timers.delete(name);
                }
            });

            currentScene.events.forEach((event, eventIndex) => {
                event.conditions.forEach((cond, condIndex) => {
                    if (cond.trigger === 'EveryXSeconds' && cond.params?.interval) {
                        const key = \`evt-\${event.id || eventIndex}-cond-\${condIndex}\`;
                        const intervalData = intervals.get(key);
                        const intervalMs = Number(cond.params.interval) * 1000;
                        if (!intervalData) {
                            intervals.set(key, { interval: intervalMs, lastTriggerTime: now });
                        } else if (now >= intervalData.lastTriggerTime + intervalData.interval) {
                            const otherConditionsMet = event.conditions.filter(c => c !== cond).every(checkCondition);
                            if (otherConditionsMet) {
                                event.actions.forEach(action => executeAction(action));
                            }
                            intervalData.lastTriggerTime = now;
                        }
                    }
                });
            });

            const objectsById = new Map(gameObjects.map(o => [o.id, o]));
            
            const staticCollisionShapes = [];
            const allObjectsWithAbsPosForPhysics = gameObjects.map(o => ({...o, ...getObjectAbsolutePosition(o.id, objectsById)}));
            
            allObjectsWithAbsPosForPhysics.forEach(obj => {
                if (obj.behaviors?.some(b => b.name === 'Solid')) {
                    staticCollisionShapes.push({ ...getCollisionBox(obj), owner: obj });
                }
                const tilemapBehavior = obj.behaviors?.find(b => b.name === 'Tilemap');
                if (tilemapBehavior) {
                    const { tileSize = 32, collisionData = '' } = tilemapBehavior.properties || {};
                    const rows = String(collisionData).split('\\n');
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

            frameJoystickEvents = [];

            ['moveLeft','moveRight','moveUp','moveDown','jump','attack'].forEach(act => {
                if (!actionsPressed[act+'_ui']) actionsPressed[act] = false;
            });
            
            const joystickUpNow = joystickState.active && joystickState.angle > -135 && joystickState.angle < -45;

            if (joystickUpNow && !joystickUpPreviousFrame) {
                actionsPressed.jump = true;
            }
            joystickUpPreviousFrame = joystickUpNow;

            if (joystickState.active) {
                const angle = joystickState.angle;
                const angleRad = angle * (Math.PI / 180);
                const horizontalProjection = Math.cos(angleRad);
                
                if (horizontalProjection > 0.15) {
                   actionsPressed.moveRight = true;
                   if (!frameJoystickEvents.includes('right')) frameJoystickEvents.push('right');
                } else if (horizontalProjection < -0.15) {
                   actionsPressed.moveLeft = true;
                   if (!frameJoystickEvents.includes('left')) frameJoystickEvents.push('left');
                }

                if (angle > 45 && angle < 135) {
                   actionsPressed.moveDown = true;
                   if (!frameJoystickEvents.includes('down')) frameJoystickEvents.push('down');
                }

                if (joystickUpNow) {
                    actionsPressed.moveUp = true;
                    if (!frameJoystickEvents.includes('up')) frameJoystickEvents.push('up');
                }
            }
            
            if (keysPressed['arrowleft'] || keysPressed['keya']) actionsPressed.moveLeft = true;
            if (keysPressed['arrowright'] || keysPressed['keyd']) actionsPressed.moveRight = true;
            if (keysPressed['arrowup'] || keysPressed['keyw']) actionsPressed.moveUp = true;
            if (keysPressed['arrowdown'] || keysPressed['keys']) actionsPressed.moveDown = true;
            if (keysPressed['space']) actionsPressed.jump = true;
            if (keysPressed['keyx']) actionsPressed.attack = true;

            if (actionsPressed.jump) {
                if (!actionsPressed.jumpPressed) { actionsPressed.jumpAction = true; actionsPressed.jumpPressed = true; } 
                else { actionsPressed.jumpAction = false; }
            } else { actionsPressed.jumpPressed = false; actionsPressed.jumpAction = false; }

            if (actionsPressed.attack) {
                if (!actionsPressed.attackPressed) { actionsPressed.attackAction = true; actionsPressed.attackPressed = true; }
                else { actionsPressed.attackAction = false; }
            } else { actionsPressed.attackPressed = false; actionsPressed.attackAction = false; }

            gameObjects.forEach(obj => {
                if (obj.isUI) return;
                obj.scripts?.forEach(s => s.trigger === 'OnUpdate' && s.actions.forEach(a => executeAction(a, obj)));

                if (obj.pendingMovements) {
                    obj.pendingMovements.forEach(move => {
                        const speed = move.speed;
                        switch (move.direction) {
                            case 'right': obj.x += speed * deltaTime; break;
                            case 'left': obj.x -= speed * deltaTime; break;
                            case 'up': obj.y -= speed * deltaTime; break;
                            case 'down': obj.y += speed * deltaTime; break;
                        }
                    });
                    obj.pendingMovements = [];
                }

                const platformer = obj.behaviors?.find(b => b.name === 'PlatformerCharacter');
                if (platformer) {
                    const { speed, jumpForce } = platformer.properties;
                    obj.vx = 0;
                    if (actionsPressed.moveLeft) { obj.vx = -speed; obj.direction = 'left'; }
                    if (actionsPressed.moveRight) { obj.vx = speed; obj.direction = 'right'; }
                    if (actionsPressed.jumpAction && obj.grounded) obj.vy = -jumpForce;
                    if (actionsPressed.attackAction) {
                        frameAttacks.push(obj.name);
                    }
                }
                const rpgMovement = obj.behaviors?.find(b => b.name === 'TopDownRPGMovement');
                if (rpgMovement) {
                    const { speed } = rpgMovement.properties;
                    obj.vx = 0; obj.vy = 0;
                    if (joystickState.active) {
                        const maxDistance = joystickSize / 2;
                        const intensity = joystickState.distance / maxDistance;
                        const angleRad = joystickState.angle * Math.PI / 180;
                        obj.vx = speed * intensity * Math.cos(angleRad);
                        obj.vy = speed * intensity * Math.sin(angleRad);
                        if (Math.abs(joystickState.angle) > 90) {
                            obj.direction = 'left';
                        } else {
                            obj.direction = 'right';
                        }
                    } else {
                        if (actionsPressed.moveLeft) { obj.vx = -speed; obj.direction = 'left'; }
                        if (actionsPressed.moveRight) { obj.vx = speed; obj.direction = 'right'; }
                        if (actionsPressed.moveUp) obj.vy = -speed;
                        if (actionsPressed.moveDown) obj.vy = speed;
                        if (obj.vx && obj.vy) { obj.vx /= Math.SQRT2; obj.vy /= Math.SQRT2; }
                    }
                }

                const physics = obj.behaviors?.find(b => ['Physics', 'PlatformerCharacter'].includes(b.name || ''));
                if (physics) {
                    obj.x += (obj.vx || 0) * deltaTime;
                    let absPos = getObjectAbsolutePosition(obj.id, objectsById);
                    for (const solidShape of staticCollisionShapes) {
                        if (obj.id !== solidShape.owner.id && isColliding(getCollisionBox({...obj, ...absPos}), solidShape)) {
                            frameCollisions.push({ obj1Name: obj.name, obj2Name: solidShape.owner.name, type: 'OnHorizontalCollision' });
                            if (obj.vx > 0) obj.x = solidShape.x - getCollisionBox(obj).width - (absPos.x - obj.x);
                            else if (obj.vx < 0) obj.x = solidShape.x + solidShape.width - (absPos.x - obj.x);
                            obj.vx = 0;
                            break;
                        }
                    }
                    obj.grounded = false;
                    obj.vy += physics.properties.gravity * deltaTime;
                    obj.y += obj.vy * deltaTime;
                    absPos = getObjectAbsolutePosition(obj.id, objectsById);
                    for (const solidShape of staticCollisionShapes) {
                        if (obj.id !== solidShape.owner.id && isColliding(getCollisionBox({...obj, ...absPos}), solidShape)) {
                            frameCollisions.push({ obj1Name: obj.name, obj2Name: solidShape.owner.name, type: 'OnVerticalCollision' });
                            if (obj.vy > 0) { obj.y = solidShape.y - getCollisionBox(obj).height - (absPos.y - obj.y); obj.grounded = true; obj.vy = 0; } 
                            else if (obj.vy < 0) { obj.y = solidShape.y + solidShape.height - (absPos.y - obj.y); obj.vy = 0; }
                            break;
                        }
                    }
                } else if (rpgMovement) {
                    obj.x += (obj.vx || 0) * deltaTime;
                    let absPos = getObjectAbsolutePosition(obj.id, objectsById);
                    for (const solidShape of staticCollisionShapes) {
                        if (obj.id !== solidShape.owner.id && isColliding(getCollisionBox({...obj, ...absPos}), solidShape)) {
                            if (obj.vx > 0) obj.x = solidShape.x - getCollisionBox(obj).width - (absPos.x - obj.x); else if (obj.vx < 0) obj.x = solidShape.x + solidShape.width - (absPos.x - obj.x);
                            obj.vx = 0; break;
                        }
                    }
                    obj.y += (obj.vy || 0) * deltaTime;
                    absPos = getObjectAbsolutePosition(obj.id, objectsById);
                    for (const solidShape of staticCollisionShapes) {
                        if (obj.id !== solidShape.owner.id && isColliding(getCollisionBox({...obj, ...absPos}), solidShape)) {
                            if (obj.vy > 0) obj.y = solidShape.y - getCollisionBox(obj).height - (absPos.y - obj.y); else if (obj.vy < 0) obj.y = solidShape.y + solidShape.height - (absPos.y - obj.y);
                            obj.vy = 0; break;
                        }
                    }
                }
            });

            const collidables = gameObjects.map(o => ({...o, ...getObjectAbsolutePosition(o.id, objectsById)})).filter(o => !o.isUI && (o.isTouchable ?? true));
            for (let i = 0; i < collidables.length; i++) for (let j = i + 1; j < collidables.length; j++) {
                if (isColliding(getCollisionBox(collidables[i]), getCollisionBox(collidables[j]))) {
                    frameCollisions.push({ obj1Name: collidables[i].name, obj2Name: collidables[j].name, type: 'OnCollisionWith' });
                    const o1 = gameObjects.find(o => o.id === collidables[i].id);
                    const o2 = gameObjects.find(o => o.id === collidables[j].id);
                    o1?.scripts?.forEach(s => s.trigger === 'OnCollisionWith' && (!s.params?.targetObjectName || s.params.targetObjectName === o2?.name) && s.actions.forEach(a => executeAction(a, o1)));
                    o2?.scripts?.forEach(s => s.trigger === 'OnCollisionWith' && (!s.params?.targetObjectName || s.params.targetObjectName === o1?.name) && s.actions.forEach(a => executeAction(a, o2)));
                }
            }
            
            evaluateEvents();
            frameCollisions = []; frameClicks = []; frameTimerEvents = []; frameAttacks = [];

            activeAnimations.forEach((activeAnim, objId) => {
                const obj = gameObjects.find(o => o.id === objId);
                if (!obj) { activeAnimations.delete(objId); return; }
                const elapsed = now - activeAnim.startTime;
                let totalDuration = 0, currentFrameIndex = 0;
                for (let i = 0; i < activeAnim.animation.frames.length; i++) {
                    const frameDuration = activeAnim.animation.frames[i].duration;
                    if (elapsed >= totalDuration && elapsed < totalDuration + frameDuration) { currentFrameIndex = i; break; }
                    totalDuration += frameDuration;
                }
                if (elapsed >= totalDuration) {
                    if (activeAnim.animation.loop) { 
                        activeAnim.startTime = now; 
                        currentFrameIndex = 0; 
                    } else { 
                        activeAnimations.delete(objId); 
                        const originalObject = currentScene.gameObjects.find(o => o.id === objId);
                        if (originalObject) {
                            obj.imageUrl = originalObject.imageUrl;
                        }
                        return; 
                    }
                }
                const frame = activeAnim.animation.frames[currentFrameIndex];
                if (frame) {
                    const asset = assets.find(a => a.id === frame.assetId);
                    if (asset) obj.imageUrl = asset.url;
                }
            });
            
            const followTarget = gameObjects.find(o => o.behaviors?.some(b => b.name === 'FollowCamera'));
            if (followTarget) {
                const absPos = getObjectAbsolutePosition(followTarget.id, objectsById);
                const followTargetWithAbsPos = {...followTarget, ...absPos};
                const collisionBox = getCollisionBox(followTargetWithAbsPos);
                
                const idealCamX = collisionBox.x + collisionBox.width / 2;
                const idealCamY = collisionBox.y + collisionBox.height / 2;
            
                if (currentScene?.cameraBounds?.enabled) {
                    const bounds = currentScene.cameraBounds;
                    const zoomedWidth = canvas.width / camera.zoom;
                    const zoomedHeight = canvas.height / camera.zoom;
                    
                    if (bounds.width < zoomedWidth) {
                        camera.x = bounds.x + bounds.width / 2;
                    } else {
                        const minCamX = bounds.x + zoomedWidth / 2;
                        const maxCamX = bounds.x + bounds.width - zoomedWidth / 2;
                        camera.x = Math.max(minCamX, Math.min(idealCamX, maxCamX));
                    }
                    
                    if (bounds.height < zoomedHeight) {
                        camera.y = bounds.y + bounds.height / 2;
                    } else {
                        const minCamY = bounds.y + zoomedHeight / 2;
                        const maxCamY = bounds.y + bounds.height - zoomedHeight / 2;
                        camera.y = Math.max(minCamY, Math.min(idealCamY, maxCamY));
                    }

                } else {
                    camera.x = idealCamX;
                    camera.y = idealCamY;
                }
            }

            ctx.imageSmoothingEnabled = true;
            ctx.fillStyle = runtimeBackgroundColor;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.save();
            ctx.translate(canvas.width / 2, canvas.height / 2);
            ctx.scale(camera.zoom, camera.zoom);
            ctx.translate(-camera.x, -camera.y);
            
            const allDrawable = gameObjects.map(o => ({...o, ...getObjectAbsolutePosition(o.id, objectsById)}));
            allDrawable.filter(o => !o.isUI).sort((a,b) => a.zIndex-b.zIndex).forEach(obj => renderObject(ctx, obj));
            ctx.restore();
            allDrawable.filter(o => o.isUI).sort((a,b) => a.zIndex-b.zIndex).forEach(obj => renderObject(ctx, obj, true));

            animationFrameId = requestAnimationFrame(gameLoop);
        };
        
        function renderObject(context, obj, isUI = false) {
            const tilemapBehavior = obj.behaviors?.find(b => b.name === 'Tilemap');
            if (tilemapBehavior && obj.imageUrl) {
                const img = imageCache.get(obj.imageUrl);
                if (img && img.complete) {
                    const { tileSize = 32, collisionData = '' } = tilemapBehavior.properties || {};
                    const rows = String(collisionData).split('\\n');
                    rows.forEach((row, y) => {
                        for (let x = 0; x < row.length; x++) {
                            if (row[x] !== ' ' && row[x] !== '0') {
                                context.drawImage(img, obj.x + x * tileSize, obj.y + y * tileSize, tileSize, tileSize);
                            }
                        }
                    });
                }
                return;
            }

            context.save();
            const centerX = isUI ? obj.x + obj.width/2 : obj.x + obj.width/2;
            const centerY = isUI ? obj.y + obj.height/2 : obj.y + obj.height/2;
            context.translate(centerX, centerY);
            context.rotate((obj.rotation || 0) * Math.PI / 180);
            const scaleX = (obj.scaleX ?? 1) * (obj.direction === 'left' ? -1 : 1);
            const scaleY = obj.scaleY ?? 1;
            context.scale(scaleX, scaleY);
            const drawX = -obj.width/2, drawY = -obj.height/2;

            if (obj.videoUrl) {
                const video = videoCache.get(obj.videoUrl);
                if (video) {
                    if (video.paused && (obj.videoAutoplay ?? true)) video.play().catch(()=>{});
                    video.loop = obj.videoLoop ?? true;
                    try { context.drawImage(video, drawX, drawY, obj.width, obj.height); } catch (e) {}
                }
            } else if (obj.imageUrl) {
                const img = imageCache.get(obj.imageUrl);
                if (img?.complete) context.drawImage(img, drawX, drawY, obj.width, obj.height);
            } else if (obj.color !== 'transparent') {
                context.fillStyle = obj.color;
                context.fillRect(drawX, drawY, obj.width, obj.height);
            }
            if (obj.text) {
                if (scaleX < 0) context.scale(-1, 1);
                context.fillStyle = isUI ? 'white' : (obj.color === 'transparent' ? 'white' : 'black');
                context.font = '16px sans-serif';
                context.textAlign = 'center';
                context.textBaseline = 'middle';
                let newText = obj.text;
                for (const key in gameVariables) newText = newText.replace(new RegExp('{' + key + '}', 'g'), String(gameVariables[key]));
                context.fillText(newText, 0, 0);
            }
            context.restore();
        }

        function loadSceneByName(sceneName, savedState = null) {
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
            const sceneToLoad = allScenes.find(s => s.name === sceneName);
            if (!sceneToLoad) return;
            if (backgroundMusicPlayer) backgroundMusicPlayer.pause();

            lastTime = 0;
            currentScene = sceneToLoad;
            
            if (savedState) {
                gameObjects = savedState.gameObjects;
                gameVariables = savedState.gameVariables;
                camera = savedState.camera;
                runtimeBackgroundColor = sceneToLoad.backgroundColor;
            } else {
                runtimeBackgroundColor = currentScene.backgroundColor;
                camera.zoom = currentScene.defaultZoom || 1;
                gameObjects = JSON.parse(JSON.stringify(currentScene.gameObjects.map(o => ({ ...o, vx:0,vy:0,grounded:false }))));
                if(currentScene.backgroundMusicId) {
                    const musicAsset = assets.find(a => a.id === currentScene.backgroundMusicId);
                    if(musicAsset) {
                        const cachedAudio = audioCache.get(musicAsset.url);
                        if (cachedAudio) {
                            backgroundMusicPlayer = cachedAudio.cloneNode();
                            backgroundMusicPlayer.loop = true;
                            backgroundMusicPlayer.play().catch(()=>{});
                            currentBackgroundMusicId = musicAsset.id;
                        }
                    }
                }
                currentScene.events.forEach(e => e.conditions.every(c=>c.trigger==='OnStart') && e.actions.forEach(a => executeAction(a, null)));
                gameObjects.forEach(o => o.scripts?.forEach(s => s.trigger==='OnStart' && s.actions.forEach(a => executeAction(a, o))));
            }
            activeAnimations.clear();
            timers.clear();
            intervals.clear();
            if (dialogueElement) dialogueElement.remove();
            dialogueElement = null;
            setupUI();
            animationFrameId = requestAnimationFrame(gameLoop);
        }
        
        async function startGame(data) {
            canvas.width = data.gameWidth || 1024;
            canvas.height = data.gameHeight || 768;
            allScenes = data.scenes; 
            assets = data.assets; 
            animations = data.animations;
            
            const assetPromises = assets.map(asset => new Promise((resolve, reject) => {
                if (asset.type === 'image') {
                    const img = new Image();
                    img.onload = () => { imageCache.set(asset.url, img); resolve(); };
                    img.onerror = reject; img.src = asset.url;
                } else if (asset.type === 'audio') {
                    const audio = new Audio();
                    audio.oncanplaythrough = () => { audioCache.set(asset.url, audio); resolve(); };
                    audio.onerror = reject; audio.src = asset.url;
                } else if (asset.type === 'video') {
                    const video = document.createElement('video');
                    video.oncanplaythrough = () => {
                        video.muted = true; video.playsInline = true;
                        video.play().finally(() => { videoCache.set(asset.url, video); resolve(); });
                    };
                    video.onerror = reject; video.src = asset.url; video.load();
                } else resolve();
            }));

            await Promise.allSettled(assetPromises);
            
            const preservedVars = { ...gameVariables };
            (data.globalVariables || []).forEach(v => {
                if (preservedVars[v.name] === undefined) preservedVars[v.name] = v.value;
            });
            gameVariables = preservedVars;
            
            const startingScene = data.scenes.find(s => s.id === data.activeSceneId);
            if(startingScene) {
                loadSceneByName(startingScene.name);
            }
        }

        window.addEventListener('keydown', (e) => { 
            keysPressed[e.code.toLowerCase()] = true; 
            keysPressed[e.key.toLowerCase()] = true;
        });
        window.addEventListener('keyup', (e) => { 
            keysPressed[e.code.toLowerCase()] = false; 
            keysPressed[e.key.toLowerCase()] = false;
        });
        
        canvas.addEventListener('click', (e) => {
            if (!window.audioContext) {
                try { window.audioContext = new (window.AudioContext || window.webkitAudioContext)(); } catch(e) {}
            }
            if (window.audioContext?.state === 'suspended') window.audioContext.resume();

            if (dialogueElement) { dialogueElement.remove(); dialogueElement = null; return; }
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width, scaleY = canvas.height / rect.height;
            const mouseX = (e.clientX - rect.left) * scaleX, mouseY = (e.clientY - rect.top) * scaleY;
            const objectsById = new Map(gameObjects.map(o => [o.id, o]));
            const worldMouseX = (mouseX / camera.zoom) + camera.x - (canvas.width / (2 * camera.zoom));
            const worldMouseY = (mouseY / camera.zoom) + camera.y - (canvas.height / (2 * camera.zoom));
            const clickedObject = [...gameObjects].sort((a,b)=>b.zIndex-a.zIndex).find(obj => {
                if (obj.isUI) return false;
                const absPos = getObjectAbsolutePosition(obj.id, objectsById);
                const collisionBox = getCollisionBox({...obj, ...absPos});
                return worldMouseX >= collisionBox.x && worldMouseX <= collisionBox.x + collisionBox.width &&
                       worldMouseY >= collisionBox.y && worldMouseY <= collisionBox.y + collisionBox.height;
            });
            if (clickedObject) {
                frameClicks.push(clickedObject.name);
                clickedObject.scripts?.forEach(s => s.trigger==='OnClick' && s.actions.forEach(a => executeAction(a, clickedObject)));
            }
        });
        
        function setupUI() {
            const uiContainer = document.getElementById('ui-container');
            if (!uiContainer) return;
            uiContainer.innerHTML = '';
            
            const uiControls = gameObjects.filter(o => o.isUI && o.controlAction && o.controlAction !== 'none');
            
            const scaleX = uiContainer.clientWidth / (window.projectData.gameWidth || 1024);
            const scaleY = uiContainer.clientHeight / (window.projectData.gameHeight || 768);

            uiControls.forEach(obj => {
                const button = document.createElement('button');
                
                button.style.position = 'absolute';
                button.style.left = (obj.x * scaleX) + 'px';
                button.style.top = (obj.y * scaleY) + 'px';
                button.style.width = (obj.width * scaleX) + 'px';
                button.style.height = (obj.height * scaleY) + 'px';
                button.style.background = obj.imageUrl ? \`url(\${obj.imageUrl})\` : obj.color;
                button.style.backgroundSize = 'contain';
                button.style.backgroundRepeat = 'no-repeat';
                button.style.backgroundPosition = 'center';
                button.style.border = '2px solid rgba(255,255,255,0.3)';
                button.style.borderRadius = '8px';
                button.dataset.action = obj.controlAction;
                uiContainer.appendChild(button);

                const handlePress = e => { e.preventDefault(); actionsPressed[obj.controlAction] = true; actionsPressed[obj.controlAction + '_ui'] = true; };
                const handleRelease = e => { e.preventDefault(); actionsPressed[obj.controlAction] = false; actionsPressed[obj.controlAction + '_ui'] = false; };

                button.addEventListener('mousedown', handlePress);
                button.addEventListener('mouseup', handleRelease);
                button.addEventListener('mouseleave', handleRelease);
                button.addEventListener('touchstart', handlePress, { passive: false });
                button.addEventListener('touchend', handleRelease, { passive: false });
            });
            
            if (window.projectData.joystick?.enabled) {
                joystickSize = window.projectData.joystick.size || 120;
                const joystickBase = document.createElement('div');
                const joystickHandle = document.createElement('div');
                const handleSize = joystickSize / 2.4;
                
                joystickBase.style.position = 'absolute';
                joystickBase.style.bottom = '40px';
                joystickBase.style[window.projectData.joystick.position || 'left'] = '40px';
                joystickBase.style.width = joystickSize + 'px';
                joystickBase.style.height = joystickSize + 'px';
                joystickBase.style.backgroundColor = 'rgba(255, 255, 255, ' + (window.projectData.joystick.opacity ?? 0.1) + ')';
                joystickBase.style.borderRadius = '50%';
                joystickBase.style.pointerEvents = 'auto';
                joystickBase.style.userSelect = 'none';

                joystickHandle.style.position = 'absolute';
                joystickHandle.style.width = handleSize + 'px';
                joystickHandle.style.height = handleSize + 'px';
                joystickHandle.style.backgroundColor = 'rgba(255, 255, 255, 0.3)';
                joystickHandle.style.borderRadius = '50%';
                joystickHandle.style.left = 'calc(50% - ' + (handleSize / 2) + 'px)';
                joystickHandle.style.top = 'calc(50% - ' + (handleSize / 2) + 'px)';
                joystickHandle.style.transition = 'transform 50ms linear';

                joystickBase.appendChild(joystickHandle);
                uiContainer.appendChild(joystickBase);
                
                const updateJoystickVisuals = () => {
                    if (joystickState.active) {
                        const x = joystickState.distance * Math.cos(joystickState.angle * Math.PI / 180);
                        const y = joystickState.distance * Math.sin(joystickState.angle * Math.PI / 180);
                        joystickHandle.style.transform = \`translate(\${x}px, \${y}px)\`;
                    } else {
                        joystickHandle.style.transform = 'translate(0, 0)';
                    }
                };

                const updateJoystickState = (touch) => {
                    const rect = joystickBase.getBoundingClientRect();
                    const centerX = rect.left + rect.width / 2;
                    const centerY = rect.top + rect.height / 2;
                    const dx = touch.clientX - centerX;
                    const dy = touch.clientY - centerY;
                    const angle = Math.atan2(dy, dx) * (180 / Math.PI);
                    const distance = Math.min(joystickSize / 2, Math.hypot(dx, dy));
                    joystickState = { active: true, angle, distance };
                    updateJoystickVisuals();
                };

                joystickBase.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    const touch = e.changedTouches[0];
                    if (touch) {
                        joystickTouchId = touch.identifier;
                        updateJoystickState(touch);
                    }
                }, { passive: false });

                window.addEventListener('touchmove', (e) => {
                    if (joystickTouchId !== null) {
                        for (let i = 0; i < e.changedTouches.length; i++) {
                            const touch = e.changedTouches[i];
                            if (touch.identifier === joystickTouchId) {
                                e.preventDefault();
                                updateJoystickState(touch);
                                return;
                            }
                        }
                    }
                }, { passive: false });

                window.addEventListener('touchend', (e) => {
                    if (joystickTouchId !== null) {
                         for (let i = 0; i < e.changedTouches.length; i++) {
                            const touch = e.changedTouches[i];
                            if (touch.identifier === joystickTouchId) {
                                e.preventDefault();
                                joystickState = { active: false, angle: 0, distance: 0 };
                                joystickTouchId = null;
                                updateJoystickVisuals();
                                return;
                            }
                        }
                    }
                }, { passive: false });
            }
        }

        window.addEventListener('resize', () => {
             const gameContainer = document.getElementById('game-container');
             const uiContainer = document.getElementById('ui-container');
             const w = gameContainer.clientWidth;
             const h = gameContainer.clientHeight;
             const ratio = (window.projectData.gameWidth || 1024) / (window.projectData.gameHeight || 768);
             
             let newCanvasWidth, newCanvasHeight;
             if (w / h > ratio) {
                newCanvasHeight = h;
                newCanvasWidth = h * ratio;
             } else {
                newCanvasWidth = w;
                newCanvasHeight = w / ratio;
             }
             canvas.style.height = newCanvasHeight + 'px';
             canvas.style.width = newCanvasWidth + 'px';
             uiContainer.style.height = newCanvasHeight + 'px';
             uiContainer.style.width = newCanvasWidth + 'px';
             setupUI();
        });
        
        document.addEventListener('DOMContentLoaded', () => {
            startGame(window.projectData);
            window.dispatchEvent(new Event('resize'));
        });
    `;

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
    <title>Return 2D Game</title>
    <style>
        body, html { margin: 0; padding: 0; height: 100%; width: 100%; overflow: hidden; background-color: #000; display: flex; justify-content: center; align-items: center; font-family: sans-serif; color: white; }
        #game-container { position: relative; width: 100%; height: 100%; display: flex; justify-content: center; align-items: center; }
        canvas { display: block; image-rendering: pixelated; image-rendering: -moz-crisp-edges; image-rendering: crisp-edges; max-width: 100%; max-height: 100%; }
        #ui-container { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); pointer-events: none; }
        #ui-container button, #ui-container div { pointer-events: auto; }
    </style>
</head>
<body>
    <div id="game-container">
        <canvas id="gameCanvas"></canvas>
        <div id="ui-container"></div>
    </div>
    <script>
        window.projectData = ${JSON.stringify(projectData)};
        ${gameEngineScript}
    </script>
</body>
</html>`;
};