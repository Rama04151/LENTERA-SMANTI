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

exports.handler = async function (event) {

  // ============================================================
  // CEK METHOD
  // ============================================================

  if (event.httpMethod !== "POST") {
    return response(405, {
      success: false,
      message: "Method tidak diizinkan."
    });
  }

  try {

    const body =
      JSON.parse(
        event.body || "{}"
      );

    const guruId =
      String(
        body.guruId || ""
      ).trim();

    const currentPassword =
      String(
        body.currentPassword || ""
      );

    const newPassword =
      String(
        body.newPassword || ""
      );

    // ============================================================
    // VALIDASI
    // ============================================================

    if (!guruId) {
      return response(400, {
        success: false,
        message:
          "ID guru tidak ditemukan."
      });
    }

    if (
      !currentPassword ||
      !newPassword
    ) {
      return response(400, {
        success: false,
        message:
          "Password lama dan password baru wajib diisi."
      });
    }

    if (newPassword.length < 6) {
      return response(400, {
        success: false,
        message:
          "Password baru minimal 6 karakter."
      });
    }

    if (
      currentPassword ===
      newPassword
    ) {
      return response(400, {
        success: false,
        message:
          "Password baru harus berbeda dari password lama."
      });
    }

    // ============================================================
    // CARI GURU
    // ============================================================

    const {
      data: guru,
      error: guruError
    } = await supabase
      .from("guru")
      .select(`
        id,
        password,
        status
      `)
      .eq("id", guruId)
      .maybeSingle();

    if (guruError) {
      console.error(
        "SUPABASE GURU CHANGE PASSWORD GET ERROR:",
        guruError
      );

      return response(500, {
        success: false,
        message:
          "Gagal mengambil data akun guru."
      });
    }

    if (!guru) {
      return response(404, {
        success: false,
        message:
          "Akun guru tidak ditemukan."
      });
    }

    // ============================================================
    // CEK STATUS
    // ============================================================

    const status =
      String(
        guru.status || ""
      )
        .trim()
        .toLowerCase();

    if (status !== "aktif") {
      return response(403, {
        success: false,
        message:
          "Akun guru tidak aktif."
      });
    }

    // ============================================================
    // CEK PASSWORD LAMA
    // ============================================================

    const storedPassword =
      String(
        guru.password || ""
      );

    if (
      storedPassword !==
      currentPassword
    ) {
      return response(401, {
        success: false,
        message:
          "Password lama salah."
      });
    }

    // ============================================================
    // UPDATE PASSWORD
    // ============================================================

    const {
      error: updateError
    } = await supabase
      .from("guru")
      .update({
        password: newPassword
      })
      .eq("id", guruId);

    if (updateError) {
      console.error(
        "SUPABASE GURU CHANGE PASSWORD UPDATE ERROR:",
        updateError
      );

      return response(500, {
        success: false,
        message:
          "Gagal mengubah password."
      });
    }

    return response(200, {
      success: true,
      message:
        "Password berhasil diubah."
    });

  } catch (error) {

    console.error(
      "GURU CHANGE PASSWORD ERROR:",
      error
    );

    return response(500, {
      success: false,
      message:
        "Gagal mengubah password."
    });
  }
};
