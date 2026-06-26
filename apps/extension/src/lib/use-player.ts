import { useCallback, useEffect, useState } from "react";
import browser from "webextension-polyfill";

import { PLAYER_LIVE_KEY, isPlayerState } from "../offscreen/protocol";
import type { PlayerCommand, PlayerState } from "./player-state";

// Subscribes to live player state: seeds from the session-storage snapshot (so a
// freshly-opened popup/new-tab renders now-playing immediately) then stays live
// via the audio context's broadcasts. Commands are sent to the background,
// which routes them to the audio context (creating it on demand).
export function usePlayer(): {
  state: PlayerState | null;
  send: (command: PlayerCommand) => void;
} {
  const [state, setState] = useState<PlayerState | null>(null);

  useEffect(() => {
    void browser.storage.session.get(PLAYER_LIVE_KEY).then((r) => {
      const live = r[PLAYER_LIVE_KEY] as PlayerState | undefined;
      if (live) setState(live);
    });

    const listener = (msg: unknown): void => {
      if (isPlayerState(msg)) setState(msg.state);
    };
    browser.runtime.onMessage.addListener(listener);
    return () => browser.runtime.onMessage.removeListener(listener);
  }, []);

  const send = useCallback((command: PlayerCommand) => {
    void browser.runtime.sendMessage({
      target: "background",
      type: "player-command",
      command,
    });
  }, []);

  return { state, send };
}
