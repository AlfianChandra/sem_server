import axios from "axios";
import { EventEmitter } from "events";

const emitter = new EventEmitter();
let workerInterval = null;

export const bsnwWorker = {
  runWorker: () => {
    const apiUrl = "https://semapi.rndkito.com/api/flow/getBsnwLatestData";

    if (workerInterval) clearInterval(workerInterval);

    workerInterval = setInterval(async () => {
      try {
        const res = await axios.get(apiUrl);
        const spot3 = res.data.averageFlowRate.spot3;
        const spot2 = res.data.averageFlowRate.spot2;
        const x1 = spot3 - spot2;
        const y = 0.130869 - 0.00052 * x1;
        const bsnw = Number(y.toFixed(6));
        // 🔥 Emit event!
        emitter.emit("bsnw-update", {
          value: bsnw,
          timestamp: new Date().toISOString(),
          spot3,
          spot2,
        });
      } catch (err) {
        console.error("BSNW worker error:", err.message);
      }
    }, 5000);

    console.log("🧠 BSNW Worker started");
    return {
      status: "running",
    };
  },

  stopWorker: () => {
    if (workerInterval) clearInterval(workerInterval);
    console.log("🛑 BSNW Worker stopped");
    return {
      status: "stopped",
    };
  },

  getBsnwData: () => {
    return new Promise((resolve, reject) => {
      const apiUrl = "https://semapi.rndkito.com/api/flow/getBsnwLatestData";
      return axios
        .get(apiUrl)
        .then((res) => {
          const spot3 = res.data.averageFlowRate.spot3;
          const spot2 = res.data.averageFlowRate.spot2;
          const x1 = spot3 - spot2;
          const y = 0.130869 - 0.00052 * x1;
          resolve({
            bsnw_value: Number(y.toFixed(6)),
            timestamp: new Date().toISOString(),
            flowRate_spot3: spot3,
            flowRate_spot2: spot2,
            hint: "Untuk menghitung nilai BSNW, kami menggunakan rumus: y = 0.130869 - 0.00052 * (spot3 - spot2). Nilai BSNW di bawah 0.5 dianggap normal.",
          });
        })
        .catch((err) => {
          console.error("Error fetching BSNW data:", err.message);
          reject(err);
        });
    });
  },

  // ⬅️ expose emitter biar bisa di-subscribe
  on: (eventName, callback) => emitter.on(eventName, callback),
};
