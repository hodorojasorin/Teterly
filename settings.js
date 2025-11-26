
const qs=(s,el=document)=>el.querySelector(s)
const storage=chrome.storage.local
qs('#back').onclick=()=>window.close()

const inputs={red:qs('#red'),blue:qs('#blue'),pomodoro:qs('#pomodoro'),short:qs('#short'),long:qs('#long')}

storage.get(['settings']).then(r=>{
  const s=r.settings||{red:'#DF163C',blue:'#1A293A',pomodoro:25,short:5,long:15}
  inputs.red.value=s.red||'#DF163C'
  inputs.blue.value=s.blue||'#1A293A'
  inputs.pomodoro.value=s.pomodoro||25
  inputs.short.value=s.short||5
  inputs.long.value=s.long||15
})

function doSaveSettings(closeAfter){
  const settings={
    red:inputs.red.value.trim()||'#DF163C',
    blue:inputs.blue.value.trim()||'#1A293A',
    pomodoro:parseInt(inputs.pomodoro.value,10)||25,
    short:parseInt(inputs.short.value,10)||5,
    long:parseInt(inputs.long.value,10)||15
  }
  storage.set({settings}).then(()=>{
    chrome.runtime.sendMessage({kind:'settings_changed'})
    const el=qs('#saveStatus'); if(el){ el.textContent='Salvat ✔'; setTimeout(()=>el.textContent='', 2000) }
    if(closeAfter){ window.close() }
  })
}

qs('#apply').onclick=()=>doSaveSettings(true)
const saveBtn=qs('#saveSettings'); if(saveBtn){ saveBtn.onclick=()=>doSaveSettings(false) }

qs('#exportData').onclick=()=>{
  storage.get(null).then(data=>{
    const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'})
    const url=URL.createObjectURL(blob)
    const a=document.createElement('a')
    a.href=url
    a.download='teterly-backup.json'
    a.click()
    URL.revokeObjectURL(url)
  })
}
qs('#importData').onclick=()=>qs('#importFile').click()
qs('#importFile').onchange=e=>{
  const file=e.target.files[0];if(!file)return;
  const reader=new FileReader()
  reader.onload=()=>{
    try{
      const obj=JSON.parse(reader.result)
      storage.set(obj).then(()=>chrome.runtime.sendMessage({kind:'settings_changed'}))
    }catch(e){}
  }
  reader.readAsText(file)
}
qs('#resetAll').onclick=()=>{chrome.storage.local.clear()}
