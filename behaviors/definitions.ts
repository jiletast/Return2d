

export interface BehaviorDefinition {
  name: string;
  description: string;
  defaultProperties: Record<string, any>;
}

export const availableBehaviors: BehaviorDefinition[] = [
  {
    name: 'PlatformerCharacter',
    description: 'Habilita controles de teclado para movimiento lateral y salto.',
    defaultProperties: {
      speed: 150,
      jumpForce: 350,
      gravity: 500,
    },
  },
  {
    name: 'TopDownRPGMovement',
    description: 'Habilita movimiento en 8 direcciones (arriba/abajo/lados/diagonales) sin gravedad.',
    defaultProperties: {
      speed: 100,
    },
  },
  {
    name: 'Solid',
    description: 'Convierte el objeto en un obstáculo sólido sobre el que otros objetos pueden pararse o colisionar.',
    defaultProperties: {},
  },
  {
    name: 'Physics',
    description: 'Aplica gravedad al objeto, haciendo que caiga.',
    defaultProperties: {
      gravity: 500,
    },
  },
  {
    name: 'Patrol',
    description: 'Mueve el objeto de un lado a otro horizontalmente dentro de un rango establecido.',
    defaultProperties: {
      speed: 50,
      patrolRange: 100,
    },
  },
  {
    name: 'FollowCamera',
    description: 'Hace que la cámara del juego siga a este objeto.',
    defaultProperties: {},
  },
  {
    name: 'Tilemap',
    description: 'Genera un mapa de colisiones estático basado en una rejilla de texto. Usa cualquier caracter para un bloque sólido y "0" o espacio para vacío.',
    defaultProperties: {
      tileSize: 32,
      collisionData: '11111111111111111111\n10000000000000000001\n10000000000000000001\n10000000000000000001\n11111111111111111111',
    },
  },
];