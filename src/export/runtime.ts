/**
 * The script embedded in an exported file.
 *
 * It is deliberately dumb: show a panel, hide the others, walk the
 * `[data-reveal]` elements the renderer already emitted. It contains no
 * knowledge of markdown, of what a panel is, or of how content was promoted —
 * all of that was decided at export time and is baked into the markup, so this
 * cannot disagree with the app.
 */
export const EXPORT_RUNTIME = String.raw`
(function () {
  var root = document.documentElement
  var deck = document.querySelector('.deck-export')
  var doc = document.querySelector('.doc')
  var panels = deck ? Array.prototype.slice.call(deck.querySelectorAll('[data-panel]')) : []
  var position = document.querySelector('[data-role="position"]')
  var mode = 'doc'
  var index = 0
  var step = 0

  function stepsOf(panel) {
    return Array.prototype.slice.call(panel.querySelectorAll('[data-reveal]'))
      .filter(function (element) { return element.closest('[data-panel]') === panel })
  }

  function paint() {
    panels.forEach(function (panel, panelIndex) {
      var active = panelIndex === index
      panel.hidden = !active
      if (!active) return
      stepsOf(panel).forEach(function (element, elementIndex) {
        var pending = elementIndex > step
        element.classList.toggle('is-pending', pending)
        if (pending) element.setAttribute('aria-hidden', 'true')
        else element.removeAttribute('aria-hidden')
      })
    })
    if (position) {
      position.textContent = (index + 1) + ' / ' + panels.length
    }
  }

  function setMode(next) {
    mode = next
    root.setAttribute('data-mode', next)
    if (doc) doc.hidden = next !== 'doc'
    if (deck) deck.hidden = next !== 'deck'
    if (next === 'deck') paint()
  }

  function go(nextIndex, atEnd) {
    index = Math.max(0, Math.min(panels.length - 1, nextIndex))
    step = atEnd ? Math.max(0, stepsOf(panels[index]).length - 1) : 0
    paint()
  }

  function advance() {
    var total = stepsOf(panels[index]).length
    if (step < total - 1) { step += 1; paint() }
    else if (index < panels.length - 1) go(index + 1, false)
  }

  function retreat() {
    if (step > 0) { step -= 1; paint() }
    else if (index > 0) go(index - 1, true)
  }

  document.addEventListener('keydown', function (event) {
    if (event.metaKey || event.ctrlKey || event.altKey) return
    if (event.key === 'p' || event.key === 'Escape') {
      event.preventDefault()
      setMode(mode === 'deck' ? 'doc' : 'deck')
      return
    }
    if (mode !== 'deck') return
    if (event.key === 'ArrowRight' || event.key === 'PageDown' || event.key === ' ') {
      event.preventDefault(); advance()
    } else if (event.key === 'ArrowLeft' || event.key === 'PageUp') {
      event.preventDefault(); retreat()
    } else if (event.key === 'ArrowDown') {
      event.preventDefault(); go(index + 1, false)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault(); go(index - 1, false)
    } else if (event.key === 'f') {
      event.preventDefault()
      if (document.fullscreenElement) document.exitFullscreen()
      else document.documentElement.requestFullscreen()
    }
  })

  Array.prototype.forEach.call(document.querySelectorAll('[data-action]'), function (button) {
    button.addEventListener('click', function () {
      var action = button.getAttribute('data-action')
      if (action === 'present') setMode('deck')
      else if (action === 'read') setMode('doc')
      else if (action === 'next') advance()
      else if (action === 'prev') retreat()
      else if (action === 'theme') {
        var current = root.getAttribute('data-theme')
        root.setAttribute('data-theme', current === 'dark' ? 'light' : 'dark')
      }
    })
  })

  Array.prototype.forEach.call(document.querySelectorAll('.chart-toggle'), function (button) {
    button.addEventListener('click', function () {
      var figure = button.closest('.chart-figure')
      if (!figure) return
      var plot = figure.querySelector('.chart-plot')
      var table = figure.querySelector('.chart-table-view')
      if (!plot || !table) return
      var showTable = plot.hidden
      plot.hidden = !showTable
      table.hidden = showTable
      button.textContent = showTable ? 'Show table' : 'Show chart'
      button.setAttribute('aria-expanded', String(!showTable))
    })
  })

  Array.prototype.forEach.call(document.querySelectorAll('.tree-toggle'), function (button) {
    button.addEventListener('click', function () {
      var branch = button.closest('.tree-branch')
      if (!branch) return
      var open = branch.classList.toggle('is-open')
      button.setAttribute('aria-expanded', String(open))
      var children = branch.querySelector('.tree-children')
      if (children) children.hidden = !open
    })
  })

  setMode('doc')
})()
`
