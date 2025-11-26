
// Deschide pagina de mulțumire doar la instalare
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.tabs.create({ url: chrome.runtime.getURL('thankyou.html') });
  }
});

// Programează alarma până la endAt (ms epoch)
function scheduleTimerAlarm(endAt) {
  const when = Math.max(Date.now() + 1000, endAt); // minim +1s
  chrome.alarms.clear('teterly_timer_done', () => {
    chrome.alarms.create('teterly_timer_done', { when });
  });
}

// Rehidratează alarma la pornirea browserului
async function rehydrateAlarm() {
  const { timer } = await chrome.storage.local.get(['timer']);
  if (timer && timer.running && timer.endAt && timer.endAt > Date.now()) {
    scheduleTimerAlarm(timer.endAt);
  }
}

chrome.runtime.onStartup.addListener(rehydrateAlarm);

// Mesaje din popup
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.kind === 'timer_schedule' && msg.endAt) {
    scheduleTimerAlarm(msg.endAt);
    sendResponse?.({ ok: true });
    chrome.runtime.sendMessage({ kind: 'timer_schedule_ack' });
    return true;
  }
  if (msg.kind === 'timer_clear') {
    chrome.alarms.clear('teterly_timer_done', () => sendResponse?.({ ok: true }));
    return true;
  }
});

// Când sună alarma, marchează timerul ca oprit și notifică UI
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== 'teterly_timer_done') return;
  const { timer } = await chrome.storage.local.get(['timer']);
  const t = timer || {};
  t.running = false;
  t.endAt = null;
  await chrome.storage.local.set({ timer: t });

  chrome.runtime.sendMessage({ kind: 'timer_done' });
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'assets/icon128.png',
    title: 'Teterly',
    message: 'Timpul a expirat. Pauză sau sesiune nouă?'
  });
});
