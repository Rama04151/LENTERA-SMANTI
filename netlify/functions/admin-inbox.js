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

exports.handler = async function (event) {

  try {

    // ===================================================
    // GET
    // DATA PESAN
    // ===================================================

    if (event.httpMethod === "GET") {

      // =================================================
      // AMBIL DATA INBOX + SISWA + KELAS
      // =================================================

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
          status,
          siswa:siswa_id (
            id,
            nama,
            nisn,
            kelas_id,
            status,
            kelas:kelas_id (
              id,
              nama_kelas
            )
          )
        `)
        .order("dibuat", {
          ascending: false
        });


      if (inboxError) {

        console.error(
          "SUPABASE ADMIN INBOX GET ERROR:",
          inboxError
        );

        return response(500, {

          success: false,

          message:
            "Gagal mengambil data pesan.",

          error:
            inboxError.message

        });

      }


      // =================================================
      // BENTUK DATA INBOX
      // =================================================

      const inbox = [];


      for (const row of inboxRows || []) {

        const siswa =
          row.siswa || {};


        const kelas =
          siswa.kelas || {};


        inbox.push({

          id:
            String(row.id || "").trim(),

          siswaId:
            String(row.siswa_id || "").trim(),

          siswaNama:
            String(
              siswa.nama || "-"
            ).trim(),

          siswaNisn:
            String(
              siswa.nisn || "-"
            ).trim(),

          siswaKelas:
            String(
              kelas.nama_kelas || "-"
            ).trim(),

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

          admin:
            String(
              row.dibuat_oleh || ""
            ).trim(),

          status:
            String(
              row.status || ""
            ).trim()

        });

      }


      // =================================================
      // RESPONSE
      // =================================================

      return response(200, {

        success: true,

        inbox

      });

    }


    // ===================================================
    // POST
    // KIRIM PESAN
    // ===================================================

    if (event.httpMethod === "POST") {

      const data =
        JSON.parse(
          event.body || "{}"
        );


      const {
        siswaId,
        judul,
        pesan,
        durasi,
        admin
      } = data;


      // =================================================
      // VALIDASI
      // =================================================

      if (
        !siswaId ||
        !judul ||
        !pesan ||
        !durasi
      ) {

        return response(400, {

          success: false,

          message:
            "Data pesan belum lengkap."

        });

      }


      // =================================================
      // DURASI
      // =================================================

      const durationMap = {

        "1h": 1,

        "3h": 3,

        "6h": 6,

        "12h": 12,

        "1d": 24,

        "3d": 72,

        "7d": 168

      };


      const hours =
        durationMap[durasi];


      if (!hours) {

        return response(400, {

          success: false,

          message:
            "Durasi pesan tidak valid."

        });

      }


      // =================================================
      // CEK SISWA
      // =================================================

      const siswaIdNormal =
        String(
          siswaId
        ).trim();


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
          "SUPABASE ADMIN INBOX CHECK SISWA ERROR:",
          siswaError
        );

        return response(500, {

          success: false,

          message:
            "Gagal memeriksa siswa.",

          error:
            siswaError.message

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
      // WAKTU
      // =================================================

      const createdAt =
        new Date();


      const expiredAt =
        new Date(
          createdAt.getTime() +
          hours *
          60 *
          60 *
          1000
        );


      // =================================================
      // ID PESAN
      // =================================================

      const id =
        "MSG" +
        Date.now();


      // =================================================
      // ADMIN
      // =================================================

      const dibuatOleh =
        String(
          admin || "admin"
        ).trim();


      // =================================================
      // SIMPAN PESAN
      // =================================================

      const {
        error: insertError
      } = await supabase
        .from("inbox")
        .insert({

          id,

          siswa_id:
            siswaIdNormal,

          judul:
            String(judul).trim(),

          pesan:
            String(pesan).trim(),

          dibuat:
            createdAt.toISOString(),

          kedaluwarsa:
            expiredAt.toISOString(),

          dibuat_oleh:
            dibuatOleh,

          status:
            "Aktif"

        });


      if (insertError) {

        console.error(
          "SUPABASE ADMIN INBOX INSERT ERROR:",
          insertError
        );

        return response(500, {

          success: false,

          message:
            "Gagal menyimpan pesan.",

          error:
            insertError.message

        });

      }


      // =================================================
      // RESPONSE
      // =================================================

      return response(200, {

        success: true,

        message:
          "Pesan berhasil dikirim.",

        data: {

          id,

          dibuat:
            createdAt.toISOString(),

          kedaluwarsa:
            expiredAt.toISOString()

        }

      });

    }


    // ===================================================
    // DELETE
    // HAPUS PESAN
    // ===================================================

    if (event.httpMethod === "DELETE") {

      const data =
        JSON.parse(
          event.body || "{}"
        );


      const messageId =
        String(
          data.id || ""
        ).trim();


      // =================================================
      // VALIDASI ID
      // =================================================

      if (!messageId) {

        return response(400, {

          success: false,

          message:
            "ID pesan wajib diisi."

        });

      }


      // =================================================
      // CEK PESAN
      // =================================================

      const {
        data: existingMessage,
        error: findError
      } = await supabase
        .from("inbox")
        .select("id")
        .eq("id", messageId)
        .maybeSingle();


      if (findError) {

        console.error(
          "SUPABASE ADMIN INBOX FIND ERROR:",
          findError
        );

        return response(500, {

          success: false,

          message:
            "Gagal mencari pesan.",

          error:
            findError.message

        });

      }


      if (!existingMessage) {

        return response(404, {

          success: false,

          message:
            "Pesan tidak ditemukan."

        });

      }


      // =================================================
      // DELETE PESAN
      // =================================================

      const {
        error: deleteError
      } = await supabase
        .from("inbox")
        .delete()
        .eq("id", messageId);


      if (deleteError) {

        console.error(
          "SUPABASE ADMIN INBOX DELETE ERROR:",
          deleteError
        );

        return response(500, {

          success: false,

          message:
            "Gagal menghapus pesan.",

          error:
            deleteError.message

        });

      }


      // =================================================
      // RESPONSE
      // =================================================

      return response(200, {

        success: true,

        message:
          "Pesan berhasil dihapus."

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
      "ADMIN INBOX ERROR:",
      error
    );

    return response(500, {

      success: false,

      message:
        "Terjadi kesalahan server.",

      error:
        error.message

    });

  }

};
