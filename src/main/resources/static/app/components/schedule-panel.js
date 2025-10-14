// app/components/schedule-panel.js
(function () {
  const q = (id) => document.getElementById(id);
  const qa = (sel) => Array.from(document.querySelectorAll(sel));

  // default values
  const DEFAULTS = {
    scheduleType: 'WEEKLY',   // 'WEEKLY' | 'PARITY'
    weekType: 'STABLE',       // 'STABLE' | 'EVEN' | 'ODD'
    dayOfWeek: 1,             // 1..7 (Пн..Вс)
    timezone: (Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC')
  };

  function getActiveFloor() {
    const btn = document.querySelector('.floor-switch button.active');
    const v = btn?.getAttribute('data-floor');
    return v ? Number(v) : 1;
  }

  class SchedulePanel {
    constructor() {
      // radio’s
      this.rWeekly   = q('sch-mode-weekly');
      this.rParity   = q('sch-mode-parity');

      // selects
      this.selWeekType = q('sch-weektype'); // STABLE/EVEN/ODD
      this.selDay      = q('sch-day');      // 1..7

      // timezone input
      this.inTimezone  = q('sch-tz');

      // init day list if empty
      if (this.selDay && this.selDay.options.length === 0) {
        const days = [
          [1, 'Понедельник'], [2,'Вторник'], [3,'Среда'], [4,'Четверг'],
          [5,'Пятница'], [6,'Суббота'], [7,'Воскресенье']
        ];
        this.selDay.innerHTML = days.map(([v,t]) => `<option value="${v}">${t}</option>`).join('');
      }

      // init weekType options if empty
      if (this.selWeekType && this.selWeekType.options.length === 0) {
        this.selWeekType.innerHTML = `
          <option value="STABLE">стабильная (каждую неделю)</option>
          <option value="EVEN">чётная неделя</option>
          <option value="ODD">нечётная неделя</option>
        `;
      }

      // handlers
      const syncWeekTypeAvailability = () => {
        const weekly = !!this.rWeekly?.checked;
        if (this.selWeekType) {
          if (weekly) {
            this.selWeekType.value = 'STABLE';
            this.selWeekType.disabled = true;
          } else {
            // PARITY
            if (this.selWeekType.value === 'STABLE') {
              this.selWeekType.value = 'EVEN';
            }
            this.selWeekType.disabled = false;
          }
        }
      };

      const emit = () => this.onChange?.(this.getValue());

      this.rWeekly?.addEventListener('change', () => { syncWeekTypeAvailability(); emit(); });
      this.rParity?.addEventListener('change', () => { syncWeekTypeAvailability(); emit(); });
      this.selWeekType?.addEventListener('change', emit);
      this.selDay?.addEventListener('change', emit);
      this.inTimezone?.addEventListener('change', emit);
      qa('.floor-switch button').forEach(b => {
        b.addEventListener('click', () => {
          qa('.floor-switch button').forEach(x => x.classList.remove('active'));
          b.classList.add('active');
          emit();
        });
      });

      // initial values
      this.setValue(DEFAULTS);
      syncWeekTypeAvailability();
    }

    getValue() {
      const weekly = !!this.rWeekly?.checked;
      const scheduleType = weekly ? 'WEEKLY' : 'PARITY';
      let weekType = this.selWeekType?.value || 'STABLE';
      if (scheduleType === 'WEEKLY') weekType = 'STABLE';

      return {
        scheduleType,
        weekType,
        dayOfWeek: Number(this.selDay?.value || 1),
        timezone: (this.inTimezone?.value || DEFAULTS.timezone || 'UTC'),
        floor: getActiveFloor()
      };
    }

    setValue({ scheduleType, weekType, dayOfWeek, timezone } = {}) {
      const st = scheduleType || DEFAULTS.scheduleType;
      if (this.rWeekly) this.rWeekly.checked = (st === 'WEEKLY');
      if (this.rParity) this.rParity.checked = (st === 'PARITY');

      if (typeof dayOfWeek === 'number' && this.selDay) {
        this.selDay.value = String(dayOfWeek);
      } else if (this.selDay && !this.selDay.value) {
        this.selDay.value = String(DEFAULTS.dayOfWeek);
      }

      if (this.inTimezone) {
        this.inTimezone.value = timezone || DEFAULTS.timezone;
      }

      if (this.selWeekType) {
        const wt = (st === 'WEEKLY') ? 'STABLE' : (weekType || 'EVEN');
        this.selWeekType.value = wt;
        this.selWeekType.disabled = (st === 'WEEKLY');
      }

      this.onChange?.(this.getValue());
    }

    setContext({ onChange } = {}) {
      this.onChange = (typeof onChange === 'function') ? onChange : null;
      this.onChange?.(this.getValue());
    }
  }

  window.SchedulePanel = SchedulePanel;
})();
