export type MoveVector = { x: number; z: number };

export function firstPersonMoveVector(
  strafe: number,
  forwardAxis: number,
  yaw: number,
): MoveVector {
  const forwardX = -Math.sin(yaw);
  const forwardZ = -Math.cos(yaw);
  const rightX = Math.cos(yaw);
  const rightZ = -Math.sin(yaw);
  return {
    x: rightX * strafe + forwardX * -forwardAxis,
    z: rightZ * strafe + forwardZ * -forwardAxis,
  };
}
