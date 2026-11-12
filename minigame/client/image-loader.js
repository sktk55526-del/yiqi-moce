'use strict';
function loadImage(createImage, src, done, timeout = 12000) {
  let image, timer, finished = false;
  const finish = result => {
    if (finished) return; finished = true; clearTimeout(timer);
    if (image) image.onload = image.onerror = null;
    done(result);
  };
  timer = setTimeout(() => finish(null), timeout); timer?.unref?.();
  try {
    image = createImage(); image.onload = () => finish(image); image.onerror = () => finish(null); image.src = src;
  } catch { finish(null); }
}
module.exports = { loadImage };
