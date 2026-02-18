package db

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	_ "github.com/mattn/go-sqlite3"
)

// MessageData represents the JSON structure stored in message.data
type MessageData struct {
	Role     string `json:"role"`
	ModelID  string `json:"modelID"`
	Provider string `json:"providerID"`
	Tokens   struct {
		Input     int64 `json:"input"`
		Output    int64 `json:"output"`
		Reasoning int64 `json:"reasoning"`
		Cache     struct {
			Read  int64 `json:"read"`
			Write int64 `json:"write"`
		} `json:"cache"`
	} `json:"tokens"`
	Cost float64 `json:"cost"`
}

// ModelStats aggregates statistics for a specific model
type ModelStats struct {
	Model        string
	Provider     string
	InputTokens  int64
	OutputTokens int64
	Cost         float64
}

// Session represents a session with aggregated data
type Session struct {
	ID           string
	Title        string
	MessageCount int
	TotalTokens  int64
	TimeUpdated  int64
}

// DB wraps the database connection
type DB struct {
	conn *sql.DB
}

// New creates a new database connection
func New(dbPath string) (*DB, error) {
	conn, err := sql.Open("sqlite3", dbPath)
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	if err := conn.Ping(); err != nil {
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	return &DB{conn: conn}, nil
}

// Close closes the database connection
func (db *DB) Close() error {
	return db.conn.Close()
}

// GetModelStats retrieves aggregated statistics per model
func (db *DB) GetModelStats() ([]ModelStats, error) {
	query := `
		SELECT data FROM message
	`

	rows, err := db.conn.Query(query)
	if err != nil {
		return nil, fmt.Errorf("failed to query messages: %w", err)
	}
	defer rows.Close()

	// Aggregate by model+provider
	statsMap := make(map[string]*ModelStats)

	for rows.Next() {
		var dataStr string
		if err := rows.Scan(&dataStr); err != nil {
			continue
		}

		var data MessageData
		if err := json.Unmarshal([]byte(dataStr), &data); err != nil {
			continue
		}

		if data.ModelID == "" {
			continue
		}

		key := data.ModelID + "|" + data.Provider
		if statsMap[key] == nil {
			statsMap[key] = &ModelStats{
				Model:    data.ModelID,
				Provider: data.Provider,
			}
		}

		statsMap[key].InputTokens += data.Tokens.Input + data.Tokens.Cache.Read
		statsMap[key].OutputTokens += data.Tokens.Output
		statsMap[key].Cost += data.Cost
	}

	// Convert map to slice
	stats := make([]ModelStats, 0, len(statsMap))
	for _, s := range statsMap {
		stats = append(stats, *s)
	}

	return stats, nil
}

// GetSessions retrieves all sessions with aggregated message counts and tokens
func (db *DB) GetSessions() ([]Session, error) {
	query := `
		SELECT 
			s.id,
			s.title,
			COUNT(m.id) as message_count,
			s.time_updated
		FROM session s
		LEFT JOIN message m ON m.session_id = s.id
		GROUP BY s.id
		ORDER BY s.time_updated DESC
	`

	rows, err := db.conn.Query(query)
	if err != nil {
		return nil, fmt.Errorf("failed to query sessions: %w", err)
	}
	defer rows.Close()

	var sessions []Session
	for rows.Next() {
		var s Session
		if err := rows.Scan(&s.ID, &s.Title, &s.MessageCount, &s.TimeUpdated); err != nil {
			continue
		}
		sessions = append(sessions, s)
	}

	// Get token counts for each session
	for i := range sessions {
		tokens, err := db.getSessionTokens(sessions[i].ID)
		if err == nil {
			sessions[i].TotalTokens = tokens
		}
	}

	return sessions, nil
}

// getSessionTokens gets total tokens for a session
func (db *DB) getSessionTokens(sessionID string) (int64, error) {
	query := `
		SELECT data FROM message WHERE session_id = ?
	`

	rows, err := db.conn.Query(query, sessionID)
	if err != nil {
		return 0, err
	}
	defer rows.Close()

	var total int64
	for rows.Next() {
		var dataStr string
		if err := rows.Scan(&dataStr); err != nil {
			continue
		}

		var data MessageData
		if err := json.Unmarshal([]byte(dataStr), &data); err != nil {
			continue
		}

		total += data.Tokens.Input + data.Tokens.Output + data.Tokens.Cache.Read
	}

	return total, nil
}

// GetTotalCounts returns total counts for overview stats
func (db *DB) GetTotalCounts() (projects, sessions, messages int, err error) {
	// Count projects
	if err := db.conn.QueryRow("SELECT COUNT(*) FROM project").Scan(&projects); err != nil {
		return 0, 0, 0, err
	}

	// Count sessions
	if err := db.conn.QueryRow("SELECT COUNT(*) FROM session").Scan(&sessions); err != nil {
		return 0, 0, 0, err
	}

	// Count messages
	if err := db.conn.QueryRow("SELECT COUNT(*) FROM message").Scan(&messages); err != nil {
		return 0, 0, 0, err
	}

	return projects, sessions, messages, nil
}

// FormatTimeAgo formats a timestamp as relative time
func FormatTimeAgo(timestamp int64) string {
	if timestamp == 0 {
		return "N/A"
	}

	// Convert milliseconds to time
	t := time.Unix(timestamp/1000, 0)
	duration := time.Since(t)

	switch {
	case duration.Minutes() < 1:
		return "just now"
	case duration.Minutes() < 60:
		return fmt.Sprintf("%dm ago", int(duration.Minutes()))
	case duration.Hours() < 24:
		return fmt.Sprintf("%dh ago", int(duration.Hours()))
	case duration.Hours() < 24*7:
		return fmt.Sprintf("%dd ago", int(duration.Hours()/24))
	case duration.Hours() < 24*30:
		return fmt.Sprintf("%dw ago", int(duration.Hours()/(24*7)))
	default:
		return fmt.Sprintf("%dmo ago", int(duration.Hours()/(24*30)))
	}
}
