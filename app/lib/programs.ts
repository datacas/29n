// Programas electorales descargables (PDF originales tal y como los publicó cada partido).
// Generado a partir de docs/programas/parties.json. Los archivos están en public/programas/.
export interface ProgramFile { name: string; slug: string; file: string; language: string; pages: number | null; sizeMB: number }

export const PROGRAMS: ProgramFile[] = [
  {
    "name": "Adelante Andalucía",
    "slug": "adelante-andalucia",
    "file": "programa-adelante-andalucia.pdf",
    "language": "es",
    "pages": 134,
    "sizeMB": 1.8
  },
  {
    "name": "BNG",
    "slug": "bng",
    "file": "programa-bng.pdf",
    "language": "gl",
    "pages": 91,
    "sizeMB": 1.3
  },
  {
    "name": "Coalición Canaria",
    "slug": "coalicion-canaria",
    "file": "programa-coalicion-canaria.pdf",
    "language": "es",
    "pages": 23,
    "sizeMB": 0.9
  },
  {
    "name": "Compromís",
    "slug": "compromis",
    "file": "programa-compromis.pdf",
    "language": "ca",
    "pages": 57,
    "sizeMB": 0.7
  },
  {
    "name": "Democracia21",
    "slug": "democracia21",
    "file": "programa-democracia21.pdf",
    "language": "es",
    "pages": 108,
    "sizeMB": 2.2
  },
  {
    "name": "EH Bildu",
    "slug": "eh-bildu",
    "file": "programa-eh-bildu.pdf",
    "language": "es",
    "pages": 30,
    "sizeMB": 0.5
  },
  {
    "name": "ERC",
    "slug": "erc",
    "file": "programa-erc.pdf",
    "language": "ca",
    "pages": 48,
    "sizeMB": 0.3
  },
  {
    "name": "FE de las JONS",
    "slug": "fe-de-las-jons",
    "file": "programa-fe-de-las-jons.pdf",
    "language": "es",
    "pages": 60,
    "sizeMB": 1.6
  },
  {
    "name": "Frente Amplio",
    "slug": "frente-amplio",
    "file": "programa-frente-amplio.pdf",
    "language": "es",
    "pages": 151,
    "sizeMB": 1.1
  },
  {
    "name": "Frente Obrero",
    "slug": "frente-obrero",
    "file": "programa-frente-obrero.pdf",
    "language": "es",
    "pages": 64,
    "sizeMB": 1.1
  },
  {
    "name": "PACMA",
    "slug": "pacma",
    "file": "programa-pacma.pdf",
    "language": "es",
    "pages": 82,
    "sizeMB": 1.1
  },
  {
    "name": "Partido Autónomos",
    "slug": "partido-autonomos",
    "file": "programa-partido-autonomos.pdf",
    "language": "es",
    "pages": 15,
    "sizeMB": 0.2
  },
  {
    "name": "PCTE",
    "slug": "pcte",
    "file": "programa-pcte.pdf",
    "language": "es",
    "pages": 24,
    "sizeMB": 2.4
  },
  {
    "name": "PNV",
    "slug": "pnv",
    "file": "programa-pnv.pdf",
    "language": "es",
    "pages": 43,
    "sizeMB": 0.5
  },
  {
    "name": "PP",
    "slug": "pp",
    "file": "programa-pp.pdf",
    "language": "es",
    "pages": 64,
    "sizeMB": 5.1
  },
  {
    "name": "PSOE",
    "slug": "psoe",
    "file": "programa-psoe.pdf",
    "language": "es",
    "pages": 114,
    "sizeMB": 7.6
  },
  {
    "name": "SALF",
    "slug": "salf",
    "file": "programa-salf.pdf",
    "language": "es",
    "pages": 40,
    "sizeMB": 0.7
  },
  {
    "name": "Sumar",
    "slug": "sumar",
    "file": "programa-sumar.pdf",
    "language": "es",
    "pages": 95,
    "sizeMB": 2.0
  },
  {
    "name": "Vox",
    "slug": "vox",
    "file": "programa-vox.pdf",
    "language": "es",
    "pages": 66,
    "sizeMB": 2.4
  }
]

const LANG: Record<string, string> = { es: 'Castellano', ca: 'Catalán', gl: 'Gallego', va: 'Valenciano', eu: 'Euskera' }
export const languageName = (code: string) => LANG[code] ?? code

export function programFor(partyName: string): ProgramFile | undefined {
  return PROGRAMS.find((p) => p.name === partyName)
}

/** Enlace al PDF original, abierto en la página de la cita cuando se conoce. */
export function programUrl(partyName: string, page?: number | null): string | null {
  const p = programFor(partyName)
  if (!p) return null
  return `/programas/${p.file}${page ? `#page=${page}` : ''}`
}
