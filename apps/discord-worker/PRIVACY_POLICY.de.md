# XIV Dye Tools Discord-Bot - Datenschutzrichtlinie

> Dies ist eine zur Verständlichkeit bereitgestellte Übersetzung. Maßgeblich ist die englische Fassung; weichen beide voneinander ab, gilt die englische Fassung. [Englisch](PRIVACY_POLICY.md)

**Zuletzt aktualisiert**: 2026-10-05

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
| Discord-Benutzer-ID | Identifiziert Nutzer für Einstellungen, favorisierte Vorlagen, Abstimmungen, Ratenbegrenzung und die Markierung des Erstlauf-Hinweises; dient außerdem als Schlüssel für einen täglichen Aktivitäts-Marker pro Nutzer und wird (nie aufgelistet) in Nutzungsstatistiken gezählt — siehe *Nutzungsanalyse* unten | Bis eine Datenlöschung beantragt wird (Nutzungsstatistik-Datensätze: siehe *Nutzungsanalyse*) |
| Autorenname: dein Discord-Anzeigename (dein Benutzername, wenn du keinen Anzeigenamen hast). Eine Vorlage, die du in der Web-App nach der Anmeldung mit XIVAuth einreichst, zeigt stattdessen den Namen deines verifizierten Charakters oder "XIVAuth User", gefolgt von den ersten 8 Zeichen deiner XIVAuth-ID, wenn bei deiner Anmeldung kein verifizierter Charakter verfügbar ist | Wird öffentlich als Autor der von dir eingereichten Community-Vorlagen angezeigt | Bis eine Datenlöschung beantragt wird |
| Nutzer-Gebietsschema | Stellt lokalisierte Bot-Antworten bereit; die Sprache des Discord-Clients (eingeordnet in eine der sechs vom Bot unterstützten Sprachen, oder "andere") wird ebenfalls in Nutzungsstatistiken erfasst — siehe *Nutzungsanalyse* unten | Gespeicherte Einstellung: bis sie gelöscht wird. Nutzungsstatistik-Kategorie: siehe *Nutzungsanalyse* |
| Server-ID / Kanal-ID | Verarbeitet Befehle im Kontext | Wird nicht gespeichert. Nutzungsstatistiken erfassen nur, *ob* ein Befehl in einem Server oder in einer DM ausgeführt wurde (die Werte `guild` / `dm`) — niemals die ID des Servers oder des Kanals |

### Informationen, die du bereitstellst

| Datentyp | Zweck | Aufbewahrung |
|-----------|---------|-----------|
| Einstellungen | Sprache, Mischmodus, Matching-Algorithmus, Ergebnisanzahl, Stamm, Geschlecht, Standard-Welt / -Datenzentrum, ob Marktbrett-Preise standardmäßig angezeigt werden, Farbanzeige-Umschalter und Design sowie welche Farbstoffkategorien von den Suchergebnissen ausgeschlossen werden sollen (metallisch, pastellfarben, dunkel, kosmisch, ishgardisch, teuer, vom Händler verkauft, hergestellt), dazu der Zeitpunkt, zu dem du sie zuletzt geändert hast | Bis du sie zurücksetzt oder eine Löschung beantragst |
| Favorisierte Vorlagen | Bis zu 50 Community-Vorlagen, die du mit `/preset favorite add` markierst — die ID der Vorlage und der Name, den sie bei der Speicherung hatte | Bis du sie entfernst oder eine Löschung beantragst |
| Erstlauf-Hinweis-Markierung | Eine Markierung pro Nutzer, dass dir der 5.0-Willkommenshinweis gezeigt wurde; enthält keinen Inhalt | Läuft automatisch nach 180 Tagen ab |
| Vorlagen-Einreichungen | Name, Beschreibung, Farbstoffe, Tags, Kategorie — und, falls unsere automatische Prüfung den neuen Namen oder die neue Beschreibung einer Bearbeitung zur Prüfung zurückhält, die Fassung vor der ersten solchen Bearbeitung, aufbewahrt, bis ein Moderator diese Fassung wiederherstellt oder die Vorlage gelöscht wird | Bis du sie löschst (unter "Meine Einreichungen" in der Web-App, angemeldet mit demselben Discord-Konto) oder eine Löschung beantragst |
| Stimmen | Deine Stimmen zu Community-Vorlagen. Das Einreichen einer Vorlage zählt als deine Stimme dafür; hat eine veröffentlichte Vorlage bereits dieselben Farbstoffe, wird deine Einreichung stattdessen zu einer Stimme für diese Vorlage | Bis du die Stimme entfernst oder eine Löschung beantragst |

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
| Befehlsname und Unterbefehl, ob er beantwortet wurde und — falls etwas schiefging — eine grobe Fehlerklasse (ratenbegrenzt, Anfrage vom Vorlagen- oder Marktdienst abgelehnt, Marktdaten nicht verfügbar, Vorlagendienst nicht verfügbar, das hochgeladene Bild oder die `.chara`-Datei konnte nicht gelesen werden, Rendern fehlgeschlagen, unbekannt; niemals eine Fehlermeldung), wie lange es dauerte, ob es in einem Server oder einer DM lief (`guild` / `dm` — niemals die ID des Servers), die Sprache deines Discord-Clients (eine der sechs vom Bot unterstützten, oder "andere"), welche Kopier-Schaltfläche du gedrückt hast (hex / RGB / HSV) und deine Discord-Benutzer-ID (nur zum Zählen eindeutiger Nutzer verwendet) | Cloudflare Workers Analytics Engine | Aufbewahrungsfenster von Cloudflares Analytics Engine (zum Zeitpunkt der Erstellung 3 Monate) |
| Aggregierte Zähler — Gesamtzahl der Befehle, Zähler pro Befehl, Erfolge/Fehlschläge (keine Nutzerdaten) | Cloudflare KV | 30 Tage (automatische TTL) |
| Ein Schlüssel pro Nutzer und Tag (`usertrack:{date}:{userId}`, Wert `1`), damit tägliche aktive Nutzer gezählt werden können | Cloudflare KV | 30 Tage (automatische TTL) |

Diese Datensätze enthalten niemals Nachrichteninhalte, Befehls-Optionswerte, Servernamen oder
Kanal-IDs. Daten in Analytics Engine können nach dem Schreiben nicht pro Nutzer bearbeitet oder
gelöscht werden; sie laufen nach Cloudflares Zeitplan ab.

### Moderationsdatensätze

Community-Vorlagen werden moderiert. Um Sperren durchzusetzen und die Moderation nachvollziehbar zu
halten, speichern wir:

- **Sperrdatensätze.** Wenn dich ein Moderator für Community-Vorlagen sperrt, enthält der
  Sperrdatensatz deine Discord-Benutzer-ID oder, wenn du dich in der Web-App mit
  einem XIVAuth-Konto angemeldet hast, das nicht mit Discord verknüpft ist, stattdessen die
  Konto-ID, die dir unser Anmeldedienst gegeben hat (eine zufällige Kennung, nicht deine
  XIVAuth-ID), den Autorennamen, der zum Zeitpunkt der Sperre bei deinen Vorlagen
  angezeigt wurde, die Discord-Benutzer-IDs des Moderators, der die Sperre verhängt hat, und des
  Moderators, der sie aufgehoben hat, den Grund, den der Moderator angegeben hat, sowie das Datum
  der Sperre und das Datum ihrer Aufhebung.
- **Das Moderationsprotokoll.** Jede Moderationsmaßnahme wird mit der Discord-Benutzer-ID des
  Moderators, der Maßnahme, einem optionalen Grund und dem Zeitpunkt protokolliert. Eine Maßnahme zu
  einer Vorlage (etwa Genehmigen, Ablehnen oder Zurücksetzen) nennt die Vorlage. Eine Sperre, eine
  Aufhebung einer Sperre, ein Ausblenden oder ein Wiederherstellen nennt außerdem den Nutzer, auf
  den sich die Maßnahme bezog.

Wie lange jeder Datensatz aufbewahrt wird, steht unter *Datenaufbewahrung*.

## 3. Daten, die wir NICHT erheben

Wir erheben ausdrücklich **nicht**:

- ❌ Nachrichteninhalte (über Befehlsparameter hinaus)
- ❌ Persönliche Informationen (E-Mail, echter Name, Telefonnummer)
- ❌ IP-Adressen (durch Cloudflare Workers abstrahiert)
- ❌ Mitgliederlisten von Servern
- ❌ Direktnachrichten
- ❌ Sprachdaten
- ❌ Bilder (im Arbeitsspeicher verarbeitet, nicht gespeichert)
- ❌ `.chara`-Dateien (im Arbeitsspeicher verarbeitet, nicht gespeichert)
- ❌ Charakternamen aus `.chara`-Dateien (nie auf Karten oder Embeds angezeigt, nie gespeichert)

### Bildverarbeitung

Wenn du `/extractor image` verwendest, wird dein hochgeladenes Bild:
1. Im Arbeitsspeicher auf Cloudflares Edge-Servern verarbeitet
2. Auf dominante Farben analysiert
3. **Sofort verworfen** nach der Verarbeitung
4. **Niemals gespeichert** auf unseren Servern

### Charakterdateien

Wenn du `/swatch` oder `/glamour` verwendest, wird deine hochgeladene `.chara`-Datei:
1. Von Discord heruntergeladen und im Arbeitsspeicher auf Cloudflares Edge-Servern gelesen
2. Auf ihre Farben, Farbstoffe und Ausrüstung ausgelesen
3. **Sofort verworfen** nach der Verarbeitung
4. **Niemals gespeichert** auf unseren Servern

Um die Ausrüstung zu benennen, sendet `/glamour` die Modellnummern der Ausrüstung aus der Datei
und die ID ihres Gesichtsaccessoires an unsere eigene API, die sie bei XIVAPI nachschlägt. Sonst
wird nichts aus der Datei gesendet, und nichts über dich oder dein Discord-Konto.

## 4. Wie wir deine Daten verwenden

| Zweck | Verwendete Daten |
|---------|-------------------|
| Bot-Funktionalität bereitstellen | Nutzer-ID, Server-ID, Kanal-ID |
| Deine Einstellungen speichern | Nutzer-ID und die von dir festgelegten Einstellungswerte |
| Deine favorisierten Vorlagen verwalten | Nutzer-ID, Vorlagen-ID |
| Community-Vorlagen | Nutzer-ID, Autorenname (öffentlich angezeigt), Inhalt der Vorlage |
| Moderation | Sperrdatensätze und Einträge im Moderationsprotokoll (siehe *Moderationsdatensätze*) |
| Abstimmungssystem | Nutzer-ID, Vorlagen-ID |
| Missbrauch verhindern | Nutzer-ID, Ratenbegrenzungszähler |
| Nutzungsstatistiken (`/stats`) | Befehlsname und Unterbefehl, Ergebnisklasse, Latenz, Server-oder-DM-Kennzeichen, Client-Sprachkategorie, Art der Kopier-Schaltfläche, Nutzer-ID (gezählt, nie aufgelistet) |

## 5. Datenspeicherung

### Wo deine Daten gespeichert werden

| Dienst | Gespeicherte Daten | Standort |
|---------|-------------|----------|
| Cloudflare KV | Einstellungen, favorisierte Vorlagen, die Erstlauf-Hinweis-Markierung, Nutzungszähler und tägliche Aktivitätsschlüssel (30-Tage-TTL) sowie die Ratenbegrenzungszähler nur auf einer Bereitstellung ohne die nativen Rate-Limiting-Bindings (120-Sekunden-TTL) | Globales Edge-Netzwerk |
| Cloudflare D1 | Community-Vorlagen, Stimmen, Moderationsdatensätze (siehe *Moderationsdatensätze*), Fehldatensätze zu Moderationsbenachrichtigungen, tägliche Zähler für Einreichungen / Bearbeitungen (siehe *Datenaufbewahrung*) | Cloudflares Datenbankinfrastruktur |
| Cloudflare Workers Analytics Engine | Telemetrie zur Befehlsnutzung (siehe *Nutzungsanalyse*) | Cloudflares Analyseinfrastruktur |
| Discord | Beiträge in zwei privaten Kanälen unseres Discord-Servers. Der Moderationskanal erhält jede Vorlage, jede Bearbeitung und jedes Vorschaubild, die geprüft werden müssen: Der Beitrag zeigt die Vorlage (etwa Name, Beschreibung, Kategorie und Farbstoffe) und den Autorennamen oder, bei einem Vorschaubild, den Namen der Vorlage und das Bild, und er wird aktualisiert, wenn ein Moderator entscheidet. Sperrt dich ein Moderator, erhält der Moderationskanal außerdem einen Beitrag mit deinem Autorennamen, dem Grund und der Anzahl deiner ausgeblendeten Vorlagen. Moderatoren können im Moderationskanal auch die Liste der Vorlagen, die auf Prüfung warten, mit ihren Autorennamen posten. Der Einreichungsprotokoll-Kanal erhält jede ohne Prüfung veröffentlichte Vorlage mit ihrem Autorennamen sowie einen Hinweis, der die Vorlage nennt, wenn ein Moderator eine genehmigt, ablehnt oder zurücksetzt, mit dem Grund bei einer Ablehnung oder einem Zurücksetzen. Beiträge, die nach dem 2026-10-05 entstanden sind, zeigen nicht deine Discord-Benutzer-ID; Beiträge, die an diesem Tag oder davor entstanden sind, können sie zeigen | Discords Infrastruktur |

Alles außer diesen Discord-Beiträgen wird auf Cloudflares Infrastruktur gespeichert. Siehe
[Cloudflares Datenschutzrichtlinie](https://www.cloudflare.com/privacypolicy/) für weitere
Informationen. Die Discord-Beiträge bleiben in diesen Kanälen, unter der
[Datenschutzrichtlinie von Discord](https://discord.com/privacy), bis ein Moderator sie löscht oder bis du eine Löschung beantragst (siehe *Deine Rechte*).

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
| XIVAPI | FFXIV-Gegenstandsnamen für `/glamour` | [XIVAPI](https://xivapi.com/) |
| Perspective API | Inhaltsmoderation (optional) | [Google-Datenschutzrichtlinie](https://policies.google.com/privacy) |

Wir verkaufen, tauschen oder teilen deine personenbezogenen Daten nicht mit Drittanbietern zu
Marketingzwecken.

## 7. Deine Rechte

Du hast das Recht:

### Auf deine Daten zuzugreifen
- Verwende `/preferences show`, um deine gespeicherten Einstellungen anzusehen
- Verwende `/preset favorite list`, um deine favorisierten Vorlagen anzusehen
- Kontaktiere uns, um einen vollständigen Datenexport anzufordern

### Deine Daten zu löschen
- Verwende `/preferences reset`, um alle deine Einstellungen zurückzusetzen, oder
  `/preferences reset key:<preference>`, um nur eine zurückzusetzen
- Verwende `/preset favorite remove`, um eine favorisierte Vorlage zu entfernen
- Kontaktiere uns, um eine vollständige Datenlöschung anzufordern

Die Erstlauf-Hinweis-Markierung kann nicht von dir selbst verwaltet werden — sie läuft von selbst
nach 180 Tagen ab.

### Eine vollständige Datenlöschung anzufordern

Um die Löschung aller deiner Daten zu beantragen:

1. **E-Mail**: FlashGalatineFGC@gmail.com
   - Betreff: "XIV Dye Tools Privacy"
   - Gib deine Discord-Benutzer-ID an
2. **Discord**: Tritt https://discord.gg/rzxDHNr6Wv bei und schreibe "Flash Galatine" eine DM

Wir bearbeiten Löschanfragen innerhalb von 30 Tagen. Eine Löschanfrage entfernt außerdem die Beiträge über dich und deine Vorlagen von unserem Discord-Server, außer dem Beitrag zu einer noch aktiven Sperre. Ein aktiver Sperrdatensatz wird auf Anfrage nicht gelöscht; sobald die Sperre aufgehoben ist, richtet sich der Datensatz nach der Aufbewahrung unter *Datenaufbewahrung*.

## 8. Datenaufbewahrung

| Datentyp | Aufbewahrungszeitraum |
|-----------|-----------------|
| Ratenbegrenzungszähler | 60 Sekunden (120 Sekunden auf einer Bereitstellung ohne die nativen Rate-Limiting-Bindings) |
| Nutzungszähler (Cloudflare KV) | 30 Tage |
| Tägliche Aktivitätsschlüssel pro Nutzer (Cloudflare KV) | 30 Tage |
| Telemetrie zur Befehlsnutzung (Analytics Engine) | Aufbewahrungsfenster von Cloudflares Analytics Engine (zum Zeitpunkt der Erstellung 3 Monate) |
| Nutzereinstellungen | Bis vom Nutzer gelöscht |
| Favorisierte Vorlagen | Bis von dir entfernt |
| Erstlauf-Hinweis-Markierung | 180 Tage |
| Community-Vorlagen | Bis du sie löschst (Web-App → Meine Einreichungen) oder eine Löschung beantragst |
| Stimmen | Bis entfernt oder Kontolöschung; auch gelöscht, wenn die Vorlage gelöscht wird |
| Fehldatensätze zu Moderationsbenachrichtigungen (Vorlagen-ID, Fehler, Zeitstempel) | 30 Tage nach Lösung, 90 Tage bei ungelöst — sofort gelöscht, wenn die Vorlage gelöscht wird |
| Tägliche Zähler für Einreichungen / Bearbeitungen (Nutzer-ID, Art, Vorlagen-ID, Zeitstempel) | 30 Tage |
| Sperrdatensätze | Solange die Sperre aktiv ist. Wird sie aufgehoben, werden der Autorenname und der Grund sofort aus dem Datensatz gelöscht, und der Datensatz wird 90 Tage später gelöscht |
| Einträge im Moderationsprotokoll zu einer Sperre, einer Aufhebung einer Sperre, einem Ausblenden oder einem Wiederherstellen (diese behalten den Grund des Moderators) | 12 Monate oder, bei einem Ausblenden oder Wiederherstellen, früher, wenn die Vorlage gelöscht wird |
| Andere Einträge im Moderationsprotokoll zu einer Vorlage (etwa Genehmigen, Ablehnen oder Zurücksetzen) | Solange die Vorlage existiert |
| Beiträge im Moderationskanal und im Einreichungsprotokoll-Kanal auf unserem Discord-Server | Bis ein Moderator sie löscht oder bis du eine Löschung beantragst (der Beitrag zu einer noch aktiven Sperre bleibt bestehen) |

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
