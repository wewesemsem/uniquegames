/**
 * Shared player world pose for proximity / approach triggers.
 * Player writes each frame; SceneInteractionSystem reads.
 */

export const playerPose = {
  x: 0,
  y: 1.6,
  z: 6,
  set(x, y, z) {
    this.x = x
    this.y = y
    this.z = z
  },
}
