package main

import (
	"bufio"
	"flag"
	"fmt"
	"io"
	"net/http"
	"os"
)

func main() {
	addr := flag.String("addr", ":8080", "address to listen on")
	filePath := flag.String("file", "", "binary data file to stream")
	chunkSize := flag.Int("chunk", 1<<20, "stream chunk size in bytes")
	flag.Parse()

	if *filePath == "" {
		fmt.Fprintln(os.Stderr, "--file is required")
		os.Exit(1)
	}
	if *chunkSize <= 0 {
		fmt.Fprintln(os.Stderr, "--chunk must be positive")
		os.Exit(1)
	}

	http.HandleFunc("/stream", func(w http.ResponseWriter, r *http.Request) {
		file, err := os.Open(*filePath)
		if err != nil {
			http.Error(w, "failed to open data file", http.StatusInternalServerError)
			return
		}
		defer file.Close()

		w.Header().Set("Content-Type", "application/octet-stream")
		w.Header().Set("Cache-Control", "no-store")

		flusher, ok := w.(http.Flusher)
		if !ok {
			http.Error(w, "streaming unsupported", http.StatusInternalServerError)
			return
		}

		reader := bufio.NewReaderSize(file, *chunkSize)
		buffer := make([]byte, *chunkSize)
		for {
			n, readErr := reader.Read(buffer)
			if n > 0 {
				if _, err := w.Write(buffer[:n]); err != nil {
					return
				}
				flusher.Flush()
			}
			if readErr != nil {
				if readErr != io.EOF {
					return
				}
				break
			}
		}
	})

	if err := http.ListenAndServe(*addr, nil); err != nil {
		fmt.Fprintf(os.Stderr, "server error: %v\n", err)
		os.Exit(1)
	}
}
