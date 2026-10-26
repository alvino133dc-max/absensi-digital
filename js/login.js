/* ============================================================
   Logika halaman login
   - Login memakai Supabase Authentication
   - Menampilkan pesan jika login gagal
   - Mengarahkan pengguna ke dashboard jika berhasil
   ============================================================ */

(function () {
  "use strict";

  const db = window.db;

  const form = document.getElementById("login-form");
  const emailInput = document.getElementById("email");
  const passwordInput = document.getElementById("password");
  const loginButton = document.getElementById("login-button");
  const loginButtonLabel = document.getElementById("login-button-label");
  const loginSpinner = document.getElementById("login-spinner");
  const loginArrow = document.getElementById("login-arrow");
  const alertBox = document.getElementById("login-alert");
  const alertText = document.getElementById("login-alert-text");
  const alertIcon = document.getElementById("login-alert-icon");
  const togglePassword = document.getElementById("toggle-password");
  const togglePasswordIcon = document.getElementById("toggle-password-icon");

  let isRedirecting = false;

  function showAlert(type, message) {
    alertBox.hidden = false;
    alertBox.className = `alert alert-${type}`;
    alertText.textContent = message;
    alertIcon.setAttribute("href", type === "info" ? "#icon-info" : "#icon-alert-circle");
  }

  function hideAlert() {
    alertBox.hidden = true;
    alertText.textContent = "";
  }

  function setLoading(isLoading) {
    loginButton.disabled = isLoading;
    loginSpinner.hidden = !isLoading;
    loginArrow.hidden = isLoading;
    loginButtonLabel.textContent = isLoading ? "Memproses..." : "Masuk";
    loginButton.classList.toggle("is-loading", isLoading);
  }

  function getLoginErrorMessage(error) {
    const message = String(error && error.message ? error.message : "").toLowerCase();
    const code = String(error && error.code ? error.code : "").toLowerCase();

    if (
      message.includes("invalid login credentials") ||
      code === "invalid_credentials"
    ) {
      return "Email atau password salah. Periksa kembali lalu coba lagi.";
    }

    if (message.includes("email not confirmed")) {
      return "Email belum dikonfirmasi. Hubungi administrator sekolah untuk mengaktifkan akun.";
    }

    if (
      message.includes("too many requests") ||
      code === "over_email_send_rate_limit"
    ) {
      return "Terlalu banyak percobaan login. Tunggu beberapa saat lalu coba lagi.";
    }

    if (
      message.includes("failed to fetch") ||
      message.includes("networkerror") ||
      message.includes("load failed")
    ) {
      return "Tidak dapat terhubung ke server. Periksa koneksi internet lalu coba lagi.";
    }

    return "Login gagal. Silakan coba lagi.";
  }

  // Jika library Supabase tidak termuat, hentikan proses login dengan pesan jelas.
  if (!db) {
    showAlert(
      "error",
      "Library Supabase gagal dimuat. Periksa koneksi internet lalu muat ulang halaman."
    );
    form.querySelectorAll("input, button").forEach(function (element) {
      element.disabled = true;
    });
    return;
  }

  // Menampilkan alasan pengguna kembali ke halaman login.
  const params = new URLSearchParams(window.location.search);
  const reason = params.get("reason");
  const reasonMessages = {
    auth: "Silakan masuk terlebih dahulu untuk mengakses halaman absensi.",
    logged_out: "Kamu telah keluar. Sampai jumpa lagi!",
    expired: "Sesi login telah berakhir. Silakan masuk kembali."
  };

  if (reason && reasonMessages[reason]) {
    showAlert("info", reasonMessages[reason]);

    // Hilangkan parameter dari URL agar tidak muncul lagi saat halaman di-refresh.
    params.delete("reason");
    const cleanUrl = window.location.pathname + (params.toString() ? `?${params}` : "");
    window.history.replaceState({}, "", cleanUrl);
  }

  // Jika sudah punya sesi aktif, langsung arahkan ke dashboard.
  db.auth
    .getSession()
    .then(function (result) {
      if (result.data && result.data.session) {
        isRedirecting = true;
        window.location.replace("dashboard.html");
      }
    })
    .catch(function (error) {
      console.error("Gagal memeriksa sesi:", error);
    });

  // Tombol tampil/sembunyikan password.
  togglePassword.addEventListener("click", function () {
    const showPassword = passwordInput.type === "password";
    passwordInput.type = showPassword ? "text" : "password";
    togglePassword.setAttribute("aria-pressed", String(showPassword));
    togglePassword.setAttribute(
      "aria-label",
      showPassword ? "Sembunyikan password" : "Tampilkan password"
    );
    togglePasswordIcon.setAttribute(
      "href",
      showPassword ? "#icon-eye-off" : "#icon-eye"
    );
  });

  // Sembunyikan pesan error ketika pengguna mulai mengetik lagi.
  [emailInput, passwordInput].forEach(function (input) {
    input.addEventListener("input", hideAlert);
  });

  form.addEventListener("submit", async function (event) {
    event.preventDefault();

    if (isRedirecting) return;

    hideAlert();

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email) {
      showAlert("error", "Email wajib diisi.");
      emailInput.focus();
      return;
    }

    if (!emailInput.validity.valid) {
      showAlert("error", "Format email belum valid. Contoh: nama@sekolah.id");
      emailInput.focus();
      return;
    }

    if (!password) {
      showAlert("error", "Password wajib diisi.");
      passwordInput.focus();
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await db.auth.signInWithPassword({
        email: email,
        password: password
      });

      if (error) throw error;
      if (!data || !data.session) {
        throw new Error("Sesi login tidak terbentuk.");
      }

      isRedirecting = true;
      window.location.replace("dashboard.html");
    } catch (error) {
      console.error("Login gagal:", error);
      showAlert("error", getLoginErrorMessage(error));
      setLoading(false);
      passwordInput.focus();
      passwordInput.select();
    }
  });
})();
