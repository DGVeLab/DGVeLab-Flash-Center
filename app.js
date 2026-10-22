// Navigation and official firmware catalog — DGVeLab Flash Center
const officialTab=document.querySelector('#officialTab');
const advancedTab=document.querySelector('#advancedTab');
const officialPanel=document.querySelector('#officialPanel');
const advancedPanel=document.querySelector('#advancedPanel');
function activate(advanced){
  officialTab.classList.toggle('active',!advanced);
  advancedTab.classList.toggle('active',advanced);
  officialTab.setAttribute('aria-selected',String(!advanced));
  advancedTab.setAttribute('aria-selected',String(advanced));
  officialPanel.classList.toggle('hidden',advanced);
  advancedPanel.classList.toggle('hidden',!advanced);
}
officialTab.addEventListener('click',()=>activate(false));
advancedTab.addEventListener('click',()=>activate(true));
document.querySelectorAll('.device').forEach(el=>el.addEventListener('click',()=>{
  document.querySelectorAll('.device').forEach(x=>x.classList.remove('chosen'));
  el.classList.add('chosen');
}));
if(!('serial' in navigator)){
  document.querySelector('#support').textContent='Web Serial unavailable. Use Chrome or Edge desktop over HTTPS.';
}
