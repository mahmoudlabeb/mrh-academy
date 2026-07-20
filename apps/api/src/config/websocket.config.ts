export const websocketCors = {
  origin: process.env.FRONTEND_URL ?? 'http://localhost:3000',
  credentials: true,
};
