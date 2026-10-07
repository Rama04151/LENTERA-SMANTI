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

/**
 * Normalisasi tanggal menjadi YYYY-MM-DD.
 *
 * Menerima:
 * - YYYY-MM-DD
 * - DD/MM/YYYY
 * - DD-MM-YYYY
 */
function normalizeDate(value) {
  const raw = String(value || "").trim();

  if (!raw) {
    return "";
  }

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [year, month, day] = raw.split("-");

    const date = new Date(
      Number(year),
      Number(month) - 1,
      Number(day)
    );

    if (
      date.getFullYear() !== Number(year) ||
      date.getMonth() !== Number(month) - 1 ||
      date.getDate() !== Number(day)
    ) {
      return "";
    }

    return raw;
  }

  // DD/MM/YYYY
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) {
    const [day, month, year] = raw.split("/");

    const date = new Date(
      Number(year),
      Number(month) - 1,
      Number(day)
    );

    if (
      date.getFullYear() !== Number(year) ||
      date.getMonth() !== Number(month) - 1 ||
      date.getDate() !== Number(day)
    ) {
      return "";
    }

    return `${year}-${month}-${day}`;
  }

  // DD-MM-YYYY
  if (/^\d{2}-\d{2}-\d{4}$/.test(raw)) {
    const [day, month, year] = raw.split("-");

    const date = new Date(
      Number(year),
      Number(month) - 1,
      Number(day)
    );

    if (
      date.getFullYear() !== Number(year) ||
      date.getMonth() !== Number(month) - 1 ||
      date.getDate() !== Number(day)
    ) {
      return "";
    }

    return `${year}-${month}-${day}`;
  }

  return "";
}

function createPointId() {
  return "P" + Date.now().toString().slice(-8);
}

exports.handler = async function (event) {
  try {
    const method = event.httpMethod;

    /*
    ============================================================
    GET
    ============================================================
    */

    if (method === "GET") {
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
        .order("tanggal", {
          ascending: false
        });

      if (poinError) {
        console.error(
          "SUPABASE ADMIN POINTS GET ERROR:",
          poinError
        );

        return response(500, {
          success: false,
          message: "Gagal mengambil data poin.",
          error: poinError.message
        });
      }

      const {
        data: siswaRows,
        error: siswaError
      } = await supabase
        .from("siswa")
        .select(`
          id,
          nisn,
          nama,
          kelas_id,
          status
        `);

      if (siswaError) {
        console.error(
          "SUPABASE ADMIN POINTS SISWA ERROR:",
          siswaError
        );

        return response(500, {
          success: false,
          message: "Gagal mengambil data siswa.",
          error: siswaError.message
        });
      }

      const {
        data: kelasRows,
        error: kelasError
      } = await supabase
        .from("kelas")
        .select(`
          id,
          nama_kelas,
          tingkat,
          status
        `);

      if (kelasError) {
        console.error(
          "SUPABASE ADMIN POINTS KELAS ERROR:",
          kelasError
        );

        return response(500, {
          success: false,
          message: "Gagal mengambil data kelas.",
          error: kelasError.message
        });
      }

      const siswaMap = {};
      const kelasMap = {};

      for (const kelas of kelasRows || []) {
        kelasMap[String(kelas.id)] = {
          id: String(kelas.id),
          nama: String(kelas.nama_kelas || "").trim(),
          tingkat: String(kelas.tingkat || "").trim(),
          status: String(kelas.status || "").trim()
        };
      }

      for (const siswa of siswaRows || []) {
        const kelasId = String(
          siswa.kelas_id || ""
        ).trim();

        siswaMap[String(siswa.id)] = {
          id: String(siswa.id),
          nisn: String(siswa.nisn || "").trim(),
          nama: String(siswa.nama || "").trim(),
          kelasId,
          kelas:
            kelasMap[kelasId]?.nama || "-",
          status:
            String(siswa.status || "").trim()
        };
      }

      const poin = (poinRows || []).map(row => {
        const siswa =
          siswaMap[String(row.siswa_id)];

        return {
          id: String(row.id || "").trim(),

          siswaId:
            String(row.siswa_id || "").trim(),

          nisn:
            siswa?.nisn || "-",

          nama:
            siswa?.nama || "-",

          kelas:
            siswa?.kelas || "-",

          jenis:
            String(row.jenis || "").trim(),

          poin:
            Number(row.poin || 0),

          keterangan:
            String(row.keterangan || "").trim(),

          tanggal:
            String(row.tanggal || "").trim(),

          dibuatOleh:
            String(row.dibuat_oleh || "").trim(),

          peran:
            String(row.peran || "").trim()
        };
      });

      return response(200, {
        success: true,
        poin
      });
    }

    /*
    ============================================================
    POST
    ============================================================
    */

    if (method === "POST") {
      const body = JSON.parse(
        event.body || "{}"
      );

      const siswaId = String(
        body.siswaId || ""
      ).trim();

      const jenis = String(
        body.jenis || ""
      )
        .trim()
        .toLowerCase();

      const nilai = Number(body.poin);

      const keterangan = String(
        body.keterangan || ""
      ).trim();

      const tanggal = normalizeDate(
        body.tanggal
      );

      const admin = String(
        body.admin || ""
      ).trim();

      /*
      ------------------------------------------------------------
      VALIDASI
      ------------------------------------------------------------
      */

      if (
        !siswaId ||
        !jenis ||
        !body.poin ||
        !keterangan ||
        !tanggal
      ) {
        return response(400, {
          success: false,
          message: "Semua data wajib diisi."
        });
      }

      if (
        jenis !== "penghargaan" &&
        jenis !== "pelanggaran"
      ) {
        return response(400, {
          success: false,
          message:
            "Jenis poin tidak valid."
        });
      }

      if (
        !Number.isFinite(nilai) ||
        nilai <= 0
      ) {
        return response(400, {
          success: false,
          message:
            "Nilai poin harus lebih dari 0."
        });
      }

      /*
      ------------------------------------------------------------
      CEK SISWA
      ------------------------------------------------------------
      */

      const {
        data: siswa,
        error: siswaError
      } = await supabase
        .from("siswa")
        .select(`
          id,
          nama,
          status
        `)
        .eq("id", siswaId)
        .maybeSingle();

      if (siswaError) {
        console.error(
          "SUPABASE ADMIN POINTS CHECK SISWA ERROR:",
          siswaError
        );

        return response(500, {
          success: false,
          message:
            "Gagal memeriksa siswa.",
          error: siswaError.message
        });
      }

      if (!siswa) {
        return response(404, {
          success: false,
          message:
            "Siswa tidak ditemukan."
        });
      }

      if (
        String(siswa.status || "")
          .trim() !== "Aktif"
      ) {
        return response(400, {
          success: false,
          message:
            "Siswa tidak aktif."
        });
      }

      /*
      ------------------------------------------------------------
      INSERT
      ------------------------------------------------------------
      */

      const pointId =
        createPointId();

      const {
        data: inserted,
        error: insertError
      } = await supabase
        .from("poin")
        .insert({
          id: pointId,

          siswa_id: siswaId,

          jenis,

          poin: nilai,

          keterangan,

          tanggal,

          dibuat_oleh: admin,

          peran: "Admin"
        })
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
        .single();

      if (insertError) {
        console.error(
          "SUPABASE ADMIN POINTS INSERT ERROR:",
          insertError
        );

        return response(500, {
          success: false,
          message:
            "Gagal menyimpan poin.",
          error: insertError.message
        });
      }

      return response(200, {
        success: true,
        message:
          "Poin berhasil ditambahkan.",
        poin: {
          id:
            String(inserted.id || "").trim(),

          siswaId:
            String(
              inserted.siswa_id || ""
            ).trim(),

          jenis:
            String(
              inserted.jenis || ""
            ).trim(),

          poin:
            Number(
              inserted.poin || 0
            ),

          keterangan:
            String(
              inserted.keterangan || ""
            ).trim(),

          tanggal:
            String(
              inserted.tanggal || ""
            ).trim(),

          dibuatOleh:
            String(
              inserted.dibuat_oleh || ""
            ).trim(),

          peran:
            String(
              inserted.peran || ""
            ).trim()
        }
      });
    }

    /*
    ============================================================
    PUT
    ============================================================
    */

    if (method === "PUT") {
      const body = JSON.parse(
        event.body || "{}"
      );

      const id = String(
        body.id || ""
      ).trim();

      const jenis = String(
        body.jenis || ""
      )
        .trim()
        .toLowerCase();

      const nilai = Number(body.poin);

      const keterangan = String(
        body.keterangan || ""
      ).trim();

      const tanggal = normalizeDate(
        body.tanggal
      );

      if (
        !id ||
        !jenis ||
        !body.poin ||
        !keterangan ||
        !tanggal
      ) {
        return response(400, {
          success: false,
          message:
            "Semua data wajib diisi."
        });
      }

      if (
        jenis !== "penghargaan" &&
        jenis !== "pelanggaran"
      ) {
        return response(400, {
          success: false,
          message:
            "Jenis poin tidak valid."
        });
      }

      if (
        !Number.isFinite(nilai) ||
        nilai <= 0
      ) {
        return response(400, {
          success: false,
          message:
            "Nilai poin harus lebih dari 0."
        });
      }

      /*
      ------------------------------------------------------------
      CEK POIN
      ------------------------------------------------------------
      */

      const {
        data: existing,
        error: existingError
      } = await supabase
        .from("poin")
        .select(`
          id,
          dibuat_oleh,
          peran
        `)
        .eq("id", id)
        .maybeSingle();

      if (existingError) {
        console.error(
          "SUPABASE ADMIN POINTS CHECK ERROR:",
          existingError
        );

        return response(500, {
          success: false,
          message:
            "Gagal memeriksa data poin.",
          error:
            existingError.message
        });
      }

      if (!existing) {
        return response(404, {
          success: false,
          message:
            "Data poin tidak ditemukan."
        });
      }

      /*
      ------------------------------------------------------------
      UPDATE
      ------------------------------------------------------------
      */

      const {
        data: updated,
        error: updateError
      } = await supabase
        .from("poin")
        .update({
          jenis,

          poin: nilai,

          keterangan,

          tanggal
        })
        .eq("id", id)
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
        .single();

      if (updateError) {
        console.error(
          "SUPABASE ADMIN POINTS UPDATE ERROR:",
          updateError
        );

        return response(500, {
          success: false,
          message:
            "Gagal memperbarui poin.",
          error:
            updateError.message
        });
      }

      return response(200, {
        success: true,
        message:
          "Poin berhasil diperbarui.",
        poin: updated
      });
    }

    /*
    ============================================================
    DELETE
    ============================================================
    */

    if (method === "DELETE") {
      const body = JSON.parse(
        event.body || "{}"
      );

      const id = String(
        body.id || ""
      ).trim();

      if (!id) {
        return response(400, {
          success: false,
          message:
            "ID poin wajib diisi."
        });
      }

      const {
        data: existing,
        error: existingError
      } = await supabase
        .from("poin")
        .select("id")
        .eq("id", id)
        .maybeSingle();

      if (existingError) {
        console.error(
          "SUPABASE ADMIN POINTS DELETE CHECK ERROR:",
          existingError
        );

        return response(500, {
          success: false,
          message:
            "Gagal memeriksa poin.",
          error:
            existingError.message
        });
      }

      if (!existing) {
        return response(404, {
          success: false,
          message:
            "Data poin tidak ditemukan."
        });
      }

      const {
        error: deleteError
      } = await supabase
        .from("poin")
        .delete()
        .eq("id", id);

      if (deleteError) {
        console.error(
          "SUPABASE ADMIN POINTS DELETE ERROR:",
          deleteError
        );

        return response(500, {
          success: false,
          message:
            "Gagal menghapus poin.",
          error:
            deleteError.message
        });
      }

      return response(200, {
        success: true,
        message:
          "Poin berhasil dihapus."
      });
    }

    /*
    ============================================================
    METHOD TIDAK DIIZINKAN
    ============================================================
    */

    return response(405, {
      success: false,
      message:
        "Method tidak diizinkan."
    });

  } catch (error) {
    console.error(
      "ADMIN POINTS ERROR:",
      error
    );

    return response(500, {
      success: false,
      message:
        "Terjadi kesalahan server.",
      error: error.message
    });
  }
};
