export function installGeometry(shield) {
  const { native } = shield;
  const freeze = (object, name, owner = object) => {
    let descriptor;
    for (let target = object; target && !descriptor; target = Object.getPrototypeOf(target)) descriptor = native.descriptor(target, name);
    if (!descriptor?.get) return;
    const initial = native.apply(descriptor.get, object, []);
    shield.patch(owner, name, { get() {
      const current = native.apply(descriptor.get, this, []);
      return this === object ? initial : current;
    } });
  };
  for (const name of ["innerWidth", "innerHeight", "outerWidth", "outerHeight", "screenX", "screenY", "screenLeft", "screenTop", "devicePixelRatio"]) freeze(window, name);
  for (const name of ["width", "height", "availWidth", "availHeight", "availLeft", "availTop", "colorDepth", "pixelDepth"]) freeze(screen, name, Screen.prototype);
  if (window.visualViewport) for (const name of ["width", "height", "scale", "offsetLeft", "offsetTop", "pageLeft", "pageTop"]) freeze(window.visualViewport, name, VisualViewport.prototype);
  if (screen.orientation) for (const name of ["type", "angle"]) freeze(screen.orientation, name, ScreenOrientation.prototype);
  shield.listen(window, "resize", event => { if (event.target === window) shield.block(event); });
  if (window.visualViewport) for (const type of ["resize", "scroll"]) shield.listen(window.visualViewport, type, event => shield.block(event));
  if (screen.orientation) shield.listen(screen.orientation, "change", event => shield.block(event));
  shield.features.geometry = true;
  shield.capabilities.geometry = true;
}
