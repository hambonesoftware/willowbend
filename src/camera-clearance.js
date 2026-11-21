// Test a camera boom against oriented building envelopes. This avoids raycasting
// the entire baked landscape every frame, while keeping the camera out of roofs.
export function buildingHit(start, end, building) {
  const c = Math.cos(building.yaw), s = Math.sin(building.yaw);
  const local = point => [c * (point.x - building.x) - s * (point.z - building.z), point.y - building.y,
    s * (point.x - building.x) + c * (point.z - building.z)];
  const a = local(start), b = local(end), low = [-building.w, 0, -building.d], high = [building.w, building.h, building.d];
  let enter = 0, leave = 1;
  for (let axis = 0; axis < 3; axis++) {
    const direction = b[axis] - a[axis];
    if (Math.abs(direction) < .000001) {
      if (a[axis] < low[axis] || a[axis] > high[axis]) return 1;
    } else {
      const t1 = (low[axis] - a[axis]) / direction, t2 = (high[axis] - a[axis]) / direction;
      enter = Math.max(enter, Math.min(t1, t2)); leave = Math.min(leave, Math.max(t1, t2));
      if (enter > leave) return 1;
    }
  }
  return enter;
}

export function clearCamera(pivot, desired, buildings) {
  const clearance = point => Math.min(1, ...buildings.map(building => buildingHit(pivot, point, building)));
  if (clearance(desired) >= 1) return desired;
  const dx = desired.x - pivot.x, dz = desired.z - pivot.z;
  let best = desired, fraction = clearance(desired);
  // Prefer a nearby open angle before shortening the boom. The user's stored
  // yaw and zoom stay intact and resume when the building no longer blocks them.
  for (const angle of [.52, -.52, 1.05, -1.05, 1.57, -1.57]) {
    const c = Math.cos(angle), s = Math.sin(angle);
    const candidate = { x: pivot.x + dx * c - dz * s, y: desired.y, z: pivot.z + dx * s + dz * c };
    const clear = clearance(candidate);
    if (clear >= 1) return candidate;
    if (clear > fraction) { best = candidate; fraction = clear; }
  }
  const distance = Math.hypot(best.x - pivot.x, best.y - pivot.y, best.z - pivot.z);
  const stop = Math.max(0, fraction - .35 / distance);
  return { x: pivot.x + (best.x - pivot.x) * stop, y: pivot.y + (best.y - pivot.y) * stop, z: pivot.z + (best.z - pivot.z) * stop };
}
