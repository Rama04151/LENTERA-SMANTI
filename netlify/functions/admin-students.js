const supabase = require("./_supabase");

/* =========================================================
   RESPONSE
========================================================= */

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

/* =========================================================
   GENERATE ID SISWA
========================================================= */

function generateStudentId() {
  return (
    "S" +
    Date.now().toString().slice(-8) +
    Math.random().toString(36).substring(2, 6).toUpperCase()
  );
}

/* =========================================================
   GET — DATA SISWA
========================================================= */

async function getStudents() {

  const {
    data,
    error
  } = await supabase
    .from("siswa")
    .select(`
      id,
      nisn,
      nama,
      kelas_id,
      password,
      status,
      kelas:kelas_id (
        id,
        nama_kelas,
        tingkat,
        status
      )
    `)
    .order("nama", {
      ascending: true
    });

  if (error) {
    throw error;
  }

  const siswa = (data || []).map((row) => {

    return {
      id:
        row.id,

      nisn:
        row.nisn,

      nama:
        row.nama,

      kelasId:
        row.kelas_id,

      kelas:
        row.kelas?.nama_kelas || "-",

      password:
        row.password || "",

      status:
        row.status || ""
    };

  });

  return siswa;
}

/* =========================================================
   POST — TAMBAH / IMPORT
========================================================= */

async function handlePost(event) {

  const body =
    JSON.parse(event.body || "{}");

  const action =
    body.action || "";

  /* =======================================================
     IMPORT SISWA MASSAL
  ======================================================= */

  if (
    action === "import_students"
  ) {

    const siswaList =
      Array.isArray(body.siswa)
        ? body.siswa
        : [];

    if (
      siswaList.length === 0
    ) {

      return response(400, {
        success: false,
        message:
          "Data siswa untuk import kosong."
      });

    }

    /* =====================================================
       AMBIL DATA KELAS
    ===================================================== */

    const {
      data: kelasRows,
      error: kelasError
    } = await supabase
      .from("kelas")
      .select(
        "id, nama_kelas, tingkat, status"
      );

    if (kelasError) {
      throw kelasError;
    }

    /* =====================================================
       MAP KELAS
    ===================================================== */

    const kelasMap = {};

    for (
      const kelas of kelasRows || []
    ) {

      if (
        !kelas.id ||
        !kelas.nama_kelas
      ) {
        continue;
      }

      kelasMap[
        String(
          kelas.nama_kelas
        )
          .trim()
          .toLowerCase()
      ] = kelas.id;

      // Bisa juga mencari berdasarkan ID
      kelasMap[
        String(
          kelas.id
        )
          .trim()
          .toLowerCase()
      ] = kelas.id;
    }

    /* =====================================================
       AMBIL NISN YANG SUDAH ADA
    ===================================================== */

    const {
      data: siswaLama,
      error: siswaError
    } = await supabase
      .from("siswa")
      .select("nisn");

    if (siswaError) {
      throw siswaError;
    }

    const nisnLama =
      new Set(
        (siswaLama || []).map(
          (row) =>
            String(
              row.nisn || ""
            ).trim()
        )
      );

    /* =====================================================
       VALIDASI
    ===================================================== */

    const berhasil = [];
    const gagal = [];

    const nisnDalamImport =
      new Set();

    for (
      let i = 0;
      i < siswaList.length;
      i++
    ) {

      const dataSiswa =
        siswaList[i] || {};

      const nisnValue =
        String(
          dataSiswa.nisn ||
          dataSiswa.NISN ||
          ""
        ).trim();

      const namaValue =
        String(
          dataSiswa.nama ||
          dataSiswa.Nama ||
          ""
        ).trim();

      const kelasValue =
        String(
          dataSiswa.kelas ||
          dataSiswa.Kelas ||
          ""
        ).trim();

      const kelasIdValue =
        String(
          dataSiswa.kelasId ||
          dataSiswa.Kelas_ID ||
          ""
        ).trim();

      const passwordValue =
        String(
          dataSiswa.password ||
          dataSiswa.Password ||
          ""
        ).trim();

      /* ===================================================
         DATA WAJIB
      =================================================== */

      if (
        !nisnValue ||
        !namaValue ||
        (
          !kelasValue &&
          !kelasIdValue
        ) ||
        !passwordValue
      ) {

        gagal.push({

          baris:
            i + 2,

          nisn:
            nisnValue,

          nama:
            namaValue,

          alasan:
            "NISN, nama, kelas, dan password wajib diisi."

        });

        continue;
      }

      /* ===================================================
         CEK NISN LAMA
      =================================================== */

      if (
        nisnLama.has(
          nisnValue
        )
      ) {

        gagal.push({

          baris:
            i + 2,

          nisn:
            nisnValue,

          nama:
            namaValue,

          alasan:
            "NISN sudah terdaftar."

        });

        continue;
      }

      /* ===================================================
         CEK DUPLIKAT FILE
      =================================================== */

      if (
        nisnDalamImport.has(
          nisnValue
        )
      ) {

        gagal.push({

          baris:
            i + 2,

          nisn:
            nisnValue,

          nama:
            namaValue,

          alasan:
            "NISN duplikat di file import."

        });

        continue;
      }

      /* ===================================================
         TENTUKAN KELAS
      =================================================== */

      let kelasTujuanId =
        "";

      if (
        kelasIdValue
      ) {

        const idKey =
          kelasIdValue
            .toLowerCase();

        if (
          kelasMap[idKey]
        ) {
          kelasTujuanId =
            kelasMap[idKey];
        }
      }

      if (
        !kelasTujuanId &&
        kelasValue
      ) {

        kelasTujuanId =
          kelasMap[
            kelasValue
              .toLowerCase()
          ] || "";

      }

      /* ===================================================
         KELAS TIDAK VALID
      =================================================== */

      if (
        !kelasTujuanId
      ) {

        gagal.push({

          baris:
            i + 2,

          nisn:
            nisnValue,

          nama:
            namaValue,

          alasan:
            `Kelas "${kelasValue || kelasIdValue}" tidak ditemukan.`

        });

        continue;
      }

      /* ===================================================
         SIAPKAN DATA
      =================================================== */

      const id =
        generateStudentId();

      berhasil.push({

        id,

        nisn:
          nisnValue,

        nama:
          namaValue,

        kelas_id:
          kelasTujuanId,

        password:
          passwordValue,

        status:
          "Aktif"

      });

      nisnDalamImport.add(
        nisnValue
      );

    }

    /* =====================================================
       SIMPAN MASSAL
    ===================================================== */

    if (
      berhasil.length > 0
    ) {

      const {
        error: insertError
      } = await supabase
        .from("siswa")
        .insert(berhasil);

      if (insertError) {

        console.error(
          "SUPABASE IMPORT ERROR:",
          insertError
        );

        /*
         * Jika terjadi duplicate key karena
         * ada perubahan data bersamaan,
         * kembalikan error database.
         */

        return response(500, {

          success: false,

          message:
            "Gagal menyimpan data siswa hasil import.",

          error:
            insertError.message

        });

      }

    }

    return response(200, {

      success: true,

      message:
        `${berhasil.length} siswa berhasil diimport.`,

      berhasil:
        berhasil.length,

      gagal:
        gagal.length,

      detailGagal:
        gagal

    });

  }

  /* =======================================================
     TAMBAH SISWA BIASA
  ======================================================= */

  const {
    nisn,
    nama,
    kelasId,
    password
  } = body;

  if (
    !nisn ||
    !nama ||
    !kelasId ||
    !password
  ) {

    return response(400, {

      success: false,

      message:
        "NISN, nama, kelas, dan password wajib diisi."

    });

  }

  /* =====================================================
     CEK NISN
  ===================================================== */

  const {
    data: existing,
    error: existingError
  } = await supabase
    .from("siswa")
    .select("id")
    .eq(
      "nisn",
      String(nisn).trim()
    )
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (existing) {

    return response(409, {

      success: false,

      message:
        "NISN sudah terdaftar."

    });

  }

  /* =====================================================
     CEK KELAS
  ===================================================== */

  const {
    data: kelas,
    error: kelasError
  } = await supabase
    .from("kelas")
    .select(
      "id, nama_kelas, status"
    )
    .eq(
      "id",
      String(kelasId).trim()
    )
    .maybeSingle();

  if (kelasError) {
    throw kelasError;
  }

  if (!kelas) {

    return response(400, {

      success: false,

      message:
        "Kelas tidak ditemukan."

    });

  }

  /* =====================================================
     BUAT ID
  ===================================================== */

  const id =
    generateStudentId();

  /* =====================================================
     SIMPAN
  ===================================================== */

  const {
    error: insertError
  } = await supabase
    .from("siswa")
    .insert({

      id,

      nisn:
        String(nisn).trim(),

      nama:
        String(nama).trim(),

      kelas_id:
        String(kelasId).trim(),

      password:
        String(password).trim(),

      status:
        "Aktif"

    });

  if (insertError) {
    throw insertError;
  }

  return response(201, {

    success: true,

    message:
      "Siswa berhasil ditambahkan.",

    siswa: {

      id,

      nisn:
        String(nisn).trim(),

      nama:
        String(nama).trim(),

      kelasId:
        String(kelasId).trim(),

      status:
        "Aktif"

    }

  });

}

/* =========================================================
   PUT — EDIT SISWA
========================================================= */

async function handlePut(event) {

  const body =
    JSON.parse(event.body || "{}");

  const {
    id,
    nisn,
    nama,
    kelasId,
    password,
    status
  } = body;

  if (!id) {

    return response(400, {

      success: false,

      message:
        "ID siswa wajib diisi."

    });

  }

  /* =====================================================
     CARI SISWA
  ===================================================== */

  const {
    data: oldStudent,
    error: findError
  } = await supabase
    .from("siswa")
    .select(`
      id,
      nisn,
      nama,
      kelas_id,
      password,
      status
    `)
    .eq(
      "id",
      String(id).trim()
    )
    .maybeSingle();

  if (findError) {
    throw findError;
  }

  if (!oldStudent) {

    return response(404, {

      success: false,

      message:
        "Siswa tidak ditemukan."

    });

  }

  /* =====================================================
     DATA BARU
  ===================================================== */

  const updateData = {

    nisn:
      nisn ??
      oldStudent.nisn,

    nama:
      nama ??
      oldStudent.nama,

    kelas_id:
      kelasId ??
      oldStudent.kelas_id,

    password:
      password ??
      oldStudent.password,

    status:
      status ??
      oldStudent.status

  };

  /* =====================================================
     UPDATE
  ===================================================== */

  const {
    error: updateError
  } = await supabase
    .from("siswa")
    .update(updateData)
    .eq(
      "id",
      String(id).trim()
    );

  if (updateError) {

    /*
     * 23505 = duplicate key
     */

    if (
      updateError.code ===
      "23505"
    ) {

      return response(409, {

        success: false,

        message:
          "NISN sudah digunakan siswa lain."

      });

    }

    throw updateError;
  }

  return response(200, {

    success: true,

    message:
      "Data siswa berhasil diperbarui."

  });

}

/* =========================================================
   DELETE — HAPUS SISWA
========================================================= */

async function handleDelete(event) {

  const body =
    JSON.parse(event.body || "{}");

  const id =
    String(
      body.id || ""
    ).trim();

  if (!id) {

    return response(400, {

      success: false,

      message:
        "ID siswa wajib diisi."

    });

  }

  /* =====================================================
     CEK SISWA
  ===================================================== */

  const {
    data: siswa,
    error: siswaError
  } = await supabase
    .from("siswa")
    .select("id")
    .eq(
      "id",
      id
    )
    .maybeSingle();

  if (siswaError) {
    throw siswaError;
  }

  if (!siswa) {

    return response(404, {

      success: false,

      message:
        "Siswa tidak ditemukan."

    });

  }

  /* =====================================================
     HITUNG POIN
  ===================================================== */

  const {
    count: poinCount,
    error: countError
  } = await supabase
    .from("poin")
    .select(
      "id",
      {
        count: "exact",
        head: true
      }
    )
    .eq(
      "siswa_id",
      id
    );

  if (countError) {
    throw countError;
  }

  /* =====================================================
     HAPUS LOGIN CONTROL
  ===================================================== */

  const {
    error: loginError
  } = await supabase
    .from("login_control")
    .delete()
    .eq(
      "nisn",
      /*
       * login_control menggunakan NISN,
       * jadi ambil NISN siswa terlebih dahulu.
       */
      (
        await supabase
          .from("siswa")
          .select("nisn")
          .eq("id", id)
          .single()
      ).data?.nisn || ""
    );

  if (loginError) {
    throw loginError;
  }

  /* =====================================================
     HAPUS POIN
  ===================================================== */

  const {
    error: poinError
  } = await supabase
    .from("poin")
    .delete()
    .eq(
      "siswa_id",
      id
    );

  if (poinError) {
    throw poinError;
  }

  /* =====================================================
     HAPUS INBOX SISWA
     
     Diperlukan karena inbox memiliki FK ke siswa.
  ===================================================== */

  const {
    error: inboxError
  } = await supabase
    .from("inbox")
    .delete()
    .eq(
      "siswa_id",
      id
    );

  if (inboxError) {
    throw inboxError;
  }

  /* =====================================================
     HAPUS RIWAYAT KELAS
     
     Diperlukan karena riwayat_kelas memiliki FK ke siswa.
  ===================================================== */

  const {
    error: riwayatError
  } = await supabase
    .from("riwayat_kelas")
    .delete()
    .eq(
      "siswa_id",
      id
    );

  if (riwayatError) {
    throw riwayatError;
  }

  /* =====================================================
     HAPUS SISWA
  ===================================================== */

  const {
    error: deleteError
  } = await supabase
    .from("siswa")
    .delete()
    .eq(
      "id",
      id
    );

  if (deleteError) {
    throw deleteError;
  }

  return response(200, {

    success: true,

    message:
      "Siswa dan seluruh data terkait siswa berhasil dihapus.",

    poinTerhapus:
      poinCount || 0

  });

}

/* =========================================================
   PATCH — STATUS / PASSWORD / PINDAH
========================================================= */

async function handlePatch(event) {

  const body =
    JSON.parse(event.body || "{}");

  const {
    id,
    action,
    password
  } = body;

  if (!id) {

    return response(400, {

      success: false,

      message:
        "ID siswa wajib diisi."

    });

  }

  const siswaId =
    String(id).trim();

  /* =====================================================
     CARI SISWA
  ===================================================== */

  const {
    data: siswa,
    error: siswaError
  } = await supabase
    .from("siswa")
    .select(`
      id,
      nisn,
      nama,
      kelas_id,
      password,
      status
    `)
    .eq(
      "id",
      siswaId
    )
    .maybeSingle();

  if (siswaError) {
    throw siswaError;
  }

  if (!siswa) {

    return response(404, {

      success: false,

      message:
        "Siswa tidak ditemukan."

    });

  }

  /* =====================================================
     TOGGLE STATUS
  ===================================================== */

  if (
    action ===
    "toggle_status"
  ) {

    const oldStatus =
      String(
        siswa.status || ""
      )
        .trim()
        .toLowerCase();

    const newStatus =
      oldStatus === "aktif"
        ? "Nonaktif"
        : "Aktif";

    const {
      error
    } = await supabase
      .from("siswa")
      .update({
        status:
          newStatus
      })
      .eq(
        "id",
        siswaId
      );

    if (error) {
      throw error;
    }

    return response(200, {

      success: true,

      message:
        `Status siswa diubah menjadi ${newStatus}.`,

      status:
        newStatus

    });

  }

  /* =====================================================
     RESET PASSWORD
  ===================================================== */

  if (
    action ===
    "reset_password"
  ) {

    if (!password) {

      return response(400, {

        success: false,

        message:
          "Password baru wajib diisi."

      });

    }

    const {
      error
    } = await supabase
      .from("siswa")
      .update({
        password:
          String(password)
      })
      .eq(
        "id",
        siswaId
      );

    if (error) {
      throw error;
    }

    return response(200, {

      success: true,

      message:
        "Password berhasil direset."

    });

  }

  /* =====================================================
     PINDAH SISWA
  ===================================================== */

  if (
    action ===
    "move_student"
  ) {

    const {
      kelasId,
      alasan,
      admin
    } = body;

    if (!kelasId) {

      return response(400, {

        success: false,

        message:
          "Kelas tujuan wajib dipilih."

      });

    }

    const tujuanKelasId =
      String(
        kelasId
      ).trim();

    const kelasSekarangId =
      String(
        siswa.kelas_id || ""
      ).trim();

    /* ===================================================
       CEK KELAS SAMA
    =================================================== */

    if (
      kelasSekarangId ===
      tujuanKelasId
    ) {

      return response(400, {

        success: false,

        message:
          "Siswa sudah berada di kelas tersebut."

      });

    }

    /* ===================================================
       CARI KELAS SEKARANG
       DAN KELAS TUJUAN
    =================================================== */

    const {
      data: kelasRows,
      error: kelasError
    } = await supabase
      .from("kelas")
      .select(`
        id,
        nama_kelas,
        status
      `)
      .in(
        "id",
        [
          kelasSekarangId,
          tujuanKelasId
        ]
      );

    if (kelasError) {
      throw kelasError;
    }

    let kelasSekarang =
      "-";

    let kelasTujuan =
      "-";

    for (
      const kelas of kelasRows || []
    ) {

      if (
        String(kelas.id) ===
        kelasSekarangId
      ) {

        kelasSekarang =
          kelas.nama_kelas;

      }

      if (
        String(kelas.id) ===
        tujuanKelasId
      ) {

        kelasTujuan =
          kelas.nama_kelas;

      }

    }

    /* ===================================================
       KELAS TUJUAN TIDAK DITEMUKAN
    =================================================== */

    if (
      kelasTujuan === "-"
    ) {

      return response(400, {

        success: false,

        message:
          "Kelas tujuan tidak ditemukan."

      });

    }

    /* ===================================================
       UBAH KELAS SISWA
    =================================================== */

    const {
      error: updateError
    } = await supabase
      .from("siswa")
      .update({
        kelas_id:
          tujuanKelasId
      })
      .eq(
        "id",
        siswaId
      );

    if (updateError) {
      throw updateError;
    }

    /* ===================================================
       BUAT RIWAYAT
    =================================================== */

    const historyId =
      "RK" +
      Date.now()
        .toString()
        .slice(-8);

    /*
     * Gunakan tanggal lokal Indonesia.
     */

    const tanggal =
      new Intl.DateTimeFormat(
        "en-CA",
        {
          timeZone:
            "Asia/Jakarta",

          year:
            "numeric",

          month:
            "2-digit",

          day:
            "2-digit"
        }
      ).format(
        new Date()
      );

    const {
      error: historyError
    } = await supabase
      .from("riwayat_kelas")
      .insert({

        id:
          historyId,

        siswa_id:
          siswaId,

        dari_kelas_id:
          kelasSekarangId,

        ke_kelas_id:
          tujuanKelasId,

        alasan:
          alasan || "",

        tanggal,

        admin:
          admin || ""

      });

    if (historyError) {
      throw historyError;
    }

    return response(200, {

      success: true,

      message:
        `Siswa berhasil dipindahkan dari ${kelasSekarang} ke ${kelasTujuan}.`,

      siswa: {

        id:
          siswaId,

        dariKelasId:
          kelasSekarangId,

        dariKelas:
          kelasSekarang,

        keKelasId:
          tujuanKelasId,

        keKelas:
          kelasTujuan

      }

    });

  }

  /* =====================================================
     ACTION TIDAK DIKENALI
  ===================================================== */

  return response(400, {

    success: false,

    message:
      "Action tidak dikenali."

  });

}

/* =========================================================
   HANDLER UTAMA
========================================================= */

exports.handler =
  async (event) => {

    try {

      /* ===================================================
         GET
      =================================================== */

      if (
        event.httpMethod ===
        "GET"
      ) {

        const siswa =
          await getStudents();

        return response(200, {

          success: true,

          siswa

        });

      }

      /* ===================================================
         POST
      =================================================== */

      if (
        event.httpMethod ===
        "POST"
      ) {

        return await handlePost(
          event
        );

      }

      /* ===================================================
         PUT
      =================================================== */

      if (
        event.httpMethod ===
        "PUT"
      ) {

        return await handlePut(
          event
        );

      }

      /* ===================================================
         DELETE
      =================================================== */

      if (
        event.httpMethod ===
        "DELETE"
      ) {

        return await handleDelete(
          event
        );

      }

      /* ===================================================
         PATCH
      =================================================== */

      if (
        event.httpMethod ===
        "PATCH"
      ) {

        return await handlePatch(
          event
        );

      }

      /* ===================================================
         METHOD TIDAK DIIZINKAN
      =================================================== */

      return response(405, {

        success: false,

        message:
          "Method tidak diizinkan."

      });

    } catch (error) {

      console.error(
        "ADMIN STUDENTS ERROR:",
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
