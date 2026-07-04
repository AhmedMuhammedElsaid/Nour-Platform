// Self-contained HTML compass rendered inside a WebView. This deliberately reuses
// the BROWSER's compass pipeline — `deviceorientationabsolute` (Android's fused
// rotation-vector: gyro + accelerometer + magnetometer) / `webkitCompassHeading`
// (iOS) — plus a CSS `transform: rotate()` on the GPU. It is the same thing the web
// `/qibla` page does, which the user confirmed is smooth and accurate on-device;
// native expo sensors could not match it (magnetometer-only → uncalibrated
// "accuracy 0"; DeviceMotion is relative on Android). See docs/adr/0010.
//
// The bearing (great-circle, true north) is baked in at generate time; the rose
// rotates by -heading and the marker highlights within the tolerance. Heading +
// alignment are posted back to native (throttled) for the "facing Qibla" text.

export type CompassPalette = {
  gold: string;
  sun: string;
  muted: string;
  surface: string;
  surface2: string;
  border: string;
};

const SIZE = 240;
const C = SIZE / 2;
const R = 104;
const TOLERANCE = 6;

function polar(deg: number, radius: number): { x: number; y: number } {
  const a = (deg * Math.PI) / 180;
  return { x: C + radius * Math.sin(a), y: C - radius * Math.cos(a) };
}

export function compassHtml(bearing: number, p: CompassPalette): string {
  const ticks = Array.from({ length: 24 }, (_, i) => i * 15)
    .map((angle) => {
      const card = angle % 90 === 0;
      const o = polar(angle, R);
      const inn = polar(angle, R - (card ? 14 : 8));
      return `<line x1="${o.x}" y1="${o.y}" x2="${inn.x}" y2="${inn.y}" stroke="${p.muted}" stroke-opacity="${card ? 0.9 : 0.4}" stroke-width="${card ? 2 : 1}"/>`;
    })
    .join("");

  const cards = ([["N", 0], ["E", 90], ["S", 180], ["W", 270]] as const)
    .map(([label, angle]) => {
      const pt = polar(angle, R - 28);
      return `<text x="${pt.x}" y="${pt.y}" text-anchor="middle" dominant-baseline="central" font-size="14" font-family="sans-serif" fill="${label === "N" ? p.gold : p.muted}">${label}</text>`;
    })
    .join("");

  const m = polar(bearing, R - 6);
  const mb = polar(bearing, R - 34);
  const marker =
    `<line x1="${C}" y1="${C}" x2="${mb.x}" y2="${mb.y}" stroke="var(--marker)" stroke-width="3" stroke-linecap="round"/>` +
    `<circle cx="${m.x}" cy="${m.y}" r="12" fill="var(--marker)"/>` +
    `<text x="${m.x}" y="${m.y}" text-anchor="middle" dominant-baseline="central" font-size="13">🕋</text>`;

  return `<!doctype html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/>
<style>
  :root{--marker:${p.gold};}
  html,body{margin:0;height:100%;background:${p.surface};overflow:hidden;-webkit-user-select:none;user-select:none;-webkit-tap-highlight-color:transparent;}
  #wrap{position:relative;width:100%;height:100%;display:flex;align-items:center;justify-content:center;}
  svg{width:100%;height:100%;max-width:320px;}
  /* GPU-composited rotation, eased between samples — this is what makes it smooth. */
  #rose{transform-origin:${C}px ${C}px;transition:transform .12s linear;will-change:transform;}
  #dial.aligned{--marker:${p.sun};}
</style></head><body>
<div id="wrap">
  <svg id="dial" viewBox="0 0 ${SIZE} ${SIZE}">
    <g id="rose">
      <circle cx="${C}" cy="${C}" r="${R + 14}" fill="${p.surface2}" stroke="${p.border}"/>
      ${ticks}${cards}${marker}
    </g>
    <polygon points="${C - 8},14 ${C + 8},14 ${C},30" fill="${p.muted}"/>
    <circle cx="${C}" cy="${C}" r="5" fill="${p.muted}"/>
  </svg>
</div>
<script>
(function(){
  var BEARING=${bearing}, TOL=${TOLERANCE};
  var rose=document.getElementById('rose'), dial=document.getElementById('dial'), lastMsg=0;
  function post(o){ if(window.ReactNativeWebView){ window.ReactNativeWebView.postMessage(JSON.stringify(o)); } }
  function onOrient(e){
    var h=null;
    if(typeof e.webkitCompassHeading==='number'){ h=e.webkitCompassHeading; }
    else if(e.absolute && typeof e.alpha==='number'){ h=360-e.alpha; }
    if(h==null) return;
    h=((h%360)+360)%360;
    rose.style.transform='rotate('+(-h)+'deg)';
    var aligned=Math.abs(((h-BEARING+540)%360)-180)<=TOL;
    dial.classList.toggle('aligned',aligned);
    var now=Date.now();
    if(now-lastMsg>150){ lastMsg=now; post({heading:h,aligned:aligned,live:true}); }
  }
  function start(){
    window.addEventListener('deviceorientationabsolute',onOrient,true);
    window.addEventListener('deviceorientation',onOrient,true);
  }
  // iOS needs a user gesture to grant orientation permission; Android just works.
  function enable(){
    try{
      if(typeof DeviceOrientationEvent!=='undefined' && typeof DeviceOrientationEvent.requestPermission==='function'){
        DeviceOrientationEvent.requestPermission().then(function(s){ if(s==='granted'){ start(); } }).catch(function(){});
      } else { start(); }
    }catch(e){ start(); }
  }
  document.body.addEventListener('click',enable);
  enable();
  post({live:false,aligned:false});
})();
</script>
</body></html>`;
}
