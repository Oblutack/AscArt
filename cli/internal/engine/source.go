package engine

import (
	"bufio"
	"context"
	"errors"
	"fmt"
	"image"
	"image/color"
	"image/draw"
	"image/gif"
	_ "image/jpeg" // registers the decoder for image.Decode
	"image/png"
	"io"
	"io/fs"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	_ "golang.org/x/image/bmp"  // registers the decoder
	_ "golang.org/x/image/tiff" // registers the decoder
	_ "golang.org/x/image/webp" // registers the decoder
)

var errEmptyImage = errors.New("the picture has no pixels")

// Frame is one picture of an animation and how long it stays up.
type Frame struct {
	Image *image.NRGBA
	Delay time.Duration
}

// Source is a loaded file: a single picture, or the frames of a GIF or a
// short video.
type Source struct {
	Name     string
	Frames   []Frame // always at least one
	Animated bool
}

// Video limits: every frame becomes a page of text, so clips are cut short.
const (
	videoSeconds  = 10
	videoFPS      = 10
	videoMaxWidth = 640

	defaultDelay = 100 * time.Millisecond
)

var videoExtensions = map[string]bool{
	".mp4": true, ".m4v": true, ".mov": true, ".webm": true, ".mkv": true, ".avi": true,
}

// IsVideo says whether a path names a video container.
func IsVideo(path string) bool { return videoExtensions[strings.ToLower(filepath.Ext(path))] }

// IsAnimated says whether a path is converted frame by frame.
func IsAnimated(path string) bool {
	return strings.EqualFold(filepath.Ext(path), ".gif") || IsVideo(path)
}

// LoadSource reads a picture, a GIF or a video. Cancelling the context
// stops ffmpeg for videos.
func LoadSource(ctx context.Context, path string) (*Source, error) {
	name := filepath.Base(path)

	switch {
	case IsVideo(path):
		frames, err := loadVideo(ctx, path)
		if err != nil {
			return nil, err
		}
		return &Source{Name: name, Frames: frames, Animated: true}, nil

	case strings.EqualFold(filepath.Ext(path), ".gif"):
		frames, err := loadGIF(path)
		if err != nil {
			return nil, err
		}
		return &Source{Name: name, Frames: frames, Animated: len(frames) > 1}, nil
	}

	file, err := os.Open(path)
	if err != nil {
		return nil, fmt.Errorf("can't open %s: %w", path, unwrapPathError(err))
	}
	defer file.Close()

	img, _, err := image.Decode(file)
	if err != nil {
		return nil, fmt.Errorf("%s is not a picture I can read: %w", name, err)
	}
	return &Source{Name: name, Frames: []Frame{{Image: toOpaque(img)}}}, nil
}

// loadGIF decodes every frame and composes them onto a canvas, honouring
// each frame's disposal method (GIFs usually store only what changed).
func loadGIF(path string) ([]Frame, error) {
	file, err := os.Open(path)
	if err != nil {
		return nil, fmt.Errorf("can't open %s: %w", path, unwrapPathError(err))
	}
	defer file.Close()

	animation, err := gif.DecodeAll(file)
	if err != nil {
		return nil, fmt.Errorf("%s is not a GIF I can read: %w", filepath.Base(path), err)
	}
	if len(animation.Image) == 0 {
		return nil, errEmptyImage
	}

	width, height := animation.Config.Width, animation.Config.Height
	if width == 0 || height == 0 {
		bounds := animation.Image[0].Bounds()
		width, height = bounds.Max.X, bounds.Max.Y
	}

	canvas := image.NewRGBA(image.Rect(0, 0, width, height))
	frames := make([]Frame, 0, len(animation.Image))

	for i, paletted := range animation.Image {
		var restore *image.RGBA
		disposal := byte(0)
		if i < len(animation.Disposal) {
			disposal = animation.Disposal[i]
		}
		if disposal == gif.DisposalPrevious {
			restore = image.NewRGBA(canvas.Bounds())
			copy(restore.Pix, canvas.Pix)
		}

		draw.Draw(canvas, paletted.Bounds(), paletted, paletted.Bounds().Min, draw.Over)
		frames = append(frames, Frame{Image: toOpaque(canvas), Delay: gifDelay(animation.Delay, i)})

		switch disposal {
		case gif.DisposalBackground:
			draw.Draw(canvas, paletted.Bounds(), image.NewUniform(color.Transparent), image.Point{}, draw.Src)
		case gif.DisposalPrevious:
			copy(canvas.Pix, restore.Pix)
		}
	}
	return frames, nil
}

// gifDelay: GIF delays are in hundredths of a second, and browsers show
// anything under 2/100 as 10/100, so a missing delay doesn't mean "as fast as
// possible".
func gifDelay(delays []int, i int) time.Duration {
	if i >= len(delays) || delays[i] < 2 {
		return defaultDelay
	}
	return time.Duration(delays[i]) * 10 * time.Millisecond
}

// FindFFmpeg is the ffmpeg executable: ASCART_FFMPEG, or the one on the PATH.
func FindFFmpeg() (string, error) {
	if path := os.Getenv("ASCART_FFMPEG"); path != "" {
		return path, nil
	}
	path, err := exec.LookPath("ffmpeg")
	if err != nil {
		return "", errors.New("video needs ffmpeg: install it (https://ffmpeg.org/download.html) and make sure it is on your PATH")
	}
	return path, nil
}

// loadVideo has ffmpeg cut the first seconds of a clip into frames (a stream
// of PNG pictures on its output) and reads them back.
func loadVideo(ctx context.Context, path string) ([]Frame, error) {
	ffmpeg, err := FindFFmpeg()
	if err != nil {
		return nil, err
	}

	command := exec.CommandContext(ctx, ffmpeg,
		"-v", "error", "-nostdin",
		"-t", fmt.Sprint(videoSeconds),
		"-i", path,
		"-vf", fmt.Sprintf("fps=%d,scale='min(%d,iw)':-2", videoFPS, videoMaxWidth),
		"-f", "image2pipe", "-vcodec", "png", "-",
	)
	var stderr strings.Builder
	command.Stderr = &stderr
	pipe, err := command.StdoutPipe()
	if err != nil {
		return nil, err
	}
	if err := command.Start(); err != nil {
		return nil, fmt.Errorf("could not start ffmpeg (%s): %w", ffmpeg, err)
	}

	var frames []Frame
	reader := bufio.NewReader(pipe)
	for {
		img, decodeErr := png.Decode(reader)
		if decodeErr != nil {
			if !errors.Is(decodeErr, io.EOF) && !errors.Is(decodeErr, io.ErrUnexpectedEOF) {
				err = decodeErr
			}
			break
		}
		frames = append(frames, Frame{Image: toOpaque(img), Delay: time.Second / videoFPS})
	}

	waitErr := command.Wait()
	if ctxErr := ctx.Err(); ctxErr != nil {
		return nil, ctxErr
	}
	if waitErr != nil {
		message := strings.TrimSpace(stderr.String())
		if lines := strings.Split(message, "\n"); message != "" {
			message = lines[len(lines)-1]
		} else {
			message = "unknown error"
		}
		return nil, fmt.Errorf("ffmpeg could not read this video: %s", message)
	}
	if err != nil {
		return nil, err
	}
	if len(frames) == 0 {
		return nil, errors.New("that video has no frames to convert")
	}
	return frames, nil
}

// unwrapPathError drops the file name os puts in its errors, since the
// messages above already say which file it was.
func unwrapPathError(err error) error {
	var pathErr *fs.PathError
	if errors.As(err, &pathErr) {
		return pathErr.Err
	}
	return err
}
