const supabase = require("./_supabase");

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

exports.handler = async (event) => {

  if (event.httpMethod !== "POST") {
    return response(405, {
      success: false,
      message: "Method tidak diizinkan."
    });
  }

  try {

    const {
      username,
      password
    } = JSON.parse(event.body || "{}");

    if (!username || !password) {
      return response(400, {
        success: false,
        message: "Username dan password wajib diisi."
      });
    }

    const cleanUsername =
      String(username).trim();

    const cleanPassword =
      String(password);

    // ============================================================
    // Cari akun Guru berdasarkan username
    // ============================================================

    const {
      data: guruData,
      error
    } = await supabase
      .from("guru")
      .select(`
        id,
        username,
        password,
        nama,
        status
      `)
      .eq("username", cleanUsername)
      .maybeSingle();

    if (error) {
      console.error(
        "SUPABASE GURU LOGIN ERROR:",
        error
      );

      return response(500, {
        success: false,
        message: "Gagal mengakses database."
      });
    }

    // ============================================================
    // Username tidak ditemukan / password salah
    // ============================================================

    if (
      !guruData ||
      guruData.password !== cleanPassword
    ) {
      return response(401, {
        success: false,
        message:
          "Username atau password salah."
      });
    }

    // ============================================================
    // Cek status akun
    // ============================================================

    if (
      String(guruData.status || "")
        .trim()
        .toLowerCase() !== "aktif"
    ) {
      return response(403, {
        success: false,
        message:
          "Akun Guru sedang tidak aktif."
      });
    }

    // ============================================================
    // Data session Guru
    // ============================================================

    const guru = {
      id: guruData.id,
      username: guruData.username,
      nama: guruData.nama,
      role: "guru"
    };

    return response(200, {
      success: true,
      message: "Login Guru berhasil.",
      guru
    });

  } catch (error) {

    console.error(
      "GURU LOGIN ERROR:",
      error
    );

    return response(500, {
      success: false,
      message: "Terjadi kesalahan server.",
      error: error.message
    });
  }
};
