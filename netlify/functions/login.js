const supabase = require("./_supabase");

exports.handler = async (event) => {

  // =========================
  // HANYA MENERIMA POST
  // =========================
  if (event.httpMethod !== "POST") {
    return response(405, {
      success: false,
      message: "Method tidak diizinkan"
    });
  }

  try {

    const { nisn, password } =
      JSON.parse(event.body || "{}");

    if (!nisn || !password) {
      return response(400, {
        success: false,
        message: "NISN dan password wajib diisi"
      });
    }

    const targetNisn = String(nisn).trim();

    // =========================
    // CARI SISWA
    // =========================

    const { data: siswa, error: siswaError } =
      await supabase
        .from("siswa")
        .select(`
          id,
          nisn,
          nama,
          kelas_id,
          password,
          status
        `)
        .eq("nisn", targetNisn)
        .maybeSingle();

    if (siswaError) {
      console.error(
        "SUPABASE SISWA ERROR:",
        siswaError
      );

      return response(500, {
        success: false,
        message: "Gagal mengakses data siswa"
      });
    }

    // =========================
    // NISN TIDAK DITEMUKAN
    // =========================

    if (!siswa) {
      return response(401, {
        success: false,
        message: "NISN atau password salah"
      });
    }

    // =========================
    // CEK STATUS SISWA
    // =========================

    if (
      String(siswa.status || "").toLowerCase() !== "aktif"
    ) {
      return response(403, {
        success: false,
        message: "Akun siswa tidak aktif"
      });
    }

    // =========================
    // CARI LOGIN CONTROL
    // =========================

    const {
      data: loginControl,
      error: loginControlError
    } = await supabase
      .from("login_control")
      .select(`
        nisn,
        failed_attempts,
        locked_until
      `)
      .eq("nisn", targetNisn)
      .maybeSingle();

    if (loginControlError) {
      console.error(
        "SUPABASE LOGIN CONTROL ERROR:",
        loginControlError
      );

      return response(500, {
        success: false,
        message: "Gagal mengakses kontrol login"
      });
    }

    let failedAttempts =
      Number(loginControl?.failed_attempts || 0);

    let lockedUntil =
      loginControl?.locked_until || null;

    // =========================
    // CEK LOCK
    // =========================

    if (lockedUntil) {

      const lockedTime =
        new Date(lockedUntil);

      const now =
        new Date();

      if (
        !Number.isNaN(lockedTime.getTime()) &&
        lockedTime > now
      ) {

        const remainingSeconds =
          Math.ceil(
            (lockedTime.getTime() - now.getTime()) / 1000
          );

        const remainingMinutes =
          Math.ceil(
            remainingSeconds / 60
          );

        return response(429, {
          success: false,
          message:
            `Terlalu banyak percobaan. Coba lagi dalam ${remainingMinutes} menit.`
        });

      }

      // Lock sudah habis
      failedAttempts = 0;
      lockedUntil = null;
    }

    // =========================
    // CEK PASSWORD
    // =========================

    if (
      String(siswa.password) !==
      String(password)
    ) {

      failedAttempts++;

      // =========================
      // GAGAL 3 KALI
      // =========================

      if (failedAttempts >= 3) {

        const lockUntilDate =
          new Date(
            Date.now() + 5 * 60 * 1000
          );

        lockedUntil =
          lockUntilDate.toISOString();

        failedAttempts = 3;
      }

      // =========================
      // SIMPAN LOGIN CONTROL
      // =========================

      const { error: upsertError } =
        await supabase
          .from("login_control")
          .upsert({
            nisn: targetNisn,
            failed_attempts: failedAttempts,
            locked_until: lockedUntil
          }, {
            onConflict: "nisn"
          });

      if (upsertError) {
        console.error(
          "SUPABASE LOGIN CONTROL UPDATE ERROR:",
          upsertError
        );

        return response(500, {
          success: false,
          message: "Gagal memperbarui kontrol login"
        });
      }

      // =========================
      // JIKA SUDAH 3 KALI
      // =========================

      if (failedAttempts >= 3) {

        return response(429, {
          success: false,
          message:
            "Gagal 3 kali. Login dikunci selama 5 menit."
        });

      }

      return response(401, {
        success: false,
        message:
          `NISN atau password salah. Percobaan ${failedAttempts}/3.`
      });
    }

    // =========================
    // LOGIN BERHASIL
    // =========================

    const { error: resetError } =
      await supabase
        .from("login_control")
        .upsert({
          nisn: targetNisn,
          failed_attempts: 0,
          locked_until: null
        }, {
          onConflict: "nisn"
        });

    if (resetError) {
      console.error(
        "SUPABASE LOGIN RESET ERROR:",
        resetError
      );

      return response(500, {
        success: false,
        message: "Gagal memperbarui status login"
      });
    }

    // =========================
    // CARI NAMA KELAS
    // =========================

    const {
      data: kelas,
      error: kelasError
    } = await supabase
      .from("kelas")
      .select(`
        id,
        nama_kelas,
        status
      `)
      .eq("id", siswa.kelas_id)
      .maybeSingle();

    if (kelasError) {
      console.error(
        "SUPABASE KELAS ERROR:",
        kelasError
      );

      return response(500, {
        success: false,
        message: "Gagal mengakses data kelas"
      });
    }

    let namaKelas = "-";

    if (
      kelas &&
      String(kelas.status || "").toLowerCase() === "aktif"
    ) {
      namaKelas = kelas.nama_kelas;
    }

    // =========================
    // RESPONSE LOGIN BERHASIL
    // =========================

    return response(200, {

      success: true,

      message:
        "Login berhasil",

      siswa: {

        id:
          siswa.id,

        nisn:
          siswa.nisn,

        nama:
          siswa.nama,

        kelasId:
          siswa.kelas_id,

        kelas:
          namaKelas

      }

    });

  } catch (error) {

    console.error(
      "LOGIN ERROR:",
      error
    );

    return response(500, {

      success: false,

      message:
        "Terjadi kesalahan pada server"

    });
  }
};


// =========================
// RESPONSE HELPER
// =========================

function response(
  statusCode,
  body
) {

  return {

    statusCode,

    headers: {

      "Content-Type":
        "application/json",

      "Cache-Control":
        "no-store"

    },

    body:
      JSON.stringify(body)

  };
}
