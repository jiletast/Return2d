

export interface CollisionProperties {
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
}

export interface Behavior {
  name: string; // e.g., 'PlatformerCharacter'
  properties: Record<string, any>; // e.g., { speed: 100, jumpForce: 300 }
}

export interface Variable {
    name: string;
    value: string | number | boolean;
}

export type ObjectTrigger = 'OnStart' | 'OnUpdate' | 'OnClick' | 'OnCollisionWith' | 'CompareObjectVariable' | 'Always';

export interface ObjectScript {
  id: string;
  trigger: ObjectTrigger;
  actions: Action[];
  // For 'OnCollisionWith' or 'CompareObjectVariable'
  params?: {
    targetObjectName?: string;
    variable?: string;
    operator?: string;
    value?: string | number;
  };
}

export interface GameObject {
  id: number;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string; // Now a hex color string, e.g., "#FF5733"
  zIndex: number;
  imageUrl?: string; // Optional image URL for the object's appearance
  videoUrl?: string;
  videoLoop?: boolean;
  videoAutoplay?: boolean;
  behaviors?: Behavior[];
  isUI?: boolean; // Is this a fixed-position UI element?
  text?: string; // Text content if it's a UI text object
  variables?: Variable[]; // For object-specific variables
  scripts?: ObjectScript[]; // For object-specific visual scripts
  controlAction?: 'moveLeft' | 'moveRight' | 'jump' | 'attack' | 'none' | 'moveUp' | 'moveDown';
  parentId?: number | null; // For object hierarchy
  stats?: { // For RPG elements
    hp: number;
    maxHp: number;
    attack: number;
  };
  direction?: 'left' | 'right';
  rotation?: number; // In degrees
  scaleX?: number;
  scaleY?: number;
  isTouchable?: boolean; // If false, object is ignored by collision event detection. Defaults to true.
  useCustomCollision?: boolean;
  collision?: CollisionProperties;


  // Properties for game simulation
  vx?: number;
  vy?: number;
  grounded?: boolean;
  patrolStartX?: number; // For Patrol behavior
  isAttacking?: boolean; // For attack behavior state
  pendingMovements?: { direction: string; speed: number }[]; // For MoveObject action
  oscillation?: {
    axis: 'x' | 'y';
    distance: number;
    speed: number;
    initialX: number;
    initialY: number;
    startTime: number;
  };
  scaleOscillation?: {
    distance: number;
    speed: number;
    initialScaleX: number;
    initialScaleY: number;
    startTime: number;
  };
  rotationSpeed?: number;
  initialX?: number;
  initialY?: number;
  initialScaleX?: number;
  initialScaleY?: number;
  animOffsetX?: number;
  animOffsetY?: number;
  animRotation?: number;
  animScaleX?: number;
  animScaleY?: number;
  scaleSpeedX?: number;
  scaleSpeedY?: number;
  tweens?: {
    type: 'position' | 'rotation' | 'scale';
    startX?: number;
    startY?: number;
    endX?: number;
    endY?: number;
    startRotation?: number;
    endRotation?: number;
    startScaleX?: number;
    startScaleY?: number;
    endScaleX?: number;
    endScaleY?: number;
    startTime: number;
    duration: number;
  }[];
}

export interface GameAsset {
  id: string;
  name:string;
  type: 'image' | 'audio' | 'video';
  url: string;
}

export interface AnimationKeyframe {
  assetId: string; // id of the image asset
  duration: number; // in milliseconds
  x?: number;
  y?: number;
  rotation?: number;
  scaleX?: number;
  scaleY?: number;
}

export interface Animation {
  id: string;
  name: string;
  frames: AnimationKeyframe[];
  loop: boolean;
}


export interface Condition {
  object: string;
  trigger: 'OnStart' | 'OnCollisionWith' | 'OnKeyPress' | 'OnAnyKeyPress' | 'CompareVariable' | 'OnObjectClicked' | 'IsIdle' | 'IsRunning' | 'IsJumping' | 'OnAttack' | 'OnVerticalCollision' | 'OnHorizontalCollision' | 'IsOnGround' | 'IsMoving' | 'OnMatchFound' | 'OnPlayerJoined' | 'OnPlayerLeft' | 'OnReceiveNetworkMessage' | 'IsMusicPlaying' | 'CompareStat' | 'CompareObjectVariable' | 'OnJoystickMove' | 'OnJoystickUp' | 'OnJoystickDown' | 'OnJoystickLeft' | 'OnJoystickRight' | 'OnTimerElapsed' | 'EveryXSeconds' | 'Always';
  target?: string;
  params?: Record<string, any>;
}

export interface Action {
  object: string; // Can be an object name, 'System', or 'Self' for object scripts
  action: 'Destroy' | 'AddToVariable' | 'SetVariable' | 'GoToScene' | 'SetUIText' | 'SetObjectPosition' | 'PlaySound' | 'SetBackgroundColor' | 'SetBackgroundMusic' | 'StopBackgroundMusic' | 'PauseBackgroundMusic' | 'ResumeBackgroundMusic' | 'SetBackgroundMusicVolume' | 'PlayAnimation' | 'ModifyStat' | 'ShowDialogue' | 'SetQuestState' | 'CreateMatch' | 'JoinMatch' | 'SendNetworkMessage' | 'SetPlayerName' | 'CreateObject' | 'PlayVideo' | 'PauseVideo' | 'StopVideo' | 'SaveGame' | 'LoadGame' | 'SetCameraZoom' | 'SetObjectVariable' | 'AddToObjectVariable' | 'StartTimer' | 'StopTimer' | 'MoveObject' | 'ForceJump' | 'TriggerAttack' | 'SetParent' | 'RotateObject' | 'ScaleObject' | 'GenerateObjectAt' | 'OscillateObject' | 'OscillateScale' | 'RotateContinuously' | 'SetScale' | 'SetVelocityX' | 'SetVelocityY' | 'SetRotationSpeed' | 'SetScaleSpeedX' | 'SetScaleSpeedY' | 'MoveTo' | 'RotateTo' | 'ScaleTo';
  params?: Record<string, any>;
}

export interface GameEvent {
  id: string;
  conditions: Condition[];
  actions: Action[];
}

export interface Scene {
  id: string;
  name: string;
  gameObjects: GameObject[];
  events: GameEvent[];
  backgroundColor: string;
  backgroundMusicId?: string;
  defaultZoom?: number;
  cameraBounds?: {
    enabled: boolean;
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface ProjectData {
  scenes: Scene[];
  activeSceneId: string | null;
  assets: GameAsset[];
  animations: Animation[];
  globalVariables?: Variable[];
  orientation?: 'landscape' | 'portrait';
  responsive?: boolean;
  gameWidth?: number;
  gameHeight?: number;
  joystick?: {
    enabled: boolean;
    position: 'left' | 'right';
    size?: number;
    opacity?: number;
  };
}

export interface Project {
  id: string;
  name: string;
  lastModified: number;
  data: ProjectData;
}