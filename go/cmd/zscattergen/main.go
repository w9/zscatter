package main

import (
	"bufio"
	"flag"
	"fmt"
	"math"
	"math/rand"
	"os"
	"time"

	"zscatter/pkg/format"
)

func main() {
	cloudCount := flag.Int("count", 1, "number of gaussian clouds")
	pointsPerCloud := flag.Int("points", 1000, "points per cloud")
	outFile := flag.String("out", "", "output file path")
	flag.Parse()

	if *outFile == "" {
		fmt.Fprintln(os.Stderr, "--out is required")
		os.Exit(1)
	}
	if *cloudCount <= 0 || *pointsPerCloud <= 0 {
		fmt.Fprintln(os.Stderr, "--count and --points must be positive")
		os.Exit(1)
	}

	file, err := os.Create(*outFile)
	if err != nil {
		fmt.Fprintf(os.Stderr, "failed to create output: %v\n", err)
		os.Exit(1)
	}
	defer file.Close()

	writer := bufio.NewWriterSize(file, 1<<20)
	defer writer.Flush()

	rng := rand.New(rand.NewSource(time.Now().UnixNano()))
	buffer := make([]byte, format.RecordSize)

	for cloud := 0; cloud < *cloudCount; cloud++ {
		centerX := rng.Float64()*200 - 100
		centerY := rng.Float64()*200 - 100
		centerZ := rng.Float64()*200 - 100
		sigmaX := rng.Float64()*10 + 1
		sigmaY := rng.Float64()*10 + 1
		sigmaZ := rng.Float64()*10 + 1

		baseR := rng.Float64()*0.6 + 0.2
		baseG := rng.Float64()*0.6 + 0.2
		baseB := rng.Float64()*0.6 + 0.2

		for i := 0; i < *pointsPerCloud; i++ {
			x := centerX + rng.NormFloat64()*sigmaX
			y := centerY + rng.NormFloat64()*sigmaY
			z := centerZ + rng.NormFloat64()*sigmaZ

			record := format.Record{
				X: float32(x),
				Y: float32(y),
				Z: float32(z),
				R: float32(clamp01(baseR + rng.NormFloat64()*0.05)),
				G: float32(clamp01(baseG + rng.NormFloat64()*0.05)),
				B: float32(clamp01(baseB + rng.NormFloat64()*0.05)),
			}

			if err := format.WriteRecord(writer, record, buffer); err != nil {
				fmt.Fprintf(os.Stderr, "write error: %v\n", err)
				os.Exit(1)
			}
		}
	}
}

func clamp01(value float64) float64 {
	return math.Max(0, math.Min(1, value))
}
