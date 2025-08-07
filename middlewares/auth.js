import jwt from "jsonwebtoken";
const routerExclusions = ["/socket.io"];
const allowedOrigins = [
  "http://localhost:5173", //Frontend devserver - Vite
  "http://localhost:3000", //Self
  "PostmanRuntime", //Postman
];

export const useAuthVerifier = (req, res, next) => {
  //Route Exclusion
  const route = req.originalUrl;
  if (routerExclusions.some((path) => route.startsWith(path))) {
    return next();
  }

  const userOrigin =
    req.headers["origin"] ||
    req.headers["referer"] ||
    req.headers["user-agent"];
  if (!allowedOrigins.some((origin) => userOrigin?.includes(origin))) {
    return res
      .status(403)
      .json({ status: 403, message: "Forbidden - Unauthorized Origin" });
  }

  const token = req.headers["authorization"]?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "Unauthorized" });

  try {
    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
      if (err) {
        if (err.name === "TokenExpiredError") {
          return res.status(401).json({ message: "Token expired" });
        } else if (err.name === "JsonWebTokenError") {
          return res.status(401).json({ message: "Invalid token" });
        }
      }

      req.user = user;
      next();
    });
  } catch (error) {
    console.error("JWT verification error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};
