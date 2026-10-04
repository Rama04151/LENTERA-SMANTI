const supabase = require("./_supabase");

exports.handler = async (event) => {

  if (event.httpMethod !== "POST") {
    return response(405, {
      success: false,
      message: "Method tidak diizinkan"
    });
  }

  try {

    const { username, password } =
      JSON.parse(event.body || "{}");

    if (!username || !password) {
      return response(400, {
        success: false,
        message: "Username dan password wajib diisi"
      });
    }

    // Cari admin berdasarkan username
    const { data: adminData, error } = await supabase
      .from("admin")
      .select("id, username, password, status")
      .eq("username", username)
      .maybeSingle();

    if (error) {
      console.error("SUPABASE ADMIN LOGIN ERROR:", error);

      return response(500, {
        success: false,
        message: "Gagal mengakses database"
      });
    }

    // Username tidak ditemukan atau password salah
    if (!adminData || adminData.password !== password) {
      return response(401, {
        success: false,
        message: "Username atau password salah."
      });
    }

    // Cek status akun
    if (
      String(adminData.status || "").toLowerCase() !== "aktif"
    ) {
      return response(403, {
        success: false,
        message: "Akun admin tidak aktif."
      });
    }

    // Jangan kirim password ke frontend
    const admin = {
      id: adminData.id,
      username: adminData.username,
      status: adminData.status
    };

    return response(200, {
      success: true,
      message: "Login admin berhasil",
      admin
    });

  } catch (error) {

    console.error("ADMIN LOGIN ERROR:", error);

    return response(500, {
      success: false,
      message: "Terjadi kesalahan pada server"
    });
  }
};

function response(statusCode, body) {

  return {
    statusCode,

    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store"
    },

    body: JSON.stringify(body)
  };
}
