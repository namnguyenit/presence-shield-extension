export function installPointer(shield) {
  "use strict";
  if (!shield || shield.features.pointer) return;
  for (const type of ["mouseout", "mouseleave", "pointerout", "pointerleave"]) {
    shield.listen(window, type, event => {
      if (event.relatedTarget == null) shield.block(event);
    });
  }
  for (const type of ["mouseover", "mouseenter", "pointerover", "pointerenter"]) shield.listen(window, type, event => {
    if (event.relatedTarget == null && [window, document, document.documentElement, document.body].includes(event.target)) shield.block(event);
  });
  shield.features.pointer = true;
}
