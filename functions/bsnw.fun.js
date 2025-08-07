export const useBswnFun = () => {
  const getFunctions = () => {
    return [
      {
        name: "startBsnwWorker",
        description:
          "Menjalankan fungsi worker untuk mendapatkan data BSNW (Basic Sediment & Water) secara berkala. Fungsi ini akan memeriksa data bsnw tiap 5 detik, jika nilai bsnw mencapai 0.5 keatas, maka notifikasi via WhatsApp akan diberikan ke user",
      },
      {
        name: "stopBsnwWorker",
        description: "Menghentikan fungsi worker yang mendapatkan data BSNW.",
      },
      {
        name: "getBsnwData",
        description: "Mengambil data BSNW (Basic Sediment & Water) terbaru. Nilai dibawah 0.5 dianggap Normal",
      },
    ];
  };
  return {
    getFunctions,
  };
};
