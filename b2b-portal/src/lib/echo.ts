import Echo from "laravel-echo";
import Pusher from "pusher-js";

if (typeof window !== "undefined") {
  // Setup Pusher on the window object so Echo can find it
  window.Pusher = Pusher;
}

// We only initialize Echo on the client side
export const getEcho = () => {
  if (typeof window === "undefined") {
    return null;
  }

  // Create a singleton instance if it doesn't exist
  if (!window.Echo) {
    window.Echo = new Echo({
      broadcaster: "reverb",
      key: process.env.NEXT_PUBLIC_REVERB_APP_KEY,
      wsHost: process.env.NEXT_PUBLIC_REVERB_HOST,
      wsPort: process.env.NEXT_PUBLIC_REVERB_PORT ? Number(process.env.NEXT_PUBLIC_REVERB_PORT) : 80,
      wssPort: process.env.NEXT_PUBLIC_REVERB_PORT ? Number(process.env.NEXT_PUBLIC_REVERB_PORT) : 443,
      forceTLS: (process.env.NEXT_PUBLIC_REVERB_SCHEME ?? "https") === "https",
      enabledTransports: ["ws", "wss"],
    });
  }

  return window.Echo;
};

// Global augmentation for TypeScript
declare global {
  interface Window {
    Pusher: typeof Pusher;
    Echo: any;
  }
}

