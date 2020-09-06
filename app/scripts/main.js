import React from "react";
import ReactDOM from "react-dom";
import Tock from "tocktimer";

import config from "../../server/config";

const {
  width,
  height,
  spritesheetWidth,
  originalBpm,
  seconds,
  offset,
  spritesheetLocation,
} = config;
const frames = spritesheetWidth / width;

class GifToTheBeat extends React.Component {
  constructor() {
    super();
    this.state = {
      config: {
        ...config,
        mods: [],
      },
    };
    this.timers = [];
  }

  /**
   * Sets timers to sync the gif for the rest of the current songs duration.
   * One for each time the bpm will change, and one almost immediately
   *
   * @param {Object} config
   */
  syncToSong = (config) => {
    const { timingPoints, mapTime, isoTime } = config;

    // Clear previous timers
    this.timers.forEach((timer) => timer.stop());
    this.timers = [];

    // Calculate how far through the song is currently
    const msSinceSnapshot = new Date() - new Date(isoTime);
    const mapTimeInMs = mapTime * 1000 + msSinceSnapshot;

    let lastTimerSet;
    // Iterate through the timing points while setting timers
    // which change the bpm once they've counted down.
    // Reverse order allows ignoring any timing points that have already passed
    timingPoints.reverse().forEach((timingPoint) => {
      if (lastTimerSet) return;

      const [timingPointOffset, beatLength] = timingPoint.split(",");
      let msToNextBeat = timingPointOffset - mapTimeInMs;
      if (msToNextBeat < 0) {
        beatLength - (mapTimeInMs % beatLength);
        lastTimerSet = true;
      }

      let delay = msToNextBeat;
      // Start the gif before the next beat by the gif offset
      delay -= offset;
      // If there's not enough time for that, wait until the next beat
      while (delay < 0) delay += beatLength;

      // Use Tock as setTimeout is not precise
      const timer = Tock({
        countdown: true,
        complete: () => {
          this.setState({
            config: { ...config, bpm: (60 / beatLength) * 1000 },
          });
        },
      });
      const tockFriendlyDelay = Math.round(delay);
      timer.start(tockFriendlyDelay);
      this.timers.push(timer);
    });
  };

  /**
   * Handles the latest config from the server.
   * It starts by returning early if there's no need to re-sync the gif
   * to the song, so that the gif animation will not be interrupted
   *
   * @param {Object} config
   */
  handleConfig = (config) => {
    const { timingPoints, status, mapTime, osuFile } = config;

    const osuFileChanged = osuFile !== this.lastOsuFile;
    if (!osuFileChanged) {
      // Song is unchanged but many things can affect the time it's at
      const mapTimeMovedBackward = mapTime < this.lastMapTime;
      const mapTimeMovedAhead = mapTime - this.lastMapTime > 2000;
      if (!mapTimeMovedBackward && !mapTimeMovedAhead) {
        this.lastMapTime = mapTime;
        return;
      }
    }
    this.lastMapTime = mapTime;

    if (status === "Playing") {
      // Wait until the map time is past 0 since that would indicate loading has finished
      if (mapTime <= 0) return;
    } else if (status !== "Playing") {
      // The LiveData socket can still be sending data for the previous song for a while after a change
      if (!this.waitOneCycle) {
        this.waitOneCycle = true;
        return;
      } else {
        this.waitOneCycle = false;
      }
    }

    // Gif will be synced past this point
    this.lastOsuFile = osuFile;

    // Editing offers slower playback which would currently be difficult to detect,
    // and lots of pausing/rewinding. It's probably not worth trying to sync with
    if (status === "Editing")
      return this.setState({ config: { ...config, bpm: originalBpm } });

    // No timing points available for syncing to song
    if (!timingPoints || !timingPoints.length) return this.setState({ config });

    this.syncToSong(config);
  };

  loadConfig = () => {
    fetch("/config")
      .then((response) => response.json())
      .then(this.handleConfig)
      .catch((err) => {
        console.error(`Error loading config: ${err}`);
        console.error(`The config was: ${JSON.stringify(config)}`);
      });
  };

  componentDidMount() {
    setInterval(this.loadConfig, 500);
  }

  render() {
    if (!this.state.config) return null;

    const { mods, status } = this.state.config;
    let { bpm } = this.state.config;

    if (bpm == 0) {
      console.error(
        "StreamCompanion doesn't detect the bpm of maps added in the osu! session, using default bpm"
      );
      bpm = originalBpm;
    }

    if (status === "Playing") {
      const doubleTimeActive = mods.find((mod) => mod === "DT" || mod === "NC");
      if (doubleTimeActive) bpm *= 1.5;
      const halfTimeActive = mods.find((mod) => mod === "HT");
      if (halfTimeActive) bpm *= 0.75;
    }

    const newSeconds = (seconds * originalBpm) / bpm;

    return (
      <div
        // If a song rewinds and the bpm is the same then the style values here will not change either.
        // The gif needs to be redrawn to sync back to the song but React will not do that
        // if the render content is unchanged. Using this key ensures the render content changes
        key={this.state.config.mapTime}
        style={{
          width: `${width}px`,
          height: `${height}px`,
          background: `url(${spritesheetLocation}) left center`,
          animation: `play ${newSeconds}s steps(${frames}) infinite`,
        }}
      ></div>
    );
  }
}

ReactDOM.render(<GifToTheBeat />, document.getElementById("app"));
