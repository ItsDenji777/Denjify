const CLIENT_ID = '1510625208825020467';

class DiscordRPC {
  constructor() {
    this.ws = null;
    this.connected = false;
    this.lastActivity = null;
  }

  connect() {
    if (this.ws) return;

    try {
      this.ws = new WebSocket(
        `ws://127.0.0.1:6463/?v=1&client_id=${CLIENT_ID}`
      );

      this.ws.onopen = () => {
        console.log('[Discord RPC] Connected');
        this.connected = true;

        if (this.lastActivity) {
          this.sendActivity(this.lastActivity);
        }
      };

      this.ws.onclose = () => {
        console.log('[Discord RPC] Disconnected');

        this.connected = false;
        this.ws = null;

        setTimeout(() => this.connect(), 3000);
      };

      this.ws.onerror = (err) => {
        console.error('[Discord RPC]', err);
      };
    } catch (err) {
      console.error(err);
    }
  }

  send(payload) {
    if (
      !this.ws ||
      this.ws.readyState !== WebSocket.OPEN
    ) {
      return;
    }

    this.ws.send(JSON.stringify(payload));
  }

  sendActivity(activity) {
    this.send({
      cmd: 'SET_ACTIVITY',
      nonce: Date.now().toString(),
      args: {
        pid: 1,
        activity
      }
    });
  }

  setActivity({
    title,
    artist,
    startTimestamp,
    endTimestamp,
    paused = false
  }) {
    const activity = {
      application_id: CLIENT_ID,

      type: 2, // Listening

      details: title || 'Unknown Track',

      state: artist || 'Unknown Artist',

      timestamps:
        !paused &&
        startTimestamp &&
        endTimestamp
          ? {
              start: Math.floor(startTimestamp),
              end: Math.floor(endTimestamp)
            }
          : undefined,

      assets: {
        large_image: 'logo',
        large_text: 'Denjify'
      },

      metadata: {
        artist_ids: []
      }
    };

    this.lastActivity = activity;

    if (!this.connected) return;

    this.sendActivity(activity);
  }

  clearActivity() {
    this.lastActivity = null;

    if (!this.connected) return;

    this.sendActivity(null);
  }
}

export default new DiscordRPC();