/* ============================================================
   Kumpulan fungsi bantu (utility) yang dipakai di halaman
   login maupun dashboard.
   ============================================================ */

window.AppUtils = (function () {
  "use strict";

  /**
   * Mengubah teks menjadi aman saat dimasukkan ke innerHTML.
   * Ini mencegah XSS jika ada pengguna yang mengisi nama/kelas
   * dengan karakter HTML.
   */
  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, function (character) {
      const map = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      };
      return map[character];
    });
  }

  /**
   * Format tanggal dari database (YYYY-MM-DD) menjadi
   * format Indonesia, contoh: 10 Okt 2026.
   */
  function formatTanggal(value) {
    if (!value) return "-";

    const date = value instanceof Date
      ? value
      : new Date(`${value}T00:00:00`);

    if (Number.isNaN(date.getTime())) return "-";

    return new Intl.DateTimeFormat("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    }).format(date);
  }

  /**
   * Format waktu lengkap, contoh: 26 Okt 2026, 16.38.
   */
  function formatWaktu(value) {
    if (!value) return "-";

    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "-";

    return new Intl.DateTimeFormat("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }).format(date);
  }

  /**
   * Format waktu singkat untuk kolom tabel,
   * contoh: 26 Okt, 16.38.
   */
  function formatWaktuSingkat(value) {
    if (!value) return "-";

    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "-";

    return new Intl.DateTimeFormat("id-ID", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit"
    }).format(date);
  }

  /**
   * Tanggal hari ini dalam format YYYY-MM-DD berdasarkan
   * waktu lokal perangkat (bukan UTC).
   */
  function todayISO() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  /**
   * Mengambil maksimal dua huruf awal dari nama.
   */
  function getInitials(name) {
    const text = String(name ?? "").trim();
    if (!text) return "?";

    if (text.includes("@")) {
      return text.slice(0, 2).toUpperCase();
    }

    return text
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(function (part) {
        return part.charAt(0);
      })
      .join("")
      .toUpperCase() || "?";
  }

  /**
   * Nama tampilan pengguna:
   * 1. full_name dari user metadata (jika ada)
   * 2. bagian depan email
   */
  function getDisplayName(user) {
    const metadata = user && user.user_metadata ? user.user_metadata : {};
    const fullName = metadata.full_name || metadata.name;

    if (fullName && String(fullName).trim()) {
      return String(fullName).trim();
    }

    const email = user && user.email ? String(user.email) : "";
    if (!email) return "Pengguna";

    return email
      .split("@")[0]
      .replace(/[._-]+/g, " ")
      .replace(/\b\w/g, function (character) {
        return character.toUpperCase();
      });
  }

  /**
   * Format angka dengan pemisah ribuan Indonesia.
   */
  function formatNumber(value) {
    return new Intl.NumberFormat("id-ID").format(Number(value) || 0);
  }

  return {
    escapeHtml,
    formatTanggal,
    formatWaktu,
    formatWaktuSingkat,
    todayISO,
    getInitials,
    getDisplayName,
    formatNumber
  };
})();
