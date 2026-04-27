#!/usr/bin/env node
/**
 * Generate a handful of distinct sample PDFs into ../demo/input/.
 * Run from scanlike-cli/: node scripts/make-demo-samples.mjs
 */
import { writeFile, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = join(__dirname, '..', '..', 'demo', 'input')
await mkdir(OUT, { recursive: true })

// US Letter @ 72 dpi
const PAGE = { w: 612, h: 792 }

async function letter() {
  const doc = await PDFDocument.create()
  const helv = await doc.embedFont(StandardFonts.Helvetica)
  const helvB = await doc.embedFont(StandardFonts.HelveticaBold)
  const page = doc.addPage([PAGE.w, PAGE.h])

  page.drawText('Anna Beispielfrau', { x: 50, y: 740, size: 14, font: helvB })
  page.drawText('Musterstraße 12 · 10115 Berlin', { x: 50, y: 724, size: 10, font: helv })
  page.drawText('27. April 2026', { x: 50, y: 680, size: 10, font: helv })

  page.drawText('Musterfirma AG', { x: 50, y: 640, size: 10, font: helv })
  page.drawText('Personalabteilung', { x: 50, y: 626, size: 10, font: helv })
  page.drawText('Beispielallee 1', { x: 50, y: 612, size: 10, font: helv })
  page.drawText('20095 Hamburg', { x: 50, y: 598, size: 10, font: helv })

  page.drawText('Bewerbung als Softwareentwicklerin', { x: 50, y: 550, size: 12, font: helvB })

  const body = [
    'Sehr geehrte Damen und Herren,',
    '',
    'mit großem Interesse habe ich Ihre Stellenausschreibung gelesen und möchte mich',
    'hiermit auf die Position der Softwareentwicklerin bewerben. Mein Profil passt aus',
    'meiner Sicht gut zu den von Ihnen beschriebenen Anforderungen.',
    '',
    'Während meiner bisherigen Tätigkeit habe ich an Backend-Systemen mit TypeScript',
    'und Node.js gearbeitet, sowie an Datenbank-Migrationen und CI/CD-Pipelines.',
    'Besonders reizt mich an Ihrem Unternehmen die Möglichkeit, Verantwortung für',
    'eigene Module zu übernehmen.',
    '',
    'Über die Einladung zu einem persönlichen Gespräch würde ich mich sehr freuen.',
    '',
    'Mit freundlichen Grüßen',
    '',
    'Anna Beispielfrau',
  ]
  let y = 510
  for (const line of body) {
    page.drawText(line, { x: 50, y, size: 11, font: helv })
    y -= 16
  }
  await writeFile(join(OUT, '01-letter.pdf'), await doc.save())
}

async function invoice() {
  const doc = await PDFDocument.create()
  const helv = await doc.embedFont(StandardFonts.Helvetica)
  const helvB = await doc.embedFont(StandardFonts.HelveticaBold)
  const page = doc.addPage([PAGE.w, PAGE.h])

  page.drawText('Musterhandel GmbH', { x: 50, y: 750, size: 16, font: helvB })
  page.drawText('Industriestraße 8 · 50667 Köln · USt-IdNr. DE123456789', {
    x: 50, y: 732, size: 9, font: helv,
  })

  page.drawText('RECHNUNG', { x: 50, y: 680, size: 22, font: helvB })
  page.drawText('Rechnungsnummer:  R-2026-04-0142', { x: 50, y: 650, size: 11, font: helv })
  page.drawText('Rechnungsdatum:   27.04.2026', { x: 50, y: 634, size: 11, font: helv })
  page.drawText('Leistungszeitraum: 01.04.–30.04.2026', { x: 50, y: 618, size: 11, font: helv })

  page.drawText('Kunde:  Beispiel & Partner KG, Hamburg', { x: 50, y: 580, size: 11, font: helv })

  // Table
  let y = 530
  page.drawLine({ start: { x: 50, y }, end: { x: 562, y }, thickness: 0.7, color: rgb(0, 0, 0) })
  y -= 18
  page.drawText('Pos', { x: 55, y, size: 10, font: helvB })
  page.drawText('Beschreibung', { x: 95, y, size: 10, font: helvB })
  page.drawText('Menge', { x: 360, y, size: 10, font: helvB })
  page.drawText('Einzel', { x: 420, y, size: 10, font: helvB })
  page.drawText('Summe', { x: 500, y, size: 10, font: helvB })
  y -= 6
  page.drawLine({ start: { x: 50, y }, end: { x: 562, y }, thickness: 0.5, color: rgb(0, 0, 0) })

  const rows = [
    ['1', 'Beratungsleistung Softwarearchitektur', '12 h', '120,00 €', '1.440,00 €'],
    ['2', 'Implementierung Auth-Modul', '24 h', '110,00 €', '2.640,00 €'],
    ['3', 'Code-Review & Dokumentation', '6 h', '110,00 €', '660,00 €'],
    ['4', 'Reisekosten (pauschal)', '1', '180,00 €', '180,00 €'],
  ]
  for (const r of rows) {
    y -= 18
    page.drawText(r[0], { x: 55, y, size: 10, font: helv })
    page.drawText(r[1], { x: 95, y, size: 10, font: helv })
    page.drawText(r[2], { x: 360, y, size: 10, font: helv })
    page.drawText(r[3], { x: 420, y, size: 10, font: helv })
    page.drawText(r[4], { x: 500, y, size: 10, font: helv })
  }

  y -= 24
  page.drawLine({ start: { x: 350, y }, end: { x: 562, y }, thickness: 0.5, color: rgb(0, 0, 0) })
  y -= 16
  page.drawText('Zwischensumme', { x: 360, y, size: 10, font: helv })
  page.drawText('4.920,00 €', { x: 500, y, size: 10, font: helv })
  y -= 14
  page.drawText('zzgl. 19% USt.', { x: 360, y, size: 10, font: helv })
  page.drawText('934,80 €', { x: 500, y, size: 10, font: helv })
  y -= 6
  page.drawLine({ start: { x: 350, y }, end: { x: 562, y }, thickness: 0.7, color: rgb(0, 0, 0) })
  y -= 16
  page.drawText('Gesamtbetrag', { x: 360, y, size: 12, font: helvB })
  page.drawText('5.854,80 €', { x: 500, y, size: 12, font: helvB })

  page.drawText('Bitte überweisen Sie den Betrag innerhalb von 14 Tagen auf das unten genannte Konto.',
    { x: 50, y: 200, size: 10, font: helv })
  page.drawText('IBAN: DE89 3704 0044 0532 0130 00 · BIC: COBADEFFXXX · Commerzbank Köln',
    { x: 50, y: 184, size: 10, font: helv })

  await writeFile(join(OUT, '02-invoice.pdf'), await doc.save())
}

async function multipageReport() {
  const doc = await PDFDocument.create()
  const helv = await doc.embedFont(StandardFonts.Helvetica)
  const helvB = await doc.embedFont(StandardFonts.HelveticaBold)

  const sections = [
    {
      title: 'Quartalsbericht Q1 2026',
      heading: '1. Zusammenfassung',
      paragraphs: [
        'Im ersten Quartal 2026 hat das Unternehmen ein solides Wachstum verzeichnet.',
        'Der Umsatz stieg im Vergleich zum Vorjahresquartal um 14,2 Prozent auf 8,4 Mio. EUR.',
        'Die operative Marge verbesserte sich von 11,8 auf 13,5 Prozent.',
        '',
        'Wesentliche Treiber waren die Einführung des neuen Cloud-Produkts sowie die',
        'Stabilisierung der Lieferketten nach den Verzögerungen im Vorjahr.',
      ],
    },
    {
      title: 'Quartalsbericht Q1 2026',
      heading: '2. Geschäftsentwicklung',
      paragraphs: [
        'Die Region DACH bleibt mit 62 Prozent Umsatzanteil das stärkste Marktsegment.',
        'In Südeuropa wurden zwei neue Vertriebspartnerschaften abgeschlossen.',
        'Der Auftragsbestand zum Quartalsende lag bei 11,2 Mio. EUR (Vorquartal: 9,7 Mio.).',
        '',
        'Die Kundenfluktuation ist mit 2,1 Prozent annualisiert weiter rückläufig.',
        'Wir führen dies auf die verbesserte Onboarding-Strecke seit Oktober zurück.',
      ],
    },
    {
      title: 'Quartalsbericht Q1 2026',
      heading: '3. Ausblick',
      paragraphs: [
        'Für Q2 erwarten wir eine Fortsetzung des Wachstumstrends mit moderater Beschleunigung.',
        'Geplante Investitionen in Höhe von 1,2 Mio. EUR fließen primär in den Ausbau der',
        'Plattform-Infrastruktur und in zusätzliche Engineering-Kapazität.',
        '',
        'Die Jahresprognose wird bestätigt: Umsatz 35–37 Mio. EUR, operative Marge 13–15 Prozent.',
      ],
    },
  ]

  for (let i = 0; i < sections.length; i++) {
    const s = sections[i]
    const page = doc.addPage([PAGE.w, PAGE.h])
    page.drawText(s.title, { x: 50, y: 750, size: 10, font: helv, color: rgb(0.4, 0.4, 0.4) })
    page.drawLine({ start: { x: 50, y: 738 }, end: { x: 562, y: 738 }, thickness: 0.4, color: rgb(0.6, 0.6, 0.6) })
    page.drawText(s.heading, { x: 50, y: 700, size: 18, font: helvB })
    let y = 660
    for (const line of s.paragraphs) {
      page.drawText(line, { x: 50, y, size: 12, font: helv })
      y -= 18
    }
    page.drawText(`Seite ${i + 1} von ${sections.length}`, {
      x: 50, y: 50, size: 9, font: helv, color: rgb(0.4, 0.4, 0.4),
    })
  }

  await writeFile(join(OUT, '03-report-3pages.pdf'), await doc.save())
}

async function technicalNote() {
  const doc = await PDFDocument.create()
  const helv = await doc.embedFont(StandardFonts.Helvetica)
  const helvB = await doc.embedFont(StandardFonts.HelveticaBold)
  const mono = await doc.embedFont(StandardFonts.Courier)
  const page = doc.addPage([PAGE.w, PAGE.h])

  page.drawText('Technisches Memo', { x: 50, y: 750, size: 18, font: helvB })
  page.drawText('Migration Postgres 14 -> 16', { x: 50, y: 728, size: 13, font: helv })
  page.drawLine({ start: { x: 50, y: 718 }, end: { x: 562, y: 718 }, thickness: 0.5, color: rgb(0, 0, 0) })

  const intro = [
    'Dieses Memo beschreibt die geplante Migration der Produktionsdatenbank von',
    'Postgres 14 auf 16. Es richtet sich an das Plattform-Team und ist als',
    'Vorbereitung für das Wartungsfenster am 03.05.2026 gedacht.',
  ]
  let y = 690
  for (const l of intro) {
    page.drawText(l, { x: 50, y, size: 11, font: helv })
    y -= 16
  }

  y -= 14
  page.drawText('Schritte', { x: 50, y, size: 13, font: helvB })
  y -= 18
  page.drawText('1. pg_dump der gesamten DB in das Backup-Volume.', { x: 60, y, size: 11, font: helv }); y -= 16
  page.drawText('2. Rolling Replica hochfahren mit Postgres 16.', { x: 60, y, size: 11, font: helv }); y -= 16
  page.drawText('3. Logical Replication aktivieren und Catch-up abwarten.', { x: 60, y, size: 11, font: helv }); y -= 16
  page.drawText('4. Promote des Replicas, alte Primary stoppen.', { x: 60, y, size: 11, font: helv }); y -= 16

  y -= 18
  page.drawText('Beispiel-Kommandos', { x: 50, y, size: 13, font: helvB })
  y -= 14
  page.drawRectangle({
    x: 50, y: y - 90, width: 512, height: 100,
    color: rgb(0.95, 0.95, 0.95),
  })
  y -= 14
  const cmds = [
    '$ pg_dump -Fc -j 4 -f /backup/prod-pre-upgrade.dump prod',
    '$ pg_basebackup -D /var/lib/pg16 -h primary -U replicator -P -X stream',
    '$ psql -c "SELECT pg_create_logical_replication_slot(\'upgrade\', \'pgoutput\');"',
    '$ psql -c "ALTER SUBSCRIPTION upgrade ENABLE;"',
    '$ pg_ctl promote -D /var/lib/pg16',
  ]
  for (const c of cmds) {
    page.drawText(c, { x: 60, y, size: 9, font: mono })
    y -= 14
  }

  y -= 30
  page.drawText('Rollback', { x: 50, y, size: 13, font: helvB })
  y -= 16
  const rollback = [
    'Im Falle von Replikations-Inkonsistenzen wird der ursprüngliche Primary innerhalb',
    'von 5 Minuten reaktiviert. Die Subscription wird gelöscht, der DNS-Eintrag',
    'zurückgesetzt. Erwartete Downtime im Rollback-Fall: < 90 Sekunden.',
  ]
  for (const l of rollback) {
    page.drawText(l, { x: 50, y, size: 11, font: helv })
    y -= 16
  }

  await writeFile(join(OUT, '04-tech-memo.pdf'), await doc.save())
}

await letter()
await invoice()
await multipageReport()
await technicalNote()
console.log('wrote 4 sample PDFs into', OUT)
