const supabase = require("./_supabase");

function success(data = {}) {
  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store"
    },
    body: JSON.stringify({
      success: true,
      ...data
    })
  };
}

function error(message, statusCode = 400) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store"
    },
    body: JSON.stringify({
      success: false,
      message
    })
  };
}

// ============================================================
// CARI GURU
// ============================================================

async function getGuru(guruId, guruUsername) {

  let query = supabase
    .from("guru")
    .select(`
      id,
      username,
      nama,
      status
    `);

  if (guruId) {
    query = query.eq("id", guruId);
  } else if (guruUsername) {
    query = query.eq(
      "username",
      guruUsername
    );
  } else {
    return null;
  }

  const {
    data,
    error: queryError
  } = await query.maybeSingle();

  if (queryError) {
    throw queryError;
  }

  if (!data) {
    return null;
  }

  if (
    String(data.status || "")
      .trim()
      .toLowerCase() !== "aktif"
  ) {
    return null;
  }

  return {
    id: data.id,
    username: data.username,
    nama: data.nama
  };
}

// ============================================================
// HANDLER
// ============================================================

exports.handler = async function (event) {

  try {

    // ==========================================================
    // GET — PESAN YANG DIKIRIM GURU
    // ==========================================================

    if (event.httpMethod === "GET") {

      const params =
        event.queryStringParameters || {};

      const guruId =
        String(
          params.guruId || ""
        ).trim();

      const guruUsername =
        String(
          params.guruUsername || ""
        ).trim();

      if (
        !guruId &&
        !guruUsername
      ) {
        return error(
          "Identitas guru tidak ditemukan.",
          401
        );
      }

      // --------------------------------------------------------
      // Cari Guru
      // --------------------------------------------------------

      const guru =
        await getGuru(
          guruId,
          guruUsername
        );

      if (!guru) {
        return error(
          "Akun guru tidak ditemukan.",
          404
        );
      }

      // --------------------------------------------------------
      // Ambil pesan milik Guru
      // --------------------------------------------------------

      const {
        data: inboxRows,
        error: inboxError
      } = await supabase
        .from("inbox")
        .select(`
          id,
          siswa_id,
          judul,
          pesan,
          dibuat,
          kedaluwarsa,
          dibuat_oleh,
          status
        `)
        .ilike(
          "dibuat_oleh",
          guru.username
        )
        .order(
          "dibuat",
          {
            ascending: false
          }
        );

      if (inboxError) {
        console.error(
          "SUPABASE GURU INBOX GET ERROR:",
          inboxError
        );

        return error(
          "Gagal mengambil data pesan.",
          500
        );
      }

      // --------------------------------------------------------
      // Ambil siswa
      // --------------------------------------------------------

      const {
        data: siswaRows,
        error: siswaError
      } = await supabase
        .from("siswa")
        .select(`
          id,
          nama,
          nisn,
          kelas_id
        `);

      if (siswaError) {
        console.error(
          "SUPABASE GURU INBOX SISWA ERROR:",
          siswaError
        );

        return error(
          "Gagal mengambil data siswa.",
          500
        );
      }

      // --------------------------------------------------------
      // Ambil kelas
      // --------------------------------------------------------

      const {
        data: kelasRows,
        error: kelasError
      } = await supabase
        .from("kelas")
        .select(`
          id,
          nama_kelas
        `);

      if (kelasError) {
        console.error(
          "SUPABASE GURU INBOX KELAS ERROR:",
          kelasError
        );

        return error(
          "Gagal mengambil data kelas.",
          500
        );
      }

      // --------------------------------------------------------
      // Map siswa
      // --------------------------------------------------------

      const siswaMap = {};

      for (const row of siswaRows || []) {

        const id =
          String(
            row.id || ""
          ).trim();

        if (!id) {
          continue;
        }

        siswaMap[id] = {
          nama:
            String(
              row.nama || ""
            ).trim(),

          nisn:
            String(
              row.nisn || ""
            ).trim(),

          kelasId:
            String(
              row.kelas_id || ""
            ).trim()
        };
      }

      // --------------------------------------------------------
      // Map kelas
      // --------------------------------------------------------

      const kelasMap = {};

      for (const row of kelasRows || []) {

        const id =
          String(
            row.id || ""
          ).trim();

        const nama =
          String(
            row.nama_kelas || ""
          ).trim();

        if (id) {
          kelasMap[id] = nama;
        }
      }

      // --------------------------------------------------------
      // Bentuk response pesan
      // --------------------------------------------------------

      const pesanSaya = [];

      for (const row of inboxRows || []) {

        const siswaId =
          String(
            row.siswa_id || ""
          ).trim();

        const siswa =
          siswaMap[siswaId] || {};

        pesanSaya.push({
          id:
            String(
              row.id || ""
            ).trim(),

          siswaId,

          siswaNama:
            siswa.nama || "-",

          siswaNisn:
            siswa.nisn || "-",

          siswaKelas:
            kelasMap[
              siswa.kelasId
            ] || "-",

          judul:
            String(
              row.judul || ""
            ).trim(),

          pesan:
            String(
              row.pesan || ""
            ).trim(),

          dibuat:
            row.dibuat || "",

          kedaluwarsa:
            row.kedaluwarsa || "",

          status:
            String(
              row.status || ""
            ).trim(),

          guruUsername:
            guru.username
        });
      }

      return success({
        guru: {
          id: guru.id,
          username: guru.username,
          nama: guru.nama
        },

        pesan: pesanSaya
      });
    }

    // ==========================================================
    // POST — KIRIM PESAN
    // ==========================================================

    if (event.httpMethod === "POST") {

      const body =
        JSON.parse(
          event.body || "{}"
        );

      const siswaId =
        String(
          body.siswaId || ""
        ).trim();

      const judul =
        String(
          body.judul || ""
        ).trim();

      const pesan =
        String(
          body.pesan || ""
        ).trim();

      const durasi =
        String(
          body.durasi || "1d"
        ).trim();

      const guruId =
        String(
          body.guruId || ""
        ).trim();

      const guruUsername =
        String(
          body.guruUsername || ""
        ).trim();

      // --------------------------------------------------------
      // Validasi
      // --------------------------------------------------------

      if (!siswaId) {
        return error(
          "Siswa belum dipilih."
        );
      }

      if (!judul) {
        return error(
          "Judul pesan wajib diisi."
        );
      }

      if (!pesan) {
        return error(
          "Pesan wajib diisi."
        );
      }

      if (judul.length > 100) {
        return error(
          "Judul maksimal 100 karakter."
        );
      }

      if (pesan.length > 2000) {
        return error(
          "Pesan maksimal 2000 karakter."
        );
      }

      // --------------------------------------------------------
      // Validasi Guru
      // --------------------------------------------------------

      const guru =
        await getGuru(
          guruId,
          guruUsername
        );

      if (!guru) {
        return error(
          "Akun guru tidak ditemukan.",
          404
        );
      }

      // --------------------------------------------------------
      // Cek siswa
      // --------------------------------------------------------

      const {
        data: siswa,
        error: siswaError
      } = await supabase
        .from("siswa")
        .select(`
          id,
          status
        `)
        .eq("id", siswaId)
        .maybeSingle();

      if (siswaError) {
        console.error(
          "SUPABASE GURU INBOX CHECK SISWA ERROR:",
          siswaError
        );

        return error(
          "Gagal memeriksa siswa.",
          500
        );
      }

      if (
        !siswa ||
        String(siswa.status || "")
          .trim()
          .toLowerCase() !== "aktif"
      ) {
        return error(
          "Siswa tidak ditemukan atau tidak aktif."
        );
      }

      // --------------------------------------------------------
      // Durasi
      // --------------------------------------------------------

      const durations = {

        "1h":
          1 * 60 * 60 * 1000,

        "3h":
          3 * 60 * 60 * 1000,

        "6h":
          6 * 60 * 60 * 1000,

        "12h":
          12 * 60 * 60 * 1000,

        "1d":
          24 * 60 * 60 * 1000,

        "3d":
          3 * 24 * 60 * 60 * 1000,

        "7d":
          7 * 24 * 60 * 60 * 1000
      };

      if (!durations[durasi]) {
        return error(
          "Durasi pesan tidak valid."
        );
      }

      // --------------------------------------------------------
      // Waktu
      // --------------------------------------------------------

      const now =
        new Date();

      const expiredAt =
        new Date(
          now.getTime() +
          durations[durasi]
        );

      // --------------------------------------------------------
      // ID pesan
      // --------------------------------------------------------

      const messageId =
        "MSG" +
        Date.now();

      // --------------------------------------------------------
      // Insert
      // --------------------------------------------------------

      const {
        error: insertError
      } = await supabase
        .from("inbox")
        .insert({
          id: messageId,
          siswa_id: siswaId,
          judul,
          pesan,
          dibuat:
            now.toISOString(),
          kedaluwarsa:
            expiredAt.toISOString(),
          dibuat_oleh:
            guru.username,
          status: "Aktif"
        });

      if (insertError) {
        console.error(
          "SUPABASE GURU INBOX INSERT ERROR:",
          insertError
        );

        return error(
          "Gagal mengirim pesan.",
          500
        );
      }

      return success({
        message:
          "Pesan berhasil dikirim."
      });
    }

    // ==========================================================
    // DELETE — HAPUS PESAN SENDIRI
    // ==========================================================

    if (event.httpMethod === "DELETE") {

      const body =
        JSON.parse(
          event.body || "{}"
        );

      const messageId =
        String(
          body.id || ""
        ).trim();

      const guruId =
        String(
          body.guruId || ""
        ).trim();

      const guruUsername =
        String(
          body.guruUsername || ""
        ).trim();

      if (!messageId) {
        return error(
          "ID pesan tidak ditemukan."
        );
      }

      // --------------------------------------------------------
      // Validasi Guru
      // --------------------------------------------------------

      const guru =
        await getGuru(
          guruId,
          guruUsername
        );

      if (!guru) {
        return error(
          "Akun guru tidak ditemukan.",
          404
        );
      }

      // --------------------------------------------------------
      // Cari pesan dan pastikan milik Guru
      // --------------------------------------------------------

      const {
        data: existingMessage,
        error: messageError
      } = await supabase
        .from("inbox")
        .select(`
          id,
          dibuat_oleh
        `)
        .eq("id", messageId)
        .maybeSingle();

      if (messageError) {
        console.error(
          "SUPABASE GURU INBOX DELETE GET ERROR:",
          messageError
        );

        return error(
          "Gagal mengambil data pesan.",
          500
        );
      }

      if (!existingMessage) {
        return error(
          "Pesan tidak ditemukan atau bukan pesan Anda.",
          403
        );
      }

      if (
        String(
          existingMessage.dibuat_oleh || ""
        ).toLowerCase() !==
        guru.username.toLowerCase()
      ) {
        return error(
          "Pesan tidak ditemukan atau bukan pesan Anda.",
          403
        );
      }

      // --------------------------------------------------------
      // Hapus
      // --------------------------------------------------------

      const {
        error: deleteError
      } = await supabase
        .from("inbox")
        .delete()
        .eq("id", messageId)
        .eq(
          "dibuat_oleh",
          guru.username
        );

      if (deleteError) {
        console.error(
          "SUPABASE GURU INBOX DELETE ERROR:",
          deleteError
        );

        return error(
          "Gagal menghapus pesan.",
          500
        );
      }

      return success({
        message:
          "Pesan berhasil dihapus."
      });
    }

    // ==========================================================
    // METHOD TIDAK DIIZINKAN
    // ==========================================================

    return error(
      "Method tidak diizinkan.",
      405
    );

  } catch (err) {

    console.error(
      "GURU INBOX ERROR:",
      err
    );

    return error(
      "Terjadi kesalahan pada server.",
      500
    );
  }
};
