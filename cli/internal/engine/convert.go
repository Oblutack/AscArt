package engine

import (
	"context"
	"image"
	"image/color"
	"image/draw"
)

// toOpaque copies a picture onto a white background, as RGBA bytes with no
// transparency, which is what every later step works on.
func toOpaque(src image.Image) *image.NRGBA {
	bounds := src.Bounds()
	dst := image.NewNRGBA(image.Rect(0, 0, bounds.Dx(), bounds.Dy()))
	draw.Draw(dst, dst.Bounds(), image.NewUniform(color.White), image.Point{}, draw.Src)
	draw.Draw(dst, dst.Bounds(), src, bounds.Min, draw.Over)
	return dst
}

// outputSize is the size in cells for a picture of srcW x srcH. The height
// is scaled by CellAspect because a character is taller than it is wide.
func outputSize(srcW, srcH int, o Options) (width, height int) {
	width = o.Width
	if o.Dither {
		width *= HalftoneScale
	}

	aspect := float64(srcW) / float64(srcH)
	ratio := o.Ratio
	if o.KeepOriginal {
		width = min(srcW, MaxKeepOriginalWidth)
		ratio = ""
	}
	if w, h, _ := ParseRatio(ratio); w > 0 {
		aspect = float64(w) / float64(h)
	}

	height = max(1, int(float64(width)/aspect*CellAspect))
	return width, height
}

// Convert turns one picture into art.
func Convert(img image.Image, o Options) (*Grid, error) {
	if err := o.Validate(); err != nil {
		return nil, err
	}

	work := toOpaque(img)
	if work.Bounds().Dx() == 0 || work.Bounds().Dy() == 0 {
		return nil, errEmptyImage
	}

	// Same order as the Python engine: adjust the full picture, then shrink it
	adjustBrightness(work, o.Brightness)
	adjustContrast(work, o.Contrast)
	if o.Invert {
		invert(work)
	}

	width, height := outputSize(work.Bounds().Dx(), work.Bounds().Dy(), o)
	small := resizeArea(work, width, height)

	if o.Dither {
		return halftone(small), nil
	}
	return characterGrid(small, o)
}

// characterGrid maps brightness to characters from the ramp (dark pixel to
// the first character, bright to the last) and keeps each cell's color.
func characterGrid(img *image.NRGBA, o Options) (*Grid, error) {
	ramp, err := Ramp(o)
	if err != nil {
		return nil, err
	}

	cols, rows := img.Bounds().Dx(), img.Bounds().Dy()
	grid := NewGrid(cols, rows, true)

	for y := range rows {
		// A space shows no color, so it takes the color of the cell before it
		// (keeps runs of text and blanks together)
		var last RGB
		for x := range cols {
			i := img.PixOffset(x, y)
			r, g, b := img.Pix[i], img.Pix[i+1], img.Pix[i+2]

			gray := luma(r, g, b)
			glyph := ramp[int(float64(gray)/255*float64(len(ramp)-1))]

			if glyph != ' ' {
				last = Quantize(ApplyScheme(RGB{r, g, b}, o.ColorScheme))
			}
			grid.Set(x, y, glyph, last)
		}
	}
	return grid, nil
}

// ConvertFrames converts every frame of an animation. progress (optional) is
// told after each one; cancelling the context stops between frames.
func ConvertFrames(ctx context.Context, frames []Frame, o Options, progress func(done, total int)) ([]*Grid, error) {
	if err := o.Validate(); err != nil {
		return nil, err
	}

	grids := make([]*Grid, 0, len(frames))
	for i, frame := range frames {
		if err := ctx.Err(); err != nil {
			return nil, err
		}
		grid, err := Convert(frame.Image, o)
		if err != nil {
			return nil, err
		}
		grids = append(grids, grid)
		if progress != nil {
			progress(i+1, len(frames))
		}
	}
	return grids, nil
}
