import { MessageBuilder } from '../shared/message-side'

const messageBuilder = new MessageBuilder()

function getActiveWod() {
  try {
    const raw = settings.settingsStorage.getItem('active_wod')
    if (!raw) return null
    return typeof raw === 'string' ? JSON.parse(raw) : raw
  } catch (e) {
    return null
  }
}

AppSideService({
  onInit() {
    messageBuilder.listen(() => {})

    // Notifica istantanea all'orologio quando l'utente imposta o incolla un nuovo WOD nella companion app
    settings.settingsStorage.addListener('change', ({ key, newValue }) => {
      if (key === 'active_wod' && newValue) {
        try {
          const wod = typeof newValue === 'string' ? JSON.parse(newValue) : newValue
          messageBuilder.call({
            method: 'SYNC_WOD',
            params: wod
          })
        } catch (e) {}
      }
    })

    // Risposta alle richieste provenienti dall'orologio
    messageBuilder.on('request', async (ctx) => {
      try {
        const payload = messageBuilder.buf2Json(ctx.request.payload)
        
        if (payload.method === 'GET_WOD') {
          const wod = getActiveWod()
          ctx.response({
            data: { result: wod }
          })
        } else if (payload.method === 'FETCH_CLOUD_WOD' && payload.syncCode) {
          // Opzionale: fetch da cloud key-value store tramite il PIN/Codice
          try {
            const res = await fetch({
              url: `https://api.jsonbin.io/v3/b/${payload.syncCode}`,
              method: 'GET'
            })
            const data = typeof res.body === 'string' ? JSON.parse(res.body) : res.body
            const wod = data.record || data
            settings.settingsStorage.setItem('active_wod', JSON.stringify(wod))
            ctx.response({
              data: { result: wod }
            })
          } catch (err) {
            ctx.response({
              data: { result: null, error: err.message }
            })
          }
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
