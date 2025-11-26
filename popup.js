
const qs=(s,el=document)=>el.querySelector(s)
const qsa=(s,el=document)=>[...el.querySelectorAll(s)]
const storage=chrome.storage.local

const tabs=qsa('.tabbar button')
const sections={todo:qs('#tab-todo'),timer:qs('#tab-timer'),calendar:qs('#tab-calendar'),notes:qs('#tab-notes')}
tabs.forEach(b=>b.onclick=()=>{tabs.forEach(x=>x.classList.remove('active'));b.classList.add('active');Object.values(sections).forEach(s=>s.hidden=true);qs('#tab-'+b.dataset.tab).hidden=false;qs('#tab-'+b.dataset.tab).classList.add('fade-in')})

qs('#openSettings').onclick=()=>chrome.runtime.openOptionsPage()

// To-Do
const todoInput=qs('#todoInput')
const todoList=qs('#todoList')
const addTodo=qs('#addTodo')

function renderTodos(items){
  todoList.innerHTML=''
  items.forEach(x=>{
    const li=document.createElement('div')
    li.className='todo-item'+(x.done?' done':'')
    li.innerHTML=`<input type="checkbox" ${x.done?'checked':''}><div class="label" style="flex:1">${x.text}</div><button class="ghost">✏️</button><button class="ghost">🗑️</button>`
    const [ck,label,edit,del]=li.children
    ck.onchange=()=>{x.done=ck.checked;li.classList.toggle('done',x.done);saveTodos(items)}
    edit.onclick=()=>{const t=prompt('Editează',x.text);if(t!==null){x.text=t.trim();saveTodos(items)}}
    del.onclick=()=>{const a=items.filter(i=>i.id!==x.id);saveTodos(a)}
    todoList.appendChild(li)
  })
}
function saveTodos(items){storage.set({todos:items});renderTodos(items)}
addTodo.onclick=()=>{const t=todoInput.value.trim();if(!t)return;const id=Date.now()+Math.random().toString(36).slice(2);storage.get(['todos']).then(r=>{const items=r.todos||[];items.unshift({id,text:t,done:false});todoInput.value='';saveTodos(items)})}
storage.get(['todos']).then(r=>renderTodos(r.todos||[]))

// Timer persistent
let remaining = 0, uiTick = null, endAt = null;

const timeDisplay = qs('#timeDisplay');
const startBtn = qs('#startTimer');
const pauseBtn = qs('#pauseTimer');
const resetBtn = qs('#resetTimer');
const custom = qs('#setCustom');
const customMinutes = qs('#customMinutes');

function fmt(n){const m=Math.floor(n/60),s=n%60;return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`}

function drawUI(){
  if (endAt) {
    const diff = Math.max(0, Math.floor((endAt - Date.now())/1000));
    timeDisplay.textContent = fmt(diff);
    if (diff <= 0) stopUI();
  } else {
    timeDisplay.textContent = fmt(remaining || 0);
  }
}
function startUI(){ stopUI(); uiTick = setInterval(drawUI, 1000); drawUI(); }
function stopUI(){ if (uiTick) { clearInterval(uiTick); uiTick = null; } }

async function saveTimer(running){
  await chrome.storage.local.set({ timer: { running, endAt, total: remaining } });
}

startBtn.onclick = async () => {
  const { timer } = await chrome.storage.local.get(['timer']);
  if (timer && timer.running && timer.endAt && timer.endAt > Date.now()) return;

  const sec = endAt && endAt > Date.now()
    ? Math.floor((endAt - Date.now())/1000)
    : (remaining || 0);

  if (sec <= 0) return;

  endAt = Date.now() + sec * 1000;
  await saveTimer(true);
  chrome.runtime.sendMessage({ kind: 'timer_schedule', endAt });
  startUI();
};

pauseBtn.onclick = async () => {
  if (endAt) {
    remaining = Math.max(0, Math.floor((endAt - Date.now())/1000));
    endAt = null;
  }
  await saveTimer(false);
  chrome.runtime.sendMessage({ kind: 'timer_clear' });
  drawUI();
};

resetBtn.onclick = async () => {
  const { settings } = await chrome.storage.local.get(['settings']);
  const s = settings || {};
  remaining = (s.pomodoro || 25) * 60;
  endAt = null;
  await saveTimer(false);
  chrome.runtime.sendMessage({ kind: 'timer_clear' });
  drawUI();
};

custom.onclick = async () => {
  const n = parseInt(customMinutes.value, 10);
  if (n > 0) {
    remaining = n * 60;
    endAt = null;
    await saveTimer(false);
    drawUI();
  }
};

const pills = qsa('.pill');
function applyPreset(p){
  chrome.storage.local.get(['settings']).then(({settings})=>{
    const s = settings || {};
    let mins = 25;
    if (p === 'pomodoro') mins = s.pomodoro || 25;
    else if (p === 'short') mins = s.short || 5;
    else mins = s.long || 15;
    remaining = mins * 60;
    endAt = null;
    saveTimer(false).then(drawUI);
    pills.forEach(x => x.classList.toggle('active', x.dataset.preset === p));
  });
}
pills.forEach(p => p.onclick = () => applyPreset(p.dataset.preset));

(async function initTimer(){
  const { settings, timer } = await chrome.storage.local.get(['settings','timer']);
  const s = settings || {};
  const t = timer || {};
  if (t.running && t.endAt && t.endAt > Date.now()) {
    endAt = t.endAt;
    startUI();
  } else {
    remaining = t.total || (s.pomodoro || 25) * 60;
    endAt = null;
    drawUI();
  }
})();

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.kind === 'timer_done') {
    endAt = null;
    remaining = 0;
    drawUI();
  } else if (msg.kind === 'settings_changed') {
    chrome.storage.local.get(['settings']).then(({settings})=>{
      const s = settings || {};
      document.documentElement.style.setProperty('--t-red', s.red || '#DF163C');
      document.documentElement.style.setProperty('--t-blue', s.blue || '#1A293A');
    });
  }
});

// Calendar
const calDate=qs('#calDate')
const calTime=qs('#calTime')
const calText=qs('#calText')
const addEvent=qs('#addEvent')
const events=qs('#events')
calDate.valueAsDate=new Date()

function key(d){return 'events_'+d}
function renderEvents(list){events.innerHTML='';list.forEach(e=>{const div=document.createElement('div');div.className='event';div.innerHTML=`<div>${e.text}</div><div class="when">${e.time||''}</div>`;events.appendChild(div)})}
function loadEvents(){const d=calDate.value;storage.get([key(d)]).then(r=>renderEvents(r[key(d)]||[]))}
addEvent.onclick=()=>{const d=calDate.value;if(!d)return;const t=calText.value.trim();if(!t)return;const tm=calTime.value;storage.get([key(d)]).then(r=>{const arr=r[key(d)]||[];arr.push({text:t,time:tm});storage.set({[key(d)]:arr}).then(()=>{calText.value='';loadEvents()})})}
calDate.onchange=loadEvents
loadEvents()

// Notes
const notes=qs('#notesArea')
const savedAt=qs('#savedAt')
const copyNotes=qs('#copyNotes')
const clearNotes=qs('#clearNotes')

function saveNotes(){const v=notes.value;storage.set({notes:v,notesSavedAt:Date.now()}).then(()=>{const t=new Date().toLocaleTimeString();savedAt.textContent='Salvat la '+t})}
notes.oninput=()=>{if(notes._t)clearTimeout(notes._t);notes._t=setTimeout(saveNotes,400)}
copyNotes.onclick=()=>{notes.select();document.execCommand('copy')}
clearNotes.onclick=()=>{notes.value='';saveNotes()}
storage.get(['notes','notesSavedAt']).then(r=>{notes.value=r.notes||'';if(r.notesSavedAt){const t=new Date(r.notesSavedAt).toLocaleString();savedAt.textContent='Ultima salvare: '+t}})
