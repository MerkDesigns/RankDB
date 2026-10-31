export interface Point { readonly x: number; readonly y: number }
export interface MenuBounds { readonly left: number; readonly right: number; readonly top: number; readonly bottom: number }

/** A corridor from the last point over the trigger to the submenu's near edge, on either side. */
export function aimsAtSubmenu(origin: Point, pointer: Point, bounds: MenuBounds): boolean {
  const edge = origin.x < bounds.left ? bounds.left : bounds.right;
  const direction = Math.sign(edge - origin.x);
  const travel = (pointer.x - origin.x) * direction;
  const width = Math.abs(edge - origin.x);
  if (travel <= 0 || travel > width || width === 0) return false;
  const fraction = travel / width;
  const top = origin.y + (bounds.top - 8 - origin.y) * fraction;
  const bottom = origin.y + (bounds.bottom + 8 - origin.y) * fraction;
  return pointer.y >= top && pointer.y <= bottom;
}
