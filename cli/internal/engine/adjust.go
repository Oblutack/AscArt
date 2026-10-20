package engine

import "image"

// These follow Pillow's ImageEnhance, which the Python engine uses: the
// picture is blended with a "degenerate" one (black for brightness, a flat
// gray of its average for contrast) by a factor, and the result is clipped.

func clipTruncated(v float64) uint8 {
	// Pillow converts to int (truncating toward zero) and then clips
	i := int(v)
	switch {
	case i < 0:
		return 0
	case i > 255:
		return 255
	}
	return uint8(i)
}

// adjustBrightness: value is -100..100, which becomes a factor of 0..2.
func adjustBrightness(img *image.NRGBA, value int) {
	if value == 0 {
		return
	}
	factor := 1.0 + float64(value)/100.0
	for i := 0; i < len(img.Pix); i += 4 {
		img.Pix[i] = clipTruncated(factor * float64(img.Pix[i]))
		img.Pix[i+1] = clipTruncated(factor * float64(img.Pix[i+1]))
		img.Pix[i+2] = clipTruncated(factor * float64(img.Pix[i+2]))
	}
}

// adjustContrast: value is 0..200 (100 leaves the picture alone), which
// becomes a factor of 0..2 around the picture's average brightness.
func adjustContrast(img *image.NRGBA, value int) {
	if value == 100 {
		return
	}
	factor := float64(value) / 100.0

	var sum int
	pixels := len(img.Pix) / 4
	for i := 0; i < len(img.Pix); i += 4 {
		sum += int(luma(img.Pix[i], img.Pix[i+1], img.Pix[i+2]))
	}
	mean := 0.0
	if pixels > 0 {
		mean = float64(int(float64(sum)/float64(pixels) + 0.5))
	}

	for i := 0; i < len(img.Pix); i += 4 {
		for c := range 3 {
			img.Pix[i+c] = clipTruncated(mean + factor*(float64(img.Pix[i+c])-mean))
		}
	}
}

func invert(img *image.NRGBA) {
	for i := 0; i < len(img.Pix); i += 4 {
		img.Pix[i] = 255 - img.Pix[i]
		img.Pix[i+1] = 255 - img.Pix[i+1]
		img.Pix[i+2] = 255 - img.Pix[i+2]
	}
}
