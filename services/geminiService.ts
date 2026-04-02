import { GoogleGenAI, Type } from "@google/genai";
import type { GameEvent } from '../types';

let aiInstance: GoogleGenAI | null = null;

const getAI = () => {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
    if (!apiKey) {
      console.warn("GEMINI_API_KEY environment variable not set. This will fail if you make an API call.");
      // We don't throw here to avoid crashing at module load time, 
      // but we will throw when actually trying to use it.
    }
    aiInstance = new GoogleGenAI({ apiKey: apiKey || '' });
  }
  return aiInstance;
};

const eventSchema = {
  type: Type.OBJECT,
  properties: {
    events: {
      type: Type.ARRAY,
      description: "An array of game events triggered by the prompt.",
      items: {
        type: Type.OBJECT,
        properties: {
          id: {
            type: Type.STRING,
            description: "A unique identifier for the event, e.g., 'event-1699898989'."
          },
          conditions: {
            type: Type.ARRAY,
            description: "A list of conditions that must be met for the actions to trigger.",
            items: {
              type: Type.OBJECT,
              properties: {
                object: {
                  type: Type.STRING,
                  description: "The primary object involved in the condition (e.g., 'Player', 'Enemy'). Can also be 'System' for non-object-specific triggers."
                },
                trigger: {
                  type: Type.STRING,
                  description: "The event trigger (e.g., 'OnCollisionWith', 'OnKeyPress', 'OnAnyKeyPress', 'OnStart', 'CompareVariable')."
                },
                target: {
                  type: Type.STRING,
                  description: "The secondary object, if any (e.g., the object collided with)."
                },
                params: {
                  type: Type.OBJECT,
                  description: "Additional parameters, like the key for 'OnKeyPress' or variable comparison details.",
                  properties: {
                    key: { type: Type.STRING },
                    variable: { type: Type.STRING },
                    operator: { type: Type.STRING, description: "e.g., '==', '>', '<', '!=' '>=', '<='" },
                    value: { type: Type.STRING },
                  }
                }
              }
            }
          },
          actions: {
            type: Type.ARRAY,
            description: "A list of actions to perform when the conditions are met.",
            items: {
              type: Type.OBJECT,
              properties: {
                object: {
                  type: Type.STRING,
                  description: "The object to perform the action on (e.g., 'Player', 'System', 'Coin')."
                },
                action: {
                  type: Type.STRING,
                  description: "The action to perform (e.g., 'Destroy', 'AddToVariable', 'SetVariable', 'GoToScene', 'SetUIText', 'ModifyStat', 'ShowDialogue', 'SetQuestState')."
                },
                params: {
                  type: Type.OBJECT,
                  description: "Parameters for the action, such as variable name, value, speed, or scene name.",
                   properties: {
                    variable: { type: Type.STRING },
                    value: { type: Type.STRING }, // Use string to handle numbers, text, or increments like "+1"
                    direction: { type: Type.STRING },
                    speed: { type: Type.NUMBER },
                    scene: { type: Type.STRING },
                    text: { type: Type.STRING },
                    stat: { type: Type.STRING, description: "e.g., 'hp', 'attack'" },
                    operation: { type: Type.STRING, description: "e.g., 'add', 'subtract', 'set'" },
                    dialogueText: { type: Type.STRING },
                    questId: { type: Type.STRING },
                    questState: { type: Type.STRING },
                  }
                }
              }
            }
          }
        }
      }
    }
  }
};


export const generateEventLogic = async (prompt: string): Promise<{ events: GameEvent[] }> => {
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Basado en la petición del usuario, genera un objeto JSON estructurado que represente la lógica del juego. Aquí hay algunos ejemplos:
      - "cuando el jugador toca una moneda, la moneda desaparece y la puntuación sube 10" -> condición: jugador colisiona con moneda; acciones: destruir moneda, añadir 10 a la variable puntuación.
      - "pulsa espacio para que el jugador salte" -> condición: al pulsar tecla 'espacio'; acción: aplicar fuerza hacia arriba al jugador (parte del comportamiento Plataforma, no se necesita evento a menos que sea un salto personalizado).
      - "si la puntuación es 100, ir a la escena 'Nivel 2'" -> condición: Sistema CompararVariable 'puntuación' igualA '100'; acción: Sistema IrAEscena 'Nivel 2'.
      - "cuando el jugador colisiona con la moneda, actualizar TextoPuntuacion para mostrar la nueva puntuación" -> condición: jugador colisiona con moneda; acción: TextoPuntuacion EstablecerTextoUI "Puntuación: {puntuacion}". Usa llaves para insertar valores de variables.
      - "si el jugador choca con un enemigo, quitar 10 de vida al jugador" -> condición: jugador colisiona con enemigo; acción: jugador ModificarEstadística 'hp' 'restar' '10'.
      
      Petición del Usuario: "${prompt}"`,
      config: {
        responseMimeType: "application/json",
        responseSchema: eventSchema,
      },
    });

    const jsonText = response.text.trim();
    if (!jsonText) {
        throw new Error("La API devolvió una respuesta vacía.");
    }
    
    const parsed = JSON.parse(jsonText);
    
    if (!parsed || !Array.isArray(parsed.events)) {
      throw new Error("La respuesta de la IA no tiene el formato esperado (falta la propiedad 'events').");
    }
    
    // Add unique IDs if the model didn't
    parsed.events.forEach((event: Partial<GameEvent>) => {
      if (!event.id) {
        event.id = `evt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      }
    });

    return parsed;
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    throw new Error("Fallo al generar la lógica del evento. Por favor, comprueba tu clave de API y la petición.");
  }
};