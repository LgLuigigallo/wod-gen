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
      '15 Burpees',
      '20 KB Swings',
      '15 Box Jumps',
      'Riposo (Rest)',
      '15 Burpees',
      '20 KB Swings',
      '15 Box Jumps',
      'Riposo (Rest)',
      '15 Burpees',
      '20 KB Swings',
      '15 Box Jumps',
      'Max Calorie Rower'
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
      '5 Trazioni + 10 Piegamenti + 15 Squat'
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
      'Completa nel minor tempo possibile'
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
let txtStatus = null
let txtExercise = null
let txtTimer = null
let txtNext = null
let btnAction = null

function formatTime(totalSec) {
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  const mm = m < 10 ? `0${m}` : `${m}`
  const ss = s < 10 ? `0${s}` : `${s}`
  return `${mm}:${ss}`
}

function cleanExerciseName(raw) {
  if (!raw) return 'LAVORO CONTINUO'
  return raw.replace(/^(Min(?:uto)?\s*\d+\s*:\s*|Round\s*\d+\s*:\s*|Lap\s*\d+\s*:\s*)/i, '').trim()
}

function getStatusHeaderText() {
  const cur = MODES[modeIndex]
  if (cur.id === 'EMOM') {
    const tot = cur.totalRounds || 12
    return `MINUTO ${currentRound} / ${tot}`
  } else if (cur.id === 'AMRAP') {
    const mins = cur.totalDurationSec ? Math.round(cur.totalDurationSec / 60) : 20
    return `AMRAP ${mins}' · GIRO ${currentRound}`
  } else if (cur.id === 'TABATA') {
    const cycleSec = elapsedSec % 30
    const phase = cycleSec < 20 ? 'LAVORO' : 'RIPOSO'
    return `TABATA · ${phase} ${currentRound}/8`
  } else {
    return `FOR TIME · GIRO ${currentRound}`
  }
}

function getCurrentExerciseText() {
  const cur = MODES[modeIndex]
  if (cur.exercises && cur.exercises.length > 0) {
    const idx = (currentRound - 1) % cur.exercises.length
    return cleanExerciseName(cur.exercises[idx])
  }
  return 'LAVORO CONTINUO'
}

function getNextExerciseText() {
  const cur = MODES[modeIndex]
  if (cur.id === 'EMOM' && cur.exercises && cur.exercises.length > 0) {
    if (cur.totalRounds && currentRound >= cur.totalRounds) {
      return '↳ ULTIMO MINUTO!'
    }
    const nextIdx = currentRound % cur.exercises.length
    const nextName = cleanExerciseName(cur.exercises[nextIdx])
    return `↳ Prossimo: ${nextName}`
  } else if (cur.id === 'AMRAP') {
    return '↳ Tocca "+1 Giro" a ogni giro completato'
  } else if (cur.id === 'TABATA') {
    const cycleSec = elapsedSec % 30
    if (cycleSec < 20) {
      return '↳ Prossimo: Riposo 10s'
    } else {
      return '↳ Prossimo: Lavoro Massimale 20s'
    }
  } else {
    return '↳ Tocca "+1 Giro" a ogni giro completato'
  }
}

function getActionButtonText() {
  const cur = MODES[modeIndex]
  if (elapsedSec === 0) {
    return `CAMBIA FORMATO ⟳`
  }
  if (cur.id === 'EMOM') {
    return 'AVANZA MINUTO ▶'
  } else if (cur.id === 'AMRAP' || cur.id === 'FORTIME') {
    return '+1 GIRO (LAP) ✓'
  } else {
    return 'TABATA IN CORSO'
  }
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
  if (txtStatus) {
    txtStatus.setProperty(prop.MORE, { text: getStatusHeaderText() })
  }
  if (txtExercise) {
    txtExercise.setProperty(prop.MORE, { text: getCurrentExerciseText() })
  }
  if (txtNext) {
    txtNext.setProperty(prop.MORE, { text: getNextExerciseText() })
  }
  if (btnAction) {
    btnAction.setProperty(prop.MORE, { text: getActionButtonText() })
  }
}

function updateTimerDisplay() {
  if (!txtTimer) return
  const cur = MODES[modeIndex]

  if (cur.id === 'EMOM') {
    const secInMin = elapsedSec % 60
    const secLeft = (secInMin === 0 && elapsedSec > 0) ? 60 : (60 - secInMin)
    txtTimer.setProperty(prop.MORE, { text: formatTime(secLeft) })
  } else if (cur.id === 'AMRAP') {
    const remaining = Math.max(0, cur.totalDurationSec - elapsedSec)
    txtTimer.setProperty(prop.MORE, { text: formatTime(remaining) })
  } else if (cur.id === 'TABATA') {
    const cycleSec = elapsedSec % 30
    if (cycleSec < 20) {
      const workLeft = 20 - cycleSec
      txtTimer.setProperty(prop.MORE, { text: formatTime(workLeft) })
    } else {
      const restLeft = 30 - cycleSec
      txtTimer.setProperty(prop.MORE, { text: formatTime(restLeft) })
    }
  } else {
    txtTimer.setProperty(prop.MORE, { text: formatTime(elapsedSec) })
  }
}

function tickTimer() {
  elapsedSec++
  const cur = MODES[modeIndex]

  // Aggiorna testo del pulsante al primo secondo (da Cambia Formato ad Azione)
  if (elapsedSec === 1 && btnAction) {
    btnAction.setProperty(prop.MORE, { text: getActionButtonText() })
  }

  if (cur.id === 'EMOM') {
    const secInMin = elapsedSec % 60
    const secLeft = secInMin === 0 ? 60 : (60 - secInMin)

    if (txtTimer) txtTimer.setProperty(prop.MORE, { text: formatTime(secLeft) })

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
    if (remaining === 0) {
      triggerVibration(VIBRATOR_SCENE_DURATION)
    }
  } else if (cur.id === 'TABATA') {
    const cycleSec = elapsedSec % 30
    if (cycleSec < 20) {
      const workLeft = 20 - cycleSec
      if (txtTimer) txtTimer.setProperty(prop.MORE, { text: formatTime(workLeft) })
      if (workLeft <= 3 && workLeft > 0) {
        triggerVibration(VIBRATOR_SCENE_SHORT_STRONG)
      }
    } else {
      const restLeft = 30 - cycleSec
      if (txtTimer) txtTimer.setProperty(prop.MORE, { text: formatTime(restLeft) })
      if (restLeft === 1) {
        triggerVibration(VIBRATOR_SCENE_DURATION)
        if (cur.totalRounds && currentRound < cur.totalRounds) {
          currentRound++
          updateRoundView()
        }
      }
    }
    if (cycleSec === 0 || cycleSec === 20) {
      updateRoundView()
    }
  } else {
    if (txtTimer) txtTimer.setProperty(prop.MORE, { text: formatTime(elapsedSec) })
  }
}

function handleActionButton() {
  triggerVibration(VIBRATOR_SCENE_SHORT_STRONG)

  if (elapsedSec === 0) {
    // Prima di iniziare l'attività, il pulsante cicla la modalità
    cycleMode()
    return
  }

  const cur = MODES[modeIndex]
  if (cur.id === 'EMOM') {
    // Salta subito al minuto successivo
    if (cur.totalRounds && currentRound < cur.totalRounds) {
      currentRound++
      elapsedSec = Math.floor(elapsedSec / 60) * 60 + 60
      updateRoundView()
      updateTimerDisplay()
    }
  } else {
    // AMRAP o FOR TIME: conta +1 giro
    currentRound++
    updateRoundView()
  }
}

function cycleMode() {
  triggerVibration(VIBRATOR_SCENE_SHORT_STRONG)
  modeIndex = (modeIndex + 1) % MODES.length
  currentRound = 1
  elapsedSec = 0
  updateRoundView()
  updateTimerDisplay()
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
    // 1. Sfondo Nero Puro AMOLED
    createWidget(widget.FILL_RECT, {
      x: 0,
      y: 0,
      w: 480,
      h: 480,
      color: 0x000000
    })

    // 2. HUD Biometrico Superiore (y: 46 - 82: cardio a sinistra, kcal a destra)
    // Box Cardio Sinistra
    createWidget(widget.FILL_RECT, {
      x: 100,
      y: 46,
      w: 132,
      h: 36,
      radius: 12,
      color: 0x221314
    })
    createWidget(widget.TEXT, {
      x: 104,
      y: 50,
      w: 24,
      h: 28,
      color: 0xef4444,
      text_size: 18,
      align_h: align.CENTER_H,
      align_v: align.CENTER_V,
      text: '♥'
    })
    createWidget(widget.SPORT_DATA, {
      edit_id: 1,
      x: 128,
      y: 48,
      w: 96,
      h: 32,
      category: edit_widget_group_type.SPORTS,
      default_type: sport_data.HR,
      optional_types: [sport_data.HR],
      count: 1,
      rect_visible: false,
      text_size: 22,
      text_color: 0xffffff,
      text_x: 0,
      text_y: 0,
      text_w: 96,
      text_h: 32,
      sub_text_visible: false
    })

    // Box Calorie Destra
    createWidget(widget.FILL_RECT, {
      x: 248,
      y: 46,
      w: 132,
      h: 36,
      radius: 12,
      color: 0x24180d
    })
    createWidget(widget.TEXT, {
      x: 252,
      y: 50,
      w: 24,
      h: 28,
      color: 0xf59e0b,
      text_size: 18,
      align_h: align.CENTER_H,
      align_v: align.CENTER_V,
      text: '🔥'
    })
    createWidget(widget.SPORT_DATA, {
      edit_id: 2,
      x: 276,
      y: 48,
      w: 96,
      h: 32,
      category: edit_widget_group_type.SPORTS,
      default_type: sport_data.CONSUME,
      optional_types: [sport_data.CONSUME],
      count: 1,
      rect_visible: false,
      text_size: 22,
      text_color: 0xffffff,
      text_x: 0,
      text_y: 0,
      text_w: 96,
      text_h: 32,
      sub_text_visible: false
    })

    // 3. Intestazione Stato / Round (y: 88 - 116)
    txtStatus = createWidget(widget.TEXT, {
      x: 0,
      y: 88,
      w: 480,
      h: 28,
      color: 0x38bdf8, // Ciano brillante
      text_size: 20,
      align_h: align.CENTER_H,
      align_v: align.CENTER_V,
      text_style: text_style.NONE,
      text: getStatusHeaderText()
    })
    txtStatus.addEventListener(event.CLICK_UP, () => {
      if (elapsedSec === 0) {
        cycleMode()
      }
    })

    // 4. Scheda Esercizio Corrente (Il protagonista al centro, y: 122 - 222)
    createWidget(widget.FILL_RECT, {
      x: 36,
      y: 122,
      w: 408,
      h: 100,
      radius: 18,
      color: 0x161e2e // Slate Navy elegante
    })

    txtExercise = createWidget(widget.TEXT, {
      x: 44,
      y: 128,
      w: 392,
      h: 88,
      color: 0xffffff,
      text_size: 28,
      align_h: align.CENTER_H,
      align_v: align.CENTER_V,
      text_style: text_style.WRAP,
      text: getCurrentExerciseText()
    })

    // 5. Timer Gigante Conto alla Rovescia (y: 230 - 318)
    txtTimer = createWidget(widget.TEXT, {
      x: 0,
      y: 230,
      w: 480,
      h: 88,
      color: 0xfbbf24, // Oro/Ambra ad alta visibilità
      text_size: 72,
      align_h: align.CENTER_H,
      align_v: align.CENTER_V,
      text_style: text_style.NONE,
      text: '01:00'
    })

    // 6. Prossimo Esercizio in arrivo (y: 324 - 356)
    txtNext = createWidget(widget.TEXT, {
      x: 20,
      y: 324,
      w: 440,
      h: 32,
      color: 0x94a3b8, // Slate tenue
      text_size: 18,
      align_h: align.CENTER_H,
      align_v: align.CENTER_V,
      text_style: text_style.NONE,
      text: getNextExerciseText()
    })

    // 7. Pulsante Unico e Pulito in Basso (y: 374 - 430)
    btnAction = createWidget(widget.BUTTON, {
      x: 100,
      y: 374,
      w: 280,
      h: 56,
      radius: 28,
      normal_color: 0xd97706, // Ambra sportivo
      press_color: 0xb45309,
      text: getActionButtonText(),
      text_size: 20,
      color: 0x000000,
      click_func: () => {
        handleActionButton()
      }
    })
    btnAction.addEventListener(event.CLICK_UP, () => {
      handleActionButton()
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
