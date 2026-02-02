package format

import (
	"encoding/binary"
	"io"
	"math"
)

const (
	RecordFloats = 6
	RecordSize   = RecordFloats * 4
)

type Record struct {
	X float32
	Y float32
	Z float32
	R float32
	G float32
	B float32
}

func EncodeRecord(dst []byte, record Record) {
	binary.LittleEndian.PutUint32(dst[0:4], math.Float32bits(record.X))
	binary.LittleEndian.PutUint32(dst[4:8], math.Float32bits(record.Y))
	binary.LittleEndian.PutUint32(dst[8:12], math.Float32bits(record.Z))
	binary.LittleEndian.PutUint32(dst[12:16], math.Float32bits(record.R))
	binary.LittleEndian.PutUint32(dst[16:20], math.Float32bits(record.G))
	binary.LittleEndian.PutUint32(dst[20:24], math.Float32bits(record.B))
}

func WriteRecord(w io.Writer, record Record, buffer []byte) error {
	if len(buffer) < RecordSize {
		buffer = make([]byte, RecordSize)
	}
	EncodeRecord(buffer, record)
	_, err := w.Write(buffer[:RecordSize])
	return err
}
