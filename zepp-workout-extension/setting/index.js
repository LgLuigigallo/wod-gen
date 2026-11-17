AppSettingsPage({
  state: {
    activeWod: null,
    syncStatus: null,
    pastedText: '',
    props: {}
  },

  getStorage(props) {
    this.state.props = props
    try {
      const raw = props.settingsStorage.getItem('active_wod')
      if (raw) {
        this.state.activeWod = typeof raw === 'string' ? JSON.parse(raw) : raw
      } else {
        this.state.activeWod = null
      }
    } catch (e) {
      this.state.activeWod = null
    }

    try {
      this.state.syncStatus = props.settingsStorage.getItem('sync_status') || null
    } catch (e) {
      this.state.syncStatus = null
    }
  },

  build(props) {
    this.getStorage(props)

    const views = []

    // 1. Titolo e spiegazione
    views.push(
      View(
        {
          style: {
            fontSize: '18px',
            fontWeight: 'bold',
            color: '#0f172a',
            marginBottom: '4px'
          }
        },
        ['Sincronizzazione WOD']
      )
    )

    views.push(
      View(
        {
          style: {
            fontSize: '13px',
            color: '#64748b',
            marginBottom: '16px'
          }
        },
        ['Copia il piano dalla Web App (WOD → Balance) e incollalo qui sotto per inviarlo all\'Amazfit Balance.']
      )
    )

    // 2. Banner di Stato Invio (Conferma o Errore)
    if (this.state.syncStatus) {
      const status = this.state.syncStatus
      if (status === 'SUCCESS') {
        views.push(
          View(
            {
              style: {
                backgroundColor: '#ecfdf5',
                border: '1px solid #10b981',
                borderRadius: '10px',
                padding: '12px',
                marginBottom: '16px'
              }
            },
            [
              View(
                {
                  style: {
                    fontSize: '16px',
                    fontWeight: 'bold',
                    color: '#047857',
                    marginBottom: '4px'
                  }
                },
                ['✓ WOD INVIATO CON SUCCESSO!']
              ),
              View(
                {
                  style: {
                    fontSize: '13px',
                    color: '#065f46'
                  }
                },
                ['Il piano è arrivato al Balance. L\'orologio ha confermato con una vibrazione.']
              )
            ]
          )
        )
      } else if (status.startsWith('FAILED')) {
        const errorMsg = status.replace('FAILED:', '').trim()
        views.push(
          View(
            {
              style: {
                backgroundColor: '#fef2f2',
                border: '1px solid #ef4444',
                borderRadius: '10px',
                padding: '12px',
                marginBottom: '16px'
              }
            },
            [
              View(
                {
                  style: {
                    fontSize: '16px',
                    fontWeight: 'bold',
                    color: '#b91c1c',
                    marginBottom: '4px'
                  }
                },
                ['✕ INVIO FALLITO']
              ),
              View(
                {
                  style: {
                    fontSize: '13px',
                    color: '#991b1b',
                    marginBottom: '4px'
                  }
                },
                [errorMsg || 'Impossibile trasferire il WOD all\'orologio.']
              ),
              View(
                {
                  style: {
                    fontSize: '12px',
                    color: '#7f1d1d'
                  }
                },
                ['Verifica che l\'Amazfit Balance sia acceso, nelle vicinanze e connesso via Bluetooth.']
              )
            ]
          )
        )
      } else if (status === 'IN_CORSO') {
        views.push(
          View(
            {
              style: {
                backgroundColor: '#fffbeb',
                border: '1px solid #f59e0b',
                borderRadius: '10px',
                padding: '12px',
                marginBottom: '16px'
              }
            },
            [
              View(
                {
                  style: {
                    fontSize: '15px',
                    fontWeight: 'bold',
                    color: '#b45309'
                  }
                },
                ['⏳ Invio al Balance via Bluetooth in corso...']
              )
            ]
          )
        )
      }
    }

    // 3. Stato WOD Corrente
    if (this.state.activeWod) {
      const wod = this.state.activeWod
      const exItems = (wod.exercises || []).map((ex, idx) =>
        View(
          {
            style: {
              fontSize: '12px',
              color: '#334155',
              padding: '2px 0'
            }
          },
          [`${idx + 1}. ${ex}`]
        )
      )

      views.push(
        View(
          {
            style: {
              backgroundColor: '#f1f5f9',
              borderRadius: '8px',
              padding: '12px',
              marginBottom: '16px',
              border: '1px solid #cbd5e1'
            }
          },
          [
            View(
              {
                style: {
                  fontSize: '15px',
                  fontWeight: 'bold',
                  color: '#d97706',
                  marginBottom: '6px'
                }
              },
              [`WOD Attivo: ${wod.title || wod.id}`]
            ),
            View(
              {
                style: {
                  fontSize: '12px',
                  color: '#475569',
                  marginBottom: '8px'
                }
              },
              [`Formato: ${wod.id} | Totale Esercizi: ${(wod.exercises || []).length}`]
            ),
            View(
              {
                style: {
                  marginTop: '4px'
                }
              },
              exItems
            )
          ]
        )
      )
    }

    // 4. Casella di inserimento testo JSON
    views.push(
      View(
        {
          style: {
            marginBottom: '12px'
          }
        },
        [
          TextInput({
            label: 'Incolla qui il JSON del WOD:',
            value: this.state.pastedText,
            subStyle: {
              fontSize: '12px',
              color: '#334155'
            },
            maxLength: 8000,
            onChange: (val) => {
              this.state.pastedText = val
            }
          })
        ]
      )
    )

    // 5. Pulsante Salva & Invia con feedback
    views.push(
      Button({
        label: '🚀 INVIA AD AMAZFIT BALANCE',
        style: {
          fontSize: '14px',
          fontWeight: 'bold',
          borderRadius: '24px',
          background: '#d97706',
          color: 'white',
          padding: '10px 0',
          textAlign: 'center',
          marginBottom: '10px'
        },
        onClick: () => {
          const rawText = (this.state.pastedText || '').trim()
          if (!rawText) {
            props.settingsStorage.setItem('sync_status', 'FAILED: Incolla prima il JSON del WOD nella casella')
            return
          }

          try {
            const parsed = JSON.parse(rawText)
            if (!parsed.exercises || !Array.isArray(parsed.exercises) || parsed.exercises.length === 0) {
              props.settingsStorage.setItem('sync_status', 'FAILED: Il WOD deve contenere una lista "exercises" valida')
              return
            }

            // Segna invio in corso e salva active_wod (triggerando app-side)
            this.state.activeWod = parsed
            props.settingsStorage.setItem('sync_status', 'IN_CORSO')
            props.settingsStorage.setItem('active_wod', JSON.stringify(parsed))
          } catch (err) {
            props.settingsStorage.setItem('sync_status', 'FAILED: JSON non valido (' + (err.message || 'sintassi errata') + ')')
          }
        }
      })
    )

    // 6. Pulsante Ripristina Default
    views.push(
      Button({
        label: 'Ripristina WOD Predefiniti',
        style: {
          fontSize: '12px',
          borderRadius: '20px',
          background: '#94a3b8',
          color: 'white',
          padding: '6px 0',
          textAlign: 'center'
        },
        onClick: () => {
          try {
            this.state.activeWod = null
            props.settingsStorage.removeItem('active_wod')
            props.settingsStorage.setItem('sync_status', 'RESET')
          } catch (e) {}
        }
      })
    )

    return View(
      {
        style: {
          padding: '16px'
        }
      },
      views
    )
  }
})
