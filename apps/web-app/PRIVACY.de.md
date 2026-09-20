# XIV Dye Tools — Datenschutzhinweise (Web-App)

> Dies ist eine zur Verständlichkeit bereitgestellte Übersetzung. Maßgeblich ist die englische Fassung; weichen beide voneinander ab, gilt die englische Fassung. [Englisch](PRIVACY.md)

**Zuletzt aktualisiert:** 2026-09-16 · Gilt für **xivdyetools.app** und **beta.xivdyetools.app**. Der
Discord-Bot hat eine eigene Richtlinie: [`apps/discord-worker/PRIVACY_POLICY.md`](../discord-worker/PRIVACY_POLICY.md).

XIV Dye Tools läuft in deinem Browser. Die Farbwerkzeuge — Paletten-Extraktor, Harmonie-Explorer,
Vergleich, Verlauf, Mixer, Barrierefreiheitsprüfung, Budget-Finder und Swatch-Matcher — erledigen
ihre Arbeit auf deinem Gerät. Nichts, was du hochlädst, auswählst oder eingibst, wird irgendwohin
gesendet, sofern nicht ein Abschnitt unten das Gegenteil sagt — und die Abschnitte unten sind die
vollständige Liste.

## Bilder und Kamera-Aufnahmen

- Hochgeladene, eingefügte, per Drag-and-drop abgelegte und mit der Kamera aufgenommene Bilder
  verlassen niemals dein Gerät und werden niemals im Browser-Speicher abgelegt. Sie werden mit der
  Canvas-API des Browsers gelesen, nur für die Dauer der Sitzung im Arbeitsspeicher der Seite
  gehalten und verworfen, sobald du das Bild löschst, den Tab schließt oder die Seite neu lädst.
- Der Paletten-Extraktor sagt an der Stelle, an der du eine Datei auswählst, dasselbe — "Bilder
  werden im Browser gelesen und nie hochgeladen", neben einem Vorhängeschloss. Dieser
  Hinweis ist reiner Text, kein Link; dieses Dokument erreichst du über **Über XIV Farbwerkzeuge →
  Datenschutz**.

## Charakterdateien (`.chara`)

- Eine `.chara`-Datei (Anamnesis, Ktisis, Brio) wird auf deinem Gerät ausgelesen. Ihr Charaktername
  wird niemals irgendwohin gesendet und niemals als Preset-Name, Autorenname oder irgendetwas
  anderes verwendet, das andere Spieler sehen können. Um eine Mirage bei den Community-Presets
  einzureichen, musst du selbst einen Namen eingeben — das Feld ist absichtlich leer, denn sowohl
  der Charaktername als auch der Dateiname sind Orte, an denen Spieler ihren echten Namen ablegen.
- **Eine Ausnahme, und die bleibt auf deinem Gerät.** Wenn du eine Mirage oder ihre Palette in
  diesem Browser speicherst, ohne einen Namen einzugeben, greift der gespeicherte Eintrag auf den
  Spitznamen des Charakters zurück, dann auf den Namen der `.chara`-Datei. Dieser Name liegt im
  Speicher deines Browsers neben deinen anderen gespeicherten Sammlungen. Er wird niemals
  hochgeladen, und der Community-Pfad oben liest ihn nie. Benenne den Eintrag um, lösche ihn, oder
  lösche deine Website-Daten, und er ist verschwunden.
- Um die Ausrüstung auf dem Mirage-Block zu benennen, fragt die App unsere API nach dem Gegenstand
  hinter jedem Slot. Die Anfrage enthält nur die **Modellnummern** der Ausrüstung aus der Datei
  (ein Dutzend kleiner Ganzzahlen pro Datei) — nicht die Datei, nicht den Namen, nicht die Farben —
  und die Gegenstandssymbole kommen vom selben Host zurück (`data.xivdyetools.app`).

## Was auf deinem Gerät gespeichert wird

`localStorage` enthält leichtgewichtige Einstellungen und deine eigene gespeicherte Arbeit: Design,
Sprache, Einstellungen pro Werkzeug (einschließlich des Analyse-Schalters unten), favorisierte
Farbstoffe, gespeicherte Paletten und Sammlungen sowie — wenn du dich anmeldest — dein
Sitzungs-Token für die Community-Presets. Nichts davon ist ein Tracking-Identifikator.
"Einstellungen zurücksetzen" in den Erweiterten Einstellungen sowie die Website-Daten-Steuerung
deines Browsers löschen es.

`IndexedDB` enthält genau eine Sache: einen Cache bereits abgerufener Marktbrett-Preise, damit
dieselbe Abfrage nicht wiederholt wird. Es enthält keine Bilder — eine frühere Version der App
bewahrte dort dein letztes Extraktor-Bild auf, und diese Kopie wird beim ersten Öffnen der App nach
diesem Update gelöscht. Die Website-Daten-Steuerung deines Browsers löscht es.

## Netzwerkzugriff

Die App kommuniziert nur mit diesen First-Party-Hosts (die Content-Security-Policy der Website
erlaubt nichts anderes) sowie den unten genannten Drittanbietern:

1. **Marktbrett-Preise** (optional — der Schalter "Preise anzeigen"): Gegenstands-IDs und die Welt
   oder das Datenzentrum, die du gewählt hast, gehen an unseren Proxy unter `data.xivdyetools.app`,
   der von [Universalis](https://universalis.app) abruft.
2. **Ausrüstungsnamen und -symbole für `.chara`-Importe** — `data.xivdyetools.app` (siehe oben).
3. **Community-Presets** (`api.xivdyetools.app`): Das Durchsuchen sendet nichts über dich. Die
   Anmeldung über `auth.xivdyetools.app` mit Discord oder XIVAuth legt sofort einen
   Kontodatensatz an — deine Anbieter-ID und deinen Benutzernamen —, unabhängig davon, ob du
   anschließend etwas einreichst oder abstimmst. Presets und Stimmen, die du einreichst, werden
   unter diesem Konto gespeichert, und der Autorenname wird bei veröffentlichten Presets angezeigt.
   Wenn du ein Preset einreichst oder bearbeitest, können sein Name und seine Beschreibung
   zusätzlich an Googles [Perspective API](https://perspectiveapi.com/) für eine
   Moderationsbewertung gesendet werden (optional — nur zur Inhaltsmoderation); die Anfrage weist
   Google an, sie nicht zu speichern (`doNotStore`), und sonst wird nichts — auch keine
   Kontoidentität — dorthin gesendet. Um deinen Kontodatensatz und deine Einreichungen entfernen
   zu lassen, siehe den Abschnitt Fragen? unten. Vorschaubilder von Presets werden von
   `shots.xivdyetools.app` ausgeliefert; Avatare laden vom CDN von Discord.
4. **Share-Links**: Ein Share-Link kodiert die von dir gewählten Farbstoffe oder Farben in seiner
   URL. Das Öffnen eines solchen Links lädt diese URL wie jede andere Seite; Link-Vorschauen bei
   Discord und anderswo werden von unserem eigenen `og-worker` gerendert, der nur die URL sieht.
5. **Nutzungsanalyse** (Opt-in — siehe nächster Abschnitt): `data.xivdyetools.app`.

Schriftarten sind selbst gehostet. Es gibt keine Analyse-Skripte, Werbe- oder Social-Tracker von
Drittanbietern und keine Cookies.

### Links, die dich zu anderen Websites führen

Getrennt von der obigen Liste **navigieren** dich manche Schaltflächen zu einer
Community-Datenbank, statt im Hintergrund etwas abzurufen. Das Menü "Öffnen in…" des
Swatch-Matchers bei einem Mirage-Teil öffnet [Mirapri](https://mirapri.com/),
[Garland Tools](https://www.garlandtools.org/), [Teamcraft](https://ffxivteamcraft.com/),
[Gamer Escape](https://ffxiv.gamerescape.com/) oder das Lodestone; eine Farbstoff-Ergebniskarte
kann Universalis, Garland Tools, Teamcraft oder
[Saddlebag Exchange](https://saddlebagexchange.com/) öffnen.

Was in diesen Links übertragen wird, ist der eigene Gegenstand des Spiels — seine numerische
Gegenstands-ID oder der Name des Gegenstands in der Sprache, die diese Website verwendet. Nichts
über dich, deine Palette, deinen Charakter oder deine Sitzung steht in der URL. Sie öffnen sich in
einem neuen Tab mit unterdrücktem Referrer, sodass die Website, auf der du landest, nicht erfährt,
von welcher Seite du kamst. Sobald du dort bist, befindest du dich auf der Website einer anderen
Partei, unter deren Datenschutzrichtlinie.

## Nutzungsanalyse (Opt-in)

Analysen sind **standardmäßig deaktiviert**. Sie laufen nur, solange **Erweiterte Einstellungen →
Analysen aktivieren** eingeschaltet ist, und niemals, wenn dein Browser das Signal
[Global Privacy Control](https://globalprivacycontrol.org/) sendet — selbst bei eingeschaltetem
Schalter. Der Server erzwingt dies ebenfalls: Er akzeptiert Telemetrie nur von den eigenen
Ursprüngen der App und verwirft jeden Stapel, der das `Sec-GPC`-Signal deines Browsers trägt,
bevor er sie schreibt. Das Ausschalten des Schalters stoppt das Senden sofort, in jedem geöffneten
Tab, und verwirft alles noch nicht Gesendete.

Wenn aktiviert, sendet die App kleine Stapel dieser Ereignisse an unsere API
(`data.xivdyetools.app`), die sie in Cloudflare Analytics Engine speichert:

- **Werkzeug-Aufrufe** — welches Werkzeug geöffnet wurde, ob es das Werkzeug war, mit dem die
  Seite geladen wurde, ein Share-Link oder ein bewusster Wechsel, und wie viele Sekunden der Tab
  darauf sichtbar war.
- **Farbstoff-Auswahlen** — die numerische ID eines Farbstoffs, den du bewusst aus der
  Paletten-Schublade oder einem Farbstoff-Raster ausgewählt hast, und in welchem Werkzeug du warst.
  Zufalls-Farbstoff-Schaltflächen und Auswahlen, die das Werkzeug nicht akzeptiert hat, werden nicht
  gezählt; deine Palette als Ganzes wird niemals gesendet.
- **Charakterdatei-Importe** — ob eine `.chara`-Datei erfolgreich gelesen wurde und welche
  Programmfamilie sie erzeugt hat (Anamnesis, Ktisis, Brio, andere). Niemals die Datei oder den
  Charakter.
- **Design-Wechsel** — das Design, zu dem du bewusst gewechselt hast.

Jeder Stapel trägt außerdem fünf grobe Dimensionen: App-Version, Umgebung (Produktion oder Beta),
UI-Sprache, aktuelles Design und einen Viewport-Bereich (Handy / Tablet / Desktop).

Was **niemals** zusammen mit deinen Ereignissen gespeichert wird: deine IP-Adresse, dein
User-Agent oder Geräteangaben, irgendein Konto-, Sitzungs- oder Client-Identifikator, Cookies,
Seiten-URLs, Farben oder Bilder, mit denen du arbeitest, Suchtext, Preset-Text, Charakter- oder
Weltnamen, oder irgendetwas, das zwei Besuche verknüpfen ließe. Der Server verwirft alles zur
Anfrage außer den validierten Ereignissen, und die Ereignisliste ist eine Positivliste — alles
andere wird verworfen. (Deine IP-Adresse erreicht unseren Server so, wie sie jede Website erreicht,
die du besuchst; was damit geschieht, steht im nächsten Abschnitt.)

Analytics Engine bewahrt die Daten etwa drei Monate lang auf. Der Code ist quelloffen:
[`apps/web-app/src/services/telemetry-service.ts`](src/services/telemetry-service.ts) (was der
Browser sendet) und
[`apps/api-worker/src/telemetry/schema.ts`](../api-worker/src/telemetry/schema.ts) (was der Server
annimmt).

## Deine IP-Adresse und was die Server protokollieren

Jede Website, die du besuchst, erhält deine IP-Adresse — so findet die Antwort zu dir zurück.
Unsere wird von Cloudflare verwaltet, und hier ist alles, was wir damit tun.

- **Missbrauchsprävention.** Unsere API zählt Anfragen pro IP-Adresse über ein 60-Sekunden-Fenster,
  damit keine einzelne Quelle den Dienst überfluten kann. Die Zählung übernimmt Cloudflares eigener
  Rate-Limiting-Dienst, dem wir die Adresse übergeben, ohne sie selbst zu speichern. Es gibt einen
  Ausweichpfad, der nur auf einer Bereitstellung genutzt wird, auf der dieser Dienst nicht
  eingebunden ist; dort wird stattdessen ein Zähler in Cloudflare KV unter einem Schlüssel geführt,
  der die Adresse enthält, für **120 Sekunden**. Keiner der beiden Pfade schreibt deine Adresse in
  eine Datenbank, und keiner ist mit deinen Analyse-Ereignissen verbunden.
- **Deine IP-Adresse wird niemals zusammen mit irgendetwas gespeichert, das du getan hast** — nicht
  mit deinen Ereignissen, nicht mit deinen Presets, nicht mit deinen Stimmen. Sie wird nicht
  verwendet, um Besuche zu verknüpfen, ein Profil zu erstellen oder dich zu identifizieren.
- **Betriebsprotokolle.** Unsere Worker können beim Bearbeiten einer Anfrage kurze
  Diagnosezeilen ausgeben. Die dauerhafte Protokollerfassung (Cloudflare Workers Logs) ist bei
  jedem unserer Worker **ausgeschaltet**, sodass diese Zeilen nur für einen Maintainer sichtbar
  sind, der beim Debuggen einen Live-Stream verfolgt, und danach nicht aufbewahrt werden. Sollten
  wir jemals dauerhafte Protokollierung einschalten, werden wir dies zuerst hier ankündigen. Die
  Protokolle des Discord-Bots sind durch
  [seine eigene Richtlinie](../discord-worker/PRIVACY_POLICY.md) abgedeckt.

## So kannst du es überprüfen

1. Öffne DevTools → Netzwerk, aktiviere "Protokoll beibehalten".
2. Verwende ein beliebiges Werkzeug mit einem Bild oder einer `.chara`-Datei.
3. Du wirst keinen Bild-Upload sehen — nur die oben aufgeführten Anfragen, und `/v1/telemetry`-
   Beacons nur, wenn du Analysen eingeschaltet hast.

## Fragen?

Eröffne ein Issue auf [GitHub](https://github.com/FlashGalatine/xivdyetools/issues) oder frag auf
Discord. Wir dokumentieren gerne weitere Zusicherungen, wenn es der Community hilft, sich bei der
Nutzung der Werkzeuge sicher zu fühlen.
