// public/js/rooms.js
// Lab O' Mine reservation UI

// Page State
// Initialize activeDate from BASE_ISO (YYYY-MM-DD from server).
// Falls back to today if missing or invalid.
function parseInitDate (iso) {
  if (!iso || iso === 'undefined' || iso === '') return new Date()
  const d = new Date(iso + 'T00:00:00')
  return isNaN(d.getTime()) ? new Date() : d
}
const _initDate = parseInitDate(window.BASE_ISO)

const pageState = {
  labId:          window.LAB_ID   || '',
  labCode:        window.LAB_CODE || '',
  labName:        window.LAB_NAME || '',
  pickedSeats:    [],
  chosenSlots:    [],
  takenSlots:     [],
  takenSlotMeta:  {},
  activeDate:     _initDate,
  calViewDate:    new Date(_initDate),
  editTargetId:   null
}

// Works by finding the last slot, adding 30 min to get end time
function slotArrayToRange (slotArr) {
  if (!slotArr || !slotArr.length) return ''

  // Put slots in chronological order
  const ordered = [...slotArr].sort((a, b) => {
    const toMins = str => {
      const [timePart, meridiem] = str.split(' ')
      let [h, m] = timePart.split(':').map(Number)
      if (meridiem === 'PM' && h !== 12) h += 12
      if (meridiem === 'AM' && h === 12) h = 0
      return h * 60 + m
    }
    return toMins(a) - toMins(b)
  })

  const firstSlot = ordered[0]
  const lastSlot  = ordered[ordered.length - 1]

  // Compute end = lastSlot start + 30 min
  const [timePart, meridiem] = lastSlot.split(' ')
  let [h, m] = timePart.split(':').map(Number)
  if (meridiem === 'PM' && h !== 12) h += 12
  if (meridiem === 'AM' && h === 12) h = 0
  m += 30
  if (m >= 60) { h += 1; m -= 60 }

  const endMeridiem = h >= 12 ? 'PM' : 'AM'
  const endHour     = h > 12 ? h - 12 : h === 0 ? 12 : h
  const endStr      = `${String(endHour).padStart(2, '0')}:${String(m).padStart(2, '0')} ${endMeridiem}`

  return `${firstSlot} - ${endStr}`
}

// Date object → "Mar 16, 2026"
function dateToPrettyStr (d) {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

/* Seat Grid
  - Draws one clickable tile per seat in the lab
  - Tiles marked .reserved come from loadTakenSeats()
*/
function buildSeatGrid () {
  const container = document.getElementById('seatContainer')
  if (!container) return

  container.innerHTML = ''
  document.getElementById('btnProceed').disabled = true

  const count = window.TOTAL_SEATS || 40

  for (let num = 1; num <= count; num++) {
    const tile = document.createElement('div')
    tile.className      = 'seat-unit'
    tile.dataset.seat   = num
    tile.innerHTML      = `<i class="bi bi-pc-display"></i><span>Seat ${num}</span>`

    if (pageState.pickedSeats.includes(num)) tile.classList.add('selected')

    tile.addEventListener('click', () => onSeatTileClick(tile, num))
    container.appendChild(tile)
  }

  loadTakenSeats()
}

// Handles clicking a seat tile — toggles selection if free, ignores if reserved/faculty
function onSeatTileClick (tile, num) {
  if (tile.classList.contains('reserved') || tile.classList.contains('faculty')) return

  const idx = pageState.pickedSeats.indexOf(num)
  if (idx !== -1) {
    pageState.pickedSeats.splice(idx, 1)
    tile.classList.remove('selected')
  } else {
    pageState.pickedSeats.push(num)
    tile.classList.add('selected')
  }

  document.getElementById('btnProceed').disabled = pageState.pickedSeats.length === 0
}

// Fetch which seat numbers are occupied on the currently active date
async function loadTakenSeats () {
  const dateLabel = dateToPrettyStr(pageState.activeDate)
  const params    = new URLSearchParams({
    labId:   pageState.labId,
    labCode: pageState.labCode,
    date:    dateLabel
  })

  // Clear all existing reserved/faculty markings before re-applying for the new date
  document.querySelectorAll('.seat-unit').forEach(tile => {
    tile.classList.remove('reserved', 'faculty')
    tile.onclick = null
    tile.replaceWith(tile.cloneNode(true))  // remove old event listeners cleanly
  })
  // Re-attach click handlers for selecting seats
  document.querySelectorAll('.seat-unit').forEach(tile => {
    const num = parseInt(tile.dataset.seat)
    if (pageState.pickedSeats.includes(num)) tile.classList.add('selected')
    tile.addEventListener('click', () => onSeatTileClick(tile, num))
  })

  try {
    const response = await fetch('/api/reservations/booked?' + params)
    const slotMap  = await response.json()

    // Collect every seat number referenced across all booked slots
    const occupiedNums = new Set()
    Object.values(slotMap).forEach(entry => {
      if (entry && entry.seatNumbers) {
        entry.seatNumbers.toString().split(',')
          .map(s => parseInt(s.trim()))
          .forEach(n => occupiedNums.add(n))
      }
    })

    // Build a map from seat number -> reservation info for popover
    const seatInfoMap = {}
    Object.values(slotMap).forEach(entry => {
      if (entry && entry.seatNumbers) {
        entry.seatNumbers.toString().split(',')
          .map(s => parseInt(s.trim()))
          .forEach(n => { seatInfoMap[n] = entry })
      }
    })

    document.querySelectorAll('.seat-unit').forEach(tile => {
      const seatNum = parseInt(tile.dataset.seat)
      if (occupiedNums.has(seatNum)) {
        const info = seatInfoMap[seatNum]

        // Use blue for faculty, red for everyone else
        if (info?.userRole === 'faculty') {
          tile.classList.add('faculty')
        } else {
          tile.classList.add('reserved')
        }
        tile.classList.remove('selected')

        // Wire hover popover
        if (info) {
          tile.addEventListener('mouseenter', () => showPopover(tile, info))
          tile.addEventListener('mouseleave', hidePopover)

          // Clicking a reserved seat goes to the reservee's profile
          tile.onclick = () => {
            if (!info.isAnonymous && info.userEmail) {
              window.location.href = `/profile/${info.userEmail}`
            }
          }
        }
      }
    })
  } catch (e) {
    console.error('loadTakenSeats failed:', e)
  }
}

// Fetch which time slots are booked and store results in pageState for time picker
async function loadTakenSlots () {
  const dateLabel = dateToPrettyStr(pageState.activeDate)
  const params    = new URLSearchParams({
    labId:   pageState.labId,
    labCode: pageState.labCode,
    date:    dateLabel
  })

  pageState.takenSlots    = []
  pageState.takenSlotMeta = {}

  try {
    const response = await fetch('/api/reservations/booked?' + params)
    const slotMap  = await response.json()

    pageState.takenSlotMeta = slotMap
    // Only fully booked slots count as unavailable in the time picker
    pageState.takenSlots = Object.keys(slotMap).filter(k => slotMap[k].fullyBooked)

    drawTimePicker()
  } catch (e) {
    console.error('loadTakenSlots failed:', e)
  }
}

/* Mini Calendar
  - Shows the current month with days outside
  - the allowed 7-day booking window greyed out
*/
function drawCalendar () {
  const wrap = document.getElementById('calendarEl')
  if (!wrap) return

  const yr    = pageState.calViewDate.getFullYear()
  const mo    = pageState.calViewDate.getMonth()
  const label = pageState.calViewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  wrap.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;">
      <div style="grid-column:span 7;display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
        <button class="btn btn-sm btn-outline-success" onclick="moveCalMonth(-1)">‹</button>
        <span class="fw-bold small">${label}</span>
        <button class="btn btn-sm btn-outline-success" onclick="moveCalMonth(1)">›</button>
      </div>
      ${['Su','Mo','Tu','We','Th','Fr','Sa'].map(d =>
        `<div class="text-center small text-muted fw-bold">${d}</div>`
      ).join('')}
    </div>
    <div id="calDayGrid" style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-top:4px;"></div>
  `

  const dayGrid   = document.getElementById('calDayGrid')
  const todayMidnight = new Date()
  todayMidnight.setHours(0, 0, 0, 0)
  const bookingCutoff = new Date(todayMidnight)
  bookingCutoff.setDate(todayMidnight.getDate() + 7)

  const firstWeekday = new Date(yr, mo, 1).getDay()
  const totalDays    = new Date(yr, mo + 1, 0).getDate()

  // Empty cells before day 1
  for (let pad = 0; pad < firstWeekday; pad++) {
    dayGrid.insertAdjacentHTML('beforeend', '<div></div>')
  }

  for (let day = 1; day <= totalDays; day++) {
    const thisDay    = new Date(yr, mo, day)
    const disabled   = thisDay < todayMidnight || thisDay > bookingCutoff
    const isActive   = day === pageState.activeDate.getDate() &&
                       mo  === pageState.activeDate.getMonth()

    const cell = document.createElement('div')
    cell.textContent  = day
    cell.className    = 'text-center rounded py-1 small'
    cell.style.cssText = [
      `cursor:${disabled ? 'default' : 'pointer'}`,
      `background:${isActive ? '#2e8b57' : 'transparent'}`,
      `color:${isActive ? '#fff' : disabled ? '#ccc' : '#000'}`,
      `font-weight:${isActive ? '700' : '400'}`
    ].join(';')

    if (!disabled) {
      cell.addEventListener('click', () => {
        pageState.activeDate  = new Date(yr, mo, day)
        pageState.chosenSlots = []
        loadTakenSlots()
        drawCalendar()
        // Refresh seat grid to show occupancy for the newly selected date
        loadTakenSeats()
      })
    }

    dayGrid.appendChild(cell)
  }
}

window.moveCalMonth = function (direction) {
  pageState.calViewDate.setMonth(pageState.calViewDate.getMonth() + direction)
  drawCalendar()
}

/* Time Slot Picker
  - Draws one chip per 30-min block from 8 AM to 5 PM
  - Taken slots are styled differently and non-clickable
*/
function drawTimePicker () {
  const wrap = document.getElementById('timeSlotGrid')
  if (!wrap) return

  wrap.innerHTML = ''

  // Generate every 30-min block label between 8:00 AM and 4:30 PM
  const allSlots = []
  for (let hour = 8; hour <= 16; hour++) {
    const suffix      = hour >= 12 ? 'PM' : 'AM'
    const displayHour = hour > 12 ? hour - 12 : hour
    allSlots.push(`${String(displayHour).padStart(2, '0')}:00 ${suffix}`)
    allSlots.push(`${String(displayHour).padStart(2, '0')}:30 ${suffix}`)
  }

  // For today, calculate current time to block past slots
  const now         = new Date()
  const todayStr    = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  const isViewToday = dateToPrettyStr(pageState.activeDate) === todayStr
  const nowMins     = now.getHours() * 60 + now.getMinutes()

  allSlots.forEach(slot => {
    const meta       = pageState.takenSlotMeta[slot] || null
    const fullyTaken = meta ? meta.fullyBooked : false
    const partial    = meta && !fullyTaken
    const isPicked   = pageState.chosenSlots.includes(slot)

    // Check if this slot has already passed today
    const slotPast = isViewToday && (() => {
      const [tp, mer] = slot.split(' ')
      let [h, m] = tp.split(':').map(Number)
      if (mer === 'PM' && h !== 12) h += 12
      if (mer === 'AM' && h === 12) h  = 0
      return (h * 60 + m + 30) <= nowMins   // slot end time has passed
    })()

    const unavailable = fullyTaken || slotPast

    const chip = document.createElement('div')
    chip.className = 'rounded px-3 py-2 small fw-bold text-center mb-1'

    if (slotPast) {
      chip.innerHTML = `${slot}<br><span style="font-size:10px;font-weight:400;">Past</span>`
    } else if (partial) {
      chip.innerHTML = `${slot}<br><span style="font-size:10px;font-weight:400;">${meta.seatsLeft} seat${meta.seatsLeft !== 1 ? 's' : ''} left</span>`
    } else {
      chip.textContent = slot
    }

    chip.style.cssText = [
      `cursor:${unavailable ? 'not-allowed' : 'pointer'}`,
      `background:${isPicked ? '#2e8b57' : fullyTaken ? '#842029' : slotPast ? '#e9ecef' : partial ? '#fff3cd' : '#f0f0f0'}`,
      `color:${isPicked ? '#fff' : fullyTaken ? '#fff' : slotPast ? '#adb5bd' : partial ? '#664d03' : '#333'}`,
      `border:2px solid ${isPicked ? '#1a5c38' : fullyTaken ? '#6b1a21' : slotPast ? '#dee2e6' : partial ? '#ffc107' : '#ddd'}`
    ].join(';')

    if (!unavailable) {
      chip.addEventListener('click', () => {
        const slotIdx = pageState.chosenSlots.indexOf(slot)
        if (slotIdx !== -1) {
          pageState.chosenSlots.splice(slotIdx, 1)
        } else {
          pageState.chosenSlots.push(slot)
        }
        drawTimePicker()
      })
    }

    // Hover popover on booked/partial slots
    if (meta) {
      chip.addEventListener('mouseenter', () => showPopover(chip, meta))
      chip.addEventListener('mouseleave', hidePopover)
    }

    wrap.appendChild(chip)
  })
}

// Open the date/time picker modal
function openDateTimePicker () {
  if (pageState.pickedSeats.length === 0) {
    alert('Please select at least one seat first.')
    return
  }

  pageState.chosenSlots = []
  drawCalendar()
  loadTakenSlots()

  document.getElementById('modalTitle').textContent = window.LAB_NAME
  document.getElementById('modalSub').textContent   = `${window.LAB_CODE} • Pick a date and time`

  bootstrap.Modal.getOrCreateInstance(
    document.getElementById('reservationModal')
  ).show()
}

// Open the review/summary modal
function showReviewModal () {
  if (pageState.chosenSlots.length === 0) {
    alert('Please pick at least one time slot.')
    return
  }

  if (pageState.chosenSlots.length < 2) {
    alert('Minimum reservation is 1 hour — please select at least 2 consecutive 30-minute slots.')
    return
  }

  if (pageState.chosenSlots.length > 4) {
    alert('Maximum reservation is 2 hours — please select no more than 4 slots.')
    return
  }

  // Block if any chosen slot is in the past (today only)
  const nowCheck    = new Date()
  const todayCheck  = nowCheck.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  const isTodayView = dateToPrettyStr(pageState.activeDate) === todayCheck
  const nowMinsCheck = nowCheck.getHours() * 60 + nowCheck.getMinutes()

  if (isTodayView) {
    const hasPast = pageState.chosenSlots.some(slot => {
      const [tp, mer] = slot.split(' ')
      let [h, m] = tp.split(':').map(Number)
      if (mer === 'PM' && h !== 12) h += 12
      if (mer === 'AM' && h === 12) h  = 0
      return (h * 60 + m + 30) <= nowMinsCheck
    })
    if (hasPast) {
      alert('One or more selected slots have already passed. Please choose future time slots.')
      return
    }
  }

  // Check slots are consecutive — no gaps allowed
  const toMins = label => {
    const [tp, mer] = label.split(' ')
    let [h, m] = tp.split(':').map(Number)
    if (mer === 'PM' && h !== 12) h += 12
    if (mer === 'AM' && h === 12) h = 0
    return h * 60 + m
  }
  const sorted = [...pageState.chosenSlots].sort((a, b) => toMins(a) - toMins(b))
  for (let i = 1; i < sorted.length; i++) {
    if (toMins(sorted[i]) - toMins(sorted[i - 1]) !== 30) {
      alert('Please select consecutive time slots only — no gaps allowed.')
      return
    }
  }

  const dateLabel = dateToPrettyStr(pageState.activeDate)
  const timeLabel = slotArrayToRange(pageState.chosenSlots)

  // Fill hidden form fields
  document.getElementById('f_labId').value   = window.LAB_ID
  document.getElementById('f_labCode').value = window.LAB_CODE
  document.getElementById('f_seats').value   = JSON.stringify(pageState.pickedSeats)
  document.getElementById('f_date').value    = dateLabel
  document.getElementById('f_time').value    = timeLabel
  document.getElementById('f_slots').value   = JSON.stringify(pageState.chosenSlots)
  document.getElementById('f_resId').value   = pageState.editTargetId || ''

  // Fill summary display
  document.getElementById('sum_lab').textContent   = `${window.LAB_NAME} (${window.LAB_CODE})`
  document.getElementById('sum_seats').textContent = `Seat(s) ${pageState.pickedSeats.join(', ')}`
  document.getElementById('sum_date').textContent  = dateLabel
  document.getElementById('sum_time').textContent  = timeLabel
  document.getElementById('isAnonymous').checked   = false

  bootstrap.Modal.getOrCreateInstance(document.getElementById('reservationModal')).hide()
  setTimeout(() => {
    bootstrap.Modal.getOrCreateInstance(document.getElementById('summaryModal')).show()
  }, 350)
}

// Submit the reservation to server
async function saveReservation () {
  const existingId = document.getElementById('f_resId').value

  const payload = {
    labId:       document.getElementById('f_labId').value,
    labCode:     document.getElementById('f_labCode').value,
    seats:       JSON.parse(document.getElementById('f_seats').value),
    date:        document.getElementById('f_date').value,
    timeRange:   document.getElementById('f_time').value,
    slotsArray:  JSON.parse(document.getElementById('f_slots').value),
    isAnonymous: document.getElementById('isAnonymous').checked
  }

  const endpoint = existingId ? `/api/reservations/${existingId}` : '/api/reservations'
  const verb     = existingId ? 'PUT' : 'POST'

  try {
    const response = await fetch(endpoint, {
      method:  verb,
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload)
    })

    if (response.ok) {
      const body = await response.json()
      bootstrap.Modal.getOrCreateInstance(document.getElementById('summaryModal')).hide()

      // Reset state
      pageState.pickedSeats  = []
      pageState.chosenSlots  = []
      pageState.editTargetId = null

      // If faculty bumped students, update success message
      if (body.bumpedCount > 0) {
        document.querySelector('#successModal p').textContent =
          `Your seat has been reserved. ${body.bumpedCount} conflicting student reservation(s) were cancelled due to faculty priority.`
      } else {
        document.querySelector('#successModal p').textContent =
          'Your seat has been successfully reserved.'
      }

      setTimeout(() => {
        bootstrap.Modal.getOrCreateInstance(document.getElementById('successModal')).show()
        buildSeatGrid()
      }, 350)
    } else {
      const body = await response.json()
      const msg  = body.error || 'Could not save reservation.'
      alert(msg)
      // If it's a conflict, reset so user can pick different seats/slots
      if (response.status === 409) {
        pageState.pickedSeats  = []
        pageState.chosenSlots  = []
        pageState.editTargetId = null
        buildSeatGrid()
      }
    }
  } catch (e) {
    console.error('saveReservation error:', e)
    alert('Network error — please try again.')
  }
}

/* Reservation Popover
  - Shows who booked a seat/slot on hover.
  - Clicking the name goes to their profile.
*/

let popoverTimer = null
const popover    = document.getElementById('resPopover')

function showPopover (el, info) {
  if (!popover) return
  clearTimeout(popoverTimer)

  const avatar  = document.getElementById('popAvatar')
  const nameEl  = document.getElementById('popName')
  const metaEl  = document.getElementById('popMeta')

  if (info.isAnonymous) {
    avatar.src        = 'https://ui-avatars.com/api/?name=Anon&background=555&color=fff'
    nameEl.innerHTML  = '<span class="pop-anon">Anonymous reservation</span>'
    metaEl.textContent = ''
  } else {
    avatar.src = info.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(info.name)}&background=2e8b57&color=fff`
    nameEl.innerHTML = info.userEmail
      ? `<a href="/profile/${info.userEmail}">${escapeHtml(info.name)}</a>`
      : escapeHtml(info.name)
    metaEl.textContent = info.seatNumbers ? `Seat(s): ${info.seatNumbers}` : ''
  }

  // Position near the hovered element
  const rect = el.getBoundingClientRect()
  popover.style.display = 'block'

  // Try right of element, fall back to left if near edge
  let left = rect.right + 8
  if (left + 240 > window.innerWidth) left = rect.left - 248
  let top  = rect.top + window.scrollY

  popover.style.left = left + 'px'
  popover.style.top  = top  + 'px'
}

function hidePopover () {
  popoverTimer = setTimeout(() => {
    if (popover && !popover.matches(':hover')) {
      popover.style.display = 'none'
    }
  }, 200)
}

function escapeHtml (str) {
  return String(str || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// Keep popover alive when mouse moves onto it
if (popover) {
  popover.addEventListener('mouseenter', () => clearTimeout(popoverTimer))
  popover.addEventListener('mouseleave', hidePopover)
}

// Refresh the weekly schedule table cells without a full page reload
// Fetches fresh booked-slot data for each of the 7 days and updates cell badges
async function refreshScheduleTable () {
  const table = document.getElementById('scheduleTable')
  if (!table) return

  // Get all 7 day columns from the header
  const headers = Array.from(table.querySelectorAll('thead th')).slice(1)  // skip "Time" col

  // For each day column, fetch booked slots and update the cells
  for (let i = 0; i < headers.length; i++) {
    // Parse the date from the header text e.g. "Mar 16, 2026"
    const headerText = headers[i].textContent.replace(/\s+/g, ' ').trim()

    const params = new URLSearchParams({
      labId:   pageState.labId,
      labCode: pageState.labCode,
      date:    headerText
    })

    try {
      const response = await fetch('/api/reservations/booked?' + params)
      const slotMap  = await response.json()

      // Update each row's cell for this day column
      const rows = Array.from(table.querySelectorAll('tbody tr'))
      rows.forEach(row => {
        const cells     = Array.from(row.querySelectorAll('td'))
        const timeCell  = cells[0]
        const dayCell   = cells[i + 1]   // +1 to skip time column
        if (!timeCell || !dayCell) return

        // Extract the start label from the time cell e.g. "08:00 AM" from "08:00 AM - 08:30 AM"
        const startLabel = timeCell.textContent.trim().split(' - ')[0]
        const meta       = slotMap[startLabel]

        const totalSeats = window.TOTAL_SEATS || 0
        const bookedCount = meta ? meta.bookedCount : 0
        const seatsLeft   = Math.max(0, totalSeats - bookedCount)
        const fullyBooked = meta ? meta.fullyBooked : false
        const partial     = meta && !fullyBooked

        if (fullyBooked) {
          dayCell.innerHTML = `<span class="badge bg-danger w-100" style="font-size:10px;">Full</span>`
        } else if (partial) {
          dayCell.innerHTML = `<span class="badge w-100" style="background:#fff3cd;color:#664d03;font-size:10px;">${seatsLeft} left</span>`
        } else {
          dayCell.innerHTML = `<span class="badge w-100" style="background:#d1f0e0;color:#1a5c38;font-size:10px;">Free</span>`
        }
      })
    } catch (e) {
      // Silent fail -> table will update on next interval
    }
  }
}

// Technician: cancel a no-show reservation
// Per proposal: only valid within the first 10 minutes of the reservation start time
async function techCancel (resId, btn) {
  if (!resId || resId === 'undefined') return

  // Find the start time from the cell's row — check we're within 10 minutes of start
  const row       = btn.closest('tr')
  const timeCell  = row ? row.querySelector('td:first-child') : null
  if (timeCell) {
    const startLabel = timeCell.textContent.trim().split(' - ')[0]  // e.g. "09:00 AM"
    const [tp, mer]  = startLabel.split(' ')
    let [h, m]       = tp.split(':').map(Number)
    if (mer === 'PM' && h !== 12) h += 12
    if (mer === 'AM' && h === 12) h  = 0
    const slotStartMins = h * 60 + m
    const now           = new Date()
    const nowMins       = now.getHours() * 60 + now.getMinutes()
    const diff          = nowMins - slotStartMins

    if (diff < 0) {
      alert('Cannot cancel yet — reservation has not started.')
      return
    }
    if (diff > 10) {
      alert('10-minute no-show window has passed. Cannot cancel this reservation.')
      return
    }
  }

  if (!confirm('Cancel this reservation as no-show?')) return

  try {
    const response = await fetch(`/api/reservations/${resId}`, { method: 'DELETE' })
    if (response.ok) {
      // Remove the cell visually and reload grid
      const cell = btn.closest('td')
      if (cell) cell.innerHTML = '<span class="badge w-100" style="background:#d1f0e0;color:#1a5c38;font-size:10px;">Free</span>'
      // Also refresh seat grid
      loadTakenSeats()
    } else {
      alert('Could not cancel — please try again.')
    }
  } catch (e) {
    console.error('techCancel error:', e)
    alert('Network error.')
  }
}

// Boot/Load
document.addEventListener('DOMContentLoaded', () => {
  buildSeatGrid()

  document.getElementById('btnProceed')
    .addEventListener('click', openDateTimePicker)

  document.getElementById('finalConfirm')
    .addEventListener('click', showReviewModal)

  document.getElementById('reservation-form')
    .addEventListener('submit', e => { e.preventDefault(); saveReservation() })

  // Safer if you have a specific ID for the date input
  const techDateInput = document.getElementById('reserveDate'); 
  if (techDateInput) {
    const today = new Date();
    const nextWeek = new Date();
    nextWeek.setDate(today.getDate() + 7);
  
    const formatDate = (d) => d.toISOString().split('T')[0];
    techDateInput.min = formatDate(today);
    techDateInput.max = formatDate(nextWeek);
  }
  
  // If ?edit=<id> is in the URL, auto-open the picker for editing
  const urlParams   = new URLSearchParams(window.location.search)
  const editId      = urlParams.get('edit')
  if (editId) {
    pageState.editTargetId = editId
    setTimeout(() => openDateTimePicker(), 600)
  }

  // If a time was passed from the search form, scroll the schedule table to that row
  if (window.SCROLL_TIME && window.SCROLL_TIME !== '') {
    setTimeout(() => {
      const rows = document.querySelectorAll('#scheduleTable tbody tr')
      rows.forEach(row => {
        const cell = row.querySelector('td:first-child')
        if (cell && cell.textContent.includes(window.SCROLL_TIME)) {
          row.scrollIntoView({ behavior: 'smooth', block: 'center' })
          row.style.outline = '2px solid #2e8b57'
          setTimeout(() => row.style.outline = '', 3000)
        }
      })
    }, 300)
  }

  // Keep availability fresh every 30 seconds
  // Also reloads the weekly schedule table to reflect any new bookings
  setInterval(() => {
    loadTakenSlots()
    loadTakenSeats()
    refreshScheduleTable()
  }, 30000)
})
