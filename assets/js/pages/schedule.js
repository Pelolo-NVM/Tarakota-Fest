(function (global) {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    var UI = global.TarakotaUI;
    var API = global.TarakotaAPI;
    UI.mountPublicChrome('jadwal');

    var daySelect = document.getElementById('filter-day');
    var stageSelect = document.getElementById('filter-stage');
    var genreSelect = document.getElementById('filter-genre');
    var searchInput = document.getElementById('filter-search');
    var resetBtn = document.getElementById('filter-reset-btn');
    var container = document.getElementById('schedule-grid-container');
    var countEl = document.getElementById('schedule-result-count');

    var filters = { day: 'ALL', stage: 'ALL', genre: 'ALL', search: '' };
    var currentPage = 1;
    var PAGE_LIMIT = 12;
    var optionsLoaded = false;

    function populateSelect(selectEl, values, defaultLabel) {
      if (!selectEl) return;
      var current = selectEl.value || 'ALL';
      var html = '<option value="ALL">' + UI.escapeHtml(defaultLabel) + '</option>';
      values.forEach(function (val) {
        html += '<option value="' + UI.escapeHtml(val) + '">' + UI.escapeHtml(val) + '</option>';
      });
      selectEl.innerHTML = html;
      if (values.indexOf(current) !== -1 || current === 'ALL') {
        selectEl.value = current;
      }
    }

    async function renderSchedule() {
      if (!container) return;
      container.innerHTML =
        '<div class="state-panel" role="status">' +
          '<h3>Memuat jadwal manggung...</h3>' +
          '<p>Mengambil daftar penampil terbaru dari server database.</p>' +
        '</div>';

      var res = await API.schedule.list(filters, currentPage, PAGE_LIMIT);
      if (!res.ok) {
        container.innerHTML =
          '<div class="state-panel" role="alert">' +
            '<h3>Gagal memuat jadwal</h3>' +
            '<p>' + UI.escapeHtml(res.message || 'Terjadi gangguan saat membaca data jadwal.') + '</p>' +
            '<button type="button" class="btn btn-primary" id="retry-schedule-btn">Coba Muat Ulang</button>' +
          '</div>';
        var retryBtn = document.getElementById('retry-schedule-btn');
        if (retryBtn) retryBtn.addEventListener('click', renderSchedule);
        return;
      }

      if (!optionsLoaded && res.data && res.data.options) {
        populateSelect(daySelect, res.data.options.days, 'Semua Hari');
        populateSelect(stageSelect, res.data.options.stages, 'Semua Stage');
        populateSelect(genreSelect, res.data.options.genres, 'Semua Genre');
        optionsLoaded = true;
      }

      var items = (res.data && res.data.items) || [];
      var pagination = (res.data && res.data.pagination) || { page: 1, totalPages: 1, total: items.length };
      if (countEl) {
        countEl.textContent = pagination.total + ' penampil ditemukan';
      }

      if (items.length === 0) {
        container.innerHTML =
          '<div class="state-panel">' +
            '<h3>Tidak ada jadwal yang cocok</h3>' +
            '<p>Kombinasi filter hari, stage, genre, atau pencarian belum memiliki penampil. Ubah filter atau tampilkan semua jadwal.</p>' +
            '<button type="button" class="btn btn-primary" id="empty-reset-filter">Reset Semua Filter</button>' +
          '</div>';
        var emptyReset = document.getElementById('empty-reset-filter');
        if (emptyReset) emptyReset.addEventListener('click', resetFilters);
        return;
      }

      container.innerHTML =
        '<div class="schedule-grid">' + items.map(function (slot) {
          return (
            '<article class="schedule-card">' +
              '<div>' +
                '<div class="schedule-card-top">' +
                  '<span class="status-badge status-badge--lilac">' + UI.escapeHtml(slot.genre) + '</span>' +
                  '<span class="schedule-time">' + UI.escapeHtml(slot.timeRange) + '</span>' +
                '</div>' +
                '<h3 style="margin-top:0.75rem; margin-bottom:0.35rem;">' + UI.escapeHtml(slot.artistName) + '</h3>' +
                '<p style="margin:0; color:var(--color-ink-muted); font-size:var(--text-sm);">Asal: ' + UI.escapeHtml(slot.originCity) + '</p>' +
              '</div>' +
              '<div class="ticket-meta-row">' +
                '<span class="status-badge status-badge--mint">' + UI.escapeHtml(slot.stage) + '</span>' +
                '<span class="mono" style="font-size:var(--text-xs); font-weight:700;">' + UI.escapeHtml(slot.day) + '</span>' +
              '</div>' +
            '</article>'
          );
        }).join('') + '</div>' +
        '<div class="pagination-bar" id="schedule-pagination" hidden></div>';

      UI.renderPagination(document.getElementById('schedule-pagination'), pagination, function (nextPage) {
        currentPage = nextPage;
        renderSchedule();
      });
    }

    function resetFilters() {
      filters = { day: 'ALL', stage: 'ALL', genre: 'ALL', search: '' };
      currentPage = 1;
      if (daySelect) daySelect.value = 'ALL';
      if (stageSelect) stageSelect.value = 'ALL';
      if (genreSelect) genreSelect.value = 'ALL';
      if (searchInput) searchInput.value = '';
      renderSchedule();
    }

    if (daySelect) {
      daySelect.addEventListener('change', function () {
        filters.day = daySelect.value;
        currentPage = 1;
        renderSchedule();
      });
    }
    if (stageSelect) {
      stageSelect.addEventListener('change', function () {
        filters.stage = stageSelect.value;
        currentPage = 1;
        renderSchedule();
      });
    }
    if (genreSelect) {
      genreSelect.addEventListener('change', function () {
        filters.genre = genreSelect.value;
        currentPage = 1;
        renderSchedule();
      });
    }
    if (searchInput) {
      searchInput.addEventListener('input', function () {
        filters.search = searchInput.value;
        currentPage = 1;
        renderSchedule();
      });
    }
    if (resetBtn) {
      resetBtn.addEventListener('click', resetFilters);
    }

    API.onSync(function (topic) {
      if (topic === 'bands') {
        optionsLoaded = false;
        renderSchedule();
      }
    });

    renderSchedule();
  });
})(window);

