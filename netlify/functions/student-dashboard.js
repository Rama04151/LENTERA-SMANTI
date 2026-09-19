exports.handler = async (event) => {
  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      success: true,
      message: "Student dashboard function berjalan",
      poin: {
        penghargaan: 10,
        pelanggaran: 5
      },
      riwayat: [
        {
          id: "TEST001",
          jenis: "penghargaan",
          poin: 10,
          keterangan: "Data percobaan",
          tanggal: "19/09/2026"
        },
        {
          id: "TEST002",
          jenis: "pelanggaran",
          poin: 5,
          keterangan: "Data percobaan",
          tanggal: "19/09/2026"
        }
      ]
    })
  };
};
