/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_USER_URL: string;
  readonly VITE_CHAT_URL: string;
  readonly VITE_GATEWAY_URL: string;
  readonly VITE_PRESENCE_URL: string;
  readonly VITE_NOTIFICATION_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}