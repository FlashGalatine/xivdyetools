# XIV Dye Tools Discord-Bot - Datenschutzrichtlinie

> Dies ist eine zur Verständlichkeit bereitgestellte Übersetzung. Maßgeblich ist die englische Fassung; weichen beide voneinander ab, gilt die englische Fassung. [Englisch](PRIVACY_POLICY.md)

**Zuletzt aktualisiert**: 2026-09-16

## 1. Einführung

Diese Datenschutzrichtlinie erklärt, wie der XIV Dye Tools Discord-Bot ("der Bot", "wir", "unser")
deine Informationen erhebt, nutzt und schützt, wenn du unsere Dienste nutzt.

Wir setzen uns dafür ein, deine Privatsphäre zu schützen und in Bezug auf unsere Datenpraktiken
transparent zu sein. Dieser Bot ist ein von Fans gemachtes Community-Werkzeug und steht in keiner
Verbindung zu Square Enix.

## 2. Daten, die wir erheben

### Automatisch erhobene Informationen

| Datentyp | Zweck | Aufbewahrung |
|-----------|---------|-----------|
| Discord-Benutzer-ID | Identifiziert Nutzer für Einstellungen, favorisierte Presets, Abstimmungen, Ratenbegrenzung und die Markierung des Erstlauf-Hinweises; dient außerdem als Schlüssel für einen täglichen Aktivitäts-Marker pro Nutzer und wird (nie aufgelistet) in Nutzungsstatistiken gezählt — siehe *Nutzungsanalyse* unten | Bis eine Datenlöschung beantragt wird (Nutzungsstatistik-Datensätze: siehe *Nutzungsanalyse*) |
| Discord-Benutzername | Ordnet Einreichungen von Community-Presets zu | Bis eine Datenlöschung beantragt wird |
| Nutzer-Gebietsschema | Stellt lokalisierte Bot-Antworten bereit; die Sprache des Discord-Clients (eingeordnet in eine der sechs vom Bot unterstützten Sprachen, oder "andere") wird ebenfalls in Nutzungsstatistiken erfasst — siehe *Nutzungsanalyse* unten | Gespeicherte Einstellung: bis sie gelöscht wird. Nutzungsstatistik-Kategorie: siehe *Nutzungsanalyse* |
| Server-ID / Kanal-ID | Verarbeitet Befehle im Kontext | Wird nicht gespeichert. Nutzungsstatistiken erfassen nur, *ob* ein Befehl in einem Server oder in einer DM ausgeführt wurde (die Werte `guild` / `dm`) — niemals die ID des Servers oder des Kanals |

### Informationen, die du bereitstellst

| Datentyp | Zweck | Aufbewahrung |
|-----------|---------|-----------|
| Einstellungen | Sprache, Mischmodus, Matching-Algorithmus, Ergebnisanzahl, Stamm, Geschlecht, Standard-Welt / -Datenzentrum, ob Marktbrett-Preise standardmäßig angezeigt werden, Farbanzeige-Umschalter und Design sowie welche Farbstoffkategorien von den Suchergebnissen ausgeschlossen werden sollen (metallisch, pastellfarben, dunkel, kosmisch, ishgardisch, teuer, vom Händler verkauft, hergestellt) | Bis du sie zurücksetzt oder eine Löschung beantragst |
| Favorisierte Presets | Bis zu 50 Community-Presets, die du mit `/preset favorite add` markierst — die ID des Presets und der Name, den es bei der Speicherung hatte | Bis du sie entfernst oder eine Löschung beantragst |
| Erstlauf-Hinweis-Markierung | Eine Markierung pro Nutzer, dass dir der 5.0-Willkommenshinweis gezeigt wurde; enthält keinen Inhalt | Läuft automatisch nach 180 Tagen ab |
| Preset-Einreichungen | Name, Beschreibung, Farbstoffe, Tags, Kategorie | Unbegrenzt (Community-Inhalt) |
| Stimmen | Deine Stimmen zu Community-Presets | Bis du die Stimme entfernst oder eine Löschung beantragst |

### Ratenbegrenzungsdaten

- Zähler pro Nutzer und Befehl werden vom Rate-Limiting-Dienst der Cloudflare Workers für das
  60-Sekunden-Fenster gehalten und niemals in KV geschrieben.
- **Fallback**: Auf einer Bereitstellung ohne die nativen Rate-Limiting-Bindings werden die Zähler
  stattdessen in Cloudflare KV gehalten, unter einem Schlüssel, der deine Discord-Benutzer-ID und
  den Befehlsnamen enthält, mit einer Gültigkeit von 120 Sekunden. Sowohl Produktion als auch Beta
  binden den nativen Dienst, sodass dieser Pfad dort nicht genutzt wird.
- Der Bot sieht oder verwendet deine IP-Adresse niemals zur Ratenbegrenzung — er identifiziert dich
  über die Discord-Benutzer-ID, da Befehle von Discords Servern eintreffen und nicht direkt von dir.
- Kein Dritter ist beteiligt.

### Nutzungsanalyse

Um den Bot gesund zu halten und das `/stats`-Dashboard zu betreiben, erfassen wir für jeden Befehl,
den du ausführst, oder jede Kopier-Schaltfläche, die du drückst:

| Daten | Wo | Aufbewahrung |
|------|-------|-----------|
| Befehlsname und Unterbefehl, ob er beantwortet wurde und — falls etwas schiefging — eine grobe Fehlerklasse (ratenbegrenzt, Anfrage vom Preset- oder Marktdienst abgelehnt, Marktdaten nicht verfügbar, Preset-Dienst nicht verfügbar, das hochgeladene Bild oder die `.chara`-Datei konnte nicht gelesen werden, Rendern fehlgeschlagen, unbekannt; niemals eine Fehlermeldung), wie lange es dauerte, ob es in einem Server oder einer DM lief (`guild` / `dm` — niemals die ID des Servers), die Sprache deines Discord-Clients (eine der sechs vom Bot unterstützten, oder "andere"), welche Kopier-Schaltfläche du gedrückt hast (hex / RGB / HSV) und deine Discord-Benutzer-ID (nur zum Zählen eindeutiger Nutzer verwendet) | Cloudflare Workers Analytics Engine | Aufbewahrungsfenster von Cloudflares Analytics Engine (zum Zeitpunkt der Erstellung 3 Monate) |
| Aggregierte Zähler — Gesamtzahl der Befehle, Zähler pro Befehl, Erfolge/Fehlschläge (keine Nutzerdaten) | Cloudflare KV | 30 Tage (automatische TTL) |
| Ein Schlüssel pro Nutzer und Tag (`usertrack:{date}:{userId}`, Wert `1`), damit tägliche aktive Nutzer gezählt werden können | Cloudflare KV | 30 Tage (automatische TTL) |

Diese Datensätze enthalten niemals Nachrichteninhalte, Befehls-Optionswerte, Servernamen oder
Kanal-IDs. Daten in Analytics Engine können nach dem Schreiben nicht pro Nutzer bearbeitet oder
gelöscht werden; sie laufen nach Cloudflares Zeitplan ab.

## 3. Daten, die wir NICHT erheben

Wir erheben ausdrücklich **nicht**:

- ❌ Nachrichteninhalte (über Befehlsparameter hinaus)
- ❌ Persönliche Informationen (E-Mail, echter Name, Telefonnummer)
- ❌ IP-Adressen (durch Cloudflare Workers abstrahiert)
- ❌ Mitgliederlisten von Servern
- ❌ Direktnachrichten
- ❌ Sprachdaten
- ❌ Bilder (im Arbeitsspeicher verarbeitet, nicht gespeichert)
- ❌ Charakternamen aus `.chara`-Dateien (nie auf Karten oder Embeds angezeigt, nie gespeichert)

### Bildverarbeitung

Wenn du `/extractor image` verwendest, wird dein hochgeladenes Bild:
1. Im Arbeitsspeicher auf Cloudflares Edge-Servern verarbeitet
2. Auf dominante Farben analysiert
3. **Sofort verworfen** nach der Verarbeitung
4. **Niemals gespeichert** auf unseren Servern

## 4. Wie wir deine Daten verwenden

| Zweck | Verwendete Daten |
|---------|-------------------|
| Bot-Funktionalität bereitstellen | Nutzer-ID, Server-ID, Kanal-ID |
| Deine Einstellungen speichern | Nutzer-ID und die von dir festgelegten Einstellungswerte |
| Deine favorisierten Presets verwalten | Nutzer-ID, Preset-ID |
| Community-Presets | Nutzer-ID, Benutzername, Preset-Inhalt |
| Abstimmungssystem | Nutzer-ID, Preset-ID |
| Missbrauch verhindern | Nutzer-ID, Ratenbegrenzungszähler |
| Nutzungsstatistiken (`/stats`) | Befehlsname und Unterbefehl, Ergebnisklasse, Latenz, Server-oder-DM-Kennzeichen, Client-Sprachkategorie, Art der Kopier-Schaltfläche, Nutzer-ID (gezählt, nie aufgelistet) |

## 5. Datenspeicherung

### Wo deine Daten gespeichert werden

| Dienst | Gespeicherte Daten | Standort |
|---------|-------------|----------|
| Cloudflare KV | Einstellungen, favorisierte Presets, die Erstlauf-Hinweis-Markierung, Nutzungszähler und tägliche Aktivitätsschlüssel (30-Tage-TTL) sowie die Ratenbegrenzungszähler nur auf einer Bereitstellung ohne die nativen Rate-Limiting-Bindings (120-Sekunden-TTL) | Globales Edge-Netzwerk |
| Cloudflare D1 | Community-Presets, Stimmen, Moderationsverlauf, Fehldatensätze zu Moderationsbenachrichtigungen, tägliche Zähler für Einreichungen / Bearbeitungen (siehe *Datenaufbewahrung*) | Cloudflares Datenbankinfrastruktur |
| Cloudflare Workers Analytics Engine | Telemetrie zur Befehlsnutzung (siehe *Nutzungsanalyse*) | Cloudflares Analyseinfrastruktur |

Alle Daten werden auf Cloudflares Infrastruktur gespeichert. Siehe
[Cloudflares Datenschutzrichtlinie](https://www.cloudflare.com/privacypolicy/) für weitere
Informationen.

### Datensicherheit

- Alle Daten werden über HTTPS übertragen
- Keine serverseitigen Sitzungen (zustandslose Architektur)
- Zugriff wird über Discord-Authentifizierung kontrolliert
- Keine Klartext-Passwortspeicherung (wir erheben keine Passwörter)

### Betriebsprotokolle

Während der Bearbeitung eines Befehls kann der Bot kurze Diagnosezeilen ausgeben. Zwei davon
enthalten **deine Discord-Benutzer-ID** — eine, wenn ein Befehl beginnt, eine, wenn ein Befehl
ratenbegrenzt wird — zusammen mit dem Befehlsnamen. Sie enthalten niemals Befehls-Optionswerte,
Nachrichteninhalte, Servernamen, Kanal-IDs oder irgendetwas aus einem hochgeladenen Bild oder einer
`.chara`-Datei.

Die dauerhafte Protokollerfassung (Cloudflare Workers Logs) ist für den Bot **ausgeschaltet**,
sodass diese Zeilen nur in einem Live-Debugging-Stream existieren, den ein Maintainer in diesem
Moment beobachtet, und danach nicht aufbewahrt werden. Sie sind kein Datenspeicher, nicht
abfragbar und getrennt von der oben beschriebenen Nutzungsanalyse. Sollten wir jemals dauerhafte
Protokollierung einschalten, wird diese Richtlinie zuerst aktualisiert.

## 6. Drittanbieter-Dienste

Der Bot ist mit diesen Drittanbieter-Diensten verbunden:

| Dienst | Zweck | Ihre Datenschutzrichtlinie |
|---------|---------|---------------------|
| Discord | Bot-Plattform, Authentifizierung | [Discord-Datenschutzrichtlinie](https://discord.com/privacy) |
| Cloudflare | Hosting, Datenspeicherung (KV, D1), Ratenbegrenzung, Analyse | [Cloudflare-Datenschutzrichtlinie](https://www.cloudflare.com/privacypolicy/) |
| Universalis | FFXIV-Marktbrett-Daten | [Universalis](https://universalis.app/) |
| Perspective API | Inhaltsmoderation (optional) | [Google-Datenschutzrichtlinie](https://policies.google.com/privacy) |

Wir verkaufen, tauschen oder teilen deine personenbezogenen Daten nicht mit Drittanbietern zu
Marketingzwecken.

## 7. Deine Rechte

Du hast das Recht:

### Auf deine Daten zuzugreifen
- Verwende `/preferences show`, um deine gespeicherten Einstellungen anzusehen
- Verwende `/preset favorite list`, um deine favorisierten Presets anzusehen
- Kontaktiere uns, um einen vollständigen Datenexport anzufordern

### Deine Daten zu löschen
- Verwende `/preferences reset`, um alle deine Einstellungen zurückzusetzen, oder
  `/preferences reset key:<preference>`, um nur eine zurückzusetzen
- Verwende `/preset favorite remove`, um ein favorisiertes Preset zu entfernen
- Kontaktiere uns, um eine vollständige Datenlöschung anzufordern

Die Erstlauf-Hinweis-Markierung kann nicht von dir selbst verwaltet werden — sie läuft von selbst
nach 180 Tagen ab.

### Eine vollständige Datenlöschung anzufordern

Um die Löschung aller deiner Daten zu beantragen:

1. **E-Mail**: FlashGalatineFGC@gmail.com
   - Betreff: "XIV Dye Tools Privacy"
   - Gib deine Discord-Benutzer-ID an
2. **Discord**: Tritt https://discord.gg/rzxDHNr6Wv bei und schreibe "Flash Galatine" eine DM

Wir bearbeiten Löschanfragen innerhalb von 30 Tagen.

## 8. Datenaufbewahrung

| Datentyp | Aufbewahrungszeitraum |
|-----------|-----------------|
| Ratenbegrenzungszähler | 60 Sekunden (120 Sekunden auf einer Bereitstellung ohne die nativen Rate-Limiting-Bindings) |
| Nutzungszähler (Cloudflare KV) | 30 Tage |
| Tägliche Aktivitätsschlüssel pro Nutzer (Cloudflare KV) | 30 Tage |
| Telemetrie zur Befehlsnutzung (Analytics Engine) | Aufbewahrungsfenster von Cloudflares Analytics Engine (zum Zeitpunkt der Erstellung 3 Monate) |
| Nutzereinstellungen | Bis vom Nutzer gelöscht |
| Favorisierte Presets | Bis von dir entfernt |
| Erstlauf-Hinweis-Markierung | 180 Tage |
| Community-Presets | Unbegrenzt (öffentlicher Inhalt) |
| Stimmen | Bis entfernt oder Kontolöschung |
| Fehldatensätze zu Moderationsbenachrichtigungen (Preset-ID, Fehler, Zeitstempel) | 30 Tage nach Lösung, 90 Tage bei ungelöst — sofort gelöscht, wenn das Preset gelöscht wird |
| Tägliche Zähler für Einreichungen / Bearbeitungen (Nutzer-ID, Art, Zeitstempel) | 30 Tage |

## 9. Datenschutz für Kinder

Der Bot ist für Nutzer gedacht, die das Mindestalter von Discord erfüllen (13 Jahre oder älter,
oder das Mindestalter in deinem Land). Wir erheben nicht wissentlich Daten von Kindern unter
diesen Altersgrenzen.

Wenn du glaubst, dass ein Kind unter dem Mindestalter uns Daten überlassen hat, kontaktiere uns
bitte zur Entfernung.

## 10. Internationale Datenübertragungen

Deine Daten können in jedem Land verarbeitet werden, in dem Cloudflare Edge-Server betreibt. Mit
der Nutzung des Bots stimmst du dieser Übertragung zu. Cloudflare unterhält angemessene
Schutzmaßnahmen für internationale Datenübertragungen.

## 11. Änderungen dieser Richtlinie

Wir können diese Datenschutzrichtlinie von Zeit zu Zeit aktualisieren. Änderungen werden:

- In diesem Dokument mit einem aktualisierten Datum "Zuletzt aktualisiert" veröffentlicht
- Bei bedeutenden Änderungen auf unserem Discord-Server angekündigt

Die fortgesetzte Nutzung des Bots nach Änderungen stellt die Annahme der aktualisierten Richtlinie
dar.

## 12. Kontakt

Für datenschutzbezogene Fragen oder Datenanfragen:

- **E-Mail**: FlashGalatineFGC@gmail.com (Betreff: "XIV Dye Tools Privacy")
- **Discord**: https://discord.gg/rzxDHNr6Wv
- **Support-Kanal**: #dyetools-issues-and-suggestions

---

**Mit der Nutzung des XIV Dye Tools Discord-Bots bestätigst du, dass du diese
Datenschutzrichtlinie gelesen und verstanden hast.**
