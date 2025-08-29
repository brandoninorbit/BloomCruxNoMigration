// Centralized price table for cosmetic purchases
// Prices designed so time-to-afford after unlock is 2-4 successful missions
// Based on unlock levels from unlocks.ts
export const COSMETIC_PRICES: Record<string, number> = {
  Sunrise: 180,        // L2 unlock - 2-3 missions to afford
  DeepSpace: 240,      // L3 unlock - 2-3 missions to afford
  NightMission: 360,   // L5 unlock - 3-4 missions to afford
  AgentStealth: 520,   // L8 unlock - 4-5 missions to afford
  Rainforest: 700,     // L11 unlock - 5-6 missions to afford
  DesertStorm: 850,    // L13 unlock - 6-7 missions to afford
  NeonGlow: 240,       // L4 unlock (AvatarFrames category) - 2-3 missions to afford
};
