import {
  complEventHandler,
  complEventEmitter,
} from "../events/completionEvents.js";

import { wabSocketRespond } from "../events/whatsappbotEvents.js";
import { useWhatsAppBot } from "../wabot/wabot.js";
import { bsnwWorker } from "../worker/bsnw.worker.js";

const whatsappBot = useWhatsAppBot();
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const modelsMap = [
  { name: "4.1 (Flagship)", value: "gpt-4.1-2025-04-14" },
  {
    name: "4.1 Mini (Cost-efficient - Flagship)",
    value: "gpt-4.1-mini-2025-04-14",
  },
  { name: "4.1 Nano", value: "gpt-4.1-nano-2025-04-14" },
];
let functions = [];

export const useAiCompletion = () => {
  const handleCompletion = async (socket, openai) => {
    socket.on(complEventHandler.ONCHAT, async (data) => {
      const options = { ...data.assistant_options };
      if (!validateModel(options.model)) {
        socket.emit(complEventEmitter.EMIT_RESPOND_END, {
          status: 401,
          error: true,
          message: "Invalid model selected",
        });
        return;
      }

      try {
        const conversation = formatConvo(options.memory, data.conversation);
        let messages = [];
        //Set prompt
        if (options.prompt) {
          messages.push({
            role: "system",
            content: options.prompt,
          });

          messages.push({
            role: "system",
            content:
              "Pengguna dapat mengirimkan file berupa gambar, PDF, dan Excel. Kamu dapat menjawab pertanyaan berdasarkan data yang terdapat pada file tersebut. Gunakan bahasa yang santai dan mudah dimengerti.",
          });
        }
        //Set conversation
        messages = messages.concat(conversation);
        const response = await openai.chat.completions.create({
          model: options.model,
          messages: messages,
          temperature: options.temperature || 0.7,
          top_p: options.top_p || 0.9,
          functions: functions.length > 0 ? functions : null,
          stream: false,
          function_call: "auto",
        });

        const choice = response.choices;
        if (choice[0].finish_reason === "function_call") {
          const functionName = choice[0].message.function_call.name;
          const functionArgs = choice[0].message.function_call.arguments;

          let systemPrompt =
            "Kamu adalah Respond Agent untuk fungsi Bot WhatsApp, tugas kamu memberikan respon ke pengguna apakah bot sedang diinisialisasi, apakah sedang menunggu QR Code atau update QR Code baru (mungkin pengguna tidak melakukan scan dan QR Code terlanjur refresh), atau apakah bot sudah siap, atau terjadi kesalahan di tiap prosesnya. Gunakan bahasa yang santai, gaul, dan asik serta mudah dipahami. Jika ada kesalahan, sertakan solusi. Pengguna mungkin awam dan tidak mengerti koding atau IT. Jawabannya singkat saja.";

          if (functionName === "startBsnwWorker") {
            const result = bsnwWorker.runWorker();
            const status = result.status;
            if (status === "running") {
              const agtMessage = [
                {
                  role: "system",
                  content: `Kamu adalah Respond agent. Kamu memberikan respon kepada pengguna bahwa fungsi BSNW Worker telah dimulai dan akan mengirimkan data setiap 5 detik. Gunakan bahasa yang santai dan mudah dimengerti.`,
                },
                {
                  role: "system",
                  content:
                    "BSNW Worker berhasil dijalankan. Worker akan mengirimkan pembaruan setiap 5 detik.",
                },
              ];
              const reaction = await respondAgent(agtMessage, openai, options);
              socket.emit(complEventEmitter.EMIT_RESPOND, {
                status: 200,
                data: {
                  content: reaction,
                },
              });
            }
          } else if (functionName === "stopBsnwWorker") {
            const result = bsnwWorker.stopWorker();
            const status = result.status;
            if (status === "stopped") {
              const agtMessage = [
                {
                  role: "system",
                  content: `Kamu adalah Respond agent. Kamu memberikan respon kepada pengguna bahwa fungsi BSNW Worker telah dihentikan`,
                },
                {
                  role: "system",
                  content:
                    "BSNW Worker berhasil dihentikan. Worker tidak akan mengirimkan pembaruan lagi.",
                },
              ];
              const reaction = await respondAgent(agtMessage, openai, options);
              socket.emit(complEventEmitter.EMIT_RESPOND, {
                status: 200,
                data: {
                  content: reaction,
                },
              });
            }
          } else if (functionName === "getBsnwData") {
            const bsnwData = await bsnwWorker.getBsnwData();
            let agtMessage = agtMessageComposer(
              "Kamu adalah Respond agent. Kamu memberikan respon kepada pengguna bahwa data BSNW telah berhasil diambil.",
              `Data BSNW terakhir: ${JSON.stringify(
                bsnwData
              )}. Berikan rekomendasi berdasarkan nilai ini.`
            );
            const reaction = await respondAgent(agtMessage, openai, options);
            socket.emit(complEventEmitter.EMIT_RESPOND, {
              status: 200,
              data: {
                content: reaction,
              },
            });
          } else if (functionName === "initWhatsAppBot") {
            whatsappBot.setSocketAndOpenAI(socket, openai);
            try {
              let agtMessage = agtMessageComposer(
                systemPrompt,
                `Permintaan inisiasi sudah dikirimkan. Silahkan mulai inisiasi Bot nya`
              );
              const reaction = await respondAgent(agtMessage, openai, options);
              socket.emit(complEventEmitter.EMIT_RESPOND, {
                status: 200,
                data: {
                  content: reaction,
                },
              });
              const bot = await whatsappBot.initializeBot();
              if (bot.status == "qr-received") {
                let agtMessage = agtMessageComposer(
                  systemPrompt,
                  `QR Code baru diterima. Beritahu pengguna untuk melakukan scan QR Code yang muncul dilayar pengguna`
                );
                const reaction = await respondAgent(
                  agtMessage,
                  openai,
                  options
                );
                socket.emit(complEventEmitter.EMIT_NEW_RESPOND, {
                  status: 200,
                  data: {
                    content: reaction,
                  },
                });

                socket.emit(wabSocketRespond.EMIT_ON_QR, {
                  payload: {
                    qr: bot.data,
                  },
                });
              }
            } catch (error) {
              let agtMessage = agtMessageComposer(
                systemPrompt,
                `Terjadi kesalahan saat menginisialisasi WhatsApp Bot: ${error}`
              );
              const reaction = await respondAgent(agtMessage, openai, options);
              socket.emit(complEventEmitter.EMIT_RESPOND, {
                status: 200,
                data: {
                  content: reaction,
                },
              });
            }

            whatsappBot.on("whatsapp-qr", async (bot) => {
              let agtMessage = agtMessageComposer(
                systemPrompt,
                `Update QR Code diterima. Beritahu pengguna untuk melakukan scan QR Code yang muncul dilayar pengguna`
              );
              const reaction = await respondAgent(agtMessage, openai, options);
              socket.emit(complEventEmitter.EMIT_NEW_RESPOND, {
                status: 200,
                data: {
                  content: reaction,
                },
              });

              socket.emit(wabSocketRespond.EMIT_ON_QR, {
                payload: {
                  qr: bot.data,
                },
              });
            });
          } else if (functionName === "destroyWhatsAppBot") {
            try {
              const result = await whatsappBot.destoryBotInstance();
              if (result.status === "destroyed") {
                let agtMessage = agtMessageComposer(
                  systemPrompt,
                  `User meminta agar WhatsApp Bot dihentikan. Silahkan eksekusi!`
                );
                const reaction = await respondAgent(
                  agtMessage,
                  openai,
                  options
                );
                socket.emit(complEventEmitter.EMIT_RESPOND, {
                  status: 200,
                  data: {
                    content: reaction,
                  },
                });
              }
            } catch (error) {
              let agtMessage = agtMessageComposer(
                systemPrompt,
                `Terjadi kesalahan saat menghentikan WhatsApp Bot: ${error}.`
              );
              const reaction = await respondAgent(agtMessage, openai, options);
              socket.emit(complEventEmitter.EMIT_RESPOND, {
                status: 200,
                data: {
                  content: reaction,
                },
              });
            }
          }
        } else {
          socket.emit(complEventEmitter.EMIT_RESPOND, {
            status: 200,
            data: {
              content: response.choices[0].message.content,
            },
          });
        }

        socket.emit(complEventEmitter.EMIT_RESPOND_END, {
          status: 200,
        });
      } catch (error) {
        console.error("Error in AI completion:", error);
        socket.emit(complEventEmitter.EMIT_RESPOND_ERROR, {
          status: 500,
          error: true,
          message: "Internal error: " + error,
        });
        return;
      }

      // const string = "Alfian Chandra";
      // //loop the string for testing
      // for (const s of string) {
      //   await delay(1000); // Simulate processing delay
      //   socket.emit(complEventEmitter.EMIT_RESPOND, {
      //     status: 200,
      //     data: {
      //       content: s,
      //     },
      //   });
      // }

      // socket.emit(complEventEmitter.EMIT_RESPOND_END, {
      //   status: 200,
      //   data: {
      //     content: "Processing complete",
      //   },
      // });
    });
  };

  const setFunctions = (func) => {
    functions = func;
  };

  return {
    handleCompletion,
    setFunctions,
  };
};

const agtMessageComposer = (systemPrompt, userMessage = "") => {
  return [
    {
      role: "system",
      content: systemPrompt,
    },
    {
      role: "user",
      content: userMessage,
    },
  ];
};

const respondAgent = (messages, openai, options) => {
  const convo = [];
  convo.push({
    role: "system",
    content:
      "Kamu adalah Respond Agent. Kamu memberikan respon kepada pengguna terkait function calls yang dilakukan oleh AI. Kamu adalah AI yang sangat ahli di bidang oil and gas, terutama di hulu migas, menguasai data kualitas crude oil (BS&W), SC, lakukan analisa saran dan rekomendasi dan faktor penyebab nilai BS&W tersebut terjadi. Berikan rekomendasi dan potensi faktor penyebab konkrit dan radikal terkait analisa BSNW. Gunakan bahasa yang santai, gaul, dan asik serta mudah dipahami. Pedoman kamu untuk menghitung nilai BSNW menggunakan persamaan ini: y = 0.130869 - 0.00052 * (spot3 - spot2)",
  });
  messages.forEach((msg) => {
    convo.push(msg);
  });
  return new Promise(async (resolve, reject) => {
    try {
      const response = await openai.chat.completions.create({
        model: options.model,
        messages: convo,
        max_tokens: options.max_tokens || 1000,
        temperature: 1,
        top_p: 1,
        stream: false,
      });

      resolve(response.choices[0].message.content);
    } catch (error) {
      reject(`Error in AI completion: ${error.message}`);
    }
  });
};

const validateModel = (model) => {
  return modelsMap.some((m) => m.value === model);
};

const formatConvo = (memory, conversation) => {
  const memoryLimit = memory;
  const lastKnownConvo = conversation.slice(-memoryLimit);
  const convo = lastKnownConvo.map((msg) => {
    if (msg.media == null) {
      return {
        role: msg.role,
        content: msg.message,
      };
    } else {
      let structure = [];
      msg.media.forEach((media) => {
        if (media.type === "image") {
          structure.push({
            type: "image_url",
            image_url: {
              url: media.data,
              detail: "auto",
            },
          });
        } else {
          structure.push({
            type: "text",
            text: `Berikut adalah data hasil ekstraksi dari file ${
              media.type
            } bernama ${media.name}: ${
              media.markdown == undefined ? media.data : media.markdown
            }`,
          });
        }
      });

      structure.push({
        type: "text",
        text: msg.message,
      });

      return {
        role: msg.role,
        content: structure,
      };
    }
  });

  return convo;
};
