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

// Preset WOD
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
      'Min 4: Recupero / Rest',
      'Min 5: 15 Burpees',
      'Min 6: 20 KB Swings',
      'Min 7: 15 Box Jumps',
      'Min 8: Recupero / Rest',
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
      'Giro: 5 Pull-ups + 10 Push-ups + 15 Air Squats'
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
      'Completa il WOD. Premi +1 ROUND a ogni giro.'
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

// Riferimenti Widget UI
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
    const secLeft = secInMin === 0 && elapsedSec > 0 ? 60 : (60 - secInMin)
    txtTimer.setProperty(prop.MORE, { text: formatTime(secLeft) })
    txtTimerSub.setProperty(prop.MORE, { text: `FINE MINUTO: ${secLeft}s` })
  } else if (cur.id === 'AMRAP') {
    const remaining = Math.max(0, cur.totalDurationSec - elapsedSec)
    txtTimer.setProperty(prop.MORE, { text: formatTime(remaining) })
    txtTimerSub.setProperty(prop.MORE, { text: 'TEMPO RESIDUO AMRAP' })
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

    if (secLeft === 3 || secLeft === 2 || secLeft === 1) {
      triggerVibration(VIBRATOR_SCENE_SHORT_STRONG)
    } else if (secInMin === 0) {
      triggerVibration(VIBRATOR_SCENE_DURATION)
      if (cur.totalRounds && currentRound < cur.totalRounds) {
        currentRound++
        updateRoundView()
      }
    }
  } else if (cur.id === 'AMRAP') {
    const remaining = Math.max(0, cur.totalDurationSec - elapsedSec)
    if (txtTimer) txtTimer.setProperty(prop.MORE, { text: formatTime(remaining) })
    if (txtTimerSub) txtTimerSub.setProperty(prop.MORE, { text: 'TEMPO RESIDUO AMRAP' })
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

DataWidget({
  onInit() {
    try {
      vibrator = new Vibrator()
    } catch (e) {
      vibrator = null
    }
  },

  build() {
    const curMode = MODES[modeIndex]

    // 1. Sfondo scuro elegante
    createWidget(widget.FILL_RECT, {
      x: 0,
      y: 0,
      w: 480,
      h: 480,
      color: 0x000000
    })

    // 2. HUD Biometrico Superiore (Frequenza Cardiaca e Calorie)
    // Frequenza Cardiaca (Sinistra)
    createWidget(widget.TEXT, {
      x: 75,
      y: 28,
      w: 80,
      h: 24,
      color: 0xef4444, // Rosso cardio
      text_size: 16,
      align_h: align.CENTER_H,
      align_v: align.CENTER_V,
      text: '♥ BPM'
    })
    createWidget(widget.SPORT_DATA, {
      edit_id: 1,
      x: 70,
      y: 48,
      w: 90,
      h: 38,
      category: edit_widget_group_type.SPORTS,
      default_type: sport_data.HR,
      optional_types: [sport_data.HR],
      count: 1,
      rect_visible: false,
      text_size: 28,
      text_color: 0xffffff,
      text_x: 0,
      text_y: 0,
      text_w: 90,
      text_h: 38,
      sub_text_visible: false
    })

    // Calorie Bruciate (Destra)
    createWidget(widget.TEXT, {
      x: 325,
      y: 28,
      w: 80,
      h: 24,
      color: 0xf59e0b, // Ambra Kcal
      text_size: 16,
      align_h: align.CENTER_H,
      align_v: align.CENTER_V,
      text: '🔥 KCAL'
    })
    createWidget(widget.SPORT_DATA, {
      edit_id: 2,
      x: 320,
      y: 48,
      w: 90,
      h: 38,
      category: edit_widget_group_type.SPORTS,
      default_type: sport_data.CONSUME,
      optional_types: [sport_data.CONSUME],
      count: 1,
      rect_visible: false,
      text_size: 28,
      text_color: 0xffffff,
      text_x: 0,
      text_y: 0,
      text_w: 90,
      text_h: 38,
      sub_text_visible: false
    })

    // 3. Badge Formato WOD & Indicatore Round
    txtModeBadge = createWidget(widget.TEXT, {
      x: 80,
      y: 90,
      w: 140,
      h: 32,
      color: 0xd97706, // Ambra scuro
      text_size: 20,
      align_h: align.CENTER_H,
      align_v: align.CENTER_V,
      text_style: text_style.NONE,
      text: curMode.title
    })

    txtRound = createWidget(widget.TEXT, {
      x: 230,
      y: 88,
      w: 170,
      h: 36,
      color: 0x38bdf8, // Ciano brillante
      text_size: 24,
      align_h: align.CENTER_H,
      align_v: align.CENTER_V,
      text_style: text_style.NONE,
      text: getRoundText()
    })

    // 4. Timer Gigante Centrale ad alta visibilità
    txtTimer = createWidget(widget.TEXT, {
      x: 0,
      y: 122,
      w: 480,
      h: 76,
      color: 0xffffff,
      text_size: 64,
      align_h: align.CENTER_H,
      align_v: align.CENTER_V,
      text_style: text_style.NONE,
      text: '01:00'
    })

    txtTimerSub = createWidget(widget.TEXT, {
      x: 0,
      y: 194,
      w: 480,
      h: 22,
      color: 0x94a3b8,
      text_size: 15,
      align_h: align.CENTER_H,
      align_v: align.CENTER_V,
      text: 'FINE MINUTO: 60s'
    })

    // 5. Box Esercizio Corrente (Scheda visiva)
    createWidget(widget.FILL_RECT, {
      x: 45,
      y: 224,
      w: 390,
      h: 84,
      radius: 16,
      color: 0x1e293b // Slate scuro
    })

    txtExercise = createWidget(widget.TEXT, {
      x: 55,
      y: 230,
      w: 370,
      h: 72,
      color: 0xf8fafc,
      text_size: 22,
      align_h: align.CENTER_H,
      align_v: align.CENTER_V,
      text_style: text_style.WRAP,
      text: getCurrentExerciseText()
    })

    // 6. Pulsante Principale: +1 ROUND (LAP)
    btnRound = createWidget(widget.BUTTON, {
      x: 80,
      y: 326,
      w: 320,
      h: 64,
      radius: 32,
      normal_color: 0xd97706, // Ambra intenso
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

    // 7. Pulsante Secondario: Cambia Modalità (EMOM / AMRAP / FOR TIME)
    btnMode = createWidget(widget.BUTTON, {
      x: 120,
      y: 404,
      w: 240,
      h: 40,
      radius: 20,
      normal_color: 0x334155, // Grigio scuro
      press_color: 0x475569,
      text: 'MODALITÀ WOD ⟳',
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
  }
})
