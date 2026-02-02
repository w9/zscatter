# ZScatter

High-performance 3D scatterplot renderer built with React-Three-Fiber and a Go
streaming backend. The frontend uses a single `gl.POINTS` draw call with custom
shaders and GPU picking, while the backend generates and streams large binary
datasets for stress testing.

## Quick start

Generate data:
```
go run ./go/cmd/zscattergen --count 10 --points 100000 --out data.bin
```

Stream data:
```
go run ./go/cmd/zscatterstream --file data.bin --addr :8080
```

Run playground:
```
pnpm install
pnpm -C packages/playground dev
```
