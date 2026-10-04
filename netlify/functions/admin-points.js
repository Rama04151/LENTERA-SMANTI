const supabase = require("./_supabase");

// =====================================================
// RESPONSE
// =====================================================

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


// =====================================================
// HANDLER
// =====================================================

exports.handler = async (event) => {

  try {

    // ===================================================
    // GET — DATA POIN
    // ===================================================

    if (event.httpMethod === "GET") {

      // Ambil siswa
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
          "SUPABASE ADMIN POINTS SISWA ERROR:",
          siswaError
        );

        return response(500, {
          success: false,
          message: "Gagal mengambil data siswa."
        });
      }


      // Map siswa
      const siswaMap = {};

      for (const siswa of siswaRows || []) {

        const id =
          String(siswa.id || "").trim();

        if (!id) {
          continue;
        }

        siswaMap[id] = {
          nama:
            String(siswa.nama || "").trim(),

          nisn:
            String(siswa.nisn || "").trim(),

          kelasId:
            String(siswa.kelas_id || "").trim()
        };

      }


      // Ambil poin
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
          "SUPABASE ADMIN POINTS ERROR:",
          poinError
        );

        return response(500, {
          success: false,
          message: "Gagal mengambil data poin."
        });
      }


      // Bentuk response
      const poin = [];

      for (const row of poinRows || []) {

        const pointId =
          String(row.id || "").trim();

        if (!pointId) {
          continue;
        }


        const siswaId =
          String(row.siswa_id || "").trim();


        poin.push({

          id: pointId,

          siswaId,

          nama:
            siswaMap[siswaId]?.nama || "-",

          nisn:
            siswaMap[siswaId]?.nisn || "-",

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

        });

      }


      return response(200, {

        success: true,

        poin

      });

    }


    // ===================================================
    // POST — TAMBAH POIN
    // ===================================================

    if (event.httpMethod === "POST") {

      const body =
        JSON.parse(event.body || "{}");


      const {
        siswaId,
        jenis,
        poin,
        keterangan,
        tanggal,
        admin
      } = body;


      // =================================================
      // VALIDASI DATA
      // =================================================

      if (
        !siswaId ||
        !jenis ||
        poin === undefined ||
        poin === null ||
        !keterangan
      ) {

        return response(400, {

          success: false,

          message:
            "Data poin belum lengkap."

        });

      }


      const jenisNormal =
        String(jenis)
          .trim()
          .toLowerCase();


      if (
        jenisNormal !== "penghargaan" &&
        jenisNormal !== "pelanggaran"
      ) {

        return response(400, {

          success: false,

          message:
            "Jenis poin tidak valid."

        });

      }


      const nilaiPoin =
        Number(poin);


      if (
        !Number.isFinite(nilaiPoin) ||
        nilaiPoin <= 0
      ) {

        return response(400, {

          success: false,

          message:
            "Nilai poin harus lebih dari 0."

        });

      }


      // =================================================
      // CEK SISWA
      // =================================================

      const siswaIdNormal =
        String(siswaId).trim();


      const {
        data: siswa,
        error: siswaError
      } = await supabase
        .from("siswa")
        .select("id")
        .eq("id", siswaIdNormal)
        .maybeSingle();


      if (siswaError) {

        console.error(
          "SUPABASE CHECK SISWA ERROR:",
          siswaError
        );

        return response(500, {

          success: false,

          message:
            "Gagal memeriksa siswa."

        });

      }


      if (!siswa) {

        return response(404, {

          success: false,

          message:
            "Siswa tidak ditemukan."

        });

      }


      // =================================================
      // ID POIN
      // =================================================

      const pointId =
        "P" +
        String(Date.now()).slice(-8);


      // =================================================
      // TANGGAL
      //
      // Supabase menggunakan DATE.
      // Format yang disimpan:
      // YYYY-MM-DD
      // =================================================

      let tanggalFinal =
        String(tanggal || "").trim();


      if (!tanggalFinal) {

        const now =
          new Date();


        tanggalFinal =
          now.toISOString()
            .slice(0, 10);

      }


      // =================================================
      // PEMBUAT
      // =================================================

      const dibuatOleh =
        String(admin || "").trim();


      const peran =
        "Admin";


      // =================================================
      // INSERT POIN
      // =================================================

      const {
        error: insertError
      } = await supabase
        .from("poin")
        .insert({

          id: pointId,

          siswa_id:
            siswaIdNormal,

          jenis:
            jenisNormal,

          poin:
            nilaiPoin,

          keterangan:
            String(keterangan).trim(),

          tanggal:
            tanggalFinal,

          dibuat_oleh:
            dibuatOleh,

          peran

        });


      if (insertError) {

        console.error(
          "SUPABASE INSERT POINT ERROR:",
          insertError
        );

        return response(500, {

          success: false,

          message:
            "Gagal menambahkan poin."

        });

      }


      return response(201, {

        success: true,

        message:
          "Poin berhasil ditambahkan.",

        poin: {

          id:
            pointId,

          siswaId:
            siswaIdNormal,

          jenis:
            jenisNormal,

          poin:
            nilaiPoin,

          keterangan:
            String(keterangan).trim(),

          tanggal:
            tanggalFinal,

          dibuatOleh,

          peran

        }

      });

    }


    // ===================================================
    // PUT — EDIT POIN
    // ===================================================

    if (event.httpMethod === "PUT") {

      const body =
        JSON.parse(event.body || "{}");


      const {
        id,
        siswaId,
        jenis,
        poin,
        keterangan,
        tanggal
      } = body;


      // =================================================
      // VALIDASI
      // =================================================

      if (
        !id ||
        !siswaId ||
        !jenis ||
        poin === undefined ||
        poin === null ||
        !keterangan
      ) {

        return response(400, {

          success: false,

          message:
            "Semua data wajib diisi."

        });

      }


      const jenisNormal =
        String(jenis)
          .trim()
          .toLowerCase();


      if (
        jenisNormal !== "penghargaan" &&
        jenisNormal !== "pelanggaran"
      ) {

        return response(400, {

          success: false,

          message:
            "Jenis poin tidak valid."

        });

      }


      const nilaiPoin =
        Number(poin);


      if (
        !Number.isFinite(nilaiPoin) ||
        nilaiPoin <= 0
      ) {

        return response(400, {

          success: false,

          message:
            "Jumlah poin harus lebih dari 0."

        });

      }


      const pointIdNormal =
        String(id).trim();


      const siswaIdNormal =
        String(siswaId).trim();


      // =================================================
      // CEK SISWA
      // =================================================

      const {
        data: siswa,
        error: siswaError
      } = await supabase
        .from("siswa")
        .select("id")
        .eq("id", siswaIdNormal)
        .maybeSingle();


      if (siswaError) {

        console.error(
          "SUPABASE CHECK SISWA ERROR:",
          siswaError
        );

        return response(500, {

          success: false,

          message:
            "Gagal memeriksa siswa."

        });

      }


      if (!siswa) {

        return response(404, {

          success: false,

          message:
            "Siswa tidak ditemukan."

        });

      }


      // =================================================
      // CEK POIN
      // =================================================

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
        .eq("id", pointIdNormal)
        .maybeSingle();


      if (pointError) {

        console.error(
          "SUPABASE CHECK POINT ERROR:",
          pointError
        );

        return response(500, {

          success: false,

          message:
            "Gagal memeriksa data poin."

        });

      }


      if (!existingPoint) {

        return response(404, {

          success: false,

          message:
            "Data poin tidak ditemukan."

        });

      }


      // =================================================
      // TANGGAL
      // =================================================

      let tanggalFinal =
        String(tanggal || "").trim();


      if (!tanggalFinal) {

        const sekarang =
          new Date();


        tanggalFinal =
          sekarang.toISOString()
            .slice(0, 10);

      }


      // =================================================
      // UPDATE
      //
      // HANYA DATA POIN.
      //
      // dibuat_oleh dan peran TIDAK DIUBAH.
      // =================================================

      const {
        error: updateError
      } = await supabase
        .from("poin")
        .update({

          siswa_id:
            siswaIdNormal,

          jenis:
            jenisNormal,

          poin:
            nilaiPoin,

          keterangan:
            String(keterangan).trim(),

          tanggal:
            tanggalFinal

        })
        .eq("id", pointIdNormal);


      if (updateError) {

        console.error(
          "SUPABASE UPDATE POINT ERROR:",
          updateError
        );

        return response(500, {

          success: false,

          message:
            "Gagal memperbarui poin."

        });

      }


      return response(200, {

        success: true,

        message:
          "Poin berhasil diperbarui."

      });

    }


    // ===================================================
    // DELETE — HAPUS POIN
    // ===================================================

    if (event.httpMethod === "DELETE") {

      const body =
        JSON.parse(event.body || "{}");


      const id =
        String(body.id || "").trim();


      if (!id) {

        return response(400, {

          success: false,

          message:
            "ID poin wajib diisi."

        });

      }


      // =================================================
      // CEK POIN
      // =================================================

      const {
        data: existingPoint,
        error: pointError
      } = await supabase
        .from("poin")
        .select("id")
        .eq("id", id)
        .maybeSingle();


      if (pointError) {

        console.error(
          "SUPABASE CHECK DELETE POINT ERROR:",
          pointError
        );

        return response(500, {

          success: false,

          message:
            "Gagal memeriksa data poin."

        });

      }


      if (!existingPoint) {

        return response(404, {

          success: false,

          message:
            "Poin tidak ditemukan."

        });

      }


      // =================================================
      // DELETE
      // =================================================

      const {
        error: deleteError
      } = await supabase
        .from("poin")
        .delete()
        .eq("id", id);


      if (deleteError) {

        console.error(
          "SUPABASE DELETE POINT ERROR:",
          deleteError
        );

        return response(500, {

          success: false,

          message:
            "Gagal menghapus poin."

        });

      }


      return response(200, {

        success: true,

        message:
          "Poin berhasil dihapus."

      });

    }


    // ===================================================
    // METHOD TIDAK DIIZINKAN
    // ===================================================

    return response(405, {

      success: false,

      message:
        "Method tidak diizinkan."

    });

  }

  catch (error) {

    console.error(
      "ADMIN POINTS ERROR:",
      error
    );

    return response(500, {

      success: false,

      message:
        error.message ||
        "Terjadi kesalahan pada server."

    });

  }

};
