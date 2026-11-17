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

AppSideService({
  onInit() {
    messageBuilder.connect()
    messageBuilder.listen(() => {})

    // Notifica istantanea all'orologio quando l'utente imposta o incolla un nuovo WOD nella companion app
    settings.settingsStorage.addListener('change', ({ key, newValue }) => {
      if (key === 'active_wod' && newValue) {
        try {
          const wod = typeof newValue === 'string' ? JSON.parse(newValue) : newValue
          messageBuilder.call(wod)
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
