export const websocketCors = {
  origin: (
    origin: string | undefined,
    callback: (error: Error | null, allowed?: boolean) => void,
  ) => {
    if (!origin) {
      callback(null, true);
      return;
    }
    const nodeEnv = process.env.NODE_ENV ?? 'development';
    const frontendUrl =
      process.env.FRONTEND_URL ??
      (nodeEnv === 'production' ? undefined : 'http://localhost:3000');
    const isLocalDevelopmentOrigin =
      nodeEnv !== 'production' &&
      (origin.startsWith('http://localhost') ||
        origin.startsWith('http://127.0.0.1'));
    callback(null, origin === frontendUrl || isLocalDevelopmentOrigin);
  },
  credentials: true,
};
