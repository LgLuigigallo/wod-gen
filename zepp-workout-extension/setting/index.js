AppSettingsPage({
  state: {
    activeWod: null,
    pastedText: '',
    props: {}
  },

  setState(props) {
    this.state.props = props
    try {
      const raw = props.settingsStorage.getItem('active_wod')
      if (raw) {
        this.state.activeWod = typeof raw === 'string' ? JSON.parse(raw) : raw
      }
    } catch (e) {
      this.state.activeWod = null
    }
  },

  saveWod(wod) {
    try {
      this.state.activeWod = wod
      this.state.props.settingsStorage.setItem('active_wod', JSON.stringify(wod))
    } catch (e) {
      console.log('Error saving WOD:', e)
    }
  },

  build(props) {
    this.setState(props)

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
        ['Copia il piano dalla Web App (WOD → Balance) e incollalo qui sotto per inviarlo via Bluetooth all\'orologio.']
      )
    )

    // 2. Stato WOD Corrente
    if (this.state.activeWod) {
      const wod = this.state.activeWod
      const exItems = (wod.exercises || []).map((ex) =>
        View(
          {
            style: {
              fontSize: '12px',
              color: '#334155',
              padding: '2px 0'
            }
          },
          [`• ${ex}`]
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
              [`Formato: ${wod.id} | Round: ${wod.totalRounds || 'Libero'}`]
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

    // 3. Casella di inserimento testo JSON
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
            maxLength: 4000,
            onChange: (val) => {
              this.state.pastedText = val
            }
          })
        ]
      )
    )

    // 4. Pulsante Salva & Invia
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
          if (!this.state.pastedText) return
          try {
            const parsed = JSON.parse(this.state.pastedText)
            this.saveWod(parsed)
          } catch (e) {
            console.log('Invalid JSON', e)
          }
        }
      })
    )

    // 5. Pulsante Ripristina Default
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
            this.state.props.settingsStorage.removeItem('active_wod')
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
