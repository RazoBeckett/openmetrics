package main

import (
	"fmt"
	"os"
	"sort"
	"strings"

	"github.com/charmbracelet/bubbles/spinner"
	"github.com/charmbracelet/bubbles/table"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/razobeckett/openmetrics/internal/db"
	"github.com/razobeckett/openmetrics/internal/pricing"
	"github.com/razobeckett/openmetrics/internal/tui"
)

const (
	dbPath = "/tmp/tmp.IIUEfwA85S/opencode.db"
)

type Tab int

const (
	TabOverview Tab = iota
	Tab2
	Tab3
	Tab4
)

type Model struct {
	tabs           []string
	activeTab      Tab
	pricingService *pricing.PricingService
	modelsTable    table.Model
	sessionsTable  table.Model
	models         []db.ModelStats
	sessions       []db.Session
	projectsCount  int
	sessionsCount  int
	messagesCount  int
	modelsCount    int
	spinner        spinner.Model
	loading        bool
	width          int
	height         int
	err            error
}

type DataLoadedMsg struct {
	models        []db.ModelStats
	sessions      []db.Session
	projects      int
	sessionsCount int
	messages      int
	err           error
}

type PricingLoadedMsg struct {
	err error
}

var baseStyle = lipgloss.NewStyle().
	Border(lipgloss.RoundedBorder()).
	BorderForeground(tui.ColorBorder)

func initialModel() Model {
	s := spinner.New(
		spinner.WithSpinner(spinner.Spinner{
			Frames: []string{".  ", ".. ", "...", "   "},
			FPS:    400,
		}),
		spinner.WithStyle(tui.SpinnerStyle),
	)

	m := Model{
		tabs:           []string{"Overview", "Tab2", "Tab3", "Tab4"},
		activeTab:      TabOverview,
		spinner:        s,
		loading:        true,
		pricingService: pricing.NewPricingService(),
	}

	return m
}

func calculateModelsColumnWidths(totalWidth int) []table.Column {
	available := totalWidth - 4
	modelWidth := available * 30 / 100
	if modelWidth > 25 {
		modelWidth = 25
	}
	providerWidth := available * 20 / 100
	if providerWidth > 18 {
		providerWidth = 18
	}
	tokenWidth := 10
	costWidth := 10
	remaining := available - modelWidth - providerWidth - (tokenWidth * 2) - (costWidth * 3)
	if remaining > 0 {
		costWidth += remaining / 3
	}

	return []table.Column{
		{Title: "Model", Width: modelWidth},
		{Title: "In", Width: tokenWidth},
		{Title: "Out", Width: tokenWidth},
		{Title: "In ($)", Width: costWidth},
		{Title: "Out ($)", Width: costWidth},
		{Title: "Cost", Width: costWidth},
		{Title: "Provider", Width: providerWidth},
	}
}

func calculateSessionsColumnWidths(totalWidth int) []table.Column {
	available := totalWidth - 4
	msgsWidth := 8
	tokensWidth := 10
	updatedWidth := 10
	titleWidth := available - msgsWidth - tokensWidth - updatedWidth - 2
	if titleWidth < 20 {
		titleWidth = 20
	}

	return []table.Column{
		{Title: "Title", Width: titleWidth},
		{Title: "Msgs", Width: msgsWidth},
		{Title: "Tokens", Width: tokensWidth},
		{Title: "Updated", Width: updatedWidth},
	}
}

func createModelsTable(models []db.ModelStats, ps *pricing.PricingService, width int) table.Model {
	columns := calculateModelsColumnWidths(width)

	rows := make([]table.Row, len(models))
	for i, m := range models {
		inTokens := pricing.FormatTokens(m.InputTokens)
		outTokens := pricing.FormatTokens(m.OutputTokens)

		var inCost, outCost string
		if ps != nil && m.InputTokens > 0 {
			inCostVal := ps.CalculateCost(m.Model, m.InputTokens, 0, 0)
			outCostVal := ps.CalculateCost(m.Model, 0, m.OutputTokens, 0)
			inCost = pricing.FormatCost(inCostVal)
			outCost = pricing.FormatCost(outCostVal)
		} else {
			inCost = "-"
			outCost = "-"
		}

		rows[i] = table.Row{
			m.Model,
			inTokens,
			outTokens,
			inCost,
			outCost,
			pricing.FormatCost(m.Cost),
			m.Provider,
		}
	}

	t := table.New(
		table.WithColumns(columns),
		table.WithRows(rows),
		table.WithFocused(false),
		table.WithHeight(8),
	)

	s := table.DefaultStyles()
	s.Header = s.Header.
		BorderStyle(lipgloss.NormalBorder()).
		BorderForeground(tui.ColorPrimary).
		BorderBottom(true).
		Bold(true).
		Foreground(tui.ColorPrimary)
	s.Selected = s.Selected.
		Foreground(tui.ColorText).
		Background(tui.ColorSurface).
		Bold(false)
	s.Cell = s.Cell.
		Foreground(tui.ColorText)

	t.SetStyles(s)
	return t
}

func createSessionsTable(sessions []db.Session, width int) table.Model {
	columns := calculateSessionsColumnWidths(width)

	rows := make([]table.Row, len(sessions))
	for i, s := range sessions {
		title := s.Title
		maxTitleLen := columns[0].Width - 3
		if maxTitleLen < 10 {
			maxTitleLen = 10
		}
		if len(title) > maxTitleLen {
			title = title[:maxTitleLen-3] + "..."
		}
		rows[i] = table.Row{
			title,
			fmt.Sprintf("%d", s.MessageCount),
			pricing.FormatTokens(s.TotalTokens),
			db.FormatTimeAgo(s.TimeUpdated),
		}
	}

	t := table.New(
		table.WithColumns(columns),
		table.WithRows(rows),
		table.WithFocused(false),
		table.WithHeight(8),
	)

	s := table.DefaultStyles()
	s.Header = s.Header.
		BorderStyle(lipgloss.NormalBorder()).
		BorderForeground(tui.ColorPrimary).
		BorderBottom(true).
		Bold(true).
		Foreground(tui.ColorPrimary)
	s.Selected = s.Selected.
		Foreground(tui.ColorText).
		Background(tui.ColorSurface).
		Bold(false)
	s.Cell = s.Cell.
		Foreground(tui.ColorText)

	t.SetStyles(s)
	return t
}

func (m Model) Init() tea.Cmd {
	return tea.Batch(
		m.spinner.Tick,
		loadData,
		fetchPricing,
	)
}

func loadData() tea.Msg {
	database, err := db.New(dbPath)
	if err != nil {
		return DataLoadedMsg{err: err}
	}
	defer database.Close()

	models, err := database.GetModelStats()
	if err != nil {
		return DataLoadedMsg{err: err}
	}

	sessions, err := database.GetSessions()
	if err != nil {
		return DataLoadedMsg{err: err}
	}

	projects, sessionsCount, messages, err := database.GetTotalCounts()
	if err != nil {
		return DataLoadedMsg{err: err}
	}

	sort.Slice(models, func(i, j int) bool {
		return models[i].InputTokens > models[j].InputTokens
	})

	sort.Slice(sessions, func(i, j int) bool {
		return sessions[i].TimeUpdated > sessions[j].TimeUpdated
	})

	if len(sessions) > 50 {
		sessions = sessions[:50]
	}

	return DataLoadedMsg{
		models:        models,
		sessions:      sessions,
		projects:      projects,
		sessionsCount: sessionsCount,
		messages:      messages,
	}
}

func fetchPricing() tea.Msg {
	return PricingLoadedMsg{}
}

func (m Model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	var cmds []tea.Cmd

	switch msg := msg.(type) {
	case tea.KeyMsg:
		switch msg.String() {
		case "ctrl+c", "q":
			return m, tea.Quit
		case "tab", "right":
			m.activeTab = (m.activeTab + 1) % 4
		case "shift+tab", "left":
			if m.activeTab == 0 {
				m.activeTab = Tab4
			} else {
				m.activeTab--
			}
		}
	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height
		m.updateTables()
	case spinner.TickMsg:
		var cmd tea.Cmd
		m.spinner, cmd = m.spinner.Update(msg)
		cmds = append(cmds, cmd)
	case DataLoadedMsg:
		if msg.err != nil {
			m.err = msg.err
			m.loading = false
			return m, nil
		}
		m.models = msg.models
		m.sessions = msg.sessions
		m.projectsCount = msg.projects
		m.sessionsCount = msg.sessionsCount
		m.messagesCount = msg.messages
		m.modelsCount = len(msg.models)
		m.loading = false
		m.updateTables()
	case PricingLoadedMsg:
		go m.pricingService.FetchPricing()
	}

	return m, tea.Batch(cmds...)
}

func (m *Model) updateTables() {
	if m.width == 0 || len(m.models) == 0 {
		return
	}

	availableWidth := m.width - 8
	tableHeight := (m.height - 18) / 2
	if tableHeight < 4 {
		tableHeight = 4
	}
	if tableHeight > 15 {
		tableHeight = 15
	}

	m.modelsTable = createModelsTable(m.models, m.pricingService, availableWidth)
	m.sessionsTable = createSessionsTable(m.sessions, availableWidth)

	m.modelsTable.SetHeight(tableHeight)
	m.sessionsTable.SetHeight(tableHeight)
	m.modelsTable.SetWidth(availableWidth - 2)
	m.sessionsTable.SetWidth(availableWidth - 2)
}

func (m Model) View() string {
	if m.err != nil {
		return fmt.Sprintf("\n  Error: %v\n\n  Press q to quit.\n", m.err)
	}

	var doc strings.Builder

	title := tui.Title.Render("OpenMetrics Dashboard")
	quitHint := tui.TextMuted.Render("Press q to quit")
	doc.WriteString(lipgloss.JoinHorizontal(lipgloss.Top, title, "  ", quitHint))
	doc.WriteString("\n\n")

	tabBar := tui.RenderTabBar(m.tabs, int(m.activeTab), m.width-4)
	doc.WriteString(tabBar)
	doc.WriteString("\n")

	if m.loading {
		doc.WriteString(m.spinner.View() + " Loading data...")
		return doc.String()
	}

	switch m.activeTab {
	case TabOverview:
		doc.WriteString(m.renderOverview())
	case Tab2, Tab3, Tab4:
		doc.WriteString(m.renderComingSoon())
	}

	return doc.String()
}

func (m Model) renderOverview() string {
	var b strings.Builder

	statsRow := fmt.Sprintf(
		"Projects(%d)  Sessions(%d)  Messages(%d)  Models(%d)",
		m.projectsCount, m.sessionsCount, m.messagesCount, m.modelsCount,
	)
	b.WriteString(tui.TextMuted.Render(statsRow))
	b.WriteString("\n\n")

	modelsHeader := tui.Subtitle.Render(fmt.Sprintf("Models (%d)", m.modelsCount))
	b.WriteString(modelsHeader)
	b.WriteString("\n")
	b.WriteString(baseStyle.Render(m.modelsTable.View()))
	b.WriteString("\n\n")

	sessionsHeader := tui.Subtitle.Render(fmt.Sprintf("Sessions (%d)", m.sessionsCount))
	b.WriteString(sessionsHeader)
	b.WriteString("\n")
	b.WriteString(baseStyle.Render(m.sessionsTable.View()))

	return b.String()
}

func (m Model) renderComingSoon() string {
	return tui.ComingSoon.Render("\n\nComing Soon\n\n")
}

func main() {
	p := tea.NewProgram(
		initialModel(),
		tea.WithAltScreen(),
	)

	if _, err := p.Run(); err != nil {
		fmt.Println("Error running program:", err)
		os.Exit(1)
	}
}
