export const cardImageAspectRatio = 1 / 0.86

type ImageCropBoxInput = {
  width: number
  height: number
  focusX: number
  focusY: number
  zoom: number
}

export function imageCropBox({ width, height, focusX, focusY, zoom }: ImageCropBoxInput) {
  const aspectRatio = cardImageAspectRatio
  let cropWidth = width
  let cropHeight = cropWidth / aspectRatio
  if (cropHeight > height) {
    cropHeight = height
    cropWidth = cropHeight * aspectRatio
  }

  cropWidth /= zoom
  cropHeight /= zoom
  const left = (width - cropWidth) * (focusX / 100)
  const top = (height - cropHeight) * (focusY / 100)

  const roundedWidth = Math.min(width, Math.round(cropWidth))
  const roundedHeight = Math.min(height, Math.round(cropHeight))
  return {
    left: Math.min(width - roundedWidth, Math.max(0, Math.round(left))),
    top: Math.min(height - roundedHeight, Math.max(0, Math.round(top))),
    width: roundedWidth,
    height: roundedHeight,
  }
}
