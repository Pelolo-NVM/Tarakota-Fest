(function (global) {
  'use strict';

  var IN_ADMIN_DIR = /\/admin(?:\/|$)/.test(global.location.pathname || '');
  var API_PREFIX = IN_ADMIN_DIR ? '..' : '.';

  function buildUrl(endpoint) {
    var clean = endpoint.charAt(0) === '/' ? endpoint : '/' + endpoint;
    return API_PREFIX + clean;
  }

  function appendPagination(qs, page, limit) {
    if (page && Number(page) > 0) qs.set('page', String(page));
    if (limit && Number(limit) > 0) qs.set('limit', String(limit));
  }

  async function requestJson(endpoint, options) {
    var opts = options || {};
    var headers = Object.assign({ Accept: 'application/json' }, opts.headers || {});
    var isFormData = typeof FormData !== 'undefined' && opts.body instanceof FormData;

    if (!isFormData && opts.body !== undefined && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    try {
      var res = await fetch(buildUrl(endpoint), {
        method: opts.method || 'GET',
        headers: headers,
        body: isFormData ? opts.body : (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
        credentials: 'same-origin'
      });

      var payload;
      try {
        payload = await res.json();
      } catch (_parseErr) {
        return {
          ok: false,
          status: res.status,
          message: 'Respons server bukan JSON yang valid (HTTP ' + res.status + ').',
          errors: {}
        };
      }

      return {
        ok: Boolean(payload.ok),
        status: payload.status || res.status,
        data: payload.data !== undefined ? payload.data : null,
        message: payload.message || '',
        errors: payload.errors || {}
      };
    } catch (_netErr) {
      return {
        ok: false,
        status: 0,
        message: 'Gagal menghubungi server API. Periksa koneksi server PHP.',
        errors: {}
      };
    }
  }

  var channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('tarakota_fest_sync') : null;

  function notifySync(topic) {
    if (channel) {
      channel.postMessage({ type: topic, timestamp: Date.now() });
    }
  }

  function onSync(callback) {
    if (!channel) return function () {};
    function handler(ev) {
      if (ev && ev.data && ev.data.type) {
        callback(ev.data.type);
      }
    }
    channel.addEventListener('message', handler);
    return function () {
      channel.removeEventListener('message', handler);
    };
  }

  global.TarakotaAPI = {
    buildUrl: buildUrl,
    notifySync: notifySync,
    onSync: onSync,

    events: {
      list: function (includeCancelled, page, limit, filters) {
        var qs = new URLSearchParams();
        var f = filters || {};
        qs.set('all', includeCancelled ? '1' : '0');
        if (f.status && f.status !== 'ALL') qs.set('status', f.status);
        if (f.search) qs.set('search', f.search);
        appendPagination(qs, page, limit);
        return requestJson('/api/events?' + qs.toString());
      },
      getById: function (eventCode) {
        return requestJson('/api/events/' + encodeURIComponent(eventCode));
      },
      create: async function (formData) {
        var res = await requestJson('/api/events', { method: 'POST', body: formData });
        if (res.ok) notifySync('events');
        return res;
      },
      update: async function (eventCode, formData) {
        var res = await requestJson('/api/events/' + encodeURIComponent(eventCode), { method: 'POST', body: formData });
        if (res.ok) notifySync('events');
        return res;
      },
      toggleStatus: async function (eventCode, status) {
        var res = await requestJson('/api/events/' + encodeURIComponent(eventCode) + '/status', {
          method: 'PATCH',
          body: { status: status }
        });
        if (res.ok) notifySync('events');
        return res;
      },
      softDelete: async function (eventCode) {
        var res = await requestJson('/api/events/' + encodeURIComponent(eventCode), { method: 'DELETE' });
        if (res.ok) notifySync('events');
        return res;
      }
    },

    schedule: {
      list: function (filters, page, limit) {
        var f = filters || {};
        var qs = new URLSearchParams();
        if (f.day && f.day !== 'ALL') qs.set('day', f.day);
        if (f.stage && f.stage !== 'ALL') qs.set('stage', f.stage);
        if (f.genre && f.genre !== 'ALL') qs.set('genre', f.genre);
        if (f.search) qs.set('search', f.search);
        appendPagination(qs, page, limit);
        var queryStr = qs.toString();
        return requestJson('/api/schedule' + (queryStr ? '?' + queryStr : ''));
      }
    },

    transactions: {
      list: function (statusFilter, page, limit) {
        var qs = new URLSearchParams();
        if (statusFilter && statusFilter !== 'ALL') qs.set('status', statusFilter);
        appendPagination(qs, page, limit);
        var queryStr = qs.toString();
        return requestJson('/api/transactions' + (queryStr ? '?' + queryStr : ''));
      },
      lookup: function (query, page, limit) {
        var qs = new URLSearchParams();
        qs.set('query', query || '');
        appendPagination(qs, page, limit);
        return requestJson('/api/transactions/lookup?' + qs.toString());
      },
      create: async function (formData) {
        var res = await requestJson('/api/transactions', { method: 'POST', body: formData });
        if (res.ok) notifySync('transactions');
        return res;
      },
      verify: async function (trxCode, decision, adminNote) {
        var res = await requestJson('/api/transactions/' + encodeURIComponent(trxCode) + '/verify', {
          method: 'PATCH',
          body: { decision: decision, adminNote: adminNote || '' }
        });
        if (res.ok) notifySync('transactions');
        return res;
      }
    },

    bands: {
      list: function (statusFilter, page, limit) {
        var qs = new URLSearchParams();
        if (statusFilter && statusFilter !== 'ALL') qs.set('status', statusFilter);
        appendPagination(qs, page, limit);
        var queryStr = qs.toString();
        return requestJson('/api/bands' + (queryStr ? '?' + queryStr : ''));
      },
      create: async function (payload) {
        var res = await requestJson('/api/bands', { method: 'POST', body: payload });
        if (res.ok) notifySync('bands');
        return res;
      },
      curate: async function (bandCode, decision, scheduleSlot) {
        var res = await requestJson('/api/bands/' + encodeURIComponent(bandCode) + '/curate', {
          method: 'PATCH',
          body: { decision: decision, scheduleSlot: scheduleSlot || null }
        });
        if (res.ok) notifySync('bands');
        return res;
      }
    },

    analytics: {
      summary: function () {
        return requestJson('/api/analytics/summary');
      }
    },

    auth: {
      login: function (email, password) {
        return requestJson('/api/admin/login', {
          method: 'POST',
          body: { email: email, password: password }
        });
      },
      logout: function () {
        return requestJson('/api/admin/logout', { method: 'POST' });
      },
      getSession: function () {
        return requestJson('/api/admin/session');
      }
    }
  };
})(window);
