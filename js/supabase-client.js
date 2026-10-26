/* ============================================================
   Membuat satu koneksi Supabase untuk dipakai di seluruh halaman.
   Library Supabase dimuat lewat CDN di dalam file HTML.
   ============================================================ */

(function () {
  "use strict";

  if (!window.supabase) {
    console.error(
      "Library Supabase gagal dimuat. Periksa koneksi internet lalu muat ulang halaman."
    );
    window.SUPABASE_LIBRARY_ERROR = true;
    return;
  }

  window.db = window.supabase.createClient(
    window.APP_CONFIG.supabaseUrl,
    window.APP_CONFIG.supabaseKey,
    {
      auth: {
        persistSession: true,      // Sesi login disimpan di browser
        autoRefreshToken: true,    // Token diperbarui otomatis
        detectSessionInUrl: true
      }
    }
  );
})();
