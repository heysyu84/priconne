// Small Princess Connect-style loading indicator, independent of data/storage logic.
const indicator = document.createElement('div');
indicator.className = 'nyang-loading-indicator';
indicator.hidden = true;
indicator.setAttribute('role', 'status');
indicator.setAttribute('aria-label', '데이터를 불러오는 중');
indicator.innerHTML = `
  <svg class="nyang-loading-silhouette" viewBox="0 5 62 61" aria-hidden="true">
    <path fill="currentColor" d="M54,15l-2,2l-1,-3l-2,4l-2,1l-3,-2l-5,0l-1,-1l0,-4l-3,-1l-1,6l-3,3l-5,1l-3,5l-4,4l2,-1l1,1l0,2l-2,2l2,3l-2,1l-2,3l1,2l-1,1l4,2l-1,2l-3,2l-2,-1l-5,1l1,1l-1,3l2,0l1,2l2,-1l4,-5l2,-1l1,3l2,0l5,-4l1,2l4,3l0,3l2,-1l3,-5l4,-2l-1,-2l3,-3l4,-1l5,-5l0,-1l-3,-1l3,-2l0,-2l-3,1l-1,-1l0,-2l3,-1l-3,-4l3,-5z" />
    <path class="nyang-loading-detail" d="M30,28l3,-1l2,3l-1,1z M29,33l0,-2l2,-1l1,2l-2,2z" />
  </svg>
  <span class="nyang-loading-letters" aria-hidden="true">${[...'Now Loading...'].map((letter, i) => letter === ' ' ? '<span class="nyang-loading-space"> </span>' : `<span class="nyang-loading-char" style="--i:${i}">${letter}</span>`).join('')}</span>`;
document.body.append(indicator);
// Match the loading animation to the actual site canvas, not the device OS preference.
// The site may have a separate light/dark setting even on a dark-mode phone.
function syncAppearance(){
  const bg=getComputedStyle(document.body).backgroundColor;
  const rgb=bg.match(/[0-9]+(?:\.[0-9]+)?/g);
  if(!rgb){indicator.classList.remove('nyang-loading-dark');return;}
  const [r,g,b]=rgb.slice(1,4).map(Number);
  const brightness=(0.2126*r+0.7152*g+0.0722*b)/255;
  indicator.classList.toggle('nyang-loading-dark',brightness<0.52);
}
const requests = new Set();
let showTimer = null;
let nextId = 0;
function hideIfIdle() {
  if (requests.size !== 0) return;
  if (showTimer !== null) clearTimeout(showTimer);
  showTimer = null;
  indicator.hidden = true;
}
export function beginLoading() {
  const id = ++nextId;
  requests.add(id);
  if (showTimer === null && indicator.hidden) {
    syncAppearance();
    showTimer = setTimeout(() => {
      showTimer = null;
      if (requests.size) indicator.hidden = false;
    }, 300);
  }
  let finished = false;
  // Network hangs should never leave an indicator visible indefinitely.
  const watchdog = setTimeout(endLoading, 30000);
  function endLoading() {
    if (finished) return;
    finished = true;
    clearTimeout(watchdog);
    requests.delete(id);
    hideIfIdle();
  }
  return endLoading;
}
window.addEventListener('pagehide', () => { requests.clear(); hideIfIdle(); });
