import {
  createWidget,
  widget,
  align,
  text_style,
  sport_data,
  edit_widget_group_type,
  prop
} from '@zos/ui'
import { Vibrator, VIBRATOR_SCENE_SHORT_STRONG, VIBRATOR_SCENE_DURATION } from '@zos/sensor'

// Preset di allenamento supportati per CrossFit / Allenamento Funzionale
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
      'Min 2: 20 Kettlebell Swings',
      'Min 3: 15 Box Jumps',
      'Min 4: Recupero / Rest',
      'Min 5: 15 Burpees',
      'Min 6: 20 Kettlebell Swings',
      'Min 7: 15 Box Jumps',
      'Min 8: Recupero / Rest',
      'Min 9: 15 Burpees',
      'Min 10: 20 Kettlebell Swings',
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
      'Completa il WOD nel minor tempo possibile. Premi +1 ROUND per ogni giro completato.'
    ]
  },
  {
    id: 'TABATA',
    title: 'TABATA 4\' (8 Rnd)',
    type: 'tabata',
    intervalSec: 30, // 20s lavoro + 10s rest
    totalRounds: 8,
    totalDurationSec: 240,
    exercises: [
      '20s Lavoro Massimale / 10s Riposo'
    ]
  }
]

DataWidget({
  // Stato interno del widget
  modeIndex: 0,
  currentRound: 1,
  elapsedSec: 0,
  timerInterval: null,
  vibrator: null,

  // Riferimenti ai widget UI
  txtModeBadge: null,
  txtRound: null,
  txtTimer: null,
  txtTimerSub: null,
  txtExercise: null,
  btnRound: null,
  btnMode: null,

  onInit() {
    try {
      this.vibrator = new Vibrator()
    } catch (e) {
      this.vibrator = null
    }
  },

  build() {
    this.createUI()
    this.startTimer()
  },

  createUI() {
    const curMode = MODES[this.modeIndex]

    // 1. Sfondo scuro elegante
    createWidget(widget.FILL_RECT, {
      x: 0,
      y: 0,
      w: 480,
      h: 480,
      color: 0x000000
    })

    // 2. HUD Biometrico Superiore (Frequenza Cardiaca e Calorie ufficiali Zepp)
    // Frequenza Cardiaca (Sinistra)
    createWidget(widget.TEXT, {
      x: 75,
      y: 20,
      w: 80,
      h: 30,
      color: 0xef4444, // Rosso cardio
      text_size: 18,
      align_h: align.CENTER_H,
      align_v: align.CENTER_V,
      text: '♥ BPM'
    })
    createWidget(widget.SPORT_DATA, {
      edit_id: 1,
      x: 70,
      y: 42,
      w: 90,
      h: 40,
      category: edit_widget_group_type.SPORTS,
      default_type: sport_data.HR,
      optional_types: [sport_data.HR],
      count: 1,
      rect_visible: false,
      text_size: 32,
      text_color: 0xffffff,
      text_x: 0,
      text_y: 0,
      text_w: 90,
      text_h: 40,
      sub_text_visible: false
    })

    // Calorie Bruciate (Destra)
    createWidget(widget.TEXT, {
      x: 325,
      y: 20,
      w: 80,
      h: 30,
      color: 0xf59e0b, // Ambra Kcal
      text_size: 18,
      align_h: align.CENTER_H,
      align_v: align.CENTER_V,
      text: '🔥 KCAL'
    })
    createWidget(widget.SPORT_DATA, {
      edit_id: 2,
      x: 320,
      y: 42,
      w: 90,
      h: 40,
      category: edit_widget_group_type.SPORTS,
      default_type: sport_data.CONSUME,
      optional_types: [sport_data.CONSUME],
      count: 1,
      rect_visible: false,
      text_size: 32,
      text_color: 0xffffff,
      text_x: 0,
      text_y: 0,
      text_w: 90,
      text_h: 40,
      sub_text_visible: false
    })

    // 3. Badge Formato WOD & Indicatore Round
    this.txtModeBadge = createWidget(widget.TEXT, {
      x: 80,
      y: 88,
      w: 140,
      h: 32,
      color: 0xd97706, // Ambra scuro
      text_size: 20,
      align_h: align.CENTER_H,
      align_v: align.CENTER_V,
      text_style: text_style.NONE,
      text: curMode.title
    })

    this.txtRound = createWidget(widget.TEXT, {
      x: 230,
      y: 86,
      w: 170,
      h: 36,
      color: 0x38bdf8, // Ciano brillante
      text_size: 24,
      align_h: align.CENTER_H,
      align_v: align.CENTER_V,
      text_style: text_style.NONE,
      text: this.getRoundText()
    })

    // 4. Timer Gigante Centrale ad alta visibilità
    this.txtTimer = createWidget(widget.TEXT, {
      x: 0,
      y: 124,
      w: 480,
      h: 78,
      color: 0xffffff,
      text_size: 68,
      align_h: align.CENTER_H,
      align_v: align.CENTER_V,
      text_style: text_style.NONE,
      text: '00:00'
    })

    this.txtTimerSub = createWidget(widget.TEXT, {
      x: 0,
      y: 198,
      w: 480,
      h: 24,
      color: 0x94a3b8,
      text_size: 16,
      align_h: align.CENTER_H,
      align_v: align.CENTER_V,
      text: 'TEMPO INTERVALLO'
    })

    // 5. Box Esercizio Corrente (Scheda visiva)
    createWidget(widget.FILL_RECT, {
      x: 45,
      y: 228,
      w: 390,
      h: 82,
      radius: 16,
      color: 0x1e293b // Slate scuro
    })

    this.txtExercise = createWidget(widget.TEXT, {
      x: 55,
      y: 234,
      w: 370,
      h: 70,
      color: 0xf8fafc,
      text_size: 22,
      align_h: align.CENTER_H,
      align_v: align.CENTER_V,
      text_style: text_style.WRAP,
      text: this.getCurrentExerciseText()
    })

    // 6. Pulsante Principale: +1 ROUND (LAP)
    this.btnRound = createWidget(widget.BUTTON, {
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
        this.handleNextRound()
      }
    })

    // 7. Pulsante Secondario: Cambia Modalità (EMOM / AMRAP / FOR TIME)
    this.btnMode = createWidget(widget.BUTTON, {
      x: 120,
      y: 402,
      w: 240,
      h: 38,
      radius: 19,
      normal_color: 0x334155, // Grigio scuro
      press_color: 0x475569,
      text: 'MODALITÀ WOD ⟳',
      text_size: 16,
      color: 0xffffff,
      click_func: () => {
        this.cycleMode()
      }
    })
  },

  getRoundText() {
    const cur = MODES[this.modeIndex]
    if (cur.totalRounds) {
      return `RND ${this.currentRound}/${cur.totalRounds}`
    }
    return `ROUND ${this.currentRound}`
  },

  getCurrentExerciseText() {
    const cur = MODES[this.modeIndex]
    if (cur.exercises && cur.exercises.length > 0) {
      const idx = (this.currentRound - 1) % cur.exercises.length
      return cur.exercises[idx]
    }
    return 'Lavoro continuo'
  },

  formatTime(totalSec) {
    const m = Math.floor(totalSec / 60)
    const s = totalSec % 60
    const mm = m < 10 ? `0${m}` : `${m}`
    const ss = s < 10 ? `0${s}` : `${s}`
    return `${mm}:${ss}`
  },

  startTimer() {
    if (this.timerInterval) clearInterval(this.timerInterval)

    this.timerInterval = setInterval(() => {
      this.elapsedSec++
      const cur = MODES[this.modeIndex]

      if (cur.id === 'EMOM') {
        // EMOM: ogni 60 secondi
        const secInMin = this.elapsedSec % 60
        const secLeft = 60 - secInMin
        this.txtTimer.setProperty(prop.TEXT, this.formatTime(secLeft))
        this.txtTimerSub.setProperty(prop.TEXT, `FINE MINUTO: ${secLeft}s`)

        // Avviso acustico/vibrazione 3-2-1
        if (secLeft === 3 || secLeft === 2 || secLeft === 1) {
          this.triggerVibration(VIBRATOR_SCENE_SHORT_STRONG)
        } else if (secLeft === 60) {
          // Cambio minuto effettivo
          this.triggerVibration(VIBRATOR_SCENE_DURATION)
          if (cur.totalRounds && this.currentRound < cur.totalRounds) {
            this.currentRound++
            this.updateRoundView()
          }
        }
      } else if (cur.id === 'AMRAP') {
        // AMRAP: conto alla rovescia dal totale
        const remaining = Math.max(0, cur.totalDurationSec - this.elapsedSec)
        this.txtTimer.setProperty(prop.TEXT, this.formatTime(remaining))
        this.txtTimerSub.setProperty(prop.TEXT, 'TEMPO RESIDUO AMRAP')

        if (remaining === 0) {
          this.triggerVibration(VIBRATOR_SCENE_DURATION)
        }
      } else if (cur.id === 'TABATA') {
        // TABATA: 20s lavoro, 10s rest (30s ciclo)
        const cycleSec = this.elapsedSec % 30
        if (cycleSec < 20) {
          const workLeft = 20 - cycleSec
          this.txtTimer.setProperty(prop.TEXT, this.formatTime(workLeft))
          this.txtTimerSub.setProperty(prop.TEXT, '🔥 LAVORO MASSIMALE')
          if (workLeft <= 3 && workLeft > 0) {
            this.triggerVibration(VIBRATOR_SCENE_SHORT_STRONG)
          }
        } else {
          const restLeft = 30 - cycleSec
          this.txtTimer.setProperty(prop.TEXT, this.formatTime(restLeft))
          this.txtTimerSub.setProperty(prop.TEXT, '💤 RECUPERO / REST')
          if (restLeft === 1) {
            this.triggerVibration(VIBRATOR_SCENE_DURATION)
            if (cur.totalRounds && this.currentRound < cur.totalRounds) {
              this.currentRound++
              this.updateRoundView()
            }
          }
        }
      } else {
        // FOR TIME: cronometro crescente
        this.txtTimer.setProperty(prop.TEXT, this.formatTime(this.elapsedSec))
        this.txtTimerSub.setProperty(prop.TEXT, 'TEMPO TRASCORSO')
      }
    }, 1000)
  },

  handleNextRound() {
    this.triggerVibration(VIBRATOR_SCENE_SHORT_STRONG)
    this.currentRound++
    this.updateRoundView()
  },

  cycleMode() {
    this.triggerVibration(VIBRATOR_SCENE_SHORT_STRONG)
    this.modeIndex = (this.modeIndex + 1) % MODES.length
    this.currentRound = 1
    this.elapsedSec = 0

    const cur = MODES[this.modeIndex]
    this.txtModeBadge.setProperty(prop.TEXT, cur.title)
    this.updateRoundView()
  },

  updateRoundView() {
    this.txtRound.setProperty(prop.TEXT, this.getRoundText())
    this.txtExercise.setProperty(prop.TEXT, this.getCurrentExerciseText())
  },

  triggerVibration(scene) {
    if (!this.vibrator) return
    try {
      this.vibrator.stop()
      this.vibrator.setMode(scene)
      this.vibrator.start()
    } catch (e) {}
  },

  onDestroy() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval)
      this.timerInterval = null
    }
    if (this.vibrator) {
      try {
        this.vibrator.stop()
      } catch (e) {}
      this.vibrator = null
    }
  }
})
