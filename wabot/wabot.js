import pkg from "whatsapp-web.js";
import axios from "axios";
import dotenv from "dotenv";
import qrcode from "qrcode";
import { EventEmitter } from "events";
const { Client, LocalAuth, MessageMedia, Location } = pkg;
const emitter = new EventEmitter();
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
dotenv.config();

export const useWhatsAppBot = () => {
  let socket = null;
  let openai = null;
  let isInitialized = false;
  const options = {
    localPath:
      "C:/Users/alfia/.cache/puppeteer/chrome/win64-121.0.6167.85/chrome-win64/chrome.exe",
    productionPath:
      "/root/.cache/puppeteer/chrome/linux-131.0.6778.204/chrome-linux64/chrome",
    dev: process.env.WABOT_DEV === "true",
    postfix: "@s.whatsapp.net",
    terminalAuth: true,
  };

  const client = new Client({
    authStrategy: new LocalAuth(),
    restartOnAuthFail: true,
    webVersion: "2.2409.2",
    webVersionCache: {
      remotePath:
        "https://raw.githubusercontent.com/wppconnect-team/wa-version/refs/heads/main/html/2.3000.1023290165-alpha.html",
      type: "remote",
    },
    puppeteer: {
      headless: false,
      executablePath: options.dev ? options.localPath : options.productionPath,
      args: [
        "--no-default-browser-check",
        "--disable-session-crashed-bubble",
        "--disable-dev-shm-usage",
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-accelerated-2d-canvas",
        "--no-first-run",
      ],
      takeoverOnConflict: true,
    },
  });

  const setSocketAndOpenAI = (s, o) => {
    socket = s;
    openai = o;
  };

  const initializeBot = () => {
    return new Promise(async (resolve, reject) => {
      try {
        if (isInitialized) {
          console.warn("WhatsApp Bot is already initialized.");
          return reject(new Error("Bot is already initialized."));
        }
        if (socket && openai) {
          client.initialize();
          setTimeout(() => {
            isInitialized = true;
            client.on("qr", async (qr) => {
              const qrImage = await qrcode.toDataURL(qr);
              emitter.emit("whatsapp-qr", {
                status: "qr-received",
                data: qrImage,
              });
              return resolve({ status: "qr-received", data: qrImage });
            });

            client.on("ready", async () => {
              console.log("WhatsApp Bot is ready!");
              emitter.emit("whatsapp-ready");
              return resolve({ status: "ready", data: qr });
            });
          }, 1000);
        } else {
          throw new Error(
            "Socket and OpenAI client must be set before initializing the bot."
          );
        }
      } catch (error) {
        console.error("Error initializing bot:", error);
        return reject(error);
      }
    });
  };

  const destoryBotInstance = () => {
    return new Promise(async (resolve, reject) => {
      try {
        if (isInitialized) {
          client.removeAllListeners();
          await client.destroy();
          isInitialized = false;
          console.log("WhatsApp Bot instance destroyed.");
          return resolve({ status: "destroyed" });
        } else {
          throw new Error("Bot instance is not initialized.");
        }
      } catch (error) {
        console.error("Error destroying bot instance:", error);
        return reject(error);
      }
    });
  };

  const on = (event, callback) => {
    emitter.on(event, callback);
  };

  return {
    client,
    initializeBot,
    setSocketAndOpenAI,
    on,
    destoryBotInstance,
  };
};
