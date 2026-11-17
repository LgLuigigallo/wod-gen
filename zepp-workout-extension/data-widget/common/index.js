import {
  createWidget,
  widget,
  align,
  text_style,
  sport_data,
  edit_widget_group_type,
  prop,
  event
} from '@zos/ui'
import { Vibrator, VIBRATOR_SCENE_SHORT_STRONG, VIBRATOR_SCENE_DURATION } from '@zos/sensor'
import { localStorage } from '@zos/storage'
import { MessageBuilder } from '../../shared/message'

let messageBuilder = null

// Preset di allenamento WOD
const MODES = [
  {
    id: 'EMOM',
    title: 'EMOM 12\'',
    type: 'countdown_interval',
    intervalSec: 60,
    totalRounds: 12,
    totalDurationSec: 720,
    exercises: [
      'Min 1: 15 Burpees',
      'Min 2: 20 KB Swings',
      'Min 3: 15 Box Jumps',
      'Min 4: Riposo (Rest)',
      'Min 5: 15 Burpees',
      'Min 6: 20 KB Swings',
      'Min 7: 15 Box Jumps',
      'Min 8: Riposo (Rest)',
      'Min 9: 15 Burpees',
      'Min 10: 20 KB Swings',
      'Min 11: 15 Box Jumps',
      'Min 12: Max Calorie Rower'
    ]
  },
  {
    id: 'AMRAP',
    title: 'AMRAP 20\'',
    type: 'countdown_total',
    intervalSec: null,
    totalRounds: null,
    totalDurationSec: 1200,
    exercises: [
      'Circuito: 5 Trazioni + 10 Piegamenti + 15 Squat'
    ]
  },
  {
    id: 'FORTIME',
    title: 'FOR TIME',
    type: 'countup',
    intervalSec: null,
    totalRounds: null,
    totalDurationSec: null,
    exercises: [
      'Completa nel minor tempo. Premi +1 ROUND a ogni giro finito.'
    ]
  },
  {
    id: 'TABATA',
    title: 'TABATA 4\' (8 Rnd)',
    type: 'tabata',
    intervalSec: 30,
    totalRounds: 8,
    totalDurationSec: 240,
    exercises: [
      '20s Lavoro Massimale / 10s Riposo'
    ]
  }
]

let modeIndex = 0
let currentRound = 1
let elapsedSec = 0
let timerInterval = null
let vibrator = null

// Riferimenti ai Widget UI
let txtModeBadge = null
let txtRound = null
let txtTimer = null
let txtTimerSub = null
let txtExercise = null
let btnRound = null
let btnMode = null

function formatTime(totalSec) {
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  const mm = m < 10 ? `0${m}` : `${m}`
  const ss = s < 10 ? `0${s}` : `${s}`
  return `${mm}:${ss}`
}

function getRoundText() {
  const cur = MODES[modeIndex]
  if (cur.totalRounds) {
    return `RND ${currentRound}/${cur.totalRounds}`
  }
  return `ROUND ${currentRound}`
}

function getCurrentExerciseText() {
  const cur = MODES[modeIndex]
  if (cur.exercises && cur.exercises.length > 0) {
    const idx = (currentRound - 1) % cur.exercises.length
    return cur.exercises[idx]
  }
  return 'Lavoro continuo'
}

function triggerVibration(scene) {
  if (!vibrator) return
  try {
    vibrator.stop()
    vibrator.setMode(scene)
    vibrator.start()
  } catch (e) {}
}

function updateRoundView() {
  if (txtRound) {
    txtRound.setProperty(prop.MORE, { text: getRoundText() })
  }
  if (txtExercise) {
    txtExercise.setProperty(prop.MORE, { text: getCurrentExerciseText() })
  }
}

function handleNextRound() {
  triggerVibration(VIBRATOR_SCENE_SHORT_STRONG)
  currentRound++
  updateRoundView()
}

function cycleMode() {
  triggerVibration(VIBRATOR_SCENE_SHORT_STRONG)
  modeIndex = (modeIndex + 1) % MODES.length
  currentRound = 1
  elapsedSec = 0

  const cur = MODES[modeIndex]
  if (txtModeBadge) {
    txtModeBadge.setProperty(prop.MORE, { text: cur.title })
  }
  updateRoundView()
  updateTimerDisplay()
}

function updateTimerDisplay() {
  if (!txtTimer || !txtTimerSub) return
  const cur = MODES[modeIndex]

  if (cur.id === 'EMOM') {
    const secInMin = elapsedSec % 60
    const secLeft = (secInMin === 0 && elapsedSec > 0) ? 60 : (60 - secInMin)
    txtTimer.setProperty(prop.MORE, { text: formatTime(secLeft) })
    txtTimerSub.setProperty(prop.MORE, { text: `FINE MINUTO: ${secLeft}s` })
  } else if (cur.id === 'AMRAP') {
    const remaining = Math.max(0, cur.totalDurationSec - elapsedSec)
    txtTimer.setProperty(prop.MORE, { text: formatTime(remaining) })
    txtTimerSub.setProperty(prop.MORE, { text: 'TEMPO RESIDUO' })
  } else if (cur.id === 'TABATA') {
    const cycleSec = elapsedSec % 30
    if (cycleSec < 20) {
      const workLeft = 20 - cycleSec
      txtTimer.setProperty(prop.MORE, { text: formatTime(workLeft) })
      txtTimerSub.setProperty(prop.MORE, { text: '🔥 LAVORO MASSIMALE' })
    } else {
      const restLeft = 30 - cycleSec
      txtTimer.setProperty(prop.MORE, { text: formatTime(restLeft) })
      txtTimerSub.setProperty(prop.MORE, { text: '💤 RECUPERO / REST' })
    }
  } else {
    txtTimer.setProperty(prop.MORE, { text: formatTime(elapsedSec) })
    txtTimerSub.setProperty(prop.MORE, { text: 'TEMPO TRASCORSO' })
  }
}

function tickTimer() {
  elapsedSec++
  const cur = MODES[modeIndex]

  if (cur.id === 'EMOM') {
    const secInMin = elapsedSec % 60
    const secLeft = secInMin === 0 ? 60 : (60 - secInMin)

    if (txtTimer) txtTimer.setProperty(prop.MORE, { text: formatTime(secLeft) })
    if (txtTimerSub) txtTimerSub.setProperty(prop.MORE, { text: `FINE MINUTO: ${secLeft}s` })

    // Avviso acustico / vibrazione al 3-2-1
    if (secLeft === 3 || secLeft === 2 || secLeft === 1) {
      triggerVibration(VIBRATOR_SCENE_SHORT_STRONG)
    } else if (secInMin === 0) {
      // Cambio minuto effettivo
      triggerVibration(VIBRATOR_SCENE_DURATION)
      if (cur.totalRounds && currentRound < cur.totalRounds) {
        currentRound++
        updateRoundView()
      }
    }
  } else if (cur.id === 'AMRAP') {
    const remaining = Math.max(0, cur.totalDurationSec - elapsedSec)
    if (txtTimer) txtTimer.setProperty(prop.MORE, { text: formatTime(remaining) })
    if (txtTimerSub) txtTimerSub.setProperty(prop.MORE, { text: 'TEMPO RESIDUO' })
    if (remaining === 0) {
      triggerVibration(VIBRATOR_SCENE_DURATION)
    }
  } else if (cur.id === 'TABATA') {
    const cycleSec = elapsedSec % 30
    if (cycleSec < 20) {
      const workLeft = 20 - cycleSec
      if (txtTimer) txtTimer.setProperty(prop.MORE, { text: formatTime(workLeft) })
      if (txtTimerSub) txtTimerSub.setProperty(prop.MORE, { text: '🔥 LAVORO MASSIMALE' })
      if (workLeft <= 3 && workLeft > 0) {
        triggerVibration(VIBRATOR_SCENE_SHORT_STRONG)
      }
    } else {
      const restLeft = 30 - cycleSec
      if (txtTimer) txtTimer.setProperty(prop.MORE, { text: formatTime(restLeft) })
      if (txtTimerSub) txtTimerSub.setProperty(prop.MORE, { text: '💤 RECUPERO / REST' })
      if (restLeft === 1) {
        triggerVibration(VIBRATOR_SCENE_DURATION)
        if (cur.totalRounds && currentRound < cur.totalRounds) {
          currentRound++
          updateRoundView()
        }
      }
    }
  } else {
    if (txtTimer) txtTimer.setProperty(prop.MORE, { text: formatTime(elapsedSec) })
    if (txtTimerSub) txtTimerSub.setProperty(prop.MORE, { text: 'TEMPO TRASCORSO' })
  }
}

function startTimerLoop() {
  if (timerInterval) clearInterval(timerInterval)
  updateTimerDisplay()
  timerInterval = setInterval(() => {
    try {
      tickTimer()
    } catch (e) {}
  }, 1000)
}

function stopTimerLoop() {
  if (timerInterval) {
    clearInterval(timerInterval)
    timerInterval = null
  }
}

function loadSavedWod() {
  try {
    const saved = localStorage.getItem('active_wod')
    if (saved && saved.title && saved.exercises && saved.exercises.length > 0) {
      const existingIdx = MODES.findIndex((m) => m.isCustom)
      if (existingIdx >= 0) {
        MODES[existingIdx] = { ...saved, isCustom: true }
      } else {
        MODES.unshift({ ...saved, isCustom: true })
      }
    }
  } catch (e) {}
}

function applyNewWod(wod) {
  if (!wod || !wod.title || !wod.exercises || wod.exercises.length === 0) return
  try {
    localStorage.setItem('active_wod', wod)
  } catch (e) {}

  const existingIdx = MODES.findIndex((m) => m.isCustom)
  if (existingIdx >= 0) {
    MODES[existingIdx] = { ...wod, isCustom: true }
    modeIndex = existingIdx
  } else {
    MODES.unshift({ ...wod, isCustom: true })
    modeIndex = 0
  }

  currentRound = 1
  elapsedSec = 0

  triggerVibration(VIBRATOR_SCENE_DURATION)

  const cur = MODES[modeIndex]
  if (txtModeBadge) {
    txtModeBadge.setProperty(prop.MORE, { text: cur.title })
  }
  updateRoundView()
  updateTimerDisplay()
}

DataWidget({
  onInit() {
    try {
      vibrator = new Vibrator()
    } catch (e) {
      vibrator = null
    }

    loadSavedWod()

    try {
      messageBuilder = new MessageBuilder()
      messageBuilder.listen(() => {})

      messageBuilder.on('call', ({ payload: buf }) => {
        try {
          const data = messageBuilder.buf2Json(buf)
          if (data && data.method === 'SYNC_WOD' && data.params) {
            applyNewWod(data.params)
          } else if (data && data.title && data.exercises) {
            applyNewWod(data)
          }
        } catch (e) {}
      })

      messageBuilder
        .request({
          method: 'GET_WOD'
        })
        .then((res) => {
          if (res && res.data && res.data.result) {
            applyNewWod(res.data.result)
          }
        })
        .catch(() => {})
    } catch (e) {
      messageBuilder = null
    }
  },

  build() {
    const curMode = MODES[modeIndex]

    // 1. Sfondo Nero Puro OLED
    createWidget(widget.FILL_RECT, {
      x: 0,
      y: 0,
      w: 480,
      h: 480,
      color: 0x000000
    })

    // 2. HUD Biometrico Superiore (y: 52 - 94: Perfettamente centrato e visibile all'interno del display circolare)
    // Box Cardio Sinistra (BPM)
    createWidget(widget.FILL_RECT, {
      x: 96,
      y: 52,
      w: 136,
      h: 42,
      radius: 14,
      color: 0x221314 // Sfondo rosso scuro tenue
    })
    createWidget(widget.TEXT, {
      x: 102,
      y: 57,
      w: 26,
      h: 30,
      color: 0xef4444, // Rosso vivo
      text_size: 20,
      align_h: align.CENTER_H,
      align_v: align.CENTER_V,
      text: '♥'
    })
    createWidget(widget.SPORT_DATA, {
      edit_id: 1,
      x: 130,
      y: 54,
      w: 96,
      h: 36,
      category: edit_widget_group_type.SPORTS,
      default_type: sport_data.HR,
      optional_types: [sport_data.HR],
      count: 1,
      rect_visible: false,
      text_size: 24,
      text_color: 0xffffff,
      text_x: 0,
      text_y: 0,
      text_w: 96,
      text_h: 36,
      sub_text_visible: false
    })

    // Box Calorie Destra (KCAL)
    createWidget(widget.FILL_RECT, {
      x: 248,
      y: 52,
      w: 136,
      h: 42,
      radius: 14,
      color: 0x24180d // Sfondo ambra scuro tenue
    })
    createWidget(widget.TEXT, {
      x: 254,
      y: 57,
      w: 26,
      h: 30,
      color: 0xf59e0b, // Ambra vivo
      text_size: 20,
      align_h: align.CENTER_H,
      align_v: align.CENTER_V,
      text: '🔥'
    })
    createWidget(widget.SPORT_DATA, {
      edit_id: 2,
      x: 282,
      y: 54,
      w: 96,
      h: 36,
      category: edit_widget_group_type.SPORTS,
      default_type: sport_data.CONSUME,
      optional_types: [sport_data.CONSUME],
      count: 1,
      rect_visible: false,
      text_size: 24,
      text_color: 0xffffff,
      text_x: 0,
      text_y: 0,
      text_w: 96,
      text_h: 36,
      sub_text_visible: false
    })

    // 3. Riga Formato & Round (y: 102 - 136)
    txtModeBadge = createWidget(widget.TEXT, {
      x: 60,
      y: 102,
      w: 175,
      h: 32,
      color: 0xf59e0b,
      text_size: 20,
      align_h: align.CENTER_H,
      align_v: align.CENTER_V,
      text_style: text_style.NONE,
      text: curMode.title
    })

    txtRound = createWidget(widget.TEXT, {
      x: 245,
      y: 100,
      w: 175,
      h: 36,
      color: 0x38bdf8, // Ciano brillante
      text_size: 24,
      align_h: align.CENTER_H,
      align_v: align.CENTER_V,
      text_style: text_style.NONE,
      text: getRoundText()
    })

    // 4. Timer Gigante al centro dello schermo (y: 142 - 216)
    txtTimer = createWidget(widget.TEXT, {
      x: 0,
      y: 140,
      w: 480,
      h: 68,
      color: 0xffffff,
      text_size: 64,
      align_h: align.CENTER_H,
      align_v: align.CENTER_V,
      text_style: text_style.NONE,
      text: '01:00'
    })

    txtTimerSub = createWidget(widget.TEXT, {
      x: 0,
      y: 206,
      w: 480,
      h: 22,
      color: 0x94a3b8,
      text_size: 15,
      align_h: align.CENTER_H,
      align_v: align.CENTER_V,
      text: 'FINE MINUTO: 60s'
    })

    // 5. Box Esercizio / Target (y: 234 - 316)
    createWidget(widget.FILL_RECT, {
      x: 50,
      y: 234,
      w: 380,
      h: 82,
      radius: 16,
      color: 0x1e293b // Slate scuro
    })

    txtExercise = createWidget(widget.TEXT, {
      x: 60,
      y: 240,
      w: 360,
      h: 70,
      color: 0xf8fafc,
      text_size: 22,
      align_h: align.CENTER_H,
      align_v: align.CENTER_V,
      text_style: text_style.WRAP,
      text: getCurrentExerciseText()
    })

    // 6. Pulsante Principale: +1 ROUND (LAP) (y: 330 - 394)
    btnRound = createWidget(widget.BUTTON, {
      x: 80,
      y: 330,
      w: 320,
      h: 64,
      radius: 32,
      normal_color: 0xd97706, // Ambra brillante
      press_color: 0xb45309,
      text: '+1 ROUND (LAP)',
      text_size: 24,
      color: 0x000000,
      click_func: () => {
        handleNextRound()
      }
    })
    btnRound.addEventListener(event.CLICK_UP, () => {
      handleNextRound()
    })

    // 7. Pulsante Secondario: Cambia Modalità (y: 406 - 448)
    btnMode = createWidget(widget.BUTTON, {
      x: 125,
      y: 406,
      w: 230,
      h: 42,
      radius: 21,
      normal_color: 0x334155,
      press_color: 0x475569,
      text: 'CAMBIA FORMATO',
      text_size: 16,
      color: 0xffffff,
      click_func: () => {
        cycleMode()
      }
    })
    btnMode.addEventListener(event.CLICK_UP, () => {
      cycleMode()
    })

    startTimerLoop()
  },

  onResume() {
    startTimerLoop()
  },

  onPause() {},

  onDestroy() {
    stopTimerLoop()
    if (vibrator) {
      try {
        vibrator.stop()
      } catch (e) {}
      vibrator = null
    }
    if (messageBuilder) {
      try {
        messageBuilder.disConnect()
      } catch (e) {}
      messageBuilder = null
    }
  }
})
