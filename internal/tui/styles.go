package tui

import (
	"fmt"
	"strings"

	"github.com/charmbracelet/lipgloss"
)

var (
	ColorPrimary   = lipgloss.Color("#7D56F4")
	ColorSecondary = lipgloss.Color("#04B575")
	ColorAccent    = lipgloss.Color("#FF6B6B")
	ColorHighlight = lipgloss.Color("#FFD93D")

	ColorText      = lipgloss.Color("#FAFAFA")
	ColorTextMuted = lipgloss.Color("#6C6C6C")
	ColorTextDim   = lipgloss.Color("#3C3C3C")

	ColorBackground = lipgloss.Color("#1A1A2E")
	ColorSurface    = lipgloss.Color("#16213E")
	ColorBorder     = lipgloss.Color("#3A3A5C")

	ColorSuccess = lipgloss.Color("#04B575")
	ColorWarning = lipgloss.Color("#FFD93D")
	ColorError   = lipgloss.Color("#FF6B6B")
	ColorInfo    = lipgloss.Color("#6CB4EE")
)

var (
	activeTabBorder = lipgloss.Border{
		Top:         "─",
		Bottom:      " ",
		Left:        "│",
		Right:       "│",
		TopLeft:     "╭",
		TopRight:    "╮",
		BottomLeft:  "┘",
		BottomRight: "└",
	}

	tabBorder = lipgloss.Border{
		Top:         "─",
		Bottom:      "─",
		Left:        "│",
		Right:       "│",
		TopLeft:     "╭",
		TopRight:    "╮",
		BottomLeft:  "┴",
		BottomRight: "┴",
	}

	Title = lipgloss.NewStyle().
		Bold(true).
		Foreground(ColorPrimary).
		Padding(0, 1)

	Subtitle = lipgloss.NewStyle().
			Bold(true).
			Foreground(ColorText).
			Padding(0, 1)

	TabInactive = lipgloss.NewStyle().
			Border(tabBorder).
			BorderForeground(ColorPrimary).
			Foreground(ColorTextMuted).
			Padding(0, 2)

	TabActive = TabInactive.
			Border(activeTabBorder, true).
			BorderForeground(ColorPrimary).
			Foreground(ColorText).
			Bold(true)

	TabGap = lipgloss.NewStyle().
		BorderTop(false).
		BorderLeft(false).
		BorderRight(false).
		BorderBottom(true).
		BorderForeground(ColorPrimary)

	ContentBox = lipgloss.NewStyle().
			Border(lipgloss.RoundedBorder()).
			BorderForeground(ColorPrimary).
			Padding(1, 2)

	Container = lipgloss.NewStyle().
			Border(lipgloss.RoundedBorder()).
			BorderForeground(ColorBorder).
			Padding(1, 2)

	Card = lipgloss.NewStyle().
		Border(lipgloss.RoundedBorder()).
		BorderForeground(ColorBorder).
		Background(ColorSurface).
		Padding(1, 1)

	TableHeader = lipgloss.NewStyle().
			Bold(true).
			Foreground(ColorPrimary).
			Padding(0, 1)

	TableRow = lipgloss.NewStyle().
			Foreground(ColorText).
			Padding(0, 1)

	TableRowAlt = lipgloss.NewStyle().
			Foreground(ColorText).
			Background(lipgloss.Color("#1E1E3F")).
			Padding(0, 1)

	TextBold   = lipgloss.NewStyle().Bold(true)
	TextItalic = lipgloss.NewStyle().Italic(true)
	TextMuted  = lipgloss.NewStyle().Foreground(ColorTextMuted)
	TextAccent = lipgloss.NewStyle().Foreground(ColorPrimary)

	Badge = lipgloss.NewStyle().
		Foreground(ColorText).
		Background(ColorPrimary).
		Padding(0, 1)

	BadgeSuccess = lipgloss.NewStyle().
			Foreground(ColorText).
			Background(ColorSuccess).
			Padding(0, 1)

	StatValue = lipgloss.NewStyle().
			Bold(true).
			Foreground(ColorPrimary).
			Padding(0, 1)

	StatLabel = lipgloss.NewStyle().
			Foreground(ColorTextMuted).
			Padding(0, 1)

	SpinnerStyle = lipgloss.NewStyle().
			Foreground(ColorPrimary)

	ComingSoon = lipgloss.NewStyle().
			Foreground(ColorTextMuted).
			Italic(true).
			Align(lipgloss.Center)
)

func GetTabStyle(text string, active bool) string {
	if active {
		return TabActive.Render(text)
	}
	return TabInactive.Render(text)
}

func RenderTabBar(tabs []string, activeIndex int, width int) string {
	renderedTabs := make([]string, len(tabs))
	for i, tab := range tabs {
		renderedTabs[i] = GetTabStyle(tab, i == activeIndex)
	}

	row := lipgloss.JoinHorizontal(lipgloss.Top, renderedTabs...)

	remainingWidth := width - lipgloss.Width(row)
	if remainingWidth < 0 {
		remainingWidth = 0
	}

	gap := TabGap.
		BorderForeground(ColorPrimary).
		Foreground(ColorPrimary).
		Render(strings.Repeat("─", remainingWidth))

	return lipgloss.JoinHorizontal(lipgloss.Bottom, row, gap)
}

func FormatTokenCount(count int64) string {
	if count >= 1_000_000 {
		return lipgloss.NewStyle().Foreground(ColorInfo).Render(
			formatNumber(float64(count)/1_000_000) + "M",
		)
	}
	if count >= 1_000 {
		return lipgloss.NewStyle().Foreground(ColorInfo).Render(
			formatNumber(float64(count)/1_000) + "K",
		)
	}
	return lipgloss.NewStyle().Foreground(ColorTextMuted).Render(
		formatNumber(float64(count)),
	)
}

func FormatCost(cost float64) string {
	style := lipgloss.NewStyle().Foreground(ColorSuccess)
	if cost > 100 {
		style = lipgloss.NewStyle().Foreground(ColorWarning)
	}
	if cost > 500 {
		style = lipgloss.NewStyle().Foreground(ColorError)
	}

	if cost == 0 {
		return style.Render("$0.00")
	}
	if cost < 0.01 {
		return style.Render(fmt.Sprintf("$%.4f", cost))
	}
	return style.Render(fmt.Sprintf("$%.2f", cost))
}

func formatNumber(n float64) string {
	if n >= 10 {
		return formatFloat(n, 1)
	}
	return formatFloat(n, 2)
}

func formatFloat(n float64, decimals int) string {
	switch decimals {
	case 1:
		return fmt.Sprintf("%.1f", n)
	case 2:
		return fmt.Sprintf("%.2f", n)
	case 4:
		return fmt.Sprintf("%.4f", n)
	default:
		return fmt.Sprintf("%.2f", n)
	}
}
