/* ============================================================
   Konfigurasi Supabase
   ------------------------------------------------------------
   Publishable key memang aman dipakai di browser karena akses
   data tetap dibatasi oleh Row Level Security (RLS) di database.
   JANGAN pernah menaruh service_role key / secret key di file ini.
   ============================================================ */

window.APP_CONFIG = Object.freeze({
  supabaseUrl: "https://tnqczyytfuiambesjnun.supabase.co",
  supabaseKey: "sb_publishable_u5mwN3HkuFgNkoAuZMKj6g_2Bg2fZJL"
});
