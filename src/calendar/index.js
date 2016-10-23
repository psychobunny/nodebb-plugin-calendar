/* global socket, $, config, app, RELATIVE_PATH, ajaxify */

import 'fullcalendar';

const convertToFC = (event) => {
  const ev = {
    id: event.pid,
    title: event.name,
    allDay: event.allday,
    start: event.startDate,
    end: event.endDate,
    className: [
      `plugin-calendar-cal-event-category-${event.cid}`,
      `plugin-calendar-cal-event-response-${event.responses[app.user.uid]}`,
      event.topicDeleted ? 'plugin-calendar-cal-event-topic-deleted' : '',
    ],
  };

  return ev;
};

const queryRegExp = /&event=([0-9]+)/;
const globalRegExp = /&event=([0-9]+)/g;

const displayEvent = (event, e, cb) => {
  if (e) {
    e.preventDefault();
    e.stopPropagation();
  }
  const pid = event.id;

  socket.emit('plugins.calendar.getParsedEvent', pid, (err, { content, parsed }) => {
    if (err) {
      app.alertError(err.message || err);
      throw err;
    }

    const div = $(content);
    const modal = $('#plugin-calendar-cal-event-display');
    modal
      .find('.modal-body')
      .empty()
      .append(div);
    modal
      .find('.modal-footer a.btn-primary')
      .attr('href', `${RELATIVE_PATH}/post/${pid}`);
    modal
      .find('.plugin-calendar-event-responses-lists .panel-body')
      .addClass('topic')
      .find('ul')
      .addClass('posts');
    modal
      .attr('data-pid', pid)
      .modal({
        backdrop: false,
      });
    modal.off('click').on('click', '.dismiss', () => {
      modal.modal('hide');
      location.hash = location.hash.replace(globalRegExp, '');
    });
    $(window).trigger('action:calendar.event.display', { pid, modal });
    location.hash = `${location.hash.replace(globalRegExp, '') || '#'}&event=${pid}`;

    if (typeof cb === 'function') {
      cb({ content, parsed });
    }
  });
};

const begin = (momentLang) => {
  const calendarOptions = {
    editable: false,
    header: {
      left: 'prev,next today',
      center: 'title',
      right: 'month,agendaWeek,agendaDay',
    },
    lang: momentLang,
    events: (start, end, timezone, callback) => {
      socket.emit('plugins.calendar.getEventsByDate', {
        startDate: start.valueOf(),
        endDate: end.valueOf(),
      }, (err, events) => {
        if (err) {
          app.alertError(err.message || err);
          return;
        }
        callback(events.map(convertToFC));
      });
    },
    eventClick: displayEvent,
    timezone: 'local',
  };

  const openEvent = (fc) => {
    // TODO: possibly use server rendering instead of sockets
    const matches = location.hash.match(queryRegExp);
    const pid = matches && parseInt(matches[1], 10);

    if (!pid) {
      setTimeout(() => {
        $('#plugin-calendar-cal-event-display').modal({
          backdrop: false,
          show: false,
        }).modal('hide');
      }, 200);
      return;
    }

    setTimeout(() => {
      displayEvent({ id: pid }, null, ({ parsed }) => {
        fc.fullCalendar('gotoDate', parsed.startDate);
      });
    }, 200);
  };

  let justLoaded = false;
  const init = () => {
    const $calendar = $('#calendar');

    if (!justLoaded) {
      $calendar.fullCalendar(calendarOptions);
      const btn = $('#plugin-calendar-cal-only-yes');
      btn
        .on('click', (e) => {
          e.preventDefault();
          $calendar.toggleClass('plugin-calendar-cal-only-yes');
          btn.toggleClass('active');
        })
        .detach()
        .appendTo($calendar.find('.fc-toolbar .fc-right'));
    }

    openEvent($calendar);
  };

  $(document).ready(() => {
    init();
    justLoaded = true;
  });
  $(window).on('action:ajaxify.end hashchange popstate', () => {
    if (ajaxify.data.template.calendar) {
      init();
    }
    justLoaded = false;
  });
};

__webpack_public_path__ = `${RELATIVE_PATH}/plugins/nodebb-plugin-calendar/bundles/`; // eslint-disable-line

const lang = config.userLang || config.defaultLang;
const momentLang = lang.toLowerCase().replace(/_/g, '-');

try {
  if (momentLang === 'en-us') {
    begin('en-us');
  } else {
    require(`bundle!fullcalendar/dist/lang/${momentLang}`)(() => { // eslint-disable-line
      begin(momentLang);
    });
  }
} catch (e) {
  console.error(`could not load locale data (${momentLang}) for fullcalendar`);
  begin('en-us');
}
