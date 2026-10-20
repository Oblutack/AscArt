package engine

import "image"

// resizeArea scales a picture to width x height by averaging the source
// pixels that fall under each new pixel (weighted by how much of them does).
// It is exact for shrinking, which is what converting to art mostly is, and
// gives smooth results for enlarging too.
func resizeArea(src *image.NRGBA, width, height int) *image.NRGBA {
	srcW, srcH := src.Bounds().Dx(), src.Bounds().Dy()
	if srcW == width && srcH == height {
		return src
	}

	xWeights := axisWeights(srcW, width)
	yWeights := axisWeights(srcH, height)

	// Horizontal pass: every source row, but only `width` columns wide
	horizontal := make([]float32, srcH*width*3)
	for y := range srcH {
		row := src.Pix[y*src.Stride : y*src.Stride+srcW*4]
		out := horizontal[y*width*3 : (y+1)*width*3]
		for x := range width {
			var r, g, b float32
			for _, w := range xWeights[x] {
				p := row[w.index*4 : w.index*4+3]
				r += float32(p[0]) * w.weight
				g += float32(p[1]) * w.weight
				b += float32(p[2]) * w.weight
			}
			out[x*3], out[x*3+1], out[x*3+2] = r, g, b
		}
	}

	// Vertical pass
	dst := image.NewNRGBA(image.Rect(0, 0, width, height))
	for y := range height {
		for x := range width {
			var r, g, b float32
			for _, w := range yWeights[y] {
				i := (w.index*width + x) * 3
				r += horizontal[i] * w.weight
				g += horizontal[i+1] * w.weight
				b += horizontal[i+2] * w.weight
			}
			o := dst.PixOffset(x, y)
			dst.Pix[o] = roundByte(r)
			dst.Pix[o+1] = roundByte(g)
			dst.Pix[o+2] = roundByte(b)
			dst.Pix[o+3] = 255
		}
	}
	return dst
}

type weight struct {
	index  int
	weight float32
}

// axisWeights says, for each of the `to` new positions along an axis of
// `from` source pixels, which source pixels contribute and how much (the
// weights of one position add up to 1).
func axisWeights(from, to int) [][]weight {
	scale := float64(from) / float64(to)
	all := make([][]weight, to)

	for i := range all {
		start := float64(i) * scale
		end := start + scale

		first := int(start)
		last := int(end)
		if float64(last) == end { // ends exactly on a pixel edge
			last--
		}
		if last >= from {
			last = from - 1
		}

		var total float64
		parts := make([]weight, 0, last-first+1)
		for p := first; p <= last; p++ {
			low, high := float64(p), float64(p+1)
			if low < start {
				low = start
			}
			if high > end {
				high = end
			}
			if overlap := high - low; overlap > 0 {
				parts = append(parts, weight{p, float32(overlap)})
				total += overlap
			}
		}
		for j := range parts {
			parts[j].weight = float32(float64(parts[j].weight) / total)
		}
		all[i] = parts
	}
	return all
}

func roundByte(v float32) uint8 {
	switch {
	case v <= 0:
		return 0
	case v >= 255:
		return 255
	}
	return uint8(v + 0.5)
}
