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

function createId(prefix) {
  return prefix + Date.now() + Math.random().toString(36).slice(2, 7);
}

function clean(value) {
  return String(value || "").trim();
}

exports.handler = async function (event) {
  try {
    const method = event.httpMethod;

    // =====================================================
    // GET — AMBIL EVENT DAN HASIL VOTE
    // =====================================================

    if (method === "GET") {
      const { data: events, error: eventError } = await supabase
        .from("vote_events")
        .select("*")
        .order("dibuat", { ascending: false });

      if (eventError) {
        console.error("GET VOTE EVENTS:", eventError);
        return response(500, {
          success: false,
          message: "Gagal mengambil event voting.",
          error: eventError.message
        });
      }

      const { data: options, error: optionError } = await supabase
        .from("vote_options")
        .select("*")
        .order("urutan", { ascending: true });

      if (optionError) {
        return response(500, {
          success: false,
          message: "Gagal mengambil opsi voting.",
          error: optionError.message
        });
      }

      const { data: votes, error: voteError } = await supabase
        .from("vote_votes")
        .select("id,event_id,option_id,siswa_id");

      if (voteError) {
        return response(500, {
          success: false,
          message: "Gagal mengambil suara voting.",
          error: voteError.message
        });
      }

      const { data: students, error: studentError } = await supabase
        .from("siswa")
        .select("id,status");

      if (studentError) {
        return response(500, {
          success: false,
          message: "Gagal mengambil data siswa.",
          error: studentError.message
        });
      }

      const activeStudentIds = new Set(
        (students || [])
          .filter(s => clean(s.status) === "Aktif")
          .map(s => String(s.id))
      );

      const result = (events || []).map(ev => {
        const eventOptions = (options || [])
          .filter(op => String(op.event_id) === String(ev.id))
          .map(op => {
            const optionVotes = (votes || []).filter(
              v =>
                String(v.event_id) === String(ev.id) &&
                String(v.option_id) === String(op.id)
            );

            return {
              id: op.id,
              namaOpsi: op.nama_opsi,
              urutan: op.urutan,
              jumlahSuara: optionVotes.length
            };
          });

        const eventVotes = (votes || []).filter(
          v => String(v.event_id) === String(ev.id)
        );

        const voterIds = new Set(
          eventVotes
            .map(v => String(v.siswa_id))
            .filter(id => activeStudentIds.has(id))
        );

        return {
          id: ev.id,
          judul: ev.judul,
          deskripsi: ev.deskripsi || "",
          bolehPilihBanyak: Boolean(ev.boleh_pilih_banyak),
          bolehGantiPilihan: Boolean(ev.boleh_ganti_pilihan),
          tampilkanHasilSiswa: Boolean(ev.tampilkan_hasil_siswa),
          status: ev.status,
          dibuat: ev.dibuat,
          dibuatOleh: ev.dibuat_oleh || "",
          opsi: eventOptions,
          totalPemilih: voterIds.size,
          totalSiswaAktif: activeStudentIds.size,
          belumMemilih: Math.max(0, activeStudentIds.size - voterIds.size)
        };
      });

      return response(200, {
        success: true,
        events: result
      });
    }

    // =====================================================
    // POST — BUAT EVENT
    // =====================================================

    if (method === "POST") {
      const body = JSON.parse(event.body || "{}");

      const judul = clean(body.judul);
      const deskripsi = clean(body.deskripsi);
      const opsi = Array.isArray(body.opsi) ? body.opsi : [];

      if (!judul) {
        return response(400, {
          success: false,
          message: "Judul event wajib diisi."
        });
      }

      const cleanOptions = opsi
        .map(item => clean(item))
        .filter(Boolean);

      if (cleanOptions.length < 2) {
        return response(400, {
          success: false,
          message: "Minimal harus ada 2 opsi voting."
        });
      }

      if (new Set(cleanOptions.map(x => x.toLowerCase())).size !== cleanOptions.length) {
        return response(400, {
          success: false,
          message: "Nama opsi tidak boleh duplikat."
        });
      }

      const eventId = createId("VOTE");

      const { error: insertEventError } = await supabase
        .from("vote_events")
        .insert({
          id: eventId,
          judul,
          deskripsi,
          boleh_pilih_banyak: Boolean(body.bolehPilihBanyak),
          boleh_ganti_pilihan: Boolean(body.bolehGantiPilihan),
          tampilkan_hasil_siswa: Boolean(body.tampilkanHasilSiswa),
          status: "Ditutup",
          dibuat_oleh: clean(body.admin) || "Admin"
        });

      if (insertEventError) {
        console.error("CREATE VOTE EVENT:", insertEventError);
        return response(500, {
          success: false,
          message: "Gagal membuat event voting.",
          error: insertEventError.message
        });
      }

      const optionRows = cleanOptions.map((nama, index) => ({
        id: createId("OPT"),
        event_id: eventId,
        nama_opsi: nama,
        urutan: index + 1
      }));

      const { error: insertOptionsError } = await supabase
        .from("vote_options")
        .insert(optionRows);

      if (insertOptionsError) {
        await supabase.from("vote_events").delete().eq("id", eventId);

        return response(500, {
          success: false,
          message: "Event dibuat, tetapi opsi gagal disimpan.",
          error: insertOptionsError.message
        });
      }

      return response(200, {
        success: true,
        message: "Event voting berhasil dibuat.",
        eventId
      });
    }

    // =====================================================
    // PUT — EDIT EVENT / TAMBAH OPSI / UBAH STATUS
    // =====================================================

    if (method === "PUT") {
      const body = JSON.parse(event.body || "{}");

      const eventId = clean(body.id);

      if (!eventId) {
        return response(400, {
          success: false,
          message: "ID event wajib diisi."
        });
      }

      const { data: existing, error: findError } = await supabase
        .from("vote_events")
        .select("*")
        .eq("id", eventId)
        .maybeSingle();

      if (findError) {
        return response(500, {
          success: false,
          message: "Gagal memeriksa event.",
          error: findError.message
        });
      }

      if (!existing) {
        return response(404, {
          success: false,
          message: "Event tidak ditemukan."
        });
      }

      // Ubah status event
      if (body.aksi === "status") {
        const status = clean(body.status);

        if (!["Aktif", "Ditutup"].includes(status)) {
          return response(400, {
            success: false,
            message: "Status event tidak valid."
          });
        }

        const { error } = await supabase
          .from("vote_events")
          .update({
            status,
            diperbarui: new Date().toISOString()
          })
          .eq("id", eventId);

        if (error) {
          return response(500, {
            success: false,
            message: "Gagal mengubah status event.",
            error: error.message
          });
        }

        return response(200, {
          success: true,
          message: status === "Aktif"
            ? "Voting berhasil dibuka."
            : "Voting berhasil ditutup."
        });
      }

      // Tambah opsi
      if (body.aksi === "tambah_opsi") {
        const namaOpsi = clean(body.namaOpsi);

        if (!namaOpsi) {
          return response(400, {
            success: false,
            message: "Nama opsi wajib diisi."
          });
        }

        const { data: oldOptions, error: oldError } = await supabase
          .from("vote_options")
          .select("id,nama_opsi,urutan")
          .eq("event_id", eventId);

        if (oldError) {
          return response(500, {
            success: false,
            message: "Gagal memeriksa opsi.",
            error: oldError.message
          });
        }

        const duplicate = (oldOptions || []).some(
          op => clean(op.nama_opsi).toLowerCase() === namaOpsi.toLowerCase()
        );

        if (duplicate) {
          return response(400, {
            success: false,
            message: "Opsi tersebut sudah tersedia."
          });
        }

        const { error } = await supabase
          .from("vote_options")
          .insert({
            id: createId("OPT"),
            event_id: eventId,
            nama_opsi: namaOpsi,
            urutan: (oldOptions || []).length + 1
          });

        if (error) {
          return response(500, {
            success: false,
            message: "Gagal menambahkan opsi.",
            error: error.message
          });
        }

        return response(200, {
          success: true,
          message: "Opsi berhasil ditambahkan."
        });
      }

      // Edit informasi event
      const judul = clean(body.judul);
      const deskripsi = clean(body.deskripsi);

      if (!judul) {
        return response(400, {
          success: false,
          message: "Judul event wajib diisi."
        });
      }

      const { error: updateError } = await supabase
        .from("vote_events")
        .update({
          judul,
          deskripsi,
          boleh_pilih_banyak: Boolean(body.bolehPilihBanyak),
          boleh_ganti_pilihan: Boolean(body.bolehGantiPilihan),
          tampilkan_hasil_siswa: Boolean(body.tampilkanHasilSiswa),
          diperbarui: new Date().toISOString()
        })
        .eq("id", eventId);

      if (updateError) {
        return response(500, {
          success: false,
          message: "Gagal memperbarui event.",
          error: updateError.message
        });
      }

      return response(200, {
        success: true,
        message: "Event berhasil diperbarui."
      });
    }

    // =====================================================
    // DELETE — HAPUS OPSI / EVENT
    // =====================================================

    if (method === "DELETE") {
      const body = JSON.parse(event.body || "{}");

      const eventId = clean(body.eventId);
      const optionId = clean(body.optionId);

      // Hapus satu opsi
      if (optionId) {
        const { data: option, error: findOptionError } = await supabase
          .from("vote_options")
          .select("id,event_id")
          .eq("id", optionId)
          .maybeSingle();

        if (findOptionError) {
          return response(500, {
            success: false,
            message: "Gagal memeriksa opsi.",
            error: findOptionError.message
          });
        }

        if (!option || String(option.event_id) !== eventId) {
          return response(404, {
            success: false,
            message: "Opsi tidak ditemukan."
          });
        }

        const { count, error: countError } = await supabase
          .from("vote_votes")
          .select("id", { count: "exact", head: true })
          .eq("option_id", optionId);

        if (countError) {
          return response(500, {
            success: false,
            message: "Gagal memeriksa suara opsi.",
            error: countError.message
          });
        }

        if (count > 0) {
          return response(400, {
            success: false,
            message: "Opsi sudah memiliki suara dan tidak dapat dihapus."
          });
        }

        const { error } = await supabase
          .from("vote_options")
          .delete()
          .eq("id", optionId);

        if (error) {
          return response(500, {
            success: false,
            message: "Gagal menghapus opsi.",
            error: error.message
          });
        }

        return response(200, {
          success: true,
          message: "Opsi berhasil dihapus."
        });
      }

      // Hapus event
      if (!eventId) {
        return response(400, {
          success: false,
          message: "ID event wajib diisi."
        });
      }

      const { data: eventData, error: eventFindError } = await supabase
        .from("vote_events")
        .select("id")
        .eq("id", eventId)
        .maybeSingle();

      if (eventFindError) {
        return response(500, {
          success: false,
          message: "Gagal memeriksa event.",
          error: eventFindError.message
        });
      }

      if (!eventData) {
        return response(404, {
          success: false,
          message: "Event tidak ditemukan."
        });
      }

      // Hapus suara, opsi, lalu event
      const { error: deleteVotesError } = await supabase
        .from("vote_votes")
        .delete()
        .eq("event_id", eventId);

      if (deleteVotesError) {
        return response(500, {
          success: false,
          message: "Gagal menghapus suara event.",
          error: deleteVotesError.message
        });
      }

      const { error: deleteOptionsError } = await supabase
        .from("vote_options")
        .delete()
        .eq("event_id", eventId);

      if (deleteOptionsError) {
        return response(500, {
          success: false,
          message: "Gagal menghapus opsi event.",
          error: deleteOptionsError.message
        });
      }

      const { error: deleteEventError } = await supabase
        .from("vote_events")
        .delete()
        .eq("id", eventId);

      if (deleteEventError) {
        return response(500, {
          success: false,
          message: "Gagal menghapus event.",
          error: deleteEventError.message
        });
      }

      return response(200, {
        success: true,
        message: "Event dan seluruh datanya berhasil dihapus."
      });
    }

    return response(405, {
      success: false,
      message: "Method tidak diizinkan."
    });

  } catch (error) {
    console.error("ADMIN VOTE ERROR:", error);

    return response(500, {
      success: false,
      message: "Terjadi kesalahan server.",
      error: error.message
    });
  }
};
