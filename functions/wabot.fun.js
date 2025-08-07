export const useWaBotFun = () => {
  const getFunctions = () => {
    return [
      {
        name: "initWhatsAppBot",
        description:
          "Memulai WhatsApp Bot. Pastikan socket dan OpenAI client sudah di-set.",
      },
      {
        name: "destroyWhatsAppBot",
        description:
          "Menghentikan WhatsApp Bot. Fungsi ini akan menghancurkan instance bot yang sedang berjalan.",
      },
    ];
  };
  return {
    getFunctions,
  };
};
