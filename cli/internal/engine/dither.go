package engine

import "image"

// halftone draws a black and white picture with Floyd-Steinberg dithering:
// every dot is a solid block or a space, and the error of each rounded pixel
// is spread over its neighbours so the average brightness is kept.
func halftone(img *image.NRGBA) *Grid {
	cols, rows := img.Bounds().Dx(), img.Bounds().Dy()

	gray := make([]float32, cols*rows)
	for y := range rows {
		for x := range cols {
			i := img.PixOffset(x, y)
			gray[y*cols+x] = float32(luma(img.Pix[i], img.Pix[i+1], img.Pix[i+2]))
		}
	}

	grid := NewGrid(cols, rows, false)
	for y := range rows {
		for x := range cols {
			old := gray[y*cols+x]
			var rounded float32
			if old > 128 {
				rounded = 255
			}
			if rounded == 0 {
				grid.Set(x, y, '█', RGB{})
			}

			diff := old - rounded
			if x+1 < cols {
				gray[y*cols+x+1] += diff * 7 / 16
			}
			if y+1 < rows {
				if x > 0 {
					gray[(y+1)*cols+x-1] += diff * 3 / 16
				}
				gray[(y+1)*cols+x] += diff * 5 / 16
				if x+1 < cols {
					gray[(y+1)*cols+x+1] += diff * 1 / 16
				}
			}
		}
	}
	return grid
}
