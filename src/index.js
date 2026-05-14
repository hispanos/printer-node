const http = require("http");
const express = require("express");
const cors = require("cors");
const { Server } = require("socket.io");

const PORT = Number(process.env.PORT) || 3000;
const PRINTER_EVENT = process.env.PRINTER_SOCKET_EVENT || "printer";

function roomIdForEmpresa(nombreEmpresa) {
  const name = String(nombreEmpresa ?? "").trim();
  if (!name) {
    return null;
  }
  return `empresa:${name}`;
}

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "1mb" }));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: true, credentials: true },
});

io.on("connection", (socket) => {
  socket.emit("connected", { socketId: socket.id });

  socket.on("register_printer", (data) => {
    const room = roomIdForEmpresa(data?.nombre_empresa);
    if (!room) {
      socket.emit("register_printer_error", {
        message: "nombre_empresa es obligatorio y no puede estar vacío.",
      });
      return;
    }
    socket.join(room);
    socket.emit("registered_printer", {
      nombre_empresa: String(data.nombre_empresa).trim(),
      room,
    });
  });
});

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/printer", (req, res) => {
  const payload = req.body;

  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
    return res.status(400).json({
      success: false,
      message: "El cuerpo debe ser un objeto JSON.",
    });
  }

  const room = roomIdForEmpresa(payload.nombre_empresa);
  if (!room) {
    return res.status(400).json({
      success: false,
      message: "El JSON debe incluir nombre_empresa (texto no vacío).",
    });
  }

  io.to(room).emit(PRINTER_EVENT, payload);

  return res.status(202).json({
    success: true,
    message: "Evento emitido a los clientes de esa empresa.",
    data: { event: PRINTER_EVENT, nombre_empresa: String(payload.nombre_empresa).trim() },
  });
});

server.listen(PORT, () => {
  console.log(`HTTP + Socket.IO en http://localhost:${PORT}`);
  console.log(
    `POST JSON → http://localhost:${PORT}/printer (evento "${PRINTER_EVENT}", sala por nombre_empresa)`,
  );
});
