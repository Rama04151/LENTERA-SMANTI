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

function validJenis(jenis) {
  return (
    jenis === "penghargaan" ||
    jenis === "pelanggaran"
  );
}

function getTanggalIndonesia() {
  return new Intl.DateTimeFormat(
    "sv-SE",
    {
      timeZone: "Asia/Jakarta",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }
  ).format(new Date());
}

async function findGuru(guruId, guruUsername) {

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

exports.handler = async function (event) {

  try {

    // ============================================================
    // GET — POIN SAYA
    // ============================================================

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

      // ----------------------------------------------------------
      // Cari Guru
      // ----------------------------------------------------------

      const guru =
        await findGuru(
          guruId,
          guruUsername
        );

      if (!guru) {
        return error(
          "Akun guru tidak ditemukan.",
          404
        );
      }

      // ----------------------------------------------------------
      // Ambil poin milik Guru
      // ----------------------------------------------------------

      const {
        data: poinRows,
        error: poinError
      } = await supabase
        .from("poin")
        .select(`
          id,
          siswa_id,
          jenis,
          poin,
          keterangan,
          tanggal,
          dibuat_oleh,
          peran
        `)
        .eq(
          "peran",
          "Guru"
        )
        .ilike(
          "dibuat_oleh",
          guru.username
        )
        .order(
          "tanggal",
          {
            ascending: false
          }
        );

      if (poinError) {
        console.error(
          "SUPABASE GURU POINTS GET ERROR:",
          poinError
        );

        return error(
          "Gagal mengambil data poin.",
          500
        );
      }

      // ----------------------------------------------------------
      // Ambil siswa
      // ----------------------------------------------------------

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
          "SUPABASE GURU POINTS SISWA ERROR:",
          siswaError
        );

        return error(
          "Gagal mengambil data siswa.",
          500
        );
      }

      // ----------------------------------------------------------
      // Ambil kelas
      // ----------------------------------------------------------

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
          "SUPABASE GURU POINTS KELAS ERROR:",
          kelasError
        );

        return error(
          "Gagal mengambil data kelas.",
          500
        );
      }

      // ----------------------------------------------------------
      // Map siswa
      // ----------------------------------------------------------

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

      // ----------------------------------------------------------
      // Map kelas
      // ----------------------------------------------------------

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

      // ----------------------------------------------------------
      // Bentuk response poin
      // ----------------------------------------------------------

      const poinSaya = [];

      for (const row of poinRows || []) {

        const siswaId =
          String(
            row.siswa_id || ""
          ).trim();

        const siswa =
          siswaMap[siswaId] || {};

        poinSaya.push({
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

          jenis:
            String(
              row.jenis || ""
            ).trim(),

          poin:
            Number(
              row.poin || 0
            ),

          keterangan:
            String(
              row.keterangan || ""
            ).trim(),

          tanggal:
            row.tanggal || "",

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

        poin: poinSaya
      });
    }

    // ============================================================
    // POST — TAMBAH POIN
    // ============================================================

    if (event.httpMethod === "POST") {

      const body =
        JSON.parse(
          event.body || "{}"
        );

      const siswaId =
        String(
          body.siswaId || ""
        ).trim();

      const poin =
        Number(body.poin);

      const keterangan =
        String(
          body.keterangan || ""
        ).trim();

      const jenis =
        String(
          body.jenis || ""
        )
          .trim()
          .toLowerCase();

      const guruId =
        String(
          body.guruId || ""
        ).trim();

      const guruUsername =
        String(
          body.guruUsername || ""
        ).trim();

      // ----------------------------------------------------------
      // Validasi
      // ----------------------------------------------------------

      if (!siswaId) {
        return error(
          "Siswa belum dipilih."
        );
      }

      if (
        !Number.isInteger(poin) ||
        poin < 1 ||
        poin > 100
      ) {
        return error(
          "Poin harus berupa angka 1 sampai 100."
        );
      }

      if (!keterangan) {
        return error(
          "Keterangan wajib diisi."
        );
      }

      if (!validJenis(jenis)) {
        return error(
          "Jenis poin tidak valid."
        );
      }

      // ----------------------------------------------------------
      // Validasi Guru
      // ----------------------------------------------------------

      const guru =
        await findGuru(
          guruId,
          guruUsername
        );

      if (!guru) {
        return error(
          "Akun guru tidak ditemukan.",
          404
        );
      }

      // ----------------------------------------------------------
      // Pastikan siswa ada
      // ----------------------------------------------------------

      const {
        data: siswa,
        error: siswaError
      } = await supabase
        .from("siswa")
        .select("id")
        .eq("id", siswaId)
        .maybeSingle();

      if (siswaError) {
        console.error(
          "SUPABASE CHECK SISWA ERROR:",
          siswaError
        );

        return error(
          "Gagal memeriksa siswa.",
          500
        );
      }

      if (!siswa) {
        return error(
          "Siswa tidak ditemukan.",
          404
        );
      }

      // ----------------------------------------------------------
      // ID poin
      // ----------------------------------------------------------

      const pointId =
        "P" +
        Date.now();

      // ----------------------------------------------------------
      // Tanggal Indonesia
      // ----------------------------------------------------------

      const tanggal =
        getTanggalIndonesia();

      // ----------------------------------------------------------
      // Insert poin
      // ----------------------------------------------------------

      const {
        error: insertError
      } = await supabase
        .from("poin")
        .insert({
          id: pointId,
          siswa_id: siswaId,
          jenis,
          poin,
          keterangan,
          tanggal,
          dibuat_oleh: guru.username,
          peran: "Guru"
        });

      if (insertError) {
        console.error(
          "SUPABASE GURU POINTS INSERT ERROR:",
          insertError
        );

        return error(
          "Gagal menambahkan poin.",
          500
        );
      }

      return success({
        message:
          "Poin berhasil ditambahkan."
      });
    }

    // ============================================================
    // PUT — EDIT POIN SENDIRI
    // ============================================================

    if (event.httpMethod === "PUT") {

      const body =
        JSON.parse(
          event.body || "{}"
        );

      const pointId =
        String(
          body.id || ""
        ).trim();

      const siswaIdBaru =
        String(
          body.siswaId || ""
        ).trim();

      const jenis =
        String(
          body.jenis || ""
        )
          .trim()
          .toLowerCase();

      const poin =
        Number(body.poin);

      const keterangan =
        String(
          body.keterangan || ""
        ).trim();

      const guruId =
        String(
          body.guruId || ""
        ).trim();

      const guruUsername =
        String(
          body.guruUsername || ""
        ).trim();

      // ----------------------------------------------------------
      // Validasi
      // ----------------------------------------------------------

      if (!pointId) {
        return error(
          "ID poin tidak ditemukan."
        );
      }

      if (
        !Number.isInteger(poin) ||
        poin < 1 ||
        poin > 100
      ) {
        return error(
          "Poin harus berupa angka 1 sampai 100."
        );
      }

      if (!keterangan) {
        return error(
          "Keterangan wajib diisi."
        );
      }

      if (!validJenis(jenis)) {
        return error(
          "Jenis poin tidak valid."
        );
      }

      // ----------------------------------------------------------
      // Validasi Guru
      // ----------------------------------------------------------

      const guru =
        await findGuru(
          guruId,
          guruUsername
        );

      if (!guru) {
        return error(
          "Akun guru tidak ditemukan.",
          404
        );
      }

      // ----------------------------------------------------------
      // Ambil poin dan pastikan milik Guru ini
      // ----------------------------------------------------------

      const {
        data: existingPoint,
        error: pointError
      } = await supabase
        .from("poin")
        .select(`
          id,
          siswa_id,
          dibuat_oleh,
          peran
        `)
        .eq("id", pointId)
        .maybeSingle();

      if (pointError) {
        console.error(
          "SUPABASE GET POINT ERROR:",
          pointError
        );

        return error(
          "Gagal mengambil data poin.",
          500
        );
      }

      if (!existingPoint) {
        return error(
          "Poin tidak ditemukan atau bukan poin Anda.",
          403
        );
      }

      if (
        String(
          existingPoint.peran || ""
        ).toLowerCase() !== "guru"
      ) {
        return error(
          "Poin tidak ditemukan atau bukan poin Anda.",
          403
        );
      }

      if (
        String(
          existingPoint.dibuat_oleh || ""
        ).toLowerCase() !==
        guru.username.toLowerCase()
      ) {
        return error(
          "Poin tidak ditemukan atau bukan poin Anda.",
          403
        );
      }

      // ----------------------------------------------------------
      // Tentukan siswa
      // ----------------------------------------------------------

      const siswaIdFinal =
        siswaIdBaru ||
        existingPoint.siswa_id;

      if (!siswaIdFinal) {
        return error(
          "Siswa_ID tidak ditemukan. Poin tidak dapat diedit."
        );
      }

      // ----------------------------------------------------------
      // Pastikan siswa tujuan ada
      // ----------------------------------------------------------

      const {
        data: siswa,
        error: siswaError
      } = await supabase
        .from("siswa")
        .select("id")
        .eq("id", siswaIdFinal)
        .maybeSingle();

      if (siswaError) {
        console.error(
          "SUPABASE CHECK SISWA UPDATE ERROR:",
          siswaError
        );

        return error(
          "Gagal memeriksa siswa.",
          500
        );
      }

      if (!siswa) {
        return error(
          "Siswa tidak ditemukan.",
          404
        );
      }

      // ----------------------------------------------------------
      // Update
      //
      // Dibuat_oleh dan Peran tidak disentuh.
      // ----------------------------------------------------------

      const {
        error: updateError
      } = await supabase
        .from("poin")
        .update({
          siswa_id: siswaIdFinal,
          jenis,
          poin,
          keterangan
        })
        .eq("id", pointId)
        .eq(
          "dibuat_oleh",
          guru.username
        )
        .eq(
          "peran",
          "Guru"
        );

      if (updateError) {
        console.error(
          "SUPABASE GURU POINTS UPDATE ERROR:",
          updateError
        );

        return error(
          "Gagal memperbarui poin.",
          500
        );
      }

      return success({
        message:
          "Poin berhasil diperbarui."
      });
    }

    // ============================================================
    // DELETE — HAPUS POIN SENDIRI
    // ============================================================

    if (event.httpMethod === "DELETE") {

      const body =
        JSON.parse(
          event.body || "{}"
        );

      const pointId =
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

      if (!pointId) {
        return error(
          "ID poin tidak ditemukan."
        );
      }

      // ----------------------------------------------------------
      // Validasi Guru
      // ----------------------------------------------------------

      const guru =
        await findGuru(
          guruId,
          guruUsername
        );

      if (!guru) {
        return error(
          "Akun guru tidak ditemukan.",
          404
        );
      }

      // ----------------------------------------------------------
      // Pastikan poin milik Guru ini
      // ----------------------------------------------------------

      const {
        data: existingPoint,
        error: pointError
      } = await supabase
        .from("poin")
        .select(`
          id,
          dibuat_oleh,
          peran
        `)
        .eq("id", pointId)
        .maybeSingle();

      if (pointError) {
        console.error(
          "SUPABASE GET POINT DELETE ERROR:",
          pointError
        );

        return error(
          "Gagal mengambil data poin.",
          500
        );
      }

      if (!existingPoint) {
        return error(
          "Poin tidak ditemukan atau bukan poin Anda.",
          403
        );
      }

      if (
        String(
          existingPoint.peran || ""
        ).toLowerCase() !== "guru"
      ) {
        return error(
          "Poin tidak ditemukan atau bukan poin Anda.",
          403
        );
      }

      if (
        String(
          existingPoint.dibuat_oleh || ""
        ).toLowerCase() !==
        guru.username.toLowerCase()
      ) {
        return error(
          "Poin tidak ditemukan atau bukan poin Anda.",
          403
        );
      }

      // ----------------------------------------------------------
      // Hapus poin
      // ----------------------------------------------------------

      const {
        error: deleteError
      } = await supabase
        .from("poin")
        .delete()
        .eq("id", pointId)
        .eq(
          "dibuat_oleh",
          guru.username
        )
        .eq(
          "peran",
          "Guru"
        );

      if (deleteError) {
        console.error(
          "SUPABASE GURU POINTS DELETE ERROR:",
          deleteError
        );

        return error(
          "Gagal menghapus poin.",
          500
        );
      }

      return success({
        message:
          "Poin berhasil dihapus."
      });
    }

    // ============================================================
    // METHOD TIDAK DIIZINKAN
    // ============================================================

    return error(
      "Method tidak diizinkan.",
      405
    );

  } catch (err) {

    console.error(
      "GURU POINTS ERROR:",
      err
    );

    return error(
      "Terjadi kesalahan pada server.",
      500
    );
  }
};
