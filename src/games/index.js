// src/games/index.js — Game module registry
//
// To register a new game: import the module and add it to GAME_REGISTRY.
// The App and all UI components resolve game-specific behaviour exclusively
// through getModule() — no other file needs to know about individual games.
import { InsiderModule }   from './insider/index';
import { ChameleonModule } from './chameleon/index';
import { SpyfallModule }   from './spyfall/index';

export const GAME_REGISTRY = {
  insider:   InsiderModule,
  chameleon: ChameleonModule,
  spyfall:   SpyfallModule,
};

/** Resolve the active module by gameType; falls back to InsiderModule. */
export function getModule(gameType) {
  return GAME_REGISTRY[gameType] ?? InsiderModule;
}
