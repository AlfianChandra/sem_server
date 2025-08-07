import app from "./app.js";
import http from "http";
import { Server } from "socket.io";
import OpenAI from "openai";
import { bsnwWorker } from "./worker/bsnw.worker.js";
import { useBswnFun } from "./functions/bsnw.fun.js";
import { useWaBotFun } from "./functions/wabot.fun.js";
import { useAiCompletion } from "./controllers/ai.completion.ctrl.js";
import dotenv from "dotenv";
dotenv.config({
  silent: true,
});
const aiCompletionController = useAiCompletion();
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const server = http.createServer(app);
const io = new Server(server, {
  path: process.env.SOCKET_PATH || "/socket.io",
  cors: {
    origin: process.env.SOCKET_ORIGINS?.split(" ") || [
      "http://localhost:3000",
      "http://localhost:5173",
    ],
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket) => {
  console.log("A user connected", socket.id);
  let funs = [];
  funs = funs.concat(useBswnFun().getFunctions());
  funs = funs.concat(useWaBotFun().getFunctions());
  if (funs && funs.length > 0) {
    aiCompletionController.setFunctions(funs);
  }
  aiCompletionController.handleCompletion(socket, openai);
  socket.on("disconnect", () => {
    console.log("User disconnected", socket.id);
  });
});

server.listen(process.env.PORT || 3000, () => {
  console.log(`Server is running on port ${process.env.PORT || 3000}`);
  bsnwWorker.on("bsnw-update", (data) => {
    console.log(data.value);
  });
});
