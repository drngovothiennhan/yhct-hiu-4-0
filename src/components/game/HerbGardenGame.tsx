import HerbGardenGameV7 from './HerbGardenGameV7';

// Stable module contract retained for the global acceptance gate. The production
// implementation lives in HerbGardenGameV7 and is checked by the dedicated
// garden-fertilizer-contract gate. v3 remains a backward-compatible RPC facade;
// the interactive client uses the structured v4 fertilizer RPC.
export const GARDEN_GAME_CONTRACT={
  state:'herb_garden_state_v3',
  selectInitial:'herb_garden_select_initial_plots_v3',
  plant:'herb_garden_plant_v3',
  water:'herb_garden_water_v4',
  fertilizerLegacy:'herb_garden_fertilize_v3',
  harvest:'herb_garden_harvest_v3',
  boardClass:'garden-nine-grid',
  summaryContract:'Đã mở {unlockedCount}/9 ô'
} as const;

export default HerbGardenGameV7;
