// Streak Garden — water wave animation for day cubes.
// Call Water.trigger(cell) when a cube's fill level changes:
// the wave (styled in water.css) shows and moves for one short cycle, then hides.
const Water = (() => {
  const DURATION_MS = 1200;

  function trigger(cell) {
    cell.classList.remove('waving');
    void cell.offsetWidth; // restart the CSS animation
    cell.classList.add('waving');
    clearTimeout(cell._waveTimer);
    cell._waveTimer = setTimeout(() => cell.classList.remove('waving'), DURATION_MS);
  }

  return { trigger };
})();
