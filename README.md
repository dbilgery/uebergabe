# Übergabeprotokoll – GitHub Pages

## Upload
1. Neues GitHub-Repository anlegen, z. B. `uebergabeprotokoll`.
2. Alle Dateien aus diesem Ordner in das Repository hochladen.
3. Repository → Settings → Pages.
4. Unter „Build and deployment“: `Deploy from a branch` wählen.
5. Branch `main`, Ordner `/(root)` wählen und speichern.
6. Nach kurzer Zeit ist die Web-App unter der von GitHub angezeigten Pages-URL erreichbar.

## iPad
- Seite einmal in Safari öffnen.
- Teilen → „Zum Home-Bildschirm“.
- Danach lässt sich das Formular wie eine kleine App starten.

## Datenschutz
Die Formularwerte werden nicht in Local Storage, Cookies oder einer Datenbank gespeichert. Die PDF wird lokal im Browser erzeugt. GitHub Pages liefert nur die statischen Dateien aus.

## Hinweis zur PDF-Erstellung
Die PDF-Erstellung verwendet jsPDF über jsDelivr. Beim ersten Öffnen sollte eine Internetverbindung bestehen; der Service Worker versucht die Bibliothek anschließend zusammen mit der App für die Offline-Nutzung zwischenzuspeichern.
