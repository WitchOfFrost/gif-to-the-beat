// ============================================
//     Changing settings requires a restart
// ============================================

// Dimensions of the gif
const width = 112;
const height = 112;
const spritesheetWidth = 16016;
// "BPM" of the Original gif
const originalBpm = 136.8;
// Length of the original gif
const seconds = 5.69;
// The location of the gif in sprite sheet form,
// either a URL or a file within the images folder
const spritesheetLocation = "./catjam-spritesheet.png";

// The port the server will run on
const port = 727;

module.exports = {
  width,
  height,
  spritesheetWidth,
  spritesheetLocation,
  originalBpm,
  seconds,
  port,
};
