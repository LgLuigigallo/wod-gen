import { MessageBuilder } from '../shared/message-side'

const messageBuilder = new MessageBuilder({
  appId: 1058200
})

function getActiveWod() {
  try {
    const raw = settings.settingsStorage.getItem('active_wod')
    if (!raw) return null
    return typeof raw === 'string' ? JSON.parse(raw) : raw
  } catch (e) {
    return null
  }
}

async function sendWodToWatch(wod) {
  try {
    settings.settingsStorage.setItem('sync_status', 'IN_CORSO')

    const res = await messageBuilder.request(
      {
        method: 'SYNC_WOD',
        params: wod
      },
      { timeout: 8000 }
    )

    if (res && res.result === 'OK') {
      settings.settingsStorage.setItem('sync_status', 'SUCCESS')
    } else {
      settings.settingsStorage.setItem('sync_status', 'FAILED: Risposta inattesa dall\'orologio')
    }
  } catch (err) {
    settings.settingsStorage.setItem('sync_status', 'FAILED: Orologio non raggiungibile via Bluetooth')
  }
}

AppSideService({
  onInit() {
    try {
      messageBuilder.connect()
      messageBuilder.listen(() => {})
    } catch (e) {}

    // Ascolta quando le impostazioni cambiano o viene premuto Invia
    settings.settingsStorage.addListener('change', async ({ key, newValue }) => {
      if (key === 'active_wod' && newValue) {
        try {
          const wod = typeof newValue === 'string' ? JSON.parse(newValue) : newValue
          await sendWodToWatch(wod)
        } catch (e) {
          settings.settingsStorage.setItem('sync_status', 'FAILED: Formato WOD non valido')
        }
      }
    })

    // Risposta alle richieste provenienti dall'orologio (es. all'avvio)
    messageBuilder.on('request', async (ctx) => {
      try {
        const payload = messageBuilder.buf2Json(ctx.request.payload)
        if (payload.method === 'GET_WOD') {
          const wod = getActiveWod()
          ctx.response({
            data: { result: wod }
          })
        }
      } catch (err) {
        ctx.response({
          data: { result: null, error: err.message }
        })
      }
    })
  },

  onRun() {},

  onDestroy() {
    try {
      messageBuilder.disConnect()
    } catch (e) {}
  }
})
