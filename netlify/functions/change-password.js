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

  if (event.httpMethod !== "POST") {
    return response(405, {
      success: false,
      message: "Method tidak diizinkan."
    });
  }

  try {

    const {
      siswaId,
      currentPassword,
      newPassword
    } = JSON.parse(event.body || "{}");

    // =========================
    // VALIDASI INPUT
    // =========================

    if (!siswaId || !currentPassword || !newPassword) {
      return response(400, {
        success: false,
        message: "Semua data wajib diisi."
      });
    }

    if (String(newPassword).length < 6) {
      return response(400, {
        success: false,
        message: "Password baru minimal 6 karakter."
      });
    }

    const targetSiswaId = String(siswaId).trim();
    const currentPass = String(currentPassword);
    const newPass = String(newPassword);

    // =========================
    // AMBIL DATA SISWA
    // =========================

    const {
      data: student,
      error: studentError
    } = await supabase
      .from("siswa")
      .select(`
        id,
        password,
        status
      `)
      .eq("id", targetSiswaId)
      .maybeSingle();

    if (studentError) {
      console.error(
        "SUPABASE CHANGE PASSWORD GET ERROR:",
        studentError
      );

      return response(500, {
        success: false,
        message: "Gagal mengambil data siswa.",
        error: studentError.message
      });
    }

    if (!student) {
      return response(404, {
        success: false,
        message: "Data siswa tidak ditemukan."
      });
    }

    // =========================
    // CEK STATUS AKUN
    // =========================

    if (String(student.status || "").trim() !== "Aktif") {
      return response(403, {
        success: false,
        message: "Akun siswa tidak aktif."
      });
    }

    // =========================
    // CEK PASSWORD SEKARANG
    // =========================

    const storedPassword =
      String(student.password || "");

    if (storedPassword !== currentPass) {
      return response(401, {
        success: false,
        message: "Password sekarang salah."
      });
    }

    // =========================
    // PASSWORD BARU TIDAK BOLEH SAMA
    // =========================

    if (storedPassword === newPass) {
      return response(400, {
        success: false,
        message:
          "Password baru harus berbeda dari password sekarang."
      });
    }

    // =========================
    // UPDATE PASSWORD
    // =========================

    const {
      error: updateError
    } = await supabase
      .from("siswa")
      .update({
        password: newPass
      })
      .eq("id", targetSiswaId);

    if (updateError) {
      console.error(
        "SUPABASE CHANGE PASSWORD UPDATE ERROR:",
        updateError
      );

      return response(500, {
        success: false,
        message: "Gagal mengubah password.",
        error: updateError.message
      });
    }

    // =========================
    // BERHASIL
    // =========================

    return response(200, {
      success: true,
      message: "Password berhasil diubah."
    });

  } catch (error) {

    console.error(
      "CHANGE PASSWORD ERROR:",
      error
    );

    return response(500, {
      success: false,
      message: "Terjadi kesalahan server.",
      error: error.message
    });
  }
};
