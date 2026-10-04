const supabase = require("./_supabase");

function response(statusCode, data) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store"
    },
    body: JSON.stringify(data)
  };
}

function normalizeStatus(status) {
  return String(status || "Aktif").trim() === "Nonaktif"
    ? "Nonaktif"
    : "Aktif";
}

exports.handler = async (event) => {
  try {
    const method = event.httpMethod;

    // ============================================================
    // GET
    // Mengambil seluruh akun Guru
    // ============================================================

    if (method === "GET") {
      const {
        data,
        error
      } = await supabase
        .from("guru")
        .select("id, username, nama, status")
        .order("id", {
          ascending: true
        });

      if (error) {
        console.error(
          "SUPABASE ADMIN GURU GET ERROR:",
          error
        );

        return response(500, {
          success: false,
          error: "Gagal mengambil data akun guru.",
          details: error.message
        });
      }

      const guru = (data || []).map((row) => ({
        id: String(row.id || "").trim(),
        username: String(row.username || "").trim(),
        nama: String(row.nama || "").trim(),
        status: normalizeStatus(row.status)
      }));

      return response(200, {
        success: true,
        guru
      });
    }

    // ============================================================
    // POST
    // Menambahkan akun Guru baru
    // ============================================================

    if (method === "POST") {
      let body;

      try {
        body = JSON.parse(event.body || "{}");
      } catch {
        return response(400, {
          success: false,
          error: "Format JSON tidak valid."
        });
      }

      const username =
        String(body.username || "").trim();

      const password =
        String(body.password || "");

      const nama =
        String(body.nama || "").trim();

      const status =
        normalizeStatus(body.status);

      if (!username) {
        return response(400, {
          success: false,
          error: "Username wajib diisi."
        });
      }

      if (!password) {
        return response(400, {
          success: false,
          error: "Password wajib diisi."
        });
      }

      if (!nama) {
        return response(400, {
          success: false,
          error: "Nama guru wajib diisi."
        });
      }

      if (password.length < 4) {
        return response(400, {
          success: false,
          error: "Password minimal 4 karakter."
        });
      }

      // ------------------------------------------------------------
      // Cek username agar tidak duplikat
      // Tidak membedakan huruf besar/kecil
      // ------------------------------------------------------------

      const {
        data: existingGuru,
        error: existingError
      } = await supabase
        .from("guru")
        .select("id, username")
        .ilike("username", username);

      if (existingError) {
        console.error(
          "SUPABASE CHECK USERNAME ERROR:",
          existingError
        );

        return response(500, {
          success: false,
          error: "Gagal mengecek username guru.",
          details: existingError.message
        });
      }

      if (
        existingGuru &&
        existingGuru.length > 0
      ) {
        return response(409, {
          success: false,
          error: "Username guru tersebut sudah digunakan."
        });
      }

      // ------------------------------------------------------------
      // Generate ID otomatis
      // G001
      // G002
      // G003
      // dst.
      // ------------------------------------------------------------

      const {
        data: allGuru,
        error: allGuruError
      } = await supabase
        .from("guru")
        .select("id");

      if (allGuruError) {
        console.error(
          "SUPABASE GET GURU ID ERROR:",
          allGuruError
        );

        return response(500, {
          success: false,
          error: "Gagal membuat ID guru.",
          details: allGuruError.message
        });
      }

      let maxNumber = 0;

      for (const row of allGuru || []) {
        const id =
          String(row.id || "").trim();

        const match =
          id.match(/^G(\d+)$/i);

        if (match) {
          const number =
            Number(match[1]);

          if (
            Number.isFinite(number) &&
            number > maxNumber
          ) {
            maxNumber = number;
          }
        }
      }

      const guruId =
        "G" +
        String(maxNumber + 1).padStart(3, "0");

      // ------------------------------------------------------------
      // Insert guru
      // ------------------------------------------------------------

      const {
        error: insertError
      } = await supabase
        .from("guru")
        .insert({
          id: guruId,
          username,
          password,
          nama,
          status
        });

      if (insertError) {
        console.error(
          "SUPABASE INSERT GURU ERROR:",
          insertError
        );

        // Username duplicate dari constraint database
        if (insertError.code === "23505") {
          return response(409, {
            success: false,
            error: "Username guru tersebut sudah digunakan."
          });
        }

        return response(500, {
          success: false,
          error: "Gagal menambahkan akun guru.",
          details: insertError.message
        });
      }

      return response(201, {
        success: true,
        message: "Akun guru berhasil ditambahkan.",
        guru: {
          id: guruId,
          username,
          nama,
          status
        }
      });
    }

    // ============================================================
    // PUT
    // Edit akun Guru
    //
    // Yang dapat diubah:
    // - Nama
    // - Password
    // - Status
    //
    // Username sengaja tidak diubah.
    // ============================================================

    if (method === "PUT") {
      let body;

      try {
        body = JSON.parse(event.body || "{}");
      } catch {
        return response(400, {
          success: false,
          error: "Format JSON tidak valid."
        });
      }

      const id =
        String(body.id || "").trim();

      if (!id) {
        return response(400, {
          success: false,
          error: "ID guru wajib diisi."
        });
      }

      // ------------------------------------------------------------
      // Ambil guru lama
      // ------------------------------------------------------------

      const {
        data: oldGuru,
        error: oldGuruError
      } = await supabase
        .from("guru")
        .select(
          "id, username, password, nama, status"
        )
        .eq("id", id)
        .maybeSingle();

      if (oldGuruError) {
        console.error(
          "SUPABASE GET GURU FOR UPDATE ERROR:",
          oldGuruError
        );

        return response(500, {
          success: false,
          error: "Gagal mengambil data guru.",
          details: oldGuruError.message
        });
      }

      if (!oldGuru) {
        return response(404, {
          success: false,
          error: "Akun guru tidak ditemukan."
        });
      }

      const oldUsername =
        String(
          oldGuru.username || ""
        ).trim();

      const oldPassword =
        String(
          oldGuru.password || ""
        );

      const oldNama =
        String(
          oldGuru.nama || ""
        ).trim();

      const oldStatus =
        normalizeStatus(
          oldGuru.status
        );

      const nama =
        body.nama !== undefined
          ? String(body.nama || "").trim()
          : oldNama;

      const password =
        body.password !== undefined
          ? String(body.password || "")
          : oldPassword;

      const status =
        body.status !== undefined
          ? normalizeStatus(body.status)
          : oldStatus;

      if (!nama) {
        return response(400, {
          success: false,
          error: "Nama guru tidak boleh kosong."
        });
      }

      if (!password) {
        return response(400, {
          success: false,
          error: "Password tidak boleh kosong."
        });
      }

      if (
        body.password !== undefined &&
        password.length < 4
      ) {
        return response(400, {
          success: false,
          error: "Password minimal 4 karakter."
        });
      }

      // ------------------------------------------------------------
      // Username sengaja tidak diubah.
      // Username menjadi identitas pembuat poin Guru.
      // ------------------------------------------------------------

      const {
        error: updateError
      } = await supabase
        .from("guru")
        .update({
          password,
          nama,
          status
        })
        .eq("id", id);

      if (updateError) {
        console.error(
          "SUPABASE UPDATE GURU ERROR:",
          updateError
        );

        return response(500, {
          success: false,
          error: "Gagal memperbarui akun guru.",
          details: updateError.message
        });
      }

      return response(200, {
        success: true,
        message: "Akun guru berhasil diperbarui.",
        guru: {
          id,
          username: oldUsername,
          nama,
          status
        }
      });
    }

    // ============================================================
    // DELETE
    // Menghapus akun Guru
    // ============================================================

    if (method === "DELETE") {
      let body;

      try {
        body = JSON.parse(event.body || "{}");
      } catch {
        return response(400, {
          success: false,
          error: "Format JSON tidak valid."
        });
      }

      const id =
        String(body.id || "").trim();

      if (!id) {
        return response(400, {
          success: false,
          error: "ID guru wajib diisi."
        });
      }

      // ------------------------------------------------------------
      // Cari guru terlebih dahulu
      // ------------------------------------------------------------

      const {
        data: guru,
        error: guruError
      } = await supabase
        .from("guru")
        .select("id, username")
        .eq("id", id)
        .maybeSingle();

      if (guruError) {
        console.error(
          "SUPABASE GET GURU FOR DELETE ERROR:",
          guruError
        );

        return response(500, {
          success: false,
          error: "Gagal mengambil data guru.",
          details: guruError.message
        });
      }

      if (!guru) {
        return response(404, {
          success: false,
          error: "Akun guru tidak ditemukan."
        });
      }

      const username =
        String(
          guru.username || ""
        ).trim();

      // ------------------------------------------------------------
      // Hapus akun
      // ------------------------------------------------------------

      const {
        error: deleteError
      } = await supabase
        .from("guru")
        .delete()
        .eq("id", id);

      if (deleteError) {
        console.error(
          "SUPABASE DELETE GURU ERROR:",
          deleteError
        );

        return response(500, {
          success: false,
          error: "Gagal menghapus akun guru.",
          details: deleteError.message
        });
      }

      return response(200, {
        success: true,
        message:
          `Akun @${username} berhasil dihapus.`
      });
    }

    // ============================================================
    // METHOD TIDAK DIDUKUNG
    // ============================================================

    return response(405, {
      success: false,
      error: "Method tidak diizinkan."
    });

  } catch (error) {
    console.error(
      "ADMIN GURU ERROR:",
      error
    );

    return response(500, {
      success: false,
      error:
        error.message ||
        "Terjadi kesalahan pada server."
    });
  }
};
