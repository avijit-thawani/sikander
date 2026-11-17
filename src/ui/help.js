export function showHelp() {
  const host = document.getElementById('modal');
  const el = document.createElement('div');
  el.className = 'results';
  el.innerHTML = `<div class="results-card help"><h2>How to play</h2>
  <ul>
    <li>The field is 5 lanes by 30 columns. Units only fight units in their own lane, side by side.</li>
    <li>Each round both generals give orders in secret. Then orders run one at a time, alternating sides; who goes first swaps every round.</li>
    <li>Click one of your units to open its command ring: <b>Move</b>, <b>Fire</b> (archers), <b>Fortify</b> (+0.20 defence), <b>Taunt</b> (raise your army's morale, lower theirs).</li>
    <li>A unit can move up to its movement value minus one squares (an L-shaped path). Moving a long way straight at an enemy in the same lane is a <b>charge</b>.</li>
    <li>Three units stacked in one column form a <b>shield wall</b> (+0.25 defence, −50 attack). Three in a chevron pointing at the enemy form a <b>wedge</b> (+100 attack). Formations move together; use <b>Break</b> to command members individually.</li>
    <li>Damaged, outnumbered or leaderless units may flee. An army with no units, or no morale, loses.</li>
    <li>Hit <b>Execute Commands</b> when you are ready for battle.</li>
  </ul><div class="buttons"><button class="btn" id="btn-close-help">Close</button></div></div>`;
  host.appendChild(el);
  el.querySelector('#btn-close-help').addEventListener('click', () => el.remove());
}
