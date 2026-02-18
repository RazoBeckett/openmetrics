db_path := "/tmp/tmp.IIUEfwA85S/opencode.db"

default: build

build:
  go build -o bin/openmetrics ./cmd/openmetrics

run: build
  ./bin/openmetrics

clean:
  rm -rf bin/

test:
  go test -v ./...

vet:
  go vet ./...

fmt:
  go fmt ./...

lint: vet
  go fmt ./...

tidy:
  go mod tidy

deps:
  go mod download

install: build
  cp bin/openmetrics ~/.local/bin/

db-stats:
  @echo "Database Stats:"
  @sqlite3 {{db_path}} "SELECT 'Projects: ' || COUNT(*) FROM project UNION ALL SELECT 'Sessions: ' || COUNT(*) FROM session UNION ALL SELECT 'Messages: ' || COUNT(*) FROM message UNION ALL SELECT 'Todos: ' || COUNT(*) FROM todo;"

help:
  @just --list
