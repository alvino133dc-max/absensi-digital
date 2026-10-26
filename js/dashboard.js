/* ============================================================
   Logika halaman dashboard
   - Memeriksa sesi login sebelum menampilkan data
   - Membaca, menambah, mengubah, dan menghapus absensi
   - Memperbarui tabel secara real-time
   - Menampilkan validasi dan notifikasi
   ============================================================ */

(function () {
  "use strict";

  const db = window.db;
  const utils = window.AppUtils;

  const els = {
    pageLoader: document.getElementById("page-loader"),
    pageLoaderText: document.getElementById("page-loader-text"),
    app: document.getElementById("app"),

    userAvatar: document.getElementById("user-avatar"),
    userName: document.getElementById("user-name"),
    userEmail: document.getElementById("user-email"),
    logoutButton: document.getElementById("logout-button"),
    rolePill: document.getElementById("role-pill"),

    currentDate: document.getElementById("current-date"),
    liveIndicator: document.getElementById("live-indicator"),
    liveText: document.getElementById("live-text"),
    greeting: document.getElementById("greeting"),
    welcomeName: document.getElementById("welcome-name"),

    statTotal: document.getElementById("stat-total"),
    statHadir: document.getElementById("stat-hadir"),
    statIzin: document.getElementById("stat-izin"),
    statSakit: document.getElementById("stat-sakit"),
    navCount: document.getElementById("nav-count"),

    form: document.getElementById("attendance-form"),
    formTitle: document.getElementById("form-title"),
    formSubtitle: document.getElementById("form-subtitle"),
    editBanner: document.getElementById("edit-banner"),
    editBannerText: document.getElementById("edit-banner-text"),
    cancelEditBanner: document.getElementById("cancel-edit-banner"),
    formAlert: document.getElementById("form-alert"),
    formAlertText: document.getElementById("form-alert-text"),
    formAlertIcon: document.getElementById("form-alert-icon"),

    nama: document.getElementById("nama"),
    kelas: document.getElementById("kelas"),
    tanggal: document.getElementById("tanggal"),
    statusRadios: document.querySelectorAll('input[name="status"]'),

    submitButton: document.getElementById("submit-button"),
    submitLabel: document.getElementById("submit-label"),
    submitSpinner: document.getElementById("submit-spinner"),
    resetForm: document.getElementById("reset-form"),

    attendanceTable: document.getElementById("attendance-table"),
    tableBody: document.getElementById("attendance-table-body"),
    tableCount: document.getElementById("table-count"),
    tableSummary: document.getElementById("table-summary"),
    lastUpdated: document.getElementById("last-updated"),
    emptyState: document.getElementById("empty-state"),
    emptyIconUse: document.getElementById("empty-icon-use"),
    emptyTitle: document.getElementById("empty-title"),
    emptyText: document.getElementById("empty-text"),
    emptyAction: document.getElementById("empty-action"),

    searchInput: document.getElementById("search-input"),
    statusFilter: document.getElementById("status-filter"),
    refreshButton: document.getElementById("refresh-button"),

    deleteDialog: document.getElementById("delete-dialog"),
    deleteName: document.getElementById("delete-name"),
    cancelDelete: document.getElementById("cancel-delete"),
    confirmDelete: document.getElementById("confirm-delete"),
    deleteLabel: document.getElementById("delete-label"),
    deleteSpinner: document.getElementById("delete-spinner"),

    toastStack: document.getElementById("toast-stack")
  };

  // Tampilkan pesan yang jelas jika library Supabase gagal dimuat.
  if (!db || !utils) {
    els.pageLoaderText.textContent =
      "Library Supabase gagal dimuat. Periksa koneksi internet lalu muat ulang halaman.";
    const loaderSpinner = document.querySelector("#page-loader .spinner");
    if (loaderSpinner) loaderSpinner.hidden = true;
    return;
  }

  const {
    escapeHtml,
    formatTanggal,
    formatWaktu,
    formatWaktuSingkat,
    todayISO,
    getInitials,
    getDisplayName,
    formatNumber
  } = utils;

  const state = {
    user: null,
    isAdmin: false,
    data: [],
    editingId: null,
    pendingDeleteId: null,
    isLoading: false,
    initialLoadDone: false,
    isSubmitting: false,
    loggingOut: false,
    redirecting: false,
    filters: {
      search: "",
      status: "all"
    }
  };

  let authSubscription = null;
  let realtimeChannel = null;
  let reloadTimer = null;

  // ============================================================
  // Inisialisasi halaman
  // ============================================================
  init().catch(function (error) {
    console.error("Gagal menginisialisasi dashboard:", error);
    els.pageLoaderText.textContent =
      "Terjadi kesalahan saat memuat dashboard. Muat ulang halaman.";
  });

  async function init() {
    setCurrentDate();

    const user = await requireAuth();
    if (!user) return;

    state.user = user;
    state.isAdmin = Boolean(
      user.app_metadata && user.app_metadata.role === "admin"
    );
    hydrateUser(user);

    els.tanggal.value = todayISO();
    bindEvents();
    showApp();
    watchAuthChanges();

    await loadData({ initial: true });
    subscribeRealtime();
  }

  async function requireAuth() {
    const sessionResult = await db.auth.getSession();
    const session = sessionResult.data && sessionResult.data.session;

    if (sessionResult.error || !session) {
      redirectToLogin("auth");
      return null;
    }

    // getUser() memvalidasi token ke server, bukan hanya membaca localStorage.
    const userResult = await db.auth.getUser();
    if (userResult.error || !userResult.data.user) {
      redirectToLogin("auth");
      return null;
    }

    return userResult.data.user;
  }

  function redirectToLogin(reason) {
    if (state.redirecting) return;
    state.redirecting = true;

    const target = new URL("index.html", window.location.href);
    if (reason) target.searchParams.set("reason", reason);
    window.location.replace(target.href);
  }

  function hydrateUser(user) {
    const displayName = getDisplayName(user);

    els.userName.textContent = displayName;
    els.userEmail.textContent = user.email || "Tidak ada email";
    els.userAvatar.textContent = getInitials(displayName);
    els.welcomeName.textContent = displayName;
    els.greeting.textContent = getGreetingText();
    els.rolePill.hidden = !state.isAdmin;
  }

  function getGreetingText() {
    const hour = new Date().getHours();

    if (hour < 11) return "Selamat pagi";
    if (hour < 15) return "Selamat siang";
    if (hour < 18) return "Selamat sore";
    return "Selamat malam";
  }

  function setCurrentDate() {
    const text = new Intl.DateTimeFormat("id-ID", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric"
    }).format(new Date());

    els.currentDate.textContent = text.charAt(0).toUpperCase() + text.slice(1);
  }

  function showApp() {
    els.pageLoader.hidden = true;
    els.app.hidden = false;
  }

  function watchAuthChanges() {
    const result = db.auth.onAuthStateChange(function (event) {
      if (event === "SIGNED_OUT") {
        redirectToLogin("logged_out");
      }
    });

    authSubscription = result.data.subscription;
  }

  // ============================================================
  // Event listener
  // ============================================================
  function bindEvents() {
    els.form.addEventListener("submit", handleSubmit);
    els.resetForm.addEventListener("click", function () {
      resetForm(true);
    });
    els.cancelEditBanner.addEventListener("click", cancelEdit);

    els.tableBody.addEventListener("click", handleTableClick);
    els.emptyAction.addEventListener("click", handleEmptyAction);

    els.searchInput.addEventListener("input", function () {
      state.filters.search = els.searchInput.value;
      renderTable();
    });

    els.statusFilter.addEventListener("change", function () {
      state.filters.status = els.statusFilter.value;
      renderTable();
    });

    els.refreshButton.addEventListener("click", function () {
      loadData({ silent: false });
    });

    els.logoutButton.addEventListener("click", handleLogout);

    els.cancelDelete.addEventListener("click", closeDeleteDialog);
    els.confirmDelete.addEventListener("click", handleConfirmDelete);
    els.deleteDialog.addEventListener("click", function (event) {
      if (event.target === els.deleteDialog) closeDeleteDialog();
    });
    els.deleteDialog.addEventListener("close", function () {
      document.body.classList.remove("modal-open");
      state.pendingDeleteId = null;
      setDeleteLoading(false);
    });

    // Membersihkan pesan error saat pengguna memperbaiki input.
    els.nama.addEventListener("input", function () {
      clearFieldError("nama");
      hideFormAlert();
    });
    els.kelas.addEventListener("input", function () {
      clearFieldError("kelas");
      hideFormAlert();
    });
    els.tanggal.addEventListener("input", function () {
      clearFieldError("tanggal");
      hideFormAlert();
    });
    els.statusRadios.forEach(function (radio) {
      radio.addEventListener("change", function () {
        clearFieldError("status");
        hideFormAlert();
      });
    });

    // Segarkan data saat tab kembali aktif atau koneksi kembali online.
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden && state.user && !state.isLoading) {
        loadData({ silent: true });
      }
    });

    window.addEventListener("online", function () {
      loadData({ silent: true });
    });

    window.addEventListener("offline", function () {
      setLiveStatus("offline");
    });

    window.addEventListener("beforeunload", cleanup);
  }

  // ============================================================
  // Membaca data dari Supabase
  // ============================================================
  async function loadData(options) {
    const settings = options || {};
    const initial = Boolean(settings.initial);
    const silent = Boolean(settings.silent);

    if (state.isLoading) {
      scheduleReload(250);
      return;
    }

    state.isLoading = true;
    if (!silent) els.refreshButton.classList.add("is-loading");
    if (initial) renderSkeleton();

    try {
      const result = await db
        .from("absensi")
        .select("*")
        .order("tanggal", { ascending: false })
        .order("createdAt", { ascending: false })
        .limit(1000);

      if (result.error) throw result.error;

      state.data = result.data || [];
      state.initialLoadDone = true;

      // Jika data yang sedang diedit sudah dihapus dari tab lain,
      // kembalikan formulir ke mode tambah.
      if (
        state.editingId &&
        !state.data.some(function (row) {
          return row.id === state.editingId;
        })
      ) {
        resetForm(false);
        showToast("info", "Data yang sedang diedit sudah tidak tersedia.");
      }

      renderStats();
      renderTable();
      els.lastUpdated.textContent = `Diperbarui ${formatWaktu(new Date())}`;
    } catch (error) {
      console.error("Gagal memuat data absensi:", error);
      els.lastUpdated.textContent = "Gagal memuat data";

      if (!state.initialLoadDone || state.data.length === 0) {
        els.tableBody.innerHTML = "";
        renderEmptyState("error");
      }

      showToast("error", "Gagal memuat data absensi. Periksa koneksi internet.");
    } finally {
      state.isLoading = false;
      els.refreshButton.classList.remove("is-loading");
    }
  }

  function renderSkeleton() {
    els.attendanceTable.hidden = false;
    els.emptyState.hidden = true;
    els.tableCount.textContent = "0";
    els.tableSummary.textContent = "Memuat data...";
    els.lastUpdated.textContent = "Memuat data...";

    els.tableBody.innerHTML = Array.from({ length: 5 })
      .map(function () {
        return `
          <tr class="skeleton-row">
            <td><div class="skeleton w-60"></div></td>
            <td><div class="skeleton w-40"></div></td>
            <td><div class="skeleton w-40"></div></td>
            <td><div class="skeleton w-30"></div></td>
            <td><div class="skeleton w-20" style="margin-left:auto"></div></td>
          </tr>
        `;
      })
      .join("");
  }

  function renderStats() {
    const counts = {
      Hadir: 0,
      Izin: 0,
      Sakit: 0
    };

    state.data.forEach(function (row) {
      if (Object.prototype.hasOwnProperty.call(counts, row.status)) {
        counts[row.status] += 1;
      }
    });

    els.statTotal.textContent = formatNumber(state.data.length);
    els.statHadir.textContent = formatNumber(counts.Hadir);
    els.statIzin.textContent = formatNumber(counts.Izin);
    els.statSakit.textContent = formatNumber(counts.Sakit);
    els.navCount.textContent = formatNumber(state.data.length);
  }

  function getFilteredData() {
    const query = state.filters.search.trim().toLowerCase();
    const status = state.filters.status;

    return state.data.filter(function (row) {
      const matchesSearch =
        !query ||
        String(row.nama || "").toLowerCase().includes(query) ||
        String(row.kelas || "").toLowerCase().includes(query);

      const matchesStatus = status === "all" || row.status === status;
      return matchesSearch && matchesStatus;
    });
  }

  function renderTable() {
    const rows = getFilteredData();

    els.tableCount.textContent = formatNumber(rows.length);
    els.tableSummary.textContent = `Menampilkan ${formatNumber(rows.length)} dari ${formatNumber(
      state.data.length
    )} data`;

    if (rows.length === 0) {
      renderEmptyState(state.data.length === 0 ? "empty" : "filtered");
      return;
    }

    els.attendanceTable.hidden = false;
    els.emptyState.hidden = true;

    els.tableBody.innerHTML = rows
      .map(function (row) {
        const isOwner = row.uid === state.user.id;
        const canManage = isOwner || state.isAdmin;
        const statusClass =
          row.status === "Hadir"
            ? "status-hadir"
            : row.status === "Izin"
              ? "status-izin"
              : "status-sakit";

        return `
          <tr>
            <td>
              <div class="student-cell">
                <span class="student-avatar" aria-hidden="true">${escapeHtml(
                  getInitials(row.nama)
                )}</span>
                <span class="student-name">
                  <strong>${escapeHtml(row.nama)}</strong>
                  ${isOwner ? '<span class="you-badge">Anda</span>' : ""}
                </span>
              </div>
            </td>
            <td><span class="kelas-text">${escapeHtml(row.kelas)}</span></td>
            <td>
              <span class="date-text">
                <time datetime="${escapeHtml(row.tanggal)}">${escapeHtml(
                  formatTanggal(row.tanggal)
                )}</time>
                <small>Dicatat ${escapeHtml(formatWaktuSingkat(row.createdAt))}</small>
              </span>
            </td>
            <td>
              <span class="status-badge ${statusClass}">${escapeHtml(row.status)}</span>
            </td>
            <td>
              <div class="row-actions">
                ${
                  canManage
                    ? `
                      <button
                        type="button"
                        class="icon-button icon-button-sm"
                        data-action="edit"
                        data-id="${escapeHtml(row.id)}"
                        title="Ubah absensi"
                        aria-label="Ubah absensi ${escapeHtml(row.nama)}"
                      >
                        <svg class="icon" aria-hidden="true"><use href="#icon-edit"></use></svg>
                      </button>
                      <button
                        type="button"
                        class="icon-button icon-button-sm is-danger"
                        data-action="delete"
                        data-id="${escapeHtml(row.id)}"
                        title="Hapus absensi"
                        aria-label="Hapus absensi ${escapeHtml(row.nama)}"
                      >
                        <svg class="icon" aria-hidden="true"><use href="#icon-trash"></use></svg>
                      </button>
                    `
                    : `
                      <span
                        class="locked-action"
                        title="Hanya pembuat data yang dapat mengubah atau menghapus"
                        aria-label="Tidak dapat diubah"
                      >
                        <svg class="icon" aria-hidden="true"><use href="#icon-lock"></use></svg>
                      </span>
                    `
                }
              </div>
            </td>
          </tr>
        `;
      })
      .join("");
  }

  function renderEmptyState(mode) {
    const isError = mode === "error";
    const isFiltered = mode === "filtered";

    els.attendanceTable.hidden = true;
    els.emptyState.hidden = false;

    els.emptyIconUse.setAttribute(
      "href",
      isError ? "#icon-alert-circle" : isFiltered ? "#icon-search" : "#icon-clipboard-check"
    );

    els.emptyTitle.textContent = isError
      ? "Gagal memuat data"
      : isFiltered
        ? "Data tidak ditemukan"
        : "Belum ada data absensi";

    els.emptyText.textContent = isError
      ? "Periksa koneksi internet, lalu coba muat ulang data."
      : isFiltered
        ? "Coba ubah kata kunci pencarian atau filter status kehadiran."
        : "Data akan muncul di sini setelah absensi pertama berhasil disimpan.";

    els.emptyAction.hidden = !(isError || isFiltered);
    els.emptyAction.textContent = isError ? "Coba lagi" : "Reset filter";
    els.emptyAction.dataset.mode = mode;
  }

  function handleEmptyAction() {
    if (els.emptyAction.dataset.mode === "error") {
      loadData({ initial: !state.initialLoadDone });
      return;
    }

    clearFilters();
  }

  function clearFilters() {
    state.filters.search = "";
    state.filters.status = "all";
    els.searchInput.value = "";
    els.statusFilter.value = "all";
    renderTable();
  }

  // ============================================================
  // Validasi dan penyimpanan absensi
  // ============================================================
  async function handleSubmit(event) {
    event.preventDefault();

    if (state.isSubmitting) return;

    const payload = validateForm();
    if (!payload) return;

    hideFormAlert();
    setSubmitting(true);

    try {
      const duplicate = await findDuplicate(payload, state.editingId);

      if (duplicate) {
        const message = `Absensi ${payload.nama} di kelas ${payload.kelas} pada ${formatTanggal(
          payload.tanggal
        )} sudah tercatat.`;
        showFormAlert("error", message);
        setFieldError("nama", "Siswa ini sudah memiliki absensi pada tanggal tersebut.");
        els.nama.focus();
        return;
      }

      if (state.editingId) {
        await updateAttendance(state.editingId, payload);
        showToast("success", "Perubahan absensi berhasil disimpan.");
      } else {
        await createAttendance(payload);
        showToast("success", `Absensi ${payload.nama} berhasil disimpan.`);
      }

      resetForm(true);
      await loadData({ silent: true });
    } catch (error) {
      console.error("Gagal menyimpan absensi:", error);
      handleSaveError(error, payload);
    } finally {
      setSubmitting(false);
    }
  }

  function validateForm() {
    clearAllErrors();
    hideFormAlert();

    const nama = els.nama.value.trim().replace(/\s+/g, " ");
    const kelas = els.kelas.value.trim().replace(/\s+/g, " ");
    const tanggal = els.tanggal.value;
    const status = getSelectedStatus();

    let firstInvalid = null;

    if (!nama) {
      setFieldError("nama", "Nama siswa wajib diisi.");
      firstInvalid = firstInvalid || els.nama;
    } else if (nama.length > 100) {
      setFieldError("nama", "Nama siswa maksimal 100 karakter.");
      firstInvalid = firstInvalid || els.nama;
    }

    if (!kelas) {
      setFieldError("kelas", "Kelas wajib diisi.");
      firstInvalid = firstInvalid || els.kelas;
    } else if (kelas.length > 50) {
      setFieldError("kelas", "Kelas maksimal 50 karakter.");
      firstInvalid = firstInvalid || els.kelas;
    }

    if (!tanggal) {
      setFieldError("tanggal", "Tanggal absensi wajib dipilih.");
      firstInvalid = firstInvalid || els.tanggal;
    } else if (Number.isNaN(new Date(`${tanggal}T00:00:00`).getTime())) {
      setFieldError("tanggal", "Format tanggal tidak valid.");
      firstInvalid = firstInvalid || els.tanggal;
    }

    if (!status) {
      setFieldError("status", "Pilih status kehadiran.");
      firstInvalid = firstInvalid || els.statusRadios[0];
    }

    if (firstInvalid) {
      firstInvalid.focus();
      return null;
    }

    return {
      nama: nama,
      kelas: kelas,
      tanggal: tanggal,
      status: status
    };
  }

  function getSelectedStatus() {
    const selected = document.querySelector('input[name="status"]:checked');
    return selected ? selected.value : "";
  }

  function findDuplicate(payload, ignoreId) {
    return db
      .from("absensi")
      .select("id, nama, kelas")
      .eq("tanggal", payload.tanggal)
      .then(function (result) {
        if (result.error) throw result.error;

        const normalize = function (value) {
          return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
        };

        return (result.data || []).find(function (row) {
          return (
            row.id !== ignoreId &&
            normalize(row.nama) === normalize(payload.nama) &&
            normalize(row.kelas) === normalize(payload.kelas)
          );
        }) || null;
      })
      .catch(function (error) {
        // Jika pengecekan awal gagal, tetap lanjutkan penyimpanan.
        // Database memiliki unique index sebagai pengaman terakhir.
        console.warn("Pemeriksaan duplikat gagal, mengandalkan unique index:", error);
        return null;
      });
  }

  async function createAttendance(payload) {
    const result = await db
      .from("absensi")
      .insert({
        nama: payload.nama,
        kelas: payload.kelas,
        tanggal: payload.tanggal,
        status: payload.status
      })
      .select("id")
      .single();

    if (result.error) throw result.error;
    return result.data;
  }

  async function updateAttendance(id, payload) {
    const result = await db
      .from("absensi")
      .update({
        nama: payload.nama,
        kelas: payload.kelas,
        tanggal: payload.tanggal,
        status: payload.status
      })
      .eq("id", id)
      .select("id")
      .single();

    if (result.error) throw result.error;
    return result.data;
  }

  function handleSaveError(error, payload) {
    const code = error && error.code ? error.code : "";
    const status = error && error.status ? error.status : 0;
    const message = String(error && error.message ? error.message : "");

    if (code === "23505" || message.toLowerCase().includes("duplicate key")) {
      showFormAlert(
        "error",
        `Absensi ${payload.nama} di kelas ${payload.kelas} pada ${formatTanggal(
          payload.tanggal
        )} sudah tercatat.`
      );
      setFieldError("nama", "Siswa ini sudah memiliki absensi pada tanggal tersebut.");
      return;
    }

    if (code === "42501" || status === 403) {
      showFormAlert(
        "error",
        "Kamu tidak memiliki izin untuk mengubah data ini. Data hanya dapat diubah oleh pembuatnya."
      );
      return;
    }

    if (code === "PGRST116") {
      showFormAlert(
        "error",
        "Data tidak ditemukan. Kemungkinan data sudah dihapus. Formulir akan dimuat ulang."
      );
      resetForm(false);
      scheduleReload(300);
      return;
    }

    if (code === "23514") {
      showFormAlert("error", "Data absensi belum valid. Periksa kembali nama, kelas, tanggal, dan status.");
      return;
    }

    if (status === 401) {
      showFormAlert("error", "Sesi login berakhir. Silakan masuk kembali.");
      window.setTimeout(function () {
        redirectToLogin("expired");
      }, 1500);
      return;
    }

    if (isNetworkError(error)) {
      showFormAlert(
        "error",
        "Tidak dapat terhubung ke server. Periksa koneksi internet lalu coba lagi."
      );
      return;
    }

    showFormAlert("error", "Absensi gagal disimpan. Silakan coba lagi.");
  }

  function isNetworkError(error) {
    return (
      error instanceof TypeError ||
      /failed to fetch|networkerror|load failed/i.test(
        String(error && error.message ? error.message : "")
      )
    );
  }

  function setSubmitting(isSubmitting) {
    state.isSubmitting = isSubmitting;

    els.submitButton.disabled = isSubmitting;
    els.submitSpinner.hidden = !isSubmitting;
    els.submitLabel.textContent = isSubmitting
      ? state.editingId
        ? "Menyimpan perubahan..."
        : "Menyimpan..."
      : state.editingId
        ? "Simpan Perubahan"
        : "Simpan Absensi";
    els.form.setAttribute("aria-busy", String(isSubmitting));
  }

  function resetForm(focusNama) {
    state.editingId = null;
    els.form.reset();
    els.tanggal.value = todayISO();

    clearAllErrors();
    hideFormAlert();

    els.formTitle.textContent = "Catat Absensi";
    els.formSubtitle.textContent = "Lengkapi data kehadiran siswa di bawah ini.";
    els.editBanner.hidden = true;
    els.editBannerText.textContent = "";
    els.form.classList.remove("is-editing");
    els.submitLabel.textContent = "Simpan Absensi";

    if (focusNama) els.nama.focus();
  }

  function setFieldError(fieldName, message) {
    const field = document.getElementById(`field-${fieldName}`);
    const error = document.getElementById(`${fieldName}-error`);

    if (field) field.classList.add("has-error");
    if (error) error.textContent = message;

    if (fieldName === "status") {
      els.statusRadios.forEach(function (radio) {
        radio.setAttribute("aria-invalid", "true");
      });
    } else {
      const input = document.getElementById(fieldName);
      if (input) input.setAttribute("aria-invalid", "true");
    }
  }

  function clearFieldError(fieldName) {
    const field = document.getElementById(`field-${fieldName}`);
    const error = document.getElementById(`${fieldName}-error`);

    if (field) field.classList.remove("has-error");
    if (error) error.textContent = "";

    if (fieldName === "status") {
      els.statusRadios.forEach(function (radio) {
        radio.removeAttribute("aria-invalid");
      });
    } else {
      const input = document.getElementById(fieldName);
      if (input) input.removeAttribute("aria-invalid");
    }
  }

  function clearAllErrors() {
    ["nama", "kelas", "tanggal", "status"].forEach(clearFieldError);
  }

  function showFormAlert(type, message) {
    els.formAlert.hidden = false;
    els.formAlert.className = `alert alert-${type}`;
    els.formAlertText.textContent = message;
    els.formAlertIcon.setAttribute(
      "href",
      type === "info" ? "#icon-info" : "#icon-alert-circle"
    );
  }

  function hideFormAlert() {
    els.formAlert.hidden = true;
    els.formAlertText.textContent = "";
  }

  // ============================================================
  // Edit dan hapus data
  // ============================================================
  function startEdit(id) {
    if (state.isSubmitting) return;

    const row = state.data.find(function (item) {
      return item.id === id;
    });

    if (!row) {
      showToast("error", "Data tidak ditemukan. Memuat ulang data...");
      scheduleReload(200);
      return;
    }

    if (row.uid !== state.user.id && !state.isAdmin) {
      showToast("error", "Kamu hanya dapat mengubah absensi milikmu sendiri.");
      return;
    }

    state.editingId = id;
    els.nama.value = row.nama;
    els.kelas.value = row.kelas;
    els.tanggal.value = row.tanggal;

    const radio = document.querySelector(
      `input[name="status"][value="${row.status}"]`
    );
    if (radio) radio.checked = true;

    clearAllErrors();
    hideFormAlert();

    els.formTitle.textContent = "Ubah Absensi";
    els.formSubtitle.textContent = "Perbarui data absensi yang dipilih.";
    els.editBannerText.textContent = `Mengubah absensi ${row.nama} (${row.kelas}).`;
    els.editBanner.hidden = false;
    els.submitLabel.textContent = "Simpan Perubahan";
    els.form.classList.add("is-editing");

    els.form.scrollIntoView({ behavior: "smooth", block: "center" });
    els.nama.focus({ preventScroll: true });
  }

  function cancelEdit() {
    if (!state.editingId) return;
    resetForm(false);
    showToast("info", "Perubahan dibatalkan.");
  }

  function handleTableClick(event) {
    const button = event.target.closest("button[data-action]");
    if (!button) return;

    const id = button.dataset.id;
    if (button.dataset.action === "edit") {
      startEdit(id);
    } else if (button.dataset.action === "delete") {
      openDeleteDialog(id);
    }
  }

  function openDeleteDialog(id) {
    if (state.isSubmitting) return;

    const row = state.data.find(function (item) {
      return item.id === id;
    });

    if (!row) {
      showToast("error", "Data tidak ditemukan. Memuat ulang data...");
      scheduleReload(200);
      return;
    }

    if (row.uid !== state.user.id && !state.isAdmin) {
      showToast("error", "Kamu hanya dapat menghapus absensi milikmu sendiri.");
      return;
    }

    state.pendingDeleteId = id;
    els.deleteName.textContent = `${row.nama} (${row.kelas})`;
    els.deleteLabel.textContent = "Hapus";
    els.deleteSpinner.hidden = true;
    els.confirmDelete.disabled = false;

    document.body.classList.add("modal-open");
    if (!els.deleteDialog.open) els.deleteDialog.showModal();
    els.cancelDelete.focus();
  }

  function closeDeleteDialog() {
    if (els.deleteDialog.open) els.deleteDialog.close();
    document.body.classList.remove("modal-open");
    state.pendingDeleteId = null;
  }

  async function handleConfirmDelete() {
    const id = state.pendingDeleteId;
    if (!id) return;

    setDeleteLoading(true);

    try {
      const result = await db
        .from("absensi")
        .delete()
        .eq("id", id)
        .select("id");

      if (result.error) throw result.error;
      if (!result.data || result.data.length === 0) {
        throw new Error("NOT_FOUND");
      }

      if (state.editingId === id) resetForm(false);

      closeDeleteDialog();
      showToast("success", "Data absensi berhasil dihapus.");
      await loadData({ silent: true });
    } catch (error) {
      console.error("Gagal menghapus absensi:", error);
      closeDeleteDialog();

      if (error.message === "NOT_FOUND") {
        showToast("error", "Data tidak ditemukan atau bukan milikmu.");
      } else if (error.code === "42501") {
        showToast("error", "Kamu tidak memiliki izin untuk menghapus data ini.");
      } else {
        showToast("error", "Gagal menghapus data. Silakan coba lagi.");
      }
    } finally {
      setDeleteLoading(false);
    }
  }

  function setDeleteLoading(isLoading) {
    els.confirmDelete.disabled = isLoading;
    els.deleteSpinner.hidden = !isLoading;
    els.deleteLabel.textContent = isLoading ? "Menghapus..." : "Hapus";
  }

  // ============================================================
  // Realtime dan logout
  // ============================================================
  function subscribeRealtime() {
    if (realtimeChannel) {
      db.removeChannel(realtimeChannel);
      realtimeChannel = null;
    }

    setLiveStatus("connecting");

    realtimeChannel = db
      .channel("absensi-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "absensi"
        },
        function (payload) {
          console.debug("Perubahan absensi real-time:", payload);
          scheduleReload();
        }
      )
      .subscribe(function (status) {
        if (status === "SUBSCRIBED") {
          setLiveStatus("live");
        } else if (
          status === "CHANNEL_ERROR" ||
          status === "TIMED_OUT" ||
          status === "CLOSED"
        ) {
          setLiveStatus("offline");
        } else {
          setLiveStatus("connecting");
        }
      });
  }

  function setLiveStatus(status) {
    els.liveIndicator.classList.remove("is-connecting", "is-offline");

    if (status === "live") {
      els.liveText.textContent = "Live";
      els.liveIndicator.title = "Data diperbarui secara real-time";
    } else if (status === "offline") {
      els.liveIndicator.classList.add("is-offline");
      els.liveText.textContent = "Offline";
      els.liveIndicator.title =
        "Koneksi real-time terputus. Klik tombol muat ulang untuk memperbarui data.";
    } else {
      els.liveIndicator.classList.add("is-connecting");
      els.liveText.textContent = "Menghubungkan...";
      els.liveIndicator.title = "Menghubungkan ke layanan real-time...";
    }
  }

  function scheduleReload(delay) {
    window.clearTimeout(reloadTimer);
    reloadTimer = window.setTimeout(function () {
      loadData({ silent: true });
    }, typeof delay === "number" ? delay : 350);
  }

  async function handleLogout() {
    if (state.loggingOut) return;

    state.loggingOut = true;
    els.logoutButton.disabled = true;
    els.logoutButton.classList.add("is-loading");

    try {
      const result = await db.auth.signOut();
      if (result.error) throw result.error;
      redirectToLogin("logged_out");
    } catch (error) {
      console.error("Gagal logout:", error);
      showToast("error", "Gagal keluar. Periksa koneksi internet lalu coba lagi.");
      state.loggingOut = false;
      els.logoutButton.disabled = false;
      els.logoutButton.classList.remove("is-loading");
    }
  }

  // ============================================================
  // Notifikasi toast
  // ============================================================
  function showToast(type, message) {
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.setAttribute("role", type === "error" ? "alert" : "status");

    const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    icon.setAttribute("class", "icon");
    icon.setAttribute("aria-hidden", "true");

    const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
    use.setAttribute(
      "href",
      type === "success"
        ? "#icon-check-circle"
        : type === "error"
          ? "#icon-alert-circle"
          : "#icon-info"
    );
    icon.appendChild(use);

    const text = document.createElement("span");
    text.className = "toast-message";
    text.textContent = message;

    const close = document.createElement("button");
    close.type = "button";
    close.className = "toast-close";
    close.setAttribute("aria-label", "Tutup notifikasi");
    close.innerHTML = '<svg class="icon" aria-hidden="true"><use href="#icon-x"></use></svg>';
    close.addEventListener("click", function () {
      removeToast(toast);
    });

    toast.appendChild(icon);
    toast.appendChild(text);
    toast.appendChild(close);
    els.toastStack.appendChild(toast);

    window.setTimeout(function () {
      removeToast(toast);
    }, 4500);
  }

  function removeToast(toast) {
    if (!toast.isConnected) return;
    toast.classList.add("is-leaving");
    window.setTimeout(function () {
      toast.remove();
    }, 200);
  }

  function cleanup() {
    window.clearTimeout(reloadTimer);

    if (realtimeChannel) {
      db.removeChannel(realtimeChannel);
      realtimeChannel = null;
    }

    if (authSubscription) {
      authSubscription.unsubscribe();
      authSubscription = null;
    }
  }
})();
