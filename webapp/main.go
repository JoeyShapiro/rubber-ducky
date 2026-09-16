package main

import (
	"log"

	"github.com/wailsapp/wails/v3/pkg/application"
)

// No embedded assets and no bound services: this window just points at the
// live rubber-ducky server, the same way a browser tab would. No Go server
// code, no local copy of the frontend to keep in sync.
func main() {
	app := application.New(application.Options{
		Name:        "Rubber Ducky",
		Description: "Native shell for the rubber-ducky web app",
		Mac: application.MacOptions{
			ApplicationShouldTerminateAfterLastWindowClosed: true,
		},
	})

	app.Window.NewWithOptions(application.WebviewWindowOptions{
		Title:  "Rubber Ducky",
		Width:  1000,
		Height: 700,
		Mac: application.MacWindow{
			InvisibleTitleBarHeight: 50,
			Backdrop:                application.MacBackdropTranslucent,
			TitleBar:                application.MacTitleBarHiddenInset,
		},
		BackgroundColour: application.NewRGB(6, 7, 15),
		URL:              "http://localhost:5173",
	})

	if err := app.Run(); err != nil {
		log.Fatal(err)
	}
}
