(function (global) {
  'use strict';

  document.addEventListener('DOMContentLoaded', async function () {
    var UI = global.TarakotaUI;
    var API = global.TarakotaAPI;

    var sessionRes = await API.auth.getSession();
    if (!sessionRes.ok || !sessionRes.data) {
      global.location.replace('login.html');
      return;
    }

    var session = sessionRes.data;
    var adminUserEl = document.getElementById('admin-user-email');
    if (adminUserEl) adminUserEl.textContent = session.email;

    var sidebarEl = document.getElementById('admin-sidebar');
    var mobileToggle = document.getElementById('admin-mobile-toggle');
    var navButtons = document.querySelectorAll('[data-admin-tab]');
    var panels = document.querySelectorAll('[data-admin-panel]');
    var pageTitleEl = document.getElementById('admin-page-title');
    var logoutBtn = document.getElementById('admin-logout-btn');
    var refreshBtn = document.getElementById('admin-refresh-btn');

    var badgePendingTrx = document.getElementById('badge-pending-trx');
    var badgePendingBands = document.getElementById('badge-pending-bands');

    // Menu 1: Analytics
    var metricsGrid = document.getElementById('admin-metrics-grid');
    var progressSummaryEl = document.getElementById('admin-progress-summary');
    var recentPendingList = document.getElementById('admin-recent-pending');

    // Menu 2: Event CRUD
    var eventsTableBody = document.getElementById('admin-events-tbody');
    var eventSearchInput = document.getElementById('event-search-input');
    var eventStatusFilter = document.getElementById('event-status-filter');
    var addEventBtn = document.getElementById('add-event-btn');
    var topbarAddEventBtn = document.getElementById('topbar-add-event-btn');
    var eventModalCtrl = UI.createModalController('event-modal-backdrop');
    var eventModalClose = document.getElementById('event-modal-close');
    var eventForm = document.getElementById('event-crud-form');
    var eventModalTitle = document.getElementById('event-modal-title');
    var eventFormError = document.getElementById('event-form-error');

    // Menu 3: Transactions
    var trxFilterSelect = document.getElementById('trx-status-filter');
    var trxTableBody = document.getElementById('admin-trx-tbody');
    var verifyModalCtrl = UI.createModalController('verify-modal-backdrop');
    var verifyModalClose = document.getElementById('verify-modal-close');
    var verifyDetailsBox = document.getElementById('verify-trx-details');
    var verifyProofImg = document.getElementById('verify-proof-img');
    var verifyNoteInput = document.getElementById('verify-admin-note');
    var verifyApproveBtn = document.getElementById('verify-approve-btn');
    var verifyRejectBtn = document.getElementById('verify-reject-btn');
    var verifyFeedback = document.getElementById('verify-modal-feedback');

    // Menu 4: Band Curation
    var bandFilterSelect = document.getElementById('band-status-filter');
    var bandsTableBody = document.getElementById('admin-bands-tbody');
    var curateModalCtrl = UI.createModalController('curate-modal-backdrop');
    var curateModalClose = document.getElementById('curate-modal-close');
    var curateDetailsBox = document.getElementById('curate-band-details');
    var curatePublishCheck = document.getElementById('curate-publish-schedule');
    var curateSlotFields = document.getElementById('curate-slot-fields');
    var curateDaySelect = document.getElementById('curate-day');
    var curateStageSelect = document.getElementById('curate-stage');
    var curateTimeInput = document.getElementById('curate-time');
    var curateApproveBtn = document.getElementById('curate-approve-btn');
    var curateReviewBtn = document.getElementById('curate-review-btn');
    var curateRejectBtn = document.getElementById('curate-reject-btn');
    var curateFeedback = document.getElementById('curate-modal-feedback');

    var selectedTrxId = null;
    var selectedBandId = null;
    var ADMIN_PAGE_LIMIT = 12;
    var eventsPage = 1;
    var trxPage = 1;
    var bandsPage = 1;
    var lastTransactions = [];
    var lastBands = [];

    var eventsPaginationEl = document.getElementById('admin-events-pagination');
    var trxPaginationEl = document.getElementById('admin-trx-pagination');
    var bandsPaginationEl = document.getElementById('admin-bands-pagination');

    var tabTitles = {
      overview: 'Ringkasan Analitik Festival',
      events: 'Manajemen Event & Kuota (CRUD)',
      transactions: 'Verifikasi Transaksi & Bukti Transfer',
      bands: 'Manajemen Kurasi Band Audisi'
    };

    function handleAuthLoss(res) {
      if (res && res.status === 401) {
        global.location.replace('login.html');
        return true;
      }
      return false;
    }

    function switchTab(tabId) {
      for (var i = 0; i < navButtons.length; i += 1) {
        var btn = navButtons[i];
        var isCurrent = btn.getAttribute('data-admin-tab') === tabId;
        btn.setAttribute('aria-current', isCurrent ? 'page' : 'false');
      }
      for (var j = 0; j < panels.length; j += 1) {
        var p = panels[j];
        p.hidden = p.getAttribute('data-admin-panel') !== tabId;
      }
      if (pageTitleEl) pageTitleEl.textContent = tabTitles[tabId] || 'Dashboard Admin';
      if (sidebarEl && sidebarEl.classList.contains('is-open')) {
        sidebarEl.classList.remove('is-open');
        if (mobileToggle) mobileToggle.setAttribute('aria-expanded', 'false');
      }
    }

    async function renderOverview() {
      var results = await Promise.all([
        API.analytics.summary(),
        API.transactions.list('pending', 1, 20),
        API.events.list(true, 1, 50)
      ]);
      var sumRes = results[0];
      var trxRes = results[1];
      var eventsRes = results[2];
      if (handleAuthLoss(sumRes) || handleAuthLoss(trxRes) || handleAuthLoss(eventsRes)) return;
      if (!sumRes.ok) return;
      var s = sumRes.data;

      if (badgePendingTrx) badgePendingTrx.textContent = String(s.pendingTransactionsCount);
      if (badgePendingBands) badgePendingBands.textContent = String(s.pendingBandsCount);

      if (metricsGrid) {
        metricsGrid.innerHTML =
          '<div class="metric-card">' +
            '<div class="metric-label">Pendapatan Terverifikasi (Paid)</div>' +
            '<div class="metric-value">' + UI.escapeHtml(UI.formatRupiah(s.verifiedRevenue)) + '</div>' +
          '</div>' +
          '<div class="metric-card">' +
            '<div class="metric-label">Tiket Terjual (Paid)</div>' +
            '<div class="metric-value">' + s.ticketsSold + ' tiket</div>' +
          '</div>' +
          '<div class="metric-card">' +
            '<div class="metric-label">Menunggu Verifikasi Bayar</div>' +
            '<div class="metric-value">' + s.pendingTransactionsCount + ' transaksi</div>' +
          '</div>' +
          '<div class="metric-card">' +
            '<div class="metric-label">Band Menunggu Kurasi</div>' +
            '<div class="metric-value">' + s.pendingBandsCount + ' band</div>' +
          '</div>';
      }

      if (progressSummaryEl) {
        var evtsRaw = (eventsRes.ok && eventsRes.data && eventsRes.data.items) ? eventsRes.data.items : [];
        var evts = evtsRaw.filter(function (e) { return String(e.status || '').toLowerCase() === 'active'; });
        var fillClasses = ['progress-fill--mint', 'progress-fill--lilac', 'progress-fill--tangerine'];
        var rowsHtml = evts.map(function (evt, idx) {
          var total = Math.max(0, Number(evt.totalQuota) || 0);
          var rem = Math.max(0, Number(evt.remainingQuota) || 0);
          var used = Math.max(0, total - rem);
          var pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
          return (
            '<div>' +
              '<div class="progress-row-head">' +
                '<span>' + UI.escapeHtml(evt.title) + '</span>' +
                '<span class="mono">' + used + ' / ' + total + ' tiket (' + pct + '%)</span>' +
              '</div>' +
              '<div class="progress-track" role="progressbar" aria-valuenow="' + pct + '" aria-valuemin="0" aria-valuemax="100" aria-label="Okupansi kuota ' + UI.escapeHtml(evt.title) + '">' +
                '<div class="progress-fill ' + fillClasses[idx % fillClasses.length] + '" style="width:' + pct + '%;"></div>' +
              '</div>' +
            '</div>'
          );
        }).join('');

        var totalTrx = Number(s.totalTransactionsCount) || 0;
        var verifiedTrx = Math.max(0, totalTrx - (Number(s.pendingTransactionsCount) || 0));
        var trxPct = totalTrx > 0 ? Math.round((verifiedTrx / totalTrx) * 100) : 100;

        rowsHtml +=
          '<div>' +
            '<div class="progress-row-head">' +
              '<span>Rasio Transaksi Selesai Diproses</span>' +
              '<span class="mono">' + verifiedTrx + ' / ' + totalTrx + ' transaksi (' + trxPct + '%)</span>' +
            '</div>' +
            '<div class="progress-track" role="progressbar" aria-valuenow="' + trxPct + '" aria-valuemin="0" aria-valuemax="100" aria-label="Rasio transaksi diproses">' +
              '<div class="progress-fill progress-fill--lilac" style="width:' + trxPct + '%;"></div>' +
            '</div>' +
          '</div>';

        progressSummaryEl.innerHTML =
          '<section class="analytics-progress-panel" aria-label="Ringkasan Kapasitas Kuota Event">' +
            '<h2 style="font-size:var(--text-lg); margin:0;">Okupansi Kuota Event &amp; Verifikasi</h2>' +
            '<div class="analytics-progress-list">' + rowsHtml + '</div>' +
          '</section>';
      }

      if (recentPendingList && trxRes.ok) {
        var pendingList = (trxRes.data && trxRes.data.items) || [];
        pendingList.forEach(function (item) {
          if (!lastTransactions.some(function (existing) { return existing.id === item.id; })) {
            lastTransactions.push(item);
          }
        });
        if (pendingList.length === 0) {
          recentPendingList.innerHTML =
            '<div class="state-panel">' +
              '<h3>Semua transaksi sudah diproses</h3>' +
              '<p>Tidak ada bukti transfer yang menunggu verifikasi saat ini.</p>' +
            '</div>';
        } else {
          recentPendingList.innerHTML =
            '<div class="table-scroll"><table class="data-table"><thead><tr>' +
            '<th>Kode</th><th>Pemesan</th><th>Event</th><th>Total</th><th>Status</th><th>Aksi</th>' +
            '</tr></thead><tbody>' +
            pendingList.map(function (t) {
              return '<tr>' +
                '<td class="mono">' + UI.escapeHtml(t.id) + '</td>' +
                '<td>' + UI.escapeHtml(t.buyerName) + '</td>' +
                '<td>' + UI.escapeHtml(t.eventTitle) + ' (' + t.qty + 'x)</td>' +
                '<td class="mono">' + UI.escapeHtml(UI.formatRupiah(t.totalAmount)) + '</td>' +
                '<td>' + UI.renderStatusBadge(t.status) + '</td>' +
                '<td><button type="button" class="btn btn-primary btn-sm" data-quick-verify="' + UI.escapeHtml(t.id) + '">Periksa Bukti</button></td>' +
              '</tr>';
            }).join('') +
            '</tbody></table></div>';

          var quickBtns = recentPendingList.querySelectorAll('[data-quick-verify]');
          for (var i = 0; i < quickBtns.length; i += 1) {
            quickBtns[i].addEventListener('click', function () {
              openVerifyModal(this.getAttribute('data-quick-verify'), this);
            });
          }
        }
      }
    }

    async function renderEventsTable() {
      if (!eventsTableBody) return;
      var eventFilters = {
        search: eventSearchInput ? eventSearchInput.value.trim() : '',
        status: eventStatusFilter ? eventStatusFilter.value : 'ALL'
      };
      var res = await API.events.list(true, eventsPage, ADMIN_PAGE_LIMIT, eventFilters);
      if (handleAuthLoss(res) || !res.ok) return;
      var events = (res.data && res.data.items) || [];
      UI.renderPagination(eventsPaginationEl, res.data && res.data.pagination, function (nextPage) {
        eventsPage = nextPage;
        renderEventsTable();
      });

      if (events.length === 0) {
        eventsTableBody.innerHTML = '<tr><td colspan="7">Tidak ada data event yang sesuai filter. Klik Tambah Event atau ubah kata kunci pencarian.</td></tr>';
        return;
      }

      eventsTableBody.innerHTML = events.map(function (evt) {
        var isCancelled = String(evt.status || '').toLowerCase() === 'cancelled';
        return (
          '<tr>' +
            '<td class="mono">' + UI.escapeHtml(evt.id) + '</td>' +
            '<td><strong>' + UI.escapeHtml(evt.title) + '</strong><br><span style="font-size:var(--text-xs); color:var(--color-ink-muted);">' + UI.escapeHtml(evt.dateLabel) + '</span></td>' +
            '<td>' + UI.escapeHtml(evt.category) + '</td>' +
            '<td class="mono">' + UI.escapeHtml(UI.formatRupiah(evt.price)) + '</td>' +
            '<td class="mono">' + evt.remainingQuota + ' / ' + evt.totalQuota + '</td>' +
            '<td>' + UI.renderStatusBadge(evt.status) + '</td>' +
            '<td><div class="row-actions">' +
              '<button type="button" class="btn btn-ghost btn-sm" data-edit-event="' + UI.escapeHtml(evt.id) + '">Edit</button>' +
              '<button type="button" class="btn ' + (isCancelled ? 'btn-secondary' : 'btn-danger') + ' btn-sm" data-toggle-event="' + UI.escapeHtml(evt.id) + '" data-next-status="' + (isCancelled ? 'active' : 'cancelled') + '">' +
                (isCancelled ? 'Aktifkan' : 'Batalkan') +
              '</button>' +
              '<button type="button" class="btn btn-danger btn-sm" data-archive-event="' + UI.escapeHtml(evt.id) + '">Arsipkan</button>' +
            '</div></td>' +
          '</tr>'
        );
      }).join('');

      var editBtns = eventsTableBody.querySelectorAll('[data-edit-event]');
      for (var i = 0; i < editBtns.length; i += 1) {
        editBtns[i].addEventListener('click', function () {
          var id = this.getAttribute('data-edit-event');
          var found = events.find(function (e) { return e.id === id; });
          if (found) openEventModal(found, this);
        });
      }

      var toggleBtns = eventsTableBody.querySelectorAll('[data-toggle-event]');
      for (var j = 0; j < toggleBtns.length; j += 1) {
        toggleBtns[j].addEventListener('click', async function () {
          var id = this.getAttribute('data-toggle-event');
          var nextStatus = this.getAttribute('data-next-status');
          if (nextStatus === 'cancelled' && !global.confirm('Batalkan penjualan tiket event ' + id + '? Event akan disembunyikan dari katalog publik.')) {
            return;
          }
          var toggleRes = await API.events.toggleStatus(id, nextStatus);
          if (handleAuthLoss(toggleRes)) return;
          if (!toggleRes.ok) {
            UI.announce(toggleRes.message || 'Gagal memperbarui status event.');
            return;
          }
          UI.announce('Status event diperbarui.');
          refreshAll();
        });
      }

      var archiveBtns = eventsTableBody.querySelectorAll('[data-archive-event]');
      for (var k = 0; k < archiveBtns.length; k += 1) {
        archiveBtns[k].addEventListener('click', async function () {
          var id = this.getAttribute('data-archive-event');
          if (!global.confirm('Arsipkan event ' + id + ' (Soft Delete)? Event dihapus dari katalog aktif, tetapi riwayat transaksi tetap aman.')) {
            return;
          }
          var delRes = await API.events.softDelete(id);
          if (handleAuthLoss(delRes)) return;
          if (!delRes.ok) {
            UI.announce(delRes.message || 'Gagal mengarsipkan event.');
            return;
          }
          UI.announce('Event diarsipkan melalui soft delete.');
          refreshAll();
        });
      }
    }

    function openEventModal(evtObj, triggerBtn) {
      if (!eventForm) return;
      eventForm.reset();
      UI.clearFieldErrors(eventForm);
      if (eventFormError) eventFormError.hidden = true;

      if (evtObj) {
        if (eventModalTitle) eventModalTitle.textContent = 'Edit Event: ' + evtObj.title;
        eventForm.elements.id.value = evtObj.id;
        eventForm.elements.title.value = evtObj.title;
        eventForm.elements.category.value = evtObj.category;
        eventForm.elements.dateLabel.value = evtObj.dateLabel;
        eventForm.elements.price.value = String(evtObj.price);
        eventForm.elements.totalQuota.value = String(evtObj.totalQuota);
        eventForm.elements.description.value = evtObj.description;
      } else {
        if (eventModalTitle) eventModalTitle.textContent = 'Tambah Event Baru';
        eventForm.elements.id.value = '';
      }
      eventModalCtrl.open(triggerBtn);
    }

    async function renderTransactionsTable() {
      if (!trxTableBody) return;
      var statusFilter = trxFilterSelect ? trxFilterSelect.value : 'ALL';
      var res = await API.transactions.list(statusFilter, trxPage, ADMIN_PAGE_LIMIT);
      if (handleAuthLoss(res) || !res.ok) return;
      var list = (res.data && res.data.items) || [];
      lastTransactions = list.slice();
      UI.renderPagination(trxPaginationEl, res.data && res.data.pagination, function (nextPage) {
        trxPage = nextPage;
        renderTransactionsTable();
      });

      if (list.length === 0) {
        trxTableBody.innerHTML = '<tr><td colspan="7">Belum ada transaksi pada filter status ini.</td></tr>';
        return;
      }

      trxTableBody.innerHTML = list.map(function (t) {
        return (
          '<tr>' +
            '<td class="mono">' + UI.escapeHtml(t.id) + '<br><span style="font-size:var(--text-xs); color:var(--color-ink-muted);">' + UI.escapeHtml(UI.formatDateTime(t.createdAt)) + '</span></td>' +
            '<td><strong>' + UI.escapeHtml(t.buyerName) + '</strong><br><span style="font-size:var(--text-xs); color:var(--color-ink-muted);">' + UI.escapeHtml(t.buyerEmail) + '</span></td>' +
            '<td>' + UI.escapeHtml(t.eventTitle) + '</td>' +
            '<td class="mono">' + t.qty + ' tiket</td>' +
            '<td class="mono">' + UI.escapeHtml(UI.formatRupiah(t.totalAmount)) + '</td>' +
            '<td>' + UI.renderStatusBadge(t.status) + '</td>' +
            '<td><button type="button" class="btn btn-primary btn-sm" data-inspect-trx="' + UI.escapeHtml(t.id) + '">Periksa Bukti</button></td>' +
          '</tr>'
        );
      }).join('');

      var inspectBtns = trxTableBody.querySelectorAll('[data-inspect-trx]');
      for (var i = 0; i < inspectBtns.length; i += 1) {
        inspectBtns[i].addEventListener('click', function () {
          openVerifyModal(this.getAttribute('data-inspect-trx'), this);
        });
      }
    }

    async function openVerifyModal(trxId, triggerBtn) {
      var trx = lastTransactions.find(function (t) { return t.id === trxId; });
      if (!trx) {
        var res = await API.transactions.list('ALL', 1, 100);
        if (handleAuthLoss(res) || !res.ok) return;
        trx = ((res.data && res.data.items) || []).find(function (t) { return t.id === trxId; });
      }
      if (!trx) return;

      selectedTrxId = trx.id;
      if (verifyFeedback) verifyFeedback.hidden = true;
      if (verifyNoteInput) verifyNoteInput.value = trx.adminNote || '';
      if (verifyProofImg) verifyProofImg.src = UI.resolveAssetPath(trx.proofUrl);
      if (verifyDetailsBox) {
        verifyDetailsBox.innerHTML =
          '<p style="margin:0 0 0.35rem;"><strong>Kode:</strong> <span class="mono">' + UI.escapeHtml(trx.id) + '</span> ' + UI.renderStatusBadge(trx.status) + '</p>' +
          '<p style="margin:0 0 0.35rem;"><strong>Pemesan:</strong> ' + UI.escapeHtml(trx.buyerName) + ' (' + UI.escapeHtml(trx.buyerPhone) + ')</p>' +
          '<p style="margin:0;"><strong>Pesanan:</strong> ' + UI.escapeHtml(trx.eventTitle) + ' | ' + trx.qty + ' tiket | Total <strong class="mono">' + UI.escapeHtml(UI.formatRupiah(trx.totalAmount)) + '</strong></p>';
      }
      verifyModalCtrl.open(triggerBtn);
    }

    async function renderBandsTable() {
      if (!bandsTableBody) return;
      var filter = bandFilterSelect ? bandFilterSelect.value : 'ALL';
      var res = await API.bands.list(filter, bandsPage, ADMIN_PAGE_LIMIT);
      if (handleAuthLoss(res) || !res.ok) return;
      var list = (res.data && res.data.items) || [];
      lastBands = list.slice();
      UI.renderPagination(bandsPaginationEl, res.data && res.data.pagination, function (nextPage) {
        bandsPage = nextPage;
        renderBandsTable();
      });

      if (list.length === 0) {
        bandsTableBody.innerHTML = '<tr><td colspan="6">Belum ada pendaftaran band pada filter ini.</td></tr>';
        return;
      }

      bandsTableBody.innerHTML = list.map(function (b) {
        return (
          '<tr>' +
            '<td class="mono">' + UI.escapeHtml(b.id) + '</td>' +
            '<td><strong>' + UI.escapeHtml(b.bandName) + '</strong><br><span style="font-size:var(--text-xs); color:var(--color-ink-muted);">' + UI.escapeHtml(b.contact) + '</span></td>' +
            '<td>' + UI.escapeHtml(b.genre) + ' | ' + UI.escapeHtml(b.originCity) + '</td>' +
            '<td><a href="' + UI.escapeHtml(b.demoUrl) + '" target="_blank" rel="noopener noreferrer">Buka Demo Lagu</a></td>' +
            '<td>' + UI.renderStatusBadge(b.status) + '</td>' +
            '<td><button type="button" class="btn btn-lilac btn-sm" data-review-band="' + UI.escapeHtml(b.id) + '">Review Kurasi</button></td>' +
          '</tr>'
        );
      }).join('');

      var reviewBtns = bandsTableBody.querySelectorAll('[data-review-band]');
      for (var i = 0; i < reviewBtns.length; i += 1) {
        reviewBtns[i].addEventListener('click', function () {
          openCurateModal(this.getAttribute('data-review-band'), this);
        });
      }
    }

    async function openCurateModal(bandId, triggerBtn) {
      var band = lastBands.find(function (b) { return b.id === bandId; });
      if (!band) {
        var res = await API.bands.list('ALL', 1, 100);
        if (handleAuthLoss(res) || !res.ok) return;
        band = ((res.data && res.data.items) || []).find(function (b) { return b.id === bandId; });
      }
      if (!band) return;

      selectedBandId = band.id;
      if (curateFeedback) {
        curateFeedback.hidden = true;
        curateFeedback.textContent = '';
      }
      if (curateDetailsBox) {
        curateDetailsBox.innerHTML =
          '<p style="margin:0 0 0.4rem;"><strong>Band:</strong> ' + UI.escapeHtml(band.bandName) + ' ' + UI.renderStatusBadge(band.status) + '</p>' +
          '<p style="margin:0 0 0.4rem;"><strong>Genre / Kota:</strong> ' + UI.escapeHtml(band.genre) + ' / ' + UI.escapeHtml(band.originCity) + '</p>' +
          '<p style="margin:0 0 0.4rem;"><strong>Kontak:</strong> ' + UI.escapeHtml(band.contact) + '</p>' +
          '<p style="margin:0 0 0.4rem;"><strong>Demo Lagu:</strong> <a href="' + UI.escapeHtml(band.demoUrl) + '" target="_blank" rel="noopener noreferrer">' + UI.escapeHtml(band.demoUrl) + '</a></p>' +
          '<p style="margin:0; color:var(--color-ink-muted); font-size:var(--text-sm);">' + UI.escapeHtml(band.bio) + '</p>';
      }
      if (curatePublishCheck) curatePublishCheck.checked = true;
      if (curateSlotFields) curateSlotFields.hidden = false;
      curateModalCtrl.open(triggerBtn);
    }

    async function refreshAll() {
      await Promise.all([
        renderOverview(),
        renderEventsTable(),
        renderTransactionsTable(),
        renderBandsTable()
      ]);
    }

    for (var i = 0; i < navButtons.length; i += 1) {
      navButtons[i].addEventListener('click', function () {
        switchTab(this.getAttribute('data-admin-tab'));
      });
    }

    if (mobileToggle && sidebarEl) {
      mobileToggle.addEventListener('click', function () {
        var next = !sidebarEl.classList.contains('is-open');
        sidebarEl.classList.toggle('is-open', next);
        mobileToggle.setAttribute('aria-expanded', next ? 'true' : 'false');
      });
    }

    if (logoutBtn) {
      logoutBtn.addEventListener('click', async function () {
        await API.auth.logout();
        global.location.href = 'login.html';
      });
    }

    if (refreshBtn) {
      refreshBtn.addEventListener('click', function () {
        refreshAll();
        UI.announce('Data dashboard diperbarui.');
      });
    }

    if (addEventBtn) {
      addEventBtn.addEventListener('click', function () {
        openEventModal(null, this);
      });
    }

    if (topbarAddEventBtn) {
      topbarAddEventBtn.addEventListener('click', function () {
        switchTab('events');
        openEventModal(null, this);
      });
    }

    if (eventModalClose) {
      eventModalClose.addEventListener('click', eventModalCtrl.close);
    }

    if (eventForm) {
      eventForm.addEventListener('submit', async function (e) {
        e.preventDefault();
        UI.clearFieldErrors(eventForm);
        if (eventFormError) eventFormError.hidden = true;

        var fd = new FormData(eventForm);
        var id = String(fd.get('id') || '').trim();

        var res = id
          ? await API.events.update(id, fd)
          : await API.events.create(fd);

        if (handleAuthLoss(res)) return;
        if (!res.ok) {
          UI.applyFieldErrors(eventForm, res.errors);
          if (eventFormError) {
            eventFormError.textContent = res.message;
            eventFormError.hidden = false;
          }
          return;
        }

        eventModalCtrl.close();
        UI.announce(res.message);
        refreshAll();
      });
    }

    if (eventSearchInput) {
      eventSearchInput.addEventListener('input', function () {
        eventsPage = 1;
        renderEventsTable();
      });
    }
    if (eventStatusFilter) {
      eventStatusFilter.addEventListener('change', function () {
        eventsPage = 1;
        renderEventsTable();
      });
    }
    if (trxFilterSelect) trxFilterSelect.addEventListener('change', function () {
      trxPage = 1;
      renderTransactionsTable();
    });
    if (bandFilterSelect) bandFilterSelect.addEventListener('change', function () {
      bandsPage = 1;
      renderBandsTable();
    });
    if (verifyModalClose) verifyModalClose.addEventListener('click', verifyModalCtrl.close);
    if (curateModalClose) curateModalClose.addEventListener('click', curateModalCtrl.close);

    if (verifyApproveBtn) {
      verifyApproveBtn.addEventListener('click', async function () {
        if (!selectedTrxId) return;
        var res = await API.transactions.verify(selectedTrxId, 'paid', verifyNoteInput ? verifyNoteInput.value : '');
        if (handleAuthLoss(res)) return;
        if (!res.ok && verifyFeedback) {
          verifyFeedback.textContent = res.message;
          verifyFeedback.hidden = false;
          return;
        }
        verifyModalCtrl.close();
        UI.announce('Pembayaran diterima (paid).');
        refreshAll();
      });
    }

    if (verifyRejectBtn) {
      verifyRejectBtn.addEventListener('click', async function () {
        if (!selectedTrxId) return;
        var res = await API.transactions.verify(selectedTrxId, 'cancelled', verifyNoteInput ? verifyNoteInput.value : '');
        if (handleAuthLoss(res)) return;
        if (!res.ok && verifyFeedback) {
          verifyFeedback.textContent = res.message;
          verifyFeedback.hidden = false;
          return;
        }
        verifyModalCtrl.close();
        UI.announce('Pembayaran dibatalkan dan kuota dikembalikan.');
        refreshAll();
      });
    }

    if (curatePublishCheck && curateSlotFields) {
      curatePublishCheck.addEventListener('change', function () {
        curateSlotFields.hidden = !curatePublishCheck.checked;
      });
    }

    async function submitCurateDecision(decision, scheduleSlot, successMessage) {
      if (!selectedBandId) return;
      var res = await API.bands.curate(selectedBandId, decision, scheduleSlot);
      if (handleAuthLoss(res)) return;
      if (!res.ok) {
        if (curateFeedback) {
          curateFeedback.textContent = res.message || 'Gagal memperbarui status kurasi band.';
          curateFeedback.hidden = false;
        }
        return;
      }
      curateModalCtrl.close();
      UI.announce(successMessage);
      refreshAll();
    }

    if (curateReviewBtn) {
      curateReviewBtn.addEventListener('click', function () {
        submitCurateDecision('reviewed', null, 'Band ditandai sedang ditinjau (reviewed).');
      });
    }

    if (curateApproveBtn) {
      curateApproveBtn.addEventListener('click', function () {
        submitCurateDecision('accepted', {
          publishToSchedule: curatePublishCheck ? curatePublishCheck.checked : false,
          day: curateDaySelect ? curateDaySelect.value : 'Hari 1 (Jumat, 14 Agu)',
          stage: curateStageSelect ? curateStageSelect.value : 'Karang Acoustic Deck',
          timeRange: curateTimeInput ? curateTimeInput.value : '16:00 - 16:45 WITA'
        }, 'Band diterima ke lineup (accepted).');
      });
    }

    if (curateRejectBtn) {
      curateRejectBtn.addEventListener('click', function () {
        submitCurateDecision('rejected', null, 'Band ditolak pada tahap kurasi (rejected).');
      });
    }

    API.onSync(function () {
      refreshAll();
    });

    switchTab('overview');
    refreshAll();
  });
})(window);

